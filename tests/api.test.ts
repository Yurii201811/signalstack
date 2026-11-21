import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { openDatabase, type SignalStackDb } from "../src/server/database.js";

describe("SignalStack API", () => {
  let db: SignalStackDb;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    agent = request.agent(createApp({ db }));
  });

  afterEach(() => {
    db.close();
  });

  it("requires authentication before reading dashboard data", async () => {
    await request(createApp({ db })).get("/api/dashboard").expect(401);
  });

  it("signs in with the seeded demo user and returns dashboard metrics", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "demo@signalstack.dev", password: "builder-demo" })
      .expect(200);

    const response = await agent.get("/api/dashboard").expect(200);

    expect(response.body.user.email).toBe("demo@signalstack.dev");
    expect(response.body.metrics.totalOpportunities).toBeGreaterThan(5);
    expect(response.body.pipeline).toHaveLength(5);
    expect(response.body.recommendation.opportunity).toBeTruthy();
  });

  it("creates an opportunity, scores it, and persists it in the pipeline", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "demo@signalstack.dev", password: "builder-demo" })
      .expect(200);

    const created = await agent
      .post("/api/opportunities")
      .send({
        title: "Realtime customer risk scoring",
        customer: "Customer success leaders",
        problem: "Teams need a proactive signal when product usage drops before renewal.",
        impact: 350000,
        confidence: 72,
        effort: "M",
        reach: "High",
        owner: "Alex Builder",
        dueDate: "2026-07-20",
        tags: ["Retention", "Analytics"]
      })
      .expect(201);

    expect(created.body.opportunity.status).toBe("captured");
    expect(created.body.opportunity.score).toBeGreaterThan(0);

    const dashboard = await agent.get("/api/dashboard?query=risk").expect(200);
    expect(dashboard.body.opportunities.map((item: { title: string }) => item.title)).toContain(
      "Realtime customer risk scoring"
    );
  });

  it("moves an opportunity to the next workflow stage and records activity", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "demo@signalstack.dev", password: "builder-demo" })
      .expect(200);

    const dashboard = await agent.get("/api/dashboard?status=captured").expect(200);
    const opportunity = dashboard.body.opportunities[0];

    const updated = await agent
      .patch(`/api/opportunities/${opportunity.id}`)
      .send({ status: "scored" })
      .expect(200);

    expect(updated.body.opportunity.status).toBe("scored");

    const after = await agent.get("/api/dashboard").expect(200);
    expect(after.body.activities[0].message).toContain("Opportunity moved to Scored");
  });

  it("edits an opportunity, recalculates score, and logs the updated title", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "demo@signalstack.dev", password: "builder-demo" })
      .expect(200);

    const dashboard = await agent.get("/api/dashboard?status=captured").expect(200);
    const opportunity = dashboard.body.opportunities[0];

    const updated = await agent
      .patch(`/api/opportunities/${opportunity.id}`)
      .send({
        title: "Self-serve SAML SSO onboarding",
        confidence: 92,
        effort: "S"
      })
      .expect(200);

    expect(updated.body.opportunity.title).toBe("Self-serve SAML SSO onboarding");
    expect(updated.body.opportunity.score).toBeGreaterThan(opportunity.score);

    const after = await agent.get("/api/dashboard").expect(200);
    expect(after.body.activities[0].message).toContain("Self-serve SAML SSO onboarding");
  });

  it("deletes an opportunity, logs activity, and returns 404 on repeat delete", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "demo@signalstack.dev", password: "builder-demo" })
      .expect(200);

    const before = await agent.get("/api/dashboard").expect(200);
    const target = before.body.opportunities[0];

    await agent.delete(`/api/opportunities/${target.id}`).expect(204);
    await agent.delete(`/api/opportunities/${target.id}`).expect(404);

    const after = await agent.get("/api/dashboard").expect(200);
    expect(after.body.opportunities.map((item: { id: string }) => item.id)).not.toContain(target.id);
    expect(after.body.activities[0].message).toContain(`Opportunity deleted: ${target.title}`);
  });

  it("exports filtered opportunities as formula-safe CSV and JSON", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: "demo@signalstack.dev", password: "builder-demo" })
      .expect(200);

    await agent
      .post("/api/opportunities")
      .send({
        title: "=HYPERLINK(\"http://evil.example\",\"click\")",
        customer: "+Finance Ops",
        problem: "Formula-looking strings must be neutralized before spreadsheet export.",
        impact: 150000,
        confidence: 70,
        effort: "S",
        reach: "Med",
        owner: "Alex Builder",
        tags: ["Security"]
      })
      .expect(201);

    const csvRes = await agent.get("/api/opportunities/export?format=csv&query=HYPERLINK").expect(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain("\"'=HYPERLINK(");
    expect(csvRes.text).toContain("'+Finance Ops");

    const jsonRes = await agent.get("/api/opportunities/export?format=json&status=validated").expect(200);
    expect(jsonRes.headers["content-type"]).toContain("application/json");
    const parsed = JSON.parse(jsonRes.text) as { count: number; opportunities: Array<{ status: string }> };
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.opportunities.every((item) => item.status === "validated")).toBe(true);

    await agent.get("/api/opportunities/export?format=xml").expect(400);
  });

  it("restricts credentialed CORS to allowed origins", async () => {
    const app = createApp({ db });

    const allowed = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const blocked = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example")
      .expect(200);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

