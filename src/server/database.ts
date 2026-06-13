import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
import type { EffortLevel, OpportunityStatus, ReachLevel } from "../shared/types.js";
import { calculateScore, daysAgo } from "./scoring.js";

export type SignalStackDb = DatabaseSync;

interface SeedOpportunity {
  title: string;
  customer: string;
  problem: string;
  status: OpportunityStatus;
  impact: number;
  confidence: number;
  effort: EffortLevel;
  reach: ReachLevel;
  owner: string;
  dueDate: string | null;
  tags: string[];
  daysUpdatedAgo: number;
}

const seedOpportunities: SeedOpportunity[] = [
  {
    title: "Slack integration",
    customer: "Enterprise admins",
    problem: "Teams lose decision context when opportunity updates stay outside Slack.",
    status: "validated",
    impact: 450000,
    confidence: 85,
    effort: "M",
    reach: "High",
    owner: "Taylor Kim",
    dueDate: "2026-07-12",
    tags: ["Collaboration", "Enterprise"],
    daysUpdatedAgo: 1
  },
  {
    title: "Q2 usage-based billing",
    customer: "Growth-stage SaaS teams",
    problem: "Current pricing blocks expansion when customers want metered adoption.",
    status: "in_progress",
    impact: 1200000,
    confidence: 80,
    effort: "L",
    reach: "High",
    owner: "Alex Builder",
    dueDate: "2026-07-01",
    tags: ["Revenue", "Billing"],
    daysUpdatedAgo: 0
  },
  {
    title: "Custom roles and permissions",
    customer: "Security reviewers",
    problem: "Buyers cannot map internal controls to SignalStack permissions.",
    status: "validated",
    impact: 380000,
    confidence: 75,
    effort: "M",
    reach: "Med",
    owner: "Sam Lee",
    dueDate: "2026-07-24",
    tags: ["Security", "Admin"],
    daysUpdatedAgo: 2
  },
  {
    title: "Email digest customization",
    customer: "Team leads",
    problem: "Weekly summaries are too broad for managers tracking one initiative.",
    status: "in_progress",
    impact: 210000,
    confidence: 60,
    effort: "S",
    reach: "Med",
    owner: "Taylor Kim",
    dueDate: "2026-06-28",
    tags: ["Retention", "Notifications"],
    daysUpdatedAgo: 0
  },
  {
    title: "Data residency options",
    customer: "EU platform buyers",
    problem: "Procurement teams need region controls before approving rollout.",
    status: "in_progress",
    impact: 500000,
    confidence: 65,
    effort: "L",
    reach: "Low",
    owner: "Riley Patel",
    dueDate: "2026-08-06",
    tags: ["Compliance", "Platform"],
    daysUpdatedAgo: 1
  },
  {
    title: "Advanced search relevance",
    customer: "Power users",
    problem: "Search misses high-intent notes when teams use customer-specific language.",
    status: "scored",
    impact: 320000,
    confidence: 68,
    effort: "M",
    reach: "High",
    owner: "Alex Builder",
    dueDate: "2026-07-08",
    tags: ["Search", "Productivity"],
    daysUpdatedAgo: 0
  },
  {
    title: "Workflow automation rules",
    customer: "Ops managers",
    problem: "Manual handoffs delay opportunities after scoring and validation.",
    status: "scored",
    impact: 240000,
    confidence: 62,
    effort: "M",
    reach: "Med",
    owner: "Sam Lee",
    dueDate: "2026-07-18",
    tags: ["Automation", "Workflow"],
    daysUpdatedAgo: 3
  },
  {
    title: "Bulk export enhancements",
    customer: "Analysts",
    problem: "Leadership reviews require clean CSV exports with score history.",
    status: "scored",
    impact: 190000,
    confidence: 58,
    effort: "S",
    reach: "Med",
    owner: "Riley Patel",
    dueDate: "2026-06-30",
    tags: ["Reporting", "Export"],
    daysUpdatedAgo: 2
  },
  {
    title: "Mobile onboarding improvements",
    customer: "New workspace owners",
    problem: "First-session setup is slow on smaller screens during sales-led trials.",
    status: "captured",
    impact: 300000,
    confidence: 52,
    effort: "M",
    reach: "High",
    owner: "Alex Builder",
    dueDate: "2026-07-20",
    tags: ["Activation", "Mobile"],
    daysUpdatedAgo: 0
  },
  {
    title: "Team analytics dashboard",
    customer: "Product leads",
    problem: "Managers need a quick way to spot stale opportunities and stuck experiments.",
    status: "captured",
    impact: 260000,
    confidence: 47,
    effort: "L",
    reach: "Med",
    owner: "Taylor Kim",
    dueDate: "2026-08-02",
    tags: ["Analytics", "Management"],
    daysUpdatedAgo: 4
  },
  {
    title: "API rate limit visibility",
    customer: "Developer teams",
    problem: "Integrations fail without a clear way to see quota burn down.",
    status: "captured",
    impact: 170000,
    confidence: 41,
    effort: "M",
    reach: "Med",
    owner: "Riley Patel",
    dueDate: "2026-07-26",
    tags: ["Developer", "API"],
    daysUpdatedAgo: 5
  },
  {
    title: "SSO for enterprise",
    customer: "Enterprise IT",
    problem: "Large accounts cannot complete security review without SAML support.",
    status: "captured",
    impact: 900000,
    confidence: 38,
    effort: "XL",
    reach: "High",
    owner: "Sam Lee",
    dueDate: "2026-09-10",
    tags: ["Enterprise", "Security"],
    daysUpdatedAgo: 6
  }
];

