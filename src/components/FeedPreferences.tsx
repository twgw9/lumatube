import { useState } from 'react';
import { useInterests } from '@/store/interests';
import { useSettings } from '@/store/settings';
import { Button, Input, SettingsSection, Switch } from './ui';
export function FeedPreferences() {
  const interests = useInterests();
  const settings = useSettings();
  const [topic, setTopic] = useState('');
  return <>
    <SettingsSection title="Discovery preferences" description="Keep Home focused on videos. Manage learning and interests here.">
      <Switch checked={interests.enabled} onChange={interests.setEnabled} label="Learn from searches" description="Submitted searches inform your discovery mix. Preferences stay local; selected search topics are sent to YouTube to find videos." />
      <Switch checked={settings.showContinueWatching} onChange={v => settings.set('showContinueWatching',v)} label="Show Continue watching tab" />
      <div className="py-4"><form className="flex gap-2" onSubmit={e=>{e.preventDefault();interests.record(topic);setTopic('');}}><Input aria-label="Add discovery interest" placeholder="Add an interest, e.g. music or coding" value={topic} onChange={e=>setTopic(e.target.value)} /><Button disabled={!interests.enabled || topic.trim().length<2} type="submit">Add</Button></form><div className="mt-3 flex flex-wrap gap-2">{interests.searches.map(q=><button key={q.query} title="Remove interest" onClick={()=>interests.remove(q.query)} className="rounded-full bg-accent-soft px-3 py-1.5 text-xs text-[var(--accent)]">{q.query} ×</button>)}</div></div>
      <div className="py-4"><Button size="sm" variant="danger" onClick={()=>{if(window.confirm('Reset interests and Not interested choices?'))interests.reset();}}>Reset discovery</Button></div>
    </SettingsSection>
    <SettingsSection title="Video sources" description="No silent demo-video fallback."><p className="py-4 text-sm leading-6 text-[var(--text-dim)]">Native desktop discovery uses bundled yt-dlp and subscription RSS without an API key or Google login. [Unofficial / Risky] YouTube changes can break extraction; update yt-dlp or use a Data API key as fallback. Browser feeds require your own Data API key. Explore without a key is a public search mix, not YouTube's official trending chart. Native installation and end-to-end playback are not verified yet.</p></SettingsSection>
  </>;
}
