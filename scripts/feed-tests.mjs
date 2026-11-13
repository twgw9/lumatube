import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
const original = globalThis.fetch;
try {
  const api = await vite.ssrLoadModule('/src/lib/youtube.ts');
  assert.equal(api.durationSeconds('PT1H2M3S'), 3723);
  assert.equal(api.durationSeconds('PT45S'), 45);
  assert.equal(api.durationSeconds('invalid'), 0);
  await assert.rejects(() => api.popularPage(''), /API key/);
  const calls = [];
  const responses = [];
  globalThis.fetch = async (url, options) => {
    calls.push(new URL(url));
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const next = responses.shift();
    assert.ok(next, 'No unexpected external request');
    return { ok: next.status === undefined, status: next.status ?? 200, json: async () => next };
  };
  const item = { id: 'realVideo123', snippet: { title: 'Real metadata', channelId: 'UCabcdefghijklmnopqrstuv', channelTitle: 'Channel', publishedAt: '2026-01-01T00:00:00Z' }, contentDetails: { duration: 'PT3M' }, statistics: { viewCount: '42' } };
  responses.push({ items: [item], nextPageToken: 'PAGE2' }, { items: [], nextPageToken: undefined });
  const first = await api.popularPage('test-key');
  assert.equal(first.videos[0].durationSec, 180); assert.equal(first.videos[0].channelName, 'Channel');
  await api.popularPage('test-key', first.nextPageToken);
  assert.equal(calls[1].searchParams.get('pageToken'), 'PAGE2');
  responses.push({ items: [{ id: { videoId: 'realVideo123' } }], nextPageToken: 'SEARCH2' }, { items: [item] });
  const search = await api.searchPage('test', 'test-key');
  assert.equal(search.videos[0].views, 42); assert.equal(search.nextPageToken, 'SEARCH2');
  responses.push({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUuploads' } } }] }, { items: [{ snippet: { resourceId: { videoId: 'realVideo123' } } }], nextPageToken: 'UPLOAD2' }, { items: [item] });
  const sub = await api.subscriptionPage('UCabcdefghijklmnopqrstuv', 'test-key');
  assert.equal(sub.videos[0].id, 'realVideo123'); assert.equal(sub.nextPageToken, 'UPLOAD2');
  responses.push({ status: 403, error: { message: 'quotaExceeded' } });
  await assert.rejects(() => api.popularPage('test-key'), /quota/);
  await assert.rejects(() => api.resolvePublicChannel('https://evil.example/@foo', 'test-key'), /YouTube channel/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => api.popularPage('test-key', '', controller.signal), /Aborted/);
  assert.equal(responses.length, 0);
  console.log('PASS: API mapping, duration parsing, popular/search/upload pagination, missing key, quota denial, URL validation, abort handling (mocked network)');
} finally { globalThis.fetch = original; await vite.close(); }
