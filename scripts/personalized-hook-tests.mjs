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
  const tokens = [];
  const item = id => ({ id, snippet: { title: id, channelId: id, channelTitle: id } });
  function Probe() { state = useFeed('personalized', [], 'rust\ncricket'); return React.createElement('span', null, String(state.videos.length)); }
  globalThis.fetch = async url => {
    const u = new URL(url); tokens.push(u);
    if (u.pathname.endsWith('/search')) {
      const q = u.searchParams.get('q');
      const token = u.searchParams.get('pageToken');
      return { ok: true, json: async () => ({ items: [{ id: { videoId: q + (token ?? '') } }], nextPageToken: token ? undefined : q + '-next' }) };
    }
    return { ok: true, json: async () => ({ items: [item(u.searchParams.get('id') ?? 'popular')] }) };
  };
  const until = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('Timed out waiting for personalized feed'); };
  root.render(React.createElement(Probe));
  await until(() => state && !state.loading && state.videos.length === 1);
  for (let i=0;i<4;i++) { state.loadMore(); await until(() => !state.loading); await new Promise(r=>setTimeout(r,20)); }
  await until(() => state.videos.length === 5);
  const searches = tokens.filter(u => u.pathname.endsWith('/search'));
  assert.equal(searches.length,4);
  assert.equal(searches[0].searchParams.get('q'),'rust');
  assert.equal(searches[1].searchParams.get('q'),'cricket');
  assert.equal(searches[2].searchParams.get('pageToken'),'cricket-next');
  assert.equal(searches[3].searchParams.get('pageToken'),'rust-next');
  assert.equal(state.hasMore,false,'All topic and exploration cursors exhausted');
  const count = tokens.length; state.loadMore(); assert.equal(tokens.length,count);
  console.log('PASS: personalized topic rotation, popular exploration, independent page cursors, exhaustion (jsdom + mocked network)');
} finally { root.unmount(); globalThis.fetch = original; await vite.close(); dom.window.close(); }
