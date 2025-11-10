import { create } from "zustand";

interface DataAnalysisStoreState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useDataAnalysisStore = create<DataAnalysisStoreState>()((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (enabled) => set({ enabled }),
}));
