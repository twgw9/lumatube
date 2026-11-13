import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.localStorage = dom.window.localStorage;
const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
const original = globalThis.fetch;
const root = createRoot(document.getElementById('root'));
try {
  const { useSettings } = await vite.ssrLoadModule('/src/store/settings.ts');
  const { useFeed } = await vite.ssrLoadModule('/src/hooks/useFeed.ts');
  useSettings.getState().set('dataApiKey', 'test');
  let state;
  let requests = 0;
  function Probe() { state = useFeed('popular'); return React.createElement('span', null, String(state.videos.length)); }
  globalThis.fetch = async url => {
    requests++;
    const token = new URL(url).searchParams.get('pageToken');
    return { ok: true, json: async () => ({ items: [{ id: 'repeatVideo', snippet: { title: 'One real row', channelTitle: 'Channel' } }, ...(token ? [{ id: 'newVideo', snippet: { title: 'Next row' } }] : [])], nextPageToken: token ? undefined : 'NEXT' }) };
  };
  const until = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('Timed out waiting for feed state'); };
  root.render(React.createElement(Probe));
  await until(() => state && !state.loading && state.videos.length === 1);
  assert.equal(state.hasMore, true);
  const success = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  state.loadMore();
  await until(() => state.error === 'offline');
  assert.equal(state.videos.length, 1, 'Existing results survive a pagination error');
  globalThis.fetch = success;
  state.loadMore(); state.loadMore();
  await until(() => state.videos.length === 2 && !state.loading);
  assert.equal(requests, 2, 'Duplicate load-more clicks make one successful request');
  assert.equal(state.hasMore, false);
  state.loadMore();
  assert.equal(requests, 2, 'End of feed does not request the first page again');
  globalThis.fetch = async () => { throw new Error('offline'); };
  state.refresh();
  await until(() => !state.loading && state.error === 'offline' && state.videos.length === 0);
  console.log('PASS: feed hook paging, duplicate-click guard, deduplication, end-of-feed and failure states (jsdom + mocked network)');
} finally { root.unmount(); globalThis.fetch = original; await vite.close(); dom.window.close(); }
