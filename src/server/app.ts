import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { effortLevels, reachLevels, statusOrder, type OpportunityStatus, type User } from "../shared/types.js";
import type { SignalStackDb } from "./database.js";
import {
  createOpportunity,
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  findUserBySession,
  getMetrics,
  getPipeline,
  getRecommendation,
  listActivities,
  listExperiments,
  listOpportunities,
  mapUser,
  updateOpportunity
} from "./repository.js";

const sessionCookie = "signalstack_session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8)
});

const createOpportunitySchema = z.object({
  title: z.string().min(3).max(120),
  customer: z.string().min(2).max(120),
  problem: z.string().min(10).max(500),
  impact: z.coerce.number().int().min(1000).max(5000000),
  confidence: z.coerce.number().int().min(1).max(100),
  effort: z.enum(effortLevels),
  reach: z.enum(reachLevels),
  owner: z.string().min(2).max(80),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(6)
});

const updateOpportunitySchema = createOpportunitySchema.partial().extend({
  status: z.enum(statusOrder).optional()
});

type AuthedRequest = Request & { user?: User };

export function createApp({ db, clientDist }: { db: SignalStackDb; clientDist?: string }) {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );

  function setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(sessionCookie, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SIGNALSTACK_COOKIE_SECURE === "true",
      expires: expiresAt,
      path: "/"
    });
  }

  function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.[sessionCookie] as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const user = findUserBySession(db, token);
    if (!user) {
      res.clearCookie(sessionCookie, { path: "/" });
      res.status(401).json({ error: "Session expired" });
      return;
    }

    req.user = user;
    next();
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "signalstack" });
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const userRow = findUserByEmail(db, parsed.data.email.toLowerCase());
    if (!userRow || !bcrypt.compareSync(parsed.data.password, userRow.password_hash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const session = createSession(db, userRow.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ user: mapUser(userRow) });
  });

  app.post("/api/auth/register", (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Name, valid email, and 8 character password are required" });
      return;
    }

    const existing = findUserByEmail(db, parsed.data.email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const user = createUser(db, {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash: bcrypt.hashSync(parsed.data.password, 10)
    });
    const session = createSession(db, user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.status(201).json({ user });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies?.[sessionCookie] as string | undefined;
    if (token) {
      deleteSession(db, token);
    }
    res.clearCookie(sessionCookie, { path: "/" });
    res.status(204).send();
  });

  app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/dashboard", requireAuth, (req: AuthedRequest, res) => {
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusOrder.includes(rawStatus as OpportunityStatus) ? (rawStatus as OpportunityStatus) : undefined;
    const opportunities = listOpportunities(db, { query, status });

    res.json({
      user: req.user,
      metrics: getMetrics(opportunities),
      pipeline: getPipeline(opportunities),
      opportunities,
      activities: listActivities(db),
      experiments: listExperiments(db),
      recommendation: getRecommendation(opportunities)
    });
  });

  app.get("/api/opportunities", requireAuth, (_req, res) => {
    res.json({ opportunities: listOpportunities(db) });
  });

  app.post("/api/opportunities", requireAuth, (req: AuthedRequest, res) => {
    const parsed = createOpportunitySchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
      res.status(400).json({ error: "Opportunity fields are incomplete or invalid" });
      return;
    }

    const opportunity = createOpportunity(db, parsed.data, req.user);
    res.status(201).json({ opportunity });
  });

  app.patch("/api/opportunities/:id", requireAuth, (req: AuthedRequest, res) => {
    const parsed = updateOpportunitySchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
      res.status(400).json({ error: "Opportunity update is invalid" });
      return;
    }

    const opportunity = updateOpportunity(db, req.params.id, parsed.data, req.user);
    if (!opportunity) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }

    res.json({ opportunity });
  });

  const staticDir = clientDist ?? path.resolve(process.cwd(), "dist", "client");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}

