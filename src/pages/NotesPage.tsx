import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileText, NotebookPen, Search, Trash2 } from "lucide-react";
import { useLibrary } from "@/store/library";
import { Badge, Button, EmptyState, Input } from "@/components/ui";
import { formatTime } from "@/lib/utils";

export function NotesPage() {
  const notes = useLibrary((s) => s.notes);
  const deleteNote = useLibrary((s) => s.deleteNote);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(
    () =>
      notes.filter((n) =>
        !q ? true : `${n.body} ${n.videoTitle} ${n.channelName} ${n.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [notes, q],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof notes>();
    for (const n of filtered) {
      const arr = map.get(n.videoId) ?? [];
      arr.push(n);
      map.set(n.videoId, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const exportMarkdown = () => {
    const md = notes
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(
        (n) =>
          `## ${n.videoTitle}\n_${n.channelName} · ${formatTime(n.tsSec)}_\n\n${n.body}\n\n---\n`,
      )
      .join("\n");
    const blob = new Blob([`# LumaTube Notes\n\n${md}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "localtube-notes.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-semibold tracking-tight">Notes</h1>
        <Badge tone="accent">{notes.length} saved</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={exportMarkdown}>
            <Download className="h-3.5 w-3.5" /> Export .md
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-mute)]" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Notes me dhoondo…" className="h-10 pl-10" />
      </div>

      {grouped.length ? (
        <div className="space-y-6">
          {grouped.map(([videoId, items]) => (
            <section key={videoId}>
              <header className="mb-2 flex items-baseline gap-2">
                <button
                  onClick={() => navigate(`/watch/${videoId}`)}
                  className="clamp-1 max-w-full text-left text-[13.5px] font-semibold hover:text-[var(--accent)]"
                >
                  {items[0].videoTitle}
                </button>
                <span className="shrink-0 text-[11.5px] text-[var(--text-mute)]">{items[0].channelName}</span>
              </header>
              <ul className="space-y-1.5">
                {items
                  .slice()
                  .sort((a, b) => a.tsSec - b.tsSec)
                  .map((n) => (
                    <li
                      key={n.id}
                      className="group flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 transition-colors hover:bg-[var(--bg-elev-2)]"
                    >
                      <button
                        onClick={() => navigate(`/watch/${videoId}?t=${n.tsSec}`)}
                        className="mt-0.5 h-fit shrink-0 rounded bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--accent)] hover:bg-[var(--accent)]/20"
                      >
                        {formatTime(n.tsSec)}
                      </button>
                      <p className="flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-dim)]">
                        {n.body}
                      </p>
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="shrink-0 text-[var(--text-mute)] opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<NotebookPen className="h-6 w-6" />}
          title="No notes yet"
          description="Write notes in the right panel while watching — timestamps attach automatically. Or use the 'Note' button in the player."
        />
      )}
    </div>
  );
}
