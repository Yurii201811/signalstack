export const statusOrder = ["captured", "scored", "in_progress", "validated", "backlog"] as const;
export const reachLevels = ["Low", "Med", "High"] as const;
export const effortLevels = ["S", "M", "L", "XL"] as const;

export type OpportunityStatus = (typeof statusOrder)[number];
export type ReachLevel = (typeof reachLevels)[number];
export type EffortLevel = (typeof effortLevels)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Opportunity {
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
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  opportunityId: string | null;
  type: "captured" | "scored" | "moved" | "validated" | "experiment" | "note";
  message: string;
  actor: string;
  createdAt: string;
}

export interface Experiment {
  id: string;
  opportunityId: string;
  name: string;
  hypothesis: string;
  metric: string;
  status: "planned" | "running" | "completed";
  confidenceDelta: number;
  startedAt: string;
  endedAt: string | null;
}

export interface DashboardMetrics {
  totalOpportunities: number;
  averageScore: number;
  inProgress: number;
  validated30d: number;
  expectedImpact: number;
}

export interface PipelineStage {
  status: OpportunityStatus;
  label: string;
  count: number;
  opportunities: Opportunity[];
}

export interface Recommendation {
  opportunity: Opportunity | null;
  reason: string;
  nextAction: string;
}

export interface DashboardPayload {
  user: User;
  metrics: DashboardMetrics;
  pipeline: PipelineStage[];
  opportunities: Opportunity[];
  activities: ActivityItem[];
  experiments: Experiment[];
  recommendation: Recommendation;
}

export interface CreateOpportunityInput {
  title: string;
  customer: string;
  problem: string;
  impact: number;
  confidence: number;
  effort: EffortLevel;
  reach: ReachLevel;
  owner: string;
  dueDate?: string | null;
  tags: string[];
}

export type UpdateOpportunityInput = Partial<
  Pick<
    Opportunity,
    | "title"
    | "customer"
    | "problem"
    | "status"
    | "impact"
    | "confidence"
    | "effort"
    | "reach"
    | "owner"
    | "dueDate"
    | "tags"
  >
>;

