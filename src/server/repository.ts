import { nanoid } from "nanoid";
import type {
  ActivityItem,
  CreateOpportunityInput,
  DashboardMetrics,
  EffortLevel,
  Experiment,
  Opportunity,
  OpportunityStatus,
  ReachLevel,
  UpdateOpportunityInput,
  User
} from "../shared/types.js";
import { statusOrder } from "../shared/types.js";
import { calculateScore, statusLabels } from "./scoring.js";
import type { SignalStackDb } from "./database.js";

interface OpportunityRow {
  id: string;
  title: string;
  customer: string;
  problem: string;
  status: OpportunityStatus;
  impact: number;
  confidence: number;
  effort: EffortLevel;
  reach: ReachLevel;
  score: number;
  owner: string;
  due_date: string | null;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

interface ActivityRow {
  id: string;
  opportunity_id: string | null;
  type: ActivityItem["type"];
  message: string;
  actor: string;
  created_at: string;
}

interface ExperimentRow {
  id: string;
  opportunity_id: string;
  name: string;
  hypothesis: string;
  metric: string;
  status: Experiment["status"];
  confidence_delta: number;
  started_at: string;
  ended_at: string | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash?: string;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

export function mapOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    title: row.title,
    customer: row.customer,
    problem: row.problem,
    status: row.status,
    impact: row.impact,
    confidence: row.confidence,
    effort: row.effort,
    reach: row.reach,
    score: row.score,
    owner: row.owner,
    dueDate: row.due_date,
    tags: JSON.parse(row.tags_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapActivity(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    type: row.type,
    message: row.message,
    actor: row.actor,
    createdAt: row.created_at
  };
}

export function mapExperiment(row: ExperimentRow): Experiment {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    name: row.name,
    hypothesis: row.hypothesis,
    metric: row.metric,
    status: row.status,
    confidenceDelta: row.confidence_delta,
    startedAt: row.started_at,
    endedAt: row.ended_at
  };
}

export function findUserByEmail(db: SignalStackDb, email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as (UserRow & { password_hash: string }) | undefined;
}

export function findUserBySession(db: SignalStackDb, token: string) {
  const row = db
    .prepare(
      `SELECT users.id, users.name, users.email, users.role
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createSession(db: SignalStackDb, userId: string) {
  const token = nanoid(48);
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    expires.toISOString(),
    now
  );
  return { token, expiresAt: expires };
}

export function deleteSession(db: SignalStackDb, token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function createUser(db: SignalStackDb, input: { name: string; email: string; passwordHash: string }) {
  const user = {
    id: nanoid(),
    name: input.name,
    email: input.email,
    role: "Builder",
    createdAt: new Date().toISOString()
  };
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    user.id,
    user.name,
    user.email,
    input.passwordHash,
    user.role,
    user.createdAt
  );
  return mapUser(user);
}

export function listOpportunities(db: SignalStackDb, filters: { query?: string; status?: OpportunityStatus } = {}) {
  const rows = db.prepare("SELECT * FROM opportunities ORDER BY score DESC, updated_at DESC").all() as unknown as OpportunityRow[];
  return rows.map(mapOpportunity).filter((opportunity) => {
    const query = filters.query?.trim().toLowerCase();
    const queryMatches =
      !query ||
      [opportunity.title, opportunity.customer, opportunity.problem, opportunity.owner, ...opportunity.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    const statusMatches = !filters.status || opportunity.status === filters.status;
    return queryMatches && statusMatches;
  });
}

export function getOpportunity(db: SignalStackDb, id: string) {
  const row = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(id) as OpportunityRow | undefined;
  return row ? mapOpportunity(row) : null;
}

export function createOpportunity(db: SignalStackDb, input: CreateOpportunityInput, user: User) {
  const now = new Date().toISOString();
  const opportunity = {
    ...input,
    id: nanoid(),
    status: "captured" as OpportunityStatus,
    score: calculateScore(input),
    dueDate: input.dueDate ?? null,
    createdAt: now,
    updatedAt: now
  };

  db.prepare(
    `INSERT INTO opportunities (
      id, title, customer, problem, status, impact, confidence, effort, reach, score, owner,
      due_date, tags_json, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opportunity.id,
    opportunity.title,
    opportunity.customer,
    opportunity.problem,
    opportunity.status,
    opportunity.impact,
    opportunity.confidence,
    opportunity.effort,
    opportunity.reach,
    opportunity.score,
    opportunity.owner,
    opportunity.dueDate,
    JSON.stringify(opportunity.tags),
    user.id,
    opportunity.createdAt,
    opportunity.updatedAt
  );

  addActivity(db, {
    opportunityId: opportunity.id,
    type: "captured",
    message: `New opportunity captured: ${opportunity.title}`,
    actor: user.name
  });

  return opportunity;
}

export function updateOpportunity(db: SignalStackDb, id: string, input: UpdateOpportunityInput, user: User) {
  const current = getOpportunity(db, id);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...input,
    dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
    tags: input.tags ?? current.tags
  };
  const score = calculateScore(next);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE opportunities
     SET title = ?, customer = ?, problem = ?, status = ?, impact = ?, confidence = ?, effort = ?, reach = ?,
       score = ?, owner = ?, due_date = ?, tags_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    next.title,
    next.customer,
    next.problem,
    next.status,
    next.impact,
    next.confidence,
    next.effort,
    next.reach,
    score,
    next.owner,
    next.dueDate,
    JSON.stringify(next.tags),
    now,
    id
  );

