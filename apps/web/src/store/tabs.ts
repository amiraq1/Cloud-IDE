import { create } from 'zustand';

export interface Tab {
  id: string;
  name: string;
  language?: string;
  isDirty: boolean;
}

interface TabsState {
  openTabs: Tab[];
  activeTabId: string | null;

  // Actions
  openTab: (tab: Omit<Tab, 'isDirty'>) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  markDirty: (id: string, dirty: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

export const useTabs = create<TabsState>((set, get) => ({
  openTabs: [
    { id: "app-entry", name: "app.tsx", language: "typescriptreact", isDirty: false },
  ],
  activeTabId: "app-entry",

  openTab: (tab) => set((state) => {
    const exists = state.openTabs.find((t) => t.id === tab.id);
    if (exists) {
      return { activeTabId: tab.id };
    }
    return {
      openTabs: [...state.openTabs, { ...tab, isDirty: false }],
      activeTabId: tab.id,
    };
  }),

  closeTab: (id) => set((state) => {
    const idx = state.openTabs.findIndex((t) => t.id === id);
    const newTabs = state.openTabs.filter((t) => t.id !== id);
    let newActive = state.activeTabId;
    const fallbackTab =
      idx >= newTabs.length ? newTabs[newTabs.length - 1] : newTabs[idx];

    if (state.activeTabId === id) {
      if (newTabs.length === 0) {
        newActive = null;
      } else {
        newActive = fallbackTab ? fallbackTab.id : null;
      }
    }

    return { openTabs: newTabs, activeTabId: newActive };
  }),

  closeOtherTabs: (id) => set((state) => ({
    openTabs: state.openTabs.filter((t) => t.id === id),
    activeTabId: id,
  })),

  closeAllTabs: () => set({ openTabs: [], activeTabId: null }),

  setActiveTab: (id) => set({ activeTabId: id }),

  markDirty: (id, dirty) => set((state) => ({
    openTabs: state.openTabs.map((t) =>
      t.id === id ? { ...t, isDirty: dirty } : t
    ),
  })),

  reorderTabs: (fromIndex, toIndex) => set((state) => {
    const tabs = [...state.openTabs];
    const [moved] = tabs.splice(fromIndex, 1);
    if (!moved) {
      return { openTabs: state.openTabs };
    }
    tabs.splice(toIndex, 0, moved);
    return { openTabs: tabs };
  }),
}));
