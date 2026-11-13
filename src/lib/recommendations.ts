import type { Video } from './types';
import type { Interest } from '@/store/interests';
export function interestQueries(searches: Interest[], now = Date.now()): string[] {
  return [...searches].filter(s => s.updatedAt > now - 90 * 86400000)
    .sort((a, b) => (b.count / (1 + (now - b.updatedAt) / 86400000)) - (a.count / (1 + (now - a.updatedAt) / 86400000)))
    .slice(0, 5).map(s => s.query);
}
/** Stable, deterministic local ranking with a soft per-channel diversity limit. */
export function rankFeed(videos: Video[], queries: string[], dismissed: string[], completed: Set<string>, now = Date.now()): Video[] {
  const hidden = new Set(dismissed);
  const tokens = [...new Set(queries.flatMap(q => q.toLocaleLowerCase().split(/\s+/)).filter(t => t.length > 1))];
  const score = (v: Video) => {
    const title = `${v.title} ${v.channelName}`.toLocaleLowerCase();
    const matches = tokens.reduce((n, t) => n + (title.includes(t) ? 4 : 0), 0);
    const date = Date.parse(v.publishedAt);
    const age = Number.isFinite(date) ? Math.max(0, now - date) / 86400000 : 365;
    return matches + 3 / (1 + age / 7) - (completed.has(v.id) ? 8 : 0);
  };
  const sorted = [...new Map(videos.filter(v => !hidden.has(v.id)).map(v => [v.id, v])).values()].sort((a, b) => score(b) - score(a));
  const result: Video[] = [];
  while (sorted.length) {
    const recent = result.slice(-3).map(v => v.channelId);
    const index = sorted.findIndex(v => !v.channelId || !recent.includes(v.channelId));
    result.push(sorted.splice(index < 0 ? 0 : index, 1)[0]);
  }
  return result;
}
