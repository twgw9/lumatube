import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { History, LogIn, Settings, Shield, UserRound, X } from "lucide-react";
import { useSettings } from "@/store/settings";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const recordHistory = useSettings(s => s.recordHistory);
  const set = useSettings(s => s.set);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  const item = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition hover:bg-[var(--bg-elev-2)]";
  return <div className="relative" ref={root}>
    <button ref={trigger} onClick={() => setOpen(v => !v)} aria-label="Current profile: Guest. Open profile" aria-expanded={open} className="ml-1 flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2.5 hover:bg-[var(--bg-elev-2)]"><UserRound className="h-5 w-5" /><span className="hidden text-xs font-medium sm:inline">Guest</span></button>
    {open && <section aria-label="Guest profile" className="absolute right-0 top-12 z-50 w-[min(320px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2 shadow-2xl anim-pop">
      <div className="mb-2 border-b border-[var(--border)] px-3 py-3"><div className="flex items-center justify-between"><strong>Current profile: Guest</strong><button aria-label="Close profile" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div><p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">No Google account connected. Your library is saved on this device.</p></div>
      <Link className={item} to="/settings/account" onClick={() => setOpen(false)}><LogIn className="h-4 w-4" />Sign in options<span className="ml-auto text-[10px] text-[var(--text-mute)]">Not ready</span></Link>
      <Link className={item} to="/library?tab=history" onClick={() => setOpen(false)}><History className="h-4 w-4" />Watch history</Link>
      <button className={item} onClick={() => set("recordHistory", !recordHistory)} aria-pressed={!recordHistory}><Shield className="h-4 w-4" />{recordHistory ? "Pause watch history" : "Resume watch history"}<span className="ml-auto text-xs text-[var(--accent)]">{recordHistory ? "On" : "Paused"}</span></button>
      <Link className={item} to="/settings" onClick={() => setOpen(false)}><Settings className="h-4 w-4" />Settings & appearance</Link>
      <Link className={item} to="/settings/about" onClick={() => setOpen(false)}>About, source & updates</Link>
    </section>}
  </div>;
}
