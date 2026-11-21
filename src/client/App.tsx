import {
  Activity,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FlaskConical,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  UserCircle2,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import {
  CreateOpportunityInput,
  DashboardPayload,
  EffortLevel,
  Opportunity,
  OpportunityStatus,
  ReachLevel,
  UpdateOpportunityInput,
  User,
  effortLevels,
  reachLevels,
  statusOrder
} from "../shared/types";

const statusLabels: Record<OpportunityStatus, string> = {
  captured: "Captured",
  scored: "Scored",
  in_progress: "In Progress",
  validated: "Validated",
  backlog: "Backlog"
};

const statusTone: Record<OpportunityStatus, string> = {
  captured: "neutral",
  scored: "blue",
  in_progress: "amber",
  validated: "green",
  backlog: "muted"
};

const nextStatus: Partial<Record<OpportunityStatus, OpportunityStatus>> = {
  captured: "scored",
  scored: "in_progress",
  in_progress: "validated",
  backlog: "captured"
};

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OpportunityStatus | "">("");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const loadDashboard = useCallback(() => {
    if (!user) return;
    api
      .dashboard({ query, status })
      .then((payload) => {
        setDashboard(payload);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [query, status, user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleLogout() {
    await api.logout();
    setUser(null);
    setDashboard(null);
  }

  async function handleCreate(input: CreateOpportunityInput) {
    await api.createOpportunity(input);
    setModalOpen(false);
    loadDashboard();
  }

  async function handleUpdate(id: string, input: UpdateOpportunityInput) {
    await api.updateOpportunity(id, input);
    setSelected(null);
    loadDashboard();
  }

  async function handleDelete(id: string) {
    await api.deleteOpportunity(id);
    setSelected(null);
    loadDashboard();
  }

  async function handleMove(opportunity: Opportunity) {
    const status = nextStatus[opportunity.status];
    if (!status) return;
    await api.updateOpportunity(opportunity.id, { status });
    loadDashboard();
  }

  if (authLoading) {
    return <div className="loading-screen">Preparing SignalStack...</div>;
  }

  if (!user) {
    return <LoginScreen onSignedIn={setUser} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>SignalStack</span>
        </div>

        <nav className="nav-list">
          {[
            ["Dashboard", LayoutDashboard],
            ["Opportunities", BriefcaseBusiness],
            ["Experiments", FlaskConical],
            ["Settings", Settings]
          ].map(([label, Icon]) => (
            <button
              className={cx("nav-item", activeNav === label && "active")}
              key={label as string}
              onClick={() => setActiveNav(label as string)}
            >
              <Icon size={18} />
              <span>{label as string}</span>
            </button>
          ))}
        </nav>

        <div className="workspace-card">
          <span>Demo Workspace</span>
          <strong>Portfolio Plan</strong>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search opportunities, customers, tags..."
            />
          </label>

          <div className="topbar-actions">
            <button className="workspace-button">
              <KanbanSquare size={17} />
              Demo Workspace
            </button>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button className="user-button" onClick={handleLogout}>
              <UserCircle2 size={22} />
              <span>{user.name}</span>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <section className="content">
          <div className="page-heading">
            <div>
              <h1>{activeNav}</h1>
              <p>{activeNav === "Dashboard" ? "Portfolio overview and operational snapshot" : "Manage the same live data through a focused workspace view"}</p>
            </div>
            <div className="heading-actions">
              <label className="filter-select">
                <SlidersHorizontal size={16} />
                <select value={status} onChange={(event) => setStatus(event.target.value as OpportunityStatus | "")}>
                  <option value="">All stages</option>
                  {statusOrder.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <a
                className="secondary-button"
                href={api.exportUrl("csv", { query, status })}
                download="signalstack-opportunities.csv"
              >
                <Download size={16} />
                Export CSV
              </a>
              <button className="primary-button" onClick={() => setModalOpen(true)}>
                <Plus size={18} />
                Create Opportunity
              </button>
            </div>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          {activeNav === "Dashboard" && dashboard ? (
            <DashboardView
              data={dashboard}
              selected={selected}
              onSelect={setSelected}
              onMove={handleMove}
              onCreateOpen={() => setModalOpen(true)}
            />
          ) : null}
          {activeNav === "Opportunities" && dashboard ? (
            <OpportunityList data={dashboard} onSelect={setSelected} onMove={handleMove} />
          ) : null}
          {activeNav === "Experiments" && dashboard ? <ExperimentsView data={dashboard} /> : null}
          {activeNav === "Settings" ? <SettingsView user={user} /> : null}
        </section>
      </main>

      {modalOpen ? (
        <OpportunityModal onClose={() => setModalOpen(false)} onSubmit={handleCreate} user={user} />
      ) : null}
      {selected ? (
        <OpportunityModal
          initial={selected}
          onClose={() => setSelected(null)}
          onSubmit={(input) => handleUpdate(selected.id, input)}
          onDelete={() => handleDelete(selected.id)}
          user={user}
        />
      ) : null}
    </div>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("Alex Builder");
  const [email, setEmail] = useState("demo@signalstack.dev");
  const [password, setPassword] = useState("builder-demo");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(name, email, password);
      onSignedIn(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Sign in">
        <div className="brand large">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>SignalStack</span>
        </div>
        <h1>Turn product bets into a ranked execution pipeline.</h1>
        <p>
          A full-stack demo workspace with session auth, SQLite persistence, scoring logic,
          workflow movement, and live portfolio metrics.
        </p>
        <form onSubmit={submit} className="login-form">
          <div className="segmented">
            <button type="button" className={cx(mode === "login" && "active")} onClick={() => setMode("login")}>
              Sign in
            </button>
            <button type="button" className={cx(mode === "register" && "active")} onClick={() => setMode("register")}>
              Create account
            </button>
          </div>
          {mode === "register" ? (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          ) : null}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button className="primary-button full" disabled={submitting}>
            {submitting ? "Signing in..." : mode === "login" ? "Open demo workspace" : "Create workspace"}
          </button>
        </form>
      </section>
      <section className="login-preview" aria-hidden="true">
        <div className="preview-strip">
          <span>42 opportunities</span>
          <span>68 avg score</span>
          <span>$2.4M expected impact</span>
        </div>
        <div className="preview-board">
          <div />
          <div />
          <div />
        </div>
      </section>
    </main>
  );
}

function DashboardView({
  data,
  selected,
  onSelect,
  onMove,
  onCreateOpen
}: {
  data: DashboardPayload;
  selected: Opportunity | null;
  onSelect: (opportunity: Opportunity) => void;
  onMove: (opportunity: Opportunity) => void;
  onCreateOpen: () => void;
}) {
  const topOpportunities = data.opportunities.slice(0, 6);
  const activeSelection = selected ?? data.recommendation.opportunity ?? topOpportunities[0] ?? null;

  return (
    <div className="dashboard-grid">
      <section className="metric-row" aria-label="Portfolio metrics">
        <MetricCard title="Total Opportunities" value={data.metrics.totalOpportunities.toString()} delta="+12%" icon={Gauge} tone="teal" />
        <MetricCard title="Weighted Score Avg" value={data.metrics.averageScore.toString()} delta="+5" icon={Target} tone="blue" />
        <MetricCard title="In Progress" value={data.metrics.inProgress.toString()} delta="+2" icon={Clock3} tone="amber" />
        <MetricCard title="Validated 30d" value={data.metrics.validated30d.toString()} delta="+50%" icon={CheckCircle2} tone="coral" />
        <MetricCard title="Expected Impact" value={formatCurrency(data.metrics.expectedImpact)} delta="+18%" icon={CircleDollarSign} tone="blue" />
      </section>

      <section className="panel pipeline-panel">
        <div className="panel-heading">
          <h2>Opportunity Pipeline</h2>
          <span>Group by: Stage</span>
        </div>
        <div className="pipeline-columns">
          {data.pipeline.map((stage) => (
            <div className="pipeline-column" key={stage.status}>
              <div className="stage-heading">
                <span className={cx("status-dot", statusTone[stage.status])} />
                <strong>{stage.label}</strong>
                <span>{stage.count}</span>
              </div>
              <div className="opportunity-cards">
                {stage.opportunities.map((opportunity) => (
                  <button className="opportunity-card" key={opportunity.id} onClick={() => onSelect(opportunity)}>
                    <span className="drag-handle">::</span>
                    <strong>{opportunity.title}</strong>
                    <span>Score: {opportunity.score}</span>
                  </button>
                ))}
                <button className="add-inline" type="button" onClick={onCreateOpen}>
                  <Plus size={14} />
                  Add opportunity
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="side-stack">
        <ActivityPanel activities={data.activities} />
        <RecommendationPanel recommendation={data.recommendation} onSelect={onSelect} selected={activeSelection} />
      </aside>

      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Priority Scoring</h2>
          <span>Sorted by score</span>
        </div>
        <OpportunityTable opportunities={topOpportunities} onSelect={onSelect} onMove={onMove} />
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  delta,
  icon: Icon,
  tone
}: {
  title: string;
  value: string;
  delta: string;
  icon: typeof Gauge;
  tone: "teal" | "blue" | "amber" | "coral";
}) {
  return (
    <article className="metric-card">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{delta} vs last 30 days</small>
      </div>
      <span className={cx("metric-icon", tone)}>
        <Icon size={20} />
      </span>
    </article>
  );
}

function OpportunityTable({
  opportunities,
  onSelect,
  onMove
}: {
  opportunities: Opportunity[];
  onSelect: (opportunity: Opportunity) => void;
  onMove: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Opportunity</th>
            <th>Score</th>
            <th>Impact</th>
            <th>Confidence</th>
            <th>Effort</th>
            <th>Reach</th>
            <th>Owner</th>
            <th>Updated</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opportunity) => (
            <tr key={opportunity.id}>
              <td>
                <button className="table-link" onClick={() => onSelect(opportunity)}>
                  {opportunity.title}
                </button>
              </td>
              <td>
                <span className="score-pill">{opportunity.score}</span>
              </td>
              <td>{formatCurrency(opportunity.impact)}</td>
              <td>{opportunity.confidence}%</td>
              <td>{opportunity.effort}</td>
              <td>{opportunity.reach}</td>
              <td>{opportunity.owner}</td>
              <td>{timeAgo(opportunity.updatedAt)}</td>
              <td>
                {nextStatus[opportunity.status] ? (
                  <button className="mini-button" onClick={() => onMove(opportunity)}>
                    Move
                  </button>
                ) : (
                  <button className="icon-button quiet" onClick={() => onSelect(opportunity)} aria-label="Open opportunity">
                    <MoreHorizontal size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityPanel({ activities }: { activities: DashboardPayload["activities"] }) {
  const iconForType = {
    captured: Plus,
    scored: Gauge,
    moved: ArrowUpRight,
    validated: CheckCircle2,
    experiment: FlaskConical,
    note: Activity
  };

  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <h2>Recent Activity</h2>
        <button>View all</button>
      </div>
      <div className="activity-list">
        {activities.map((item) => {
          const Icon = iconForType[item.type];
          return (
            <div className="activity-item" key={item.id}>
              <span className={cx("activity-icon", item.type)}>
                <Icon size={15} />
              </span>
              <div>
                <strong>{item.message}</strong>
                <span>
                  {timeAgo(item.createdAt)} by {item.actor}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecommendationPanel({
  recommendation,
  onSelect,
  selected
}: {
  recommendation: DashboardPayload["recommendation"];
  selected: Opportunity | null;
  onSelect: (opportunity: Opportunity) => void;
}) {
  const opportunity = recommendation.opportunity ?? selected;
  return (
    <section className="recommendation-panel">
      <h2>Recommended Next Action</h2>
      <div className="recommendation-title">
        <Sparkles size={17} />
        <strong>{recommendation.nextAction}</strong>
      </div>
      <p>{recommendation.reason}</p>
      {opportunity ? (
        <dl className="detail-list">
          <div>
            <dt>Score</dt>
            <dd>{opportunity.score}/100</dd>
          </div>
          <div>
            <dt>Impact</dt>
            <dd>{formatCurrency(opportunity.impact)}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{opportunity.confidence}%</dd>
          </div>
        </dl>
      ) : null}
      {opportunity ? (
        <button className="primary-button full" onClick={() => onSelect(opportunity)}>
          View Opportunity
        </button>
      ) : null}
    </section>
  );
}

function OpportunityList({
  data,
  onSelect,
  onMove
}: {
  data: DashboardPayload;
  onSelect: (opportunity: Opportunity) => void;
  onMove: (opportunity: Opportunity) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>All Opportunities</h2>
        <span>{data.opportunities.length} visible</span>
      </div>
      <OpportunityTable opportunities={data.opportunities} onSelect={onSelect} onMove={onMove} />
    </section>
  );
}

function ExperimentsView({ data }: { data: DashboardPayload }) {
  return (
    <section className="experiments-grid">
      {data.experiments.map((experiment) => (
        <article className="panel experiment-card" key={experiment.id}>
          <span className={cx("experiment-status", experiment.status)}>{experiment.status}</span>
          <h2>{experiment.name}</h2>
          <p>{experiment.hypothesis}</p>
          <dl className="detail-list">
            <div>
              <dt>Metric</dt>
              <dd>{experiment.metric}</dd>
            </div>
            <div>
              <dt>Confidence delta</dt>
              <dd>+{experiment.confidenceDelta}%</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}

function SettingsView({ user }: { user: User }) {
  return (
    <section className="settings-grid">
      <article className="panel settings-card">
        <h2>Workspace</h2>
        <dl className="detail-list">
          <div>
            <dt>Name</dt>
            <dd>Demo Workspace</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Persistence</dt>
            <dd>SQLite database</dd>
          </div>
        </dl>
      </article>
      <article className="panel settings-card">
        <h2>Engineering Notes</h2>
        <p>
          The app ships with session authentication, API validation, server-side scoring,
          seeded demo data, and integration tests.
        </p>
      </article>
    </section>
  );
}

function OpportunityModal({
  initial,
  onClose,
  onSubmit,
  onDelete,
  user
}: {
  initial?: Opportunity;
  onClose: () => void;
  onSubmit: (input: CreateOpportunityInput & { status?: OpportunityStatus }) => Promise<void>;
  onDelete?: () => Promise<void>;
  user: User;
}) {
  const isEditing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "Customer health risk alerts");
  const [customer, setCustomer] = useState(initial?.customer ?? "Customer success teams");
  const [problem, setProblem] = useState(
    initial?.problem ?? "Account teams do not see adoption risk until renewal conversations are already at risk."
  );
  const [status, setStatus] = useState<OpportunityStatus>(initial?.status ?? "captured");
  const [impact, setImpact] = useState(initial?.impact ?? 280000);
  const [confidence, setConfidence] = useState(initial?.confidence ?? 64);
  const [effort, setEffort] = useState<EffortLevel>(initial?.effort ?? "M");
  const [reach, setReach] = useState<ReachLevel>(initial?.reach ?? "High");
  const [owner, setOwner] = useState(initial?.owner ?? user.name);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "2026-07-15");
  const [tags, setTags] = useState(initial ? initial.tags.join(", ") : "Retention, Analytics");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
    [tags]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title,
        customer,
        problem,
        ...(isEditing ? { status } : {}),
        impact,
        confidence,
        effort,
        reach,
        owner,
        dueDate: dueDate || null,
        tags: parsedTags
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditing ? "Could not update opportunity" : "Could not create opportunity");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmAndDelete() {
    if (!onDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete opportunity");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="modal-heading">
          <div>
            <h2 id="create-title">{isEditing ? "Edit Opportunity" : "Create Opportunity"}</h2>
            <p>
              {isEditing
                ? `Score: ${initial?.score}/100 — update fields, change stage, or remove from pipeline.`
                : "Score a product bet and add it to the live pipeline."}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="opportunity-form" onSubmit={submit}>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Customer
            <input value={customer} onChange={(event) => setCustomer(event.target.value)} />
          </label>
          <label className="span-2">
            Problem
            <textarea value={problem} onChange={(event) => setProblem(event.target.value)} rows={3} />
          </label>
          {isEditing ? (
            <label className="span-2">
              Stage
              <select value={status} onChange={(event) => setStatus(event.target.value as OpportunityStatus)}>
                {statusOrder.map((stage) => (
                  <option key={stage} value={stage}>
                    {statusLabels[stage]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Expected impact
            <input value={impact} onChange={(event) => setImpact(Number(event.target.value))} type="number" min={1000} />
          </label>
          <label>
            Confidence
            <input value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} type="number" min={1} max={100} />
          </label>
          <label>
            Effort
            <select value={effort} onChange={(event) => setEffort(event.target.value as EffortLevel)}>
              {effortLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            Reach
            <select value={reach} onChange={(event) => setReach(event.target.value as ReachLevel)}>
              {reachLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            Owner
            <input value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>
          <label>
            Due date
            <input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" />
          </label>
          <label className="span-2">
            Tags
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          {error ? <div className="error-banner span-2">{error}</div> : null}
          <div className="form-actions span-2">
            {isEditing && onDelete ? (
              confirmDelete ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={confirmAndDelete}
                >
                  <Trash2 size={15} />
                  Confirm delete
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              )
            ) : null}
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={submitting}>
              {submitting ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Opportunity"}
              <ChevronRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

