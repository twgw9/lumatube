import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useInbox } from '@/store/inbox';
export function NotificationInbox() {
  const inbox = useInbox();
  const unread = inbox.notices.filter(n => !n.read).length;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div ref={root} className="relative">
    <button ref={trigger} aria-label={`Subscription notifications, ${unread} unread`} aria-expanded={open} onClick={()=>setOpen(!open)} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--bg-elev-2)]"><Bell className="h-5 w-5" />{unread>0 && <span className="absolute right-0 top-0 rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-black">{unread>9?'9+':unread}</span>}</button>
    {open && <section aria-label="Subscription notifications" className="fixed right-3 top-16 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl sm:absolute sm:right-0 sm:top-12 anim-pop">
      <div className="flex items-center gap-2 border-b border-[var(--border)] p-4"><h2 className="flex-1 text-sm font-semibold">Notifications</h2><button title="Mark all read" aria-label="Mark all read" onClick={inbox.markRead}><CheckCheck className="h-4 w-4" /></button><button className="ml-2" aria-label="Close notifications" onClick={()=>setOpen(false)}><X className="h-4 w-4" /></button></div>
      <div className="max-h-[55vh] overflow-y-auto">{inbox.notices.length ? inbox.notices.map(n=><Link key={n.id} to={`/watch/${n.videoId}`} onClick={()=>{inbox.markRead();setOpen(false);}} className="flex gap-3 border-b border-[var(--border)] p-4 hover:bg-[var(--bg-elev-2)]"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read?'bg-transparent':'bg-[var(--accent)]'}`} /><div><p className="text-xs text-[var(--text-mute)]">{n.channelName}</p><p className="mt-1 text-sm leading-snug">{n.title}</p></div></Link>) : <p className="p-6 text-center text-sm leading-6 text-[var(--text-dim)]">You're all caught up. New videos found on subscription refresh appear here after the first baseline refresh.</p>}</div>
      <div className="flex justify-between p-3 text-xs text-[var(--text-dim)]"><Link to="/subscriptions" onClick={()=>setOpen(false)}>Manage subscriptions</Link><button onClick={inbox.clear}>Clear inbox</button></div>
      <p className="px-3 pb-3 text-[11px] text-[var(--text-mute)]">Checks on refresh while using the app. No background push service.</p>
    </section>}
  </div>;
}
