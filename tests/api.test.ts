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
});

