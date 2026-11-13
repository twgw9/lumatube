import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Video } from '@/lib/types';
/** Bounded real metadata cache; feed membership is never inferred from this cache. */
export const useCatalog = create<{ videos: Record<string, Video>; remember: (videos: Video[]) => void }>()(persist((set) => ({
  videos: {},
  remember: videos => set(s => ({ videos: Object.fromEntries(Object.entries({ ...s.videos, ...Object.fromEntries(videos.map(v => [v.id, v])) }).slice(-600)) })),
}), { name: 'lumatube.catalog.v1' }));
