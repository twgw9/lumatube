import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Video } from '@/lib/types';
export interface UploadNotice { id: string; videoId: string; channelId: string; title: string; channelName: string; createdAt: number; read: boolean }
export const useInbox = create<{
  notices: UploadNotice[]; seen: Record<string, string[]>; muted: string[];
  ingest: (videos: Video[]) => void; markRead: () => void; clear: () => void;
  toggleChannel: (id: string) => void;
}>()(persist(set => ({
  notices: [], seen: {}, muted: [],
  ingest: videos => set(s => {
    const grouped = new Map<string, Video[]>();
    for (const v of videos) if (v.channelId) grouped.set(v.channelId, [...(grouped.get(v.channelId) ?? []), v]);
    const seen = { ...s.seen }; const notices = [...s.notices];
    for (const [channel, rows] of grouped) {
      const previous = seen[channel];
      // First successful refresh establishes a baseline, not a flood of old alerts.
      if (previous && !s.muted.includes(channel)) {
        for (const v of rows) {
          if (!previous.includes(v.id) && !notices.some(n => n.videoId === v.id)) notices.unshift({ id: v.id, videoId: v.id, channelId: channel, title: v.title, channelName: v.channelName, createdAt: Date.now(), read: false });
        }
      }
      seen[channel] = [...new Set([...rows.map(v => v.id), ...(previous ?? [])])].slice(0, 300);
    }
    return { seen: Object.fromEntries(Object.entries(seen).slice(-300)), notices: notices.slice(0, 100) };
  }),
  markRead: () => set(s => ({ notices: s.notices.map(n => ({ ...n, read: true })) })),
  clear: () => set({ notices: [] }),
  toggleChannel: id => set(s => ({ muted: s.muted.includes(id) ? s.muted.filter(c => c !== id) : [...s.muted, id] })),
}), { name: 'lumatube.upload-inbox.v1' }));
