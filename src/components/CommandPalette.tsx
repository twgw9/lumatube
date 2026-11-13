import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Folder,
  Home,
  ListVideo,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  Youtube,
} from "lucide-react";
import { demoVideos } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { cn } from "@/lib/utils";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  group: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const notes = useLibrary((s) => s.notes);
  const settings = useSettings();

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      onClose();
    };
    const base: Cmd[] = [
      { id: "go-home", label: "Go to Home", icon: <Home className="h-4 w-4" />, group: "Navigate", run: go("/") },
      { id: "go-subs", label: "Go to Subscriptions", icon: <ListVideo className="h-4 w-4" />, group: "Navigate", run: go("/subscriptions") },
      { id: "go-dl", label: "Go to Downloads", icon: <Download className="h-4 w-4" />, group: "Navigate", run: go("/downloads") },
      { id: "go-lib", label: "Go to Library", icon: <Folder className="h-4 w-4" />, group: "Navigate", run: go("/library") },
      { id: "go-notes", label: "Go to Notes", icon: <NotebookPen className="h-4 w-4" />, group: "Navigate", run: go("/notes") },
      { id: "go-set", label: "Open Settings", icon: <Settings className="h-4 w-4" />, group: "Navigate", run: go("/settings") },
      {
        id: "focus",
        label: settings.focusMode ? "Turn off Focus mode" : "Turn on Focus mode",
        icon: <Sparkles className="h-4 w-4" />,
        group: "Actions",
        hint: "⌘/",
        run: () => {
          settings.set("focusMode", !settings.focusMode);
          onClose();
        },
      },
      {
        id: "recs",
        label: settings.hideRecommendations ? "Show recommendations" : "Hide recommendations",
        icon: <Youtube className="h-4 w-4" />,
        group: "Actions",
        run: () => {
          settings.set("hideRecommendations", !settings.hideRecommendations);
          onClose();
        },
      },
      {
        id: "shorts",
        label: settings.hideShorts ? "Allow Shorts" : "Hide Shorts everywhere",
        icon: <Youtube className="h-4 w-4" />,
        group: "Actions",
        run: () => {
          settings.set("hideShorts", !settings.hideShorts);
          onClose();
        },
      },
    ];

    const qLower = q.trim().toLowerCase();
    const videos: Cmd[] = demoVideos
      .filter((v) => !qLower || v.title.toLowerCase().includes(qLower) || v.channelName.toLowerCase().includes(qLower))
      .slice(0, 5)
      .map((v) => ({
        id: `v-${v.id}`,
        label: v.title,
        hint: v.channelName,
        icon: <Search className="h-4 w-4" />,
        group: "Videos",
        run: go(`/watch/${v.id}`),
      }));

    const noteCmds: Cmd[] = notes
      .filter((n) => qLower && (n.body.toLowerCase().includes(qLower) || n.videoTitle.toLowerCase().includes(qLower)))
      .slice(0, 4)
      .map((n) => ({
        id: `n-${n.id}`,
        label: n.body.slice(0, 60),
        hint: n.videoTitle,
        icon: <NotebookPen className="h-4 w-4" />,
        group: "Notes",
        run: go(`/watch/${n.videoId}?t=${n.tsSec}`),
      }));

    return [...base.filter((c) => !qLower || c.label.toLowerCase().includes(qLower)), ...videos, ...noteCmds];
  }, [q, navigate, onClose, settings, notes]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  const groups = commands.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm anim-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl anim-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, commands.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          }
          if (e.key === "Enter" && commands[sel]) commands[sel].run();
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4">
          <Search className="h-4 w-4 text-[var(--text-mute)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a command, video or note…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-mute)]"
          />
          <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-mute)]">
            esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-mute)]">
                {group}
              </div>
              {items.map((c) => {
                flatIndex += 1;
                const active = flatIndex === sel;
                const idx = flatIndex;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setSel(idx)}
                    onClick={c.run}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                      active
                        ? "bg-[var(--bg-elev-2)] text-[var(--text)]"
                        : "text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)]",
                    )}
                  >
                    <span className="text-[var(--text-mute)]">{c.icon}</span>
                    <span className="clamp-1 flex-1">{c.label}</span>
                    {c.hint && (
                      <span className="shrink-0 text-[11px] text-[var(--text-mute)]">{c.hint}</span>
                    )}
                    {active && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                  </button>
                );
              })}
            </div>
          ))}
          {!commands.length && (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--text-mute)]">No results</p>
          )}
        </div>
      </div>
    </div>
  );
}
