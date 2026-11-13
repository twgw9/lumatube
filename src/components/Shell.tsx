import { WelcomeTour } from "@/components/WelcomeTour";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Command,
  Download,
  Folder,
  Home,
  ListVideo,
  Menu,
  Moon,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Youtube,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { CommandPalette } from "@/components/CommandPalette";
import { useDownloadEvents } from "@/hooks/useDownloadEvents";
import { IconButton } from "@/components/ui";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/subscriptions", label: "Subscriptions", icon: ListVideo },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/library", label: "Library", icon: Folder },
  { to: "/notes", label: "Notes", icon: NotebookPen },
];

export function Shell() {
  useDownloadEvents();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const channels = useLibrary((s) => s.channels);
  const folders = useLibrary((s) => s.folders);
  const downloads = useLibrary((s) => s.downloads);
  const showNotes = useSettings((s) => s.showNotes);
  const visibleNav = NAV.filter((item) => showNotes || item.to !== "/notes");
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);
  const isWatch = location.pathname.startsWith("/watch/");

  const activeDownloads = useMemo(
    () => downloads.filter((d) => d.status === "running" || d.status === "queued").length,
    [downloads],
  );

  /* global shortcuts: ctrl+k palette, ctrl+/ focus toggle, ctrl+b sidebar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        setSetting("focusMode", !useSettings.getState().focusMode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSetting]);

  useEffect(() => setMobileNav(false), [location.pathname]);
  useEffect(() => {
    if (!mobileNav) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNav(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileNav]);

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      {/* ── desktop sidebar ─────────────────────────────── */}
      <aside
        className={cn(
          "relative hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)] transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[220px]",
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-black">
              <img src="/logo.svg" alt="LumaTube" className="h-8 w-8" />
            </span>
            {!collapsed && (
              <span className="truncate text-[15px] font-semibold tracking-tight">
                Luma<span className="text-[var(--accent)]">Tube</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <IconButton
              label="Collapse sidebar (Ctrl+B)"
              onClick={() => setCollapsed(true)}
              className="ml-auto h-7 w-7"
            >
              <ChevronLeft />
            </IconButton>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
          <ul className="space-y-0.5">
            {visibleNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex h-9.5 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
                      isActive
                        ? "bg-[var(--bg-elev-2)] text-[var(--text)]"
                        : "text-[var(--text-dim)] hover:bg-[var(--bg-elev)] hover:text-[var(--text)]",
                      collapsed && "justify-center px-0",
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.to === "/downloads" && activeDownloads > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10.5px] font-bold text-black">
                      {activeDownloads}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {!collapsed && (
            <>
              <div className="mt-6 flex items-center justify-between px-2.5 pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-mute)]">
                  Folders
                </span>
                <IconButton label="New folder" className="h-6 w-6" onClick={() => navigate("/library")}>
                  <Plus className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              <ul className="space-y-0.5">
                {folders.map((f) => (
                  <li key={f.id}>
                    <Link
                      to={`/subscriptions?folder=${f.id}`}
                      className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--text)]"
                    >
                      <Folder className="h-4 w-4 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="ml-auto text-[11px] text-[var(--text-mute)]">
                        {f.channelIds.length}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-0.5 border-t border-[var(--border)] pt-3">
                <button
                  onClick={() => setSetting("focusMode", !useSettings.getState().focusMode)}
                  className={cn(
                    "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                    useSettings.getState().focusMode
                      ? "bg-accent-soft text-[var(--accent)]"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-elev)] hover:text-[var(--text)]",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Focus mode
                  <kbd className="ml-auto rounded border border-[var(--border)] px-1 text-[10px] text-[var(--text-mute)]">
                    ⌘/
                  </kbd>
                </button>
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-[var(--border)] p-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex h-9.5 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--text)]",
                isActive && "bg-[var(--bg-elev-2)] text-[var(--text)]",
                collapsed && "justify-center px-0",
              )
            }
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="h-4.5 w-4.5" />
            {!collapsed && "Settings"}
          </NavLink>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="mt-1 flex h-9 w-full items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--bg-elev)] hover:text-[var(--text)]"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── main column ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleNav={() => { if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed(v => !v); else setMobileNav(v => !v); }}
          onBack={isWatch ? () => navigate(-1) : undefined}
          extra={isWatch ? "watch" : undefined}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* ── mobile bottom nav ────────────────────────── */}
        <nav style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }} className="grid shrink-0 border-t border-[var(--border)] bg-[var(--bg)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors",
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-mute)]",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label === "Subscriptions" ? "Subs" : item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button autoFocus aria-label="Close navigation" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <aside className="relative flex h-full w-[min(320px,85vw)] flex-col border-r border-[var(--border)] bg-[var(--bg-elev)] p-4 shadow-2xl anim-pop">
            <div className="mb-5 flex items-center gap-3"><img src="/logo.svg" alt="" className="h-10 w-10" /><strong className="text-lg">LumaTube</strong><IconButton label="Close menu" onClick={() => setMobileNav(false)} className="ml-auto h-10 w-10"><X className="h-5 w-5" /></IconButton></div>
            <nav className="flex-1 overflow-y-auto space-y-1">
              {visibleNav.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileNav(false)} className={({isActive}) => cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition-colors", isActive ? "bg-accent-soft text-[var(--accent)]" : "text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)]")}><item.icon className="h-5 w-5" />{item.label}</NavLink>)}
              <p className="px-3 pt-6 pb-2 text-xs uppercase tracking-widest text-[var(--text-mute)]">Subscribed channels</p>
              {channels.filter(c => c.subscribed !== false).map(c => <Link onClick={() => setMobileNav(false)} key={c.id} to={`/channel/${c.id}`} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-[var(--bg-elev-2)]"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs text-[var(--accent)]">{c.name.slice(0,1)}</span><span className="truncate">{c.name}</span></Link>)}
              <Link to="/subscriptions" onClick={() => setMobileNav(false)} className="flex min-h-11 items-center gap-3 px-3 text-sm text-[var(--accent)]"><Plus className="h-4 w-4" />Manage subscriptions</Link>
            </nav>
            <Link to="/settings" onClick={() => setMobileNav(false)} className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><Settings className="h-5 w-5" />Settings & appearance</Link>
          </aside>
        </div>
      )}
      <WelcomeTour />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* theme quick toggle floating (desktop) */}
      <button
        onClick={() => setSetting("theme", theme === "oled" ? "graphite" : "oled")}
        className="fixed bottom-5 right-5 z-30 hidden h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-dim)] shadow-lg transition hover:text-[var(--text)] lg:grid"
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        {theme === "oled" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}

