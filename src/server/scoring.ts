import type { EffortLevel, OpportunityStatus, ReachLevel } from "../shared/types.js";

const effortWeight: Record<EffortLevel, number> = {
  S: 1,
  M: 1.55,
  L: 2.25,
  XL: 3.1
};

const reachWeight: Record<ReachLevel, number> = {
  Low: 0.82,
  Med: 1,
  High: 1.18
};

export const statusLabels: Record<OpportunityStatus, string> = {
  captured: "Captured",
  scored: "Scored",
  in_progress: "In Progress",
  validated: "Validated",
  backlog: "Backlog"
};

export const nextStatus: Partial<Record<OpportunityStatus, OpportunityStatus>> = {
  captured: "scored",
  scored: "in_progress",
  in_progress: "validated",
  backlog: "captured"
};

export function calculateScore(input: {
  impact: number;
  confidence: number;
  effort: EffortLevel;
  reach: ReachLevel;
}) {
  const normalizedImpact = Math.min(input.impact / 12000, 65);
  const confidenceFactor = Math.max(0.35, Math.min(input.confidence, 100) / 100);
  const score = (normalizedImpact * confidenceFactor * reachWeight[input.reach]) / effortWeight[input.effort];
  return Math.max(1, Math.min(100, Math.round(score)));
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

