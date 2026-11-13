import { Link } from 'react-router-dom';
import { Button } from './ui';
export function FeedStatus({ error, loading, hasMore, refresh, loadMore }: { error: string; loading: boolean; hasMore: boolean; refresh: () => void; loadMore: () => void }) {
  return <div className="my-4 space-y-3">
    {error && <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm"><p>{error}</p><Link to="/settings/account" className="mt-2 inline-block underline">Configure API access</Link></div>}
    <div className="flex gap-2"><Button size="sm" onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh feed'}</Button>{hasMore && <Button size="sm" variant="primary" disabled={loading} onClick={loadMore}>Load more</Button>}</div>
  </div>;
}