  if (input.status && input.status !== current.status) {
    const type = input.status === "validated" ? "validated" : "moved";
    addActivity(db, {
      opportunityId: id,
      type,
      message: `Opportunity moved to ${statusLabels[input.status]}: ${current.title}`,
      actor: user.name
    });
  } else {
    addActivity(db, {
      opportunityId: id,
      type: "scored",
      message: `Opportunity rescored: ${current.title}`,
      actor: user.name
    });
  }

  return getOpportunity(db, id);
}

export function listActivities(db: SignalStackDb) {
  const rows = db.prepare("SELECT * FROM activities ORDER BY created_at DESC LIMIT 8").all() as unknown as ActivityRow[];
  return rows.map(mapActivity);
}

export function listExperiments(db: SignalStackDb) {
  const rows = db.prepare("SELECT * FROM experiments ORDER BY started_at DESC LIMIT 8").all() as unknown as ExperimentRow[];
  return rows.map(mapExperiment);
}

export function addActivity(
  db: SignalStackDb,
  input: { opportunityId: string | null; type: ActivityItem["type"]; message: string; actor: string }
) {
  db.prepare("INSERT INTO activities (id, opportunity_id, type, message, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    nanoid(),
    input.opportunityId,
    input.type,
    input.message,
    input.actor,
    new Date().toISOString()
  );
}

export function getMetrics(opportunities: Opportunity[]): DashboardMetrics {
  const total = opportunities.length;
  const averageScore = total
    ? Math.round(opportunities.reduce((sum, opportunity) => sum + opportunity.score, 0) / total)
    : 0;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    totalOpportunities: total,
    averageScore,
    inProgress: opportunities.filter((opportunity) => opportunity.status === "in_progress").length,
    validated30d: opportunities.filter(
      (opportunity) => opportunity.status === "validated" && new Date(opportunity.updatedAt).getTime() >= thirtyDaysAgo
    ).length,
    expectedImpact: opportunities
      .filter((opportunity) => opportunity.status === "in_progress" || opportunity.status === "validated")
      .reduce((sum, opportunity) => sum + opportunity.impact, 0)
  };
}

export function getPipeline(opportunities: Opportunity[]) {
  return statusOrder.map((status) => {
    const stageOpportunities = opportunities.filter((opportunity) => opportunity.status === status);
    return {
      status,
      label: statusLabels[status],
      count: stageOpportunities.length,
      opportunities: stageOpportunities.slice(0, 5)
    };
  });
}

export function getRecommendation(opportunities: Opportunity[]) {
  const candidate =
    opportunities
      .filter((opportunity) => opportunity.status !== "validated")
      .sort((a, b) => b.score - a.score || b.impact - a.impact)[0] ?? null;

  return {
    opportunity: candidate,
    reason: candidate
      ? "High customer demand and strong implementation readiness."
      : "No active opportunity needs attention.",
    nextAction: candidate ? `Focus on: ${candidate.title}` : "Capture a new opportunity"
  };
}
