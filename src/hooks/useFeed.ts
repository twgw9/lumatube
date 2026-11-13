import { useInbox } from "@/store/inbox";
import { useEffect, useRef, useState } from 'react';
import { popularPage, searchPage, subscriptionPage } from '@/lib/youtube';
import { refreshFeed } from '@/lib/bridge';
import { isNativeApp } from '@/lib/utils';
import { useSettings } from '@/store/settings';
import { useLibrary } from '@/store/library';
import { useCatalog } from '@/store/catalog';
import type { Video } from '@/lib/types';

export function useFeed(mode: 'popular' | 'subscriptions' | 'search' | 'personalized', channelIds: string[] = [], query = '', enabled = true) {
  const key = useSettings(s => s.dataApiKey);
  const ids = [...channelIds].sort().join(',');
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const paging = useRef<{ next?: string; channels: Record<string, string | undefined> }>({ channels: {} });
  const personalizedPage = useRef(0);
  const exhausted = useRef(new Set<string>());
  const generation = useRef(0);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const loadRef = useRef<(more: boolean) => Promise<void>>(async () => {});
  loadRef.current = async (more) => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError('');
    const gen = generation.current;
    const controller = new AbortController(); abort.current = controller;
    try {
      let rows: Video[] = [];
      let moreAvailable = false;
      const state = paging.current;
      const nextChannels = { ...state.channels };
      let nextToken: string | undefined;
      if (mode === 'subscriptions') {
        const channels = ids.split(',').filter(Boolean);
        if (!channels.length) { setHasMore(false); return; }
        if (!key && isNativeApp()) {
          const names = new Map(useLibrary.getState().channels.map(c => [c.id, c.name]));
          rows = (await refreshFeed(channels)).map(v => ({ ...v, channelName: names.get(v.channelId) ?? v.channelName }));
        }
        else {
          if (!key.trim()) throw new Error('Browser subscription feeds need your YouTube Data API key in Settings → Account. Native RSS does not need a key.');
          // Bounded concurrency prevents a large subscription list from bursting the API.
          const pending = channels.filter(id => !more || state.channels[id] !== undefined);
          let failures = 0;
          for (let i = 0; i < pending.length; i += 3) {
            const results = await Promise.allSettled(pending.slice(i, i + 3).map(async id => {
              const page = await subscriptionPage(id, key, more ? state.channels[id] : '', controller.signal);
              return { id, page };
            }));
            for (const result of results) {
              if (result.status === 'rejected') { failures++; continue; }
              rows.push(...result.value.page.videos);
              nextChannels[result.value.id] = more && result.value.page.nextPageToken === state.channels[result.value.id] ? undefined : result.value.page.nextPageToken;
            }
          }
          if (failures) throw new Error('Some channel feeds failed. Check your API key/network and retry; existing videos are kept.');
          moreAvailable = Object.values(nextChannels).some(Boolean);
        }
        rows.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      } else if (mode === 'personalized') {
        const topics = query.split('\n').filter(Boolean).slice(0, 5);
        const index = more ? personalizedPage.current + 1 : 0;
        // One discovery request per click; every third batch explores popular videos.
        const available = topics.filter(t => !exhausted.current.has(t));
        const explore = !exhausted.current.has('$popular') && (!available.length || index % 3 === 2);
        const topic = explore ? '' : available[index % Math.max(1, available.length)] ?? '';
        if (!topic && exhausted.current.has('$popular')) { setHasMore(false); return; }
        const page = topic ? await searchPage(topic, key, more ? state.channels[topic] : '', controller.signal) : await popularPage(key, more ? state.next : '', controller.signal);
        rows = page.videos;
        if (topic) nextChannels[topic] = page.nextPageToken;
        else nextToken = page.nextPageToken;
        // Bounded to twelve batches to avoid unlimited expensive search calls.
        const cursor = topic ? state.channels[topic] : state.next;
        const ended = !page.nextPageToken || (more && page.nextPageToken === cursor);
        if (gen === generation.current) {
          if (ended) exhausted.current.add(topic || '$popular');
          personalizedPage.current = index;
        }
        moreAvailable = index < 11 && (topics.some(t => !exhausted.current.has(t)) || !exhausted.current.has('$popular'));
      } else {
        const page = mode === 'popular' ? await popularPage(key, more ? state.next : '', controller.signal) : await searchPage(query, key, more ? state.next : '', controller.signal);
        rows = page.videos; nextToken = page.nextPageToken; moreAvailable = Boolean(nextToken && nextToken !== state.next);
      }
      if (gen !== generation.current) return;
      paging.current = { next: mode === 'personalized' ? (nextToken ?? state.next) : nextToken, channels: nextChannels };
      useCatalog.getState().remember(rows);
      if (mode === "subscriptions" && !more) useInbox.getState().ingest(rows);
      setVideos(old => Array.from(new Map([...(more ? old : []), ...rows].map(v => [v.id, v])).values()));
      setHasMore(moreAvailable);
    } catch (err) {
      if (gen === generation.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : 'Feed failed. Retry.');
    } finally { if (gen === generation.current) { busy.current = false; setLoading(false); } }
  };
  useEffect(() => {
    generation.current++; busy.current = false; abort.current?.abort();
    personalizedPage.current = 0; exhausted.current = new Set(); paging.current = { channels: {} }; setVideos([]); setError(''); setHasMore(false); setLoading(false);
    if (enabled && (mode !== 'search' || query.trim())) void loadRef.current(false);
    return () => { generation.current++; abort.current?.abort(); };
  }, [mode, ids, key, query, revision, enabled]);
  return { videos, error, loading, hasMore, loadMore: () => { if (enabled && hasMore) void loadRef.current(true); }, refresh: () => setRevision(r => r + 1) };
}
