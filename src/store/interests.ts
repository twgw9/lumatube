import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export interface Interest { query: string; updatedAt: number; count: number }
export function cleanQuery(value: string) { return value.trim().replace(/\s+/g, ' ').slice(0, 100); }
export const useInterests = create<{
  enabled: boolean; searches: Interest[]; dismissed: string[];
  setEnabled: (enabled: boolean) => void; record: (query: string) => void;
  remove: (query: string) => void; dismiss: (id: string) => void; reset: () => void;
}>()(persist((set, get) => ({
  enabled: true, searches: [], dismissed: [],
  setEnabled: enabled => set({ enabled }),
  record: raw => {
    const query = cleanQuery(raw);
    if (!get().enabled || query.length < 2) return;
    set(s => {
      const previous = s.searches.find(x => x.query.toLocaleLowerCase() === query.toLocaleLowerCase());
      return { searches: [{ query, count: Math.min(20, (previous?.count ?? 0) + 1), updatedAt: Date.now() }, ...s.searches.filter(x => x !== previous)].slice(0, 20) };
    });
  },
  remove: query => set(s => ({ searches: s.searches.filter(x => x.query !== query) })),
  dismiss: id => set(s => ({ dismissed: [...new Set([...s.dismissed, id])].slice(-500) })),
  reset: () => set({ searches: [], dismissed: [] }),
}), { name: 'lumatube.interests.v1' }));
