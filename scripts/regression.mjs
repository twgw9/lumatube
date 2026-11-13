import assert from 'node:assert/strict';
import { createServer } from 'vite';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
globalThis.window = { localStorage: globalThis.localStorage };
const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { useSettings, defaultSettings } = await vite.ssrLoadModule('/src/store/settings.ts');
  assert.equal(defaultSettings.showNotes, false, 'Notes are off by default');
  assert.equal(defaultSettings.autoDownloadNewVideos, false, 'No automatic downloads by default');
  const migrated = useSettings.persist.getOptions().migrate({ showNotes: true, theme: 'forest', googleConnected: true }, 0);
  assert.equal(migrated.showNotes, false);
  assert.equal(migrated.theme, 'forest');
  assert.equal(migrated.googleConnected, false);
  useSettings.getState().set('showNotes', true);
  assert.equal(useSettings.getState().showNotes, true, 'Notes can be re-enabled');
  const { useLibrary } = await vite.ssrLoadModule('/src/store/library.ts');
  useLibrary.getState().addChannel({ id: 'regression', name: 'Test channel', subscribed: true });
  useLibrary.getState().toggleSubscribe('regression');
  assert.equal(useLibrary.getState().channels.find(c => c.id === 'regression').subscribed, false);
  useSettings.getState().set('recordHistory', false);
  assert.equal(useSettings.getState().recordHistory, false);
  console.log('PASS: safe defaults, settings migration, notes opt-in, local subscriptions, history preference');
} finally { await vite.close(); }