function TopBar({
  onOpenPalette,
  onToggleNav,
  onBack,
}: {
  onOpenPalette: () => void;
  onToggleNav: () => void;
  onBack?: () => void;
  extra?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const focusMode = useSettings((s) => s.focusMode);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/85 px-3 backdrop-blur-xl sm:px-4">
      {onBack ? (
        <IconButton label="Back" onClick={onBack} className="h-9 w-9 shrink-0">
          <ArrowLeft className="h-4.5 w-4.5" />
        </IconButton>
      ) : (
        <IconButton label="Menu" onClick={onToggleNav} className="h-9 w-9 shrink-0">
          <Menu className="h-5 w-5" />
        </IconButton>
      )}

      {/* search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        className="relative mx-auto flex max-w-2xl flex-1 items-center"
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-mute)]" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="h-9.5 w-full rounded-full border border-[var(--border)] bg-[var(--bg-elev)] pl-10 pr-16 text-[13.5px] outline-none transition placeholder:text-[var(--text-mute)] focus:border-[color-mix(in_oklab,var(--accent)_45%,var(--border))] focus:bg-[var(--bg-elev-2)]"
        />
        <button
          type="button"
          onClick={onOpenPalette}
          className="absolute right-1.5 flex h-7 items-center gap-1 rounded-full border border-[var(--border)] px-2 text-[10.5px] text-[var(--text-mute)] hover:text-[var(--text)]"
        >
          <Command className="h-3 w-3" />K
        </button>
      </form>

      <div className="ml-auto flex items-center gap-1">
        {focusMode && (
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-[var(--accent)] sm:flex">
            <Sparkles className="h-3 w-3" /> Focus
          </span>
        )}
        <IconButton label="Downloads" onClick={() => navigate("/downloads")} className="h-9 w-9">
          <Download className="h-4.5 w-4.5" />
        </IconButton>
        <button
          onClick={() => navigate("/settings/account")}
          className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-elev-2)] text-[11px] font-bold ring-1 ring-[var(--border)]"
          title="Account"
        >
          LT
        </button>
      </div>
    </header>
  );
}

function ChevronLeft() {
  return <ChevronRight className="h-4 w-4 rotate-180" />;
}
