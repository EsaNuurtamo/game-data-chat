import type { UIMessage } from "ai";

export type ThinkingStepKind = "thought" | "tool";

export type ThinkingStepStatus =
  | "in-progress"
  | "succeeded"
  | "failed";

export interface ThinkingStep {
  id: string;
  kind: ThinkingStepKind;
  label: string;
  status: ThinkingStepStatus;
  startedAt: string;
  completedAt?: string;
  runId?: string;
  body?: string;
  tool?: {
    name: string;
    callId?: string;
  };
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ThinkingResetPayload {
  runId: string;
}

export type AgentUIDataTypes = {
  "thinking-step": ThinkingStep;
  "thinking-reset": ThinkingResetPayload;
};

export type AgentUIMessage = UIMessage<unknown, AgentUIDataTypes>;
