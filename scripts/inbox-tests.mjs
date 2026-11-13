import assert from 'node:assert/strict';
import { createServer } from 'vite';
const memory = new Map();
globalThis.window = {localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}};
const vite = await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try {
 const {useInbox} = await vite.ssrLoadModule('/src/store/inbox.ts');
 const state = ()=>useInbox.getState();
 const video=(id,channelId='channel')=>({id,channelId,title:id,channelName:channelId,thumb:'',durationSec:0,publishedAt:''});
 state().ingest([video('old')]); assert.equal(state().notices.length,0,'First refresh establishes a baseline');
 state().ingest([video('new'),video('old')]); assert.equal(state().notices.length,1); assert.equal(state().notices[0].read,false);
 state().ingest([video('new')]); assert.equal(state().notices.length,1,'Repeated refresh does not duplicate alerts');
 state().markRead(); assert.equal(state().notices[0].read,true);
 state().toggleChannel('channel'); state().ingest([video('muted')]); assert.equal(state().notices.length,1);
 state().toggleChannel('channel'); state().ingest([video('muted')]); assert.equal(state().notices.length,1,'Muted uploads are not re-alerted');
 state().ingest([video('latest')]); assert.equal(state().notices.length,2);
 state().clear(); state().ingest([video('latest')]); assert.equal(state().notices.length,0,'Clear keeps dedupe baseline');
 console.log('PASS: subscription inbox baseline, deduplication, read, mute/unmute, clear');
} finally {await vite.close();}
