import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AgentUIMessage } from "@/types/Agent";

type StorageFactory = () => Storage;

const fallbackStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

const storageFactory: StorageFactory = () =>
  typeof window === "undefined" ? fallbackStorage : window.localStorage;

interface ChatHistoryState {
  messages: AgentUIMessage[];
  setMessages: (messages: AgentUIMessage[]) => void;
  clear: () => void;
}

export const useChatHistoryStore = create<ChatHistoryState>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (messages) => set({ messages }),
      clear: () => set({ messages: [] }),
    }),
    {
      name: "game-data-chat-history",
      version: 1,
      storage: createJSONStorage(storageFactory),
    }
  )
);
