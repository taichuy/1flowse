import { create } from 'zustand';

interface AppState {
  visitCount: number;
  increment: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  visitCount: 0,
  increment: () => set((state) => ({ visitCount: state.visitCount + 1 }))
}));
