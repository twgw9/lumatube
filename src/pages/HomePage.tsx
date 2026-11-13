import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useInterests } from '@/store/interests';
import { interestQueries, rankFeed } from '@/lib/recommendations';
import { useFeed } from '@/hooks/useFeed';
import { useCatalog } from '@/store/catalog';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { VideoGrid } from '@/components/VideoCard';
import { Button, EmptyState, IconButton } from '@/components/ui';
import { cn, isNativeApp } from '@/lib/utils';

type Tab = 'personalized' | 'popular' | 'subscriptions' | 'continue';
export function HomePage() {
  const settings = useSettings();
  const channels = useLibrary(s => s.channels);
  const progress = useLibrary(s => s.progress);
  const catalog = useCatalog(s => s.videos);
  const interests = useInterests();
  const queries = useMemo(() => interests.enabled ? interestQueries(interests.searches) : [], [interests.enabled, interests.searches]);
  const [selectedTab, setTab] = useState<Tab>('personalized');
  const tab = settings.focusMode ? 'subscriptions' : selectedTab;
  const mode = settings.focusMode ? 'subscriptions' : tab === 'continue' ? 'subscriptions' : tab;
  const feed = useFeed(mode, channels.filter(c => c.subscribed !== false && /^UC[\w-]{22}$/.test(c.id)).map(c => c.id), mode === 'personalized' ? queries.join('\n') : '', tab !== 'continue' && !(settings.hideRecommendations && !settings.focusMode && tab !== 'subscriptions'));
  const videos = useMemo(() => {
    let list = tab === 'continue' ? Object.values(progress).filter(p => !p.completed && p.percent > .02 && p.percent < .97).sort((a,b) => b.updatedAt-a.updatedAt).map(p => catalog[p.videoId]).filter(Boolean) : feed.videos;
    if (settings.hideRecommendations && !settings.focusMode && tab !== 'continue' && tab !== 'subscriptions') return [];
    if (tab === 'personalized' && !settings.focusMode) list = rankFeed(list, queries, interests.dismissed, new Set(Object.values(progress).filter(p => p.completed).map(p => p.videoId)));
    return list.filter(v => !(settings.hideShorts && v.isShort) && !settings.channelBlocklist.includes(v.channelId) && !interests.dismissed.includes(v.id) && !settings.keywordBlocklist.some(k => k && `${v.title} ${v.channelName}`.toLowerCase().includes(k.toLowerCase())));
  }, [tab, feed.videos, settings, queries, interests.dismissed, progress, catalog]);
  const tabs: { id: Tab; label: string }[] = settings.focusMode ? [{ id: 'subscriptions', label: 'Subscriptions · Focus' }] : [{ id: 'personalized', label: 'For you' }, { id: 'subscriptions', label: 'Subscriptions' }, { id: 'popular', label: 'Explore' }, ...(settings.showContinueWatching ? [{ id: 'continue' as const, label: 'Continue watching' }] : [])];
  const needsSetup = !isNativeApp() && !settings.dataApiKey.trim() && tab !== 'continue';
  return <div className="mx-auto w-full max-w-[1920px] px-4 pb-16 sm:px-6">
    <h1 className="sr-only">Home video feed</h1>
    <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={settings.focusMode || tab === t.id} className={cn('h-9 shrink-0 rounded-lg px-3.5 text-[13px] font-medium transition-colors', settings.focusMode || tab === t.id ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--bg-elev-2)] text-[var(--text-dim)] hover:text-[var(--text)]')}>{t.label}</button>)}
      </div>
      <IconButton label="Refresh feed" disabled={feed.loading} onClick={feed.refresh} className="h-9 w-9 shrink-0"><RefreshCw className={cn('h-4 w-4', feed.loading && 'animate-spin')} /></IconButton>
      <Link to="/settings/feed" aria-label="Feed preferences" title="Feed preferences" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-[var(--bg-elev-2)]"><SlidersHorizontal className="h-4 w-4" /></Link>
    </div>
    {needsSetup ? <EmptyState title="Preview needs a video source" description="The browser preview needs a Data API key. Native desktop discovery uses bundled yt-dlp without a Google account or API key; the native build still needs verification." action={<Link to="/settings/account" className="text-sm text-[var(--accent)] underline">Configure browser access</Link>} /> : <>
      {feed.error && tab !== 'continue' && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm"><p className="min-w-0 flex-1">{feed.error}</p><Button size="sm" onClick={feed.refresh}>Retry</Button></div>}
      <VideoGrid videos={videos} loading={feed.loading && !feed.videos.length && tab !== 'continue'} empty={<EmptyState title={tab === 'continue' ? 'Nothing to resume yet' : 'No videos to show'} description={mode === 'subscriptions' ? 'Subscribe to channels to see their latest uploads here.' : 'Try refreshing, or change your feed preferences.'} action={<Link to={mode === 'subscriptions' ? '/subscriptions' : '/settings/feed'} className="text-sm text-[var(--accent)] underline">{mode === 'subscriptions' ? 'Find channels' : 'Feed preferences'}</Link>} />} />
      {feed.hasMore && tab !== 'continue' && <div className="mt-8 flex justify-center"><Button disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Loading…' : 'Show more videos'}</Button></div>}
    </>}
  </div>;
}
