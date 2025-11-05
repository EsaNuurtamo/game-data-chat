import { create } from "zustand";

import type { ThinkingStep } from "@/types/Agent";

export type ThinkingRunStatus = "streaming" | "succeeded" | "failed";

export interface ThinkingRun {
  runId: string;
  steps: ThinkingStep[];
  status: ThinkingRunStatus;
  startedAt: string;
  completedAt?: string;
  messageId?: string;
  hasText?: boolean;
}

interface ThinkingStoreState {
  runs: Record<string, ThinkingRun>;
  currentRunId: string | null;
  panelOpen: boolean;
  setFromMessages: (
    runs: Record<string, ThinkingRun>,
    currentRunId: string | null
  ) => void;
  togglePanelForRun: (runId: string) => void;
  closePanel: () => void;
  getRunByMessageId: (messageId: string) => ThinkingRun | undefined;
}

export const useThinkingStore = create<ThinkingStoreState>()((set, get) => ({
  runs: {},
  currentRunId: null,
  panelOpen: false,
  setFromMessages: (runs, latestRunId) =>
    set((state) => {
      const currentStillValid = state.currentRunId
        ? Boolean(runs[state.currentRunId])
        : false;
      const nextCurrent = currentStillValid
        ? state.currentRunId
        : latestRunId && runs[latestRunId]
        ? latestRunId
        : null;

      return {
        runs,
        currentRunId: nextCurrent,
        panelOpen: nextCurrent ? state.panelOpen : false,
      };
    }),
  togglePanelForRun: (runId) =>
    set((state) => {
      if (!runId || !state.runs[runId]) {
        return state;
      }
      if (state.panelOpen && state.currentRunId === runId) {
        return { panelOpen: false };
      }
      return { currentRunId: runId, panelOpen: true };
    }),
  closePanel: () => set({ panelOpen: false }),
  getRunByMessageId: (messageId) => {
    const runs = get().runs;
    return Object.values(runs).find((run) => run.messageId === messageId);
  },
}));
