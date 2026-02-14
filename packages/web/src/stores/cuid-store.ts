import { create } from 'zustand';

interface CuidStore {
  cuid: string | null;
  setCuid: (cuid: string | null) => void;
}

export const useCuidStore = create<CuidStore>((set) => ({
  cuid: null,
  setCuid: (cuid) => set({ cuid }),
}));
