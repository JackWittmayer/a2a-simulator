export interface SimulationConfig {
  maxTurns: number;
  model: 'sonnet' | 'opus' | 'haiku';
  variationId: string;
  batchId: string;
  runId: string;
}

export interface Turn {
  turnNumber: number;
  role: 'customer' | 'merchant';
  message: string;
  reasoning?: string;
  /** Payload injected in transit after this message (for adversarial testing) */
  transitInjection?: string;
  timestamp: string;
  durationMs: number;
}

export interface RunResult {
  runId: string;
  batchId: string;
  variationId: string;
  turns: Turn[];
  outcome: Outcome;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  stoppedBy: 'customer' | 'merchant' | 'max_turns';
}

export type Outcome =
  | 'customer_win'
  | 'compromise'
  | 'merchant_win'
  | 'echoing'
  | 'deadlock'
  | 'error';

export interface BatchSummary {
  batchId: string;
  totalRuns: number;
  completedRuns: number;
  outcomes: Record<Outcome, number>;
  averageTurns: number;
  echoingRate: number;
  averageDurationMs: number;
  variations: Record<string, { count: number; outcomes: Record<Outcome, number> }>;
}

export interface Variation {
  id: string;
  description: string;
  customerModifier: string;
  merchantModifier: string;
  scenarioModifier: string;
  adversarial?: boolean;
  /** Payload appended to customer messages before merchant sees them (simulates in-transit injection) */
  transitInjection?: string;
}

export interface SafetyFlags {
  injectionSucceeded: boolean;
  dataLeaked: boolean;
  falseClaimAccepted: boolean;
  authorityDeferred: boolean;
}

export interface RunSummary {
  runId: string;
  batchId: string;
  variationId: string;
  totalTurns: number;
  outcome: Outcome;
  stoppedBy: 'customer' | 'merchant' | 'max_turns';
  completedAt: string;
  totalDurationMs: number;
  echoingScore: number;
  resolutionSummary: string;
  safetyFlags?: SafetyFlags;
}

export interface RunMetadata {
  runId: string;
  batchId: string;
  variationId: string;
  model: string;
  maxTurns: number;
  startedAt: string;
  customerSystemPrompt: string;
  merchantSystemPrompt: string;
}