export function openDatabase(file = process.env.SIGNALSTACK_DB ?? path.join(process.cwd(), "data", "signalstack.db")) {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);
  prepareDatabase(db);
  seedDatabase(db);
  return db;
}

export function prepareDatabase(db: SignalStackDb) {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      customer TEXT NOT NULL,
      problem TEXT NOT NULL,
      status TEXT NOT NULL,
      impact INTEGER NOT NULL,
      confidence INTEGER NOT NULL,
      effort TEXT NOT NULL,
      reach TEXT NOT NULL,
      score INTEGER NOT NULL,
      owner TEXT NOT NULL,
      due_date TEXT,
      tags_json TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      metric TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence_delta INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export function seedDatabase(db: SignalStackDb) {
  const existingUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (existingUsers.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const demoUserId = "user_demo";
  const passwordHash = bcrypt.hashSync("builder-demo", 10);

  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(demoUserId, "Alex Builder", "demo@signalstack.dev", passwordHash, "Founder Engineer", now);

  const insertOpportunity = db.prepare(`
    INSERT INTO opportunities (
      id, title, customer, problem, status, impact, confidence, effort, reach, score, owner,
      due_date, tags_json, created_by, created_at, updated_at
    )
    VALUES (@id, @title, @customer, @problem, @status, @impact, @confidence, @effort, @reach, @score, @owner,
      @dueDate, @tagsJson, @createdBy, @createdAt, @updatedAt)
  `);

  const opportunityIds = new Map<string, string>();
  for (const item of seedOpportunities) {
    const id = nanoid();
    opportunityIds.set(item.title, id);
    insertOpportunity.run({
      id,
      title: item.title,
      customer: item.customer,
      problem: item.problem,
      status: item.status,
      impact: item.impact,
      confidence: item.confidence,
      effort: item.effort,
      reach: item.reach,
      score: calculateScore(item),
      owner: item.owner,
      dueDate: item.dueDate,
      tagsJson: JSON.stringify(item.tags),
      createdBy: demoUserId,
      createdAt: daysAgo(item.daysUpdatedAgo + 2),
      updatedAt: daysAgo(item.daysUpdatedAgo)
    });
  }

  const opportunityId = (title: string) => {
    const id = opportunityIds.get(title);
    if (!id) {
      throw new Error(`Missing seeded opportunity: ${title}`);
    }
    return id;
  };

  const insertExperiment = db.prepare(`
    INSERT INTO experiments (
      id, opportunity_id, name, hypothesis, metric, status, confidence_delta, started_at, ended_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExperiment.run(
    nanoid(),
    opportunityId("Q2 usage-based billing"),
    "Pricing page comprehension test",
    "If metered tiers are framed around workflow volume, trials will pick a plan faster.",
    "Trial-to-paid conversion",
    "running",
    8,
    daysAgo(5),
    null
  );
  insertExperiment.run(
    nanoid(),
    opportunityId("Slack integration"),
    "Digest handoff prototype",
    "If Slack summaries include score movement, weekly review attendance improves.",
    "Review attendance",
    "completed",
    14,
    daysAgo(21),
    daysAgo(3)
  );

  const insertActivity = db.prepare(
    "INSERT INTO activities (id, opportunity_id, type, message, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );

  insertActivity.run(
    nanoid(),
    opportunityId("Mobile onboarding improvements"),
    "captured",
    "New opportunity captured: Mobile onboarding improvements",
    "Alex Builder",
    daysAgo(0)
  );
  insertActivity.run(
    nanoid(),
    opportunityId("Q2 usage-based billing"),
    "moved",
    "Opportunity moved to In Progress: Q2 usage-based billing",
    "Alex Builder",
    daysAgo(0)
  );
  insertActivity.run(
    nanoid(),
    opportunityId("Slack integration"),
    "validated",
    "Opportunity validated: Slack integration",
    "Taylor Kim",
    daysAgo(1)
  );
  insertActivity.run(
    nanoid(),
    opportunityId("Slack integration"),
    "experiment",
    "Experiment completed: Digest handoff prototype",
    "Taylor Kim",
    daysAgo(2)
  );
}
