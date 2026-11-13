import assert from 'node:assert/strict';
import { createServer } from 'vite';
const memory = new Map();
globalThis.window = { localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } };
const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { useInterests } = await vite.ssrLoadModule('/src/store/interests.ts');
  const { interestQueries, rankFeed } = await vite.ssrLoadModule('/src/lib/recommendations.ts');
  const s = () => useInterests.getState();
  s().record('  Rust   programming  '); s().record('rust programming');
  assert.equal(s().searches.length, 1); assert.equal(s().searches[0].count, 2);
  s().setEnabled(false); s().record('private query'); assert.equal(s().searches.length, 1);
  s().setEnabled(true);
  for (let i=0;i<30;i++) s().record(`topic ${i}`);
  assert.equal(s().searches.length, 20);
  const now = Date.now();
  assert.deepEqual(interestQueries([{ query:'old',count:20,updatedAt:now-100*86400000 },{query:'rust',count:2,updatedAt:now}],now), ['rust']);
  const v = (id,title,channelId) => ({ id,title,channelId,channelName: channelId,thumb:'',publishedAt:new Date(now).toISOString(),durationSec:100 });
  const ranked = rankFeed([v('a','Rust tutorial','one'),v('b','Rust advanced','one'),v('c','Travel','two'),v('d','Rust hidden','three'),v('a','Rust tutorial','one')], ['rust'], ['d'], new Set(['b']), now);
  assert.equal(ranked[0].id,'a'); assert.equal(ranked[1].id,'c');
  assert.equal(ranked.length,3); assert.equal(ranked.some(x=>x.id==='d'),false);
  s().reset(); assert.equal(s().searches.length,0); assert.equal(s().dismissed.length,0);
  console.log('PASS: query cleanup, case dedupe, opt-out, bounded storage, expiry, ranking/diversity, dismissals, reset');
} finally { await vite.close(); }
