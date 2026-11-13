import { useState } from "react";
import { PROJECT, openExternal } from "@/lib/project";
import { Badge, Button, SettingsSection } from "./ui";

export function ProjectInfo() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [release, setRelease] = useState<string | null>(null);
  async function check() {
    setBusy(true); setStatus(""); setRelease(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${PROJECT.owner}/${PROJECT.repo}/releases/latest`);
      if (res.status === 404) { setStatus("No published release found, or this repository is not publicly accessible."); return; }
      if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
      const data = await res.json();
      if (typeof data.html_url !== "string" || !data.html_url.startsWith(`${PROJECT.url}/releases/`)) throw new Error("Unexpected release URL");
      setRelease(data.html_url);
      setStatus(`Latest published release: ${data.tag_name}. Installed: v${PROJECT.version}. Review the release notes and device-compatible files before installing.`);
    } catch { setStatus("Could not check releases. Check your connection or open GitHub releases manually."); }
    finally { setBusy(false); }
  }
  return <>
    <SettingsSection title="LumaTube" description="Your videos. Your pace. Your space.">
      <div className="space-y-4 py-5 text-sm leading-relaxed text-[var(--text-dim)]">
        <img src="/logo.svg" alt="LumaTube logo" className="h-16 w-16" />
        <p>Version {PROJECT.version} · Personal-use, local-first video client. Not affiliated with YouTube or Google.</p>
        <div className="flex flex-wrap gap-2">{["Local library", "4× playback", "Timestamped notes", "SponsorBlock", "Custom themes", "No AI summaries"].map(x => <Badge key={x}>{x}</Badge>)}</div>
        <p>Source repository: <strong>{PROJECT.owner}/{PROJECT.repo}</strong>. Source availability is not a security audit. Review the code and build instructions before trusting a build. No open-source license has been declared yet.</p>
        <p>History and preferences are stored on this device. Playback, thumbnails and optional community services contact external servers. Google login and encrypted sync are not implemented yet.</p>
        <p>[Unofficial / Risky] YouTube extraction and community metadata may break. Fallback: update the extractor, disable enrichment, or watch on YouTube. Browser mode uses a bundled Big Buck Bunny sample (Blender Foundation, CC BY 3.0).</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void openExternal(PROJECT.url)}>View source</Button><Button size="sm" onClick={() => void openExternal(`${PROJECT.url}/issues`)}>Report an issue</Button></div>
      </div>
    </SettingsSection>
    <SettingsSection title="Updates from GitHub" description="Manual sideload updates — you stay in control.">
      <div className="space-y-3 py-4 text-sm text-[var(--text-dim)]">
        <p>Check published releases, read changes, then download the correct APK on your phone. Android asks you to approve installation. No silent installs or automatic APK execution.</p>
        <p>Updates require the same application ID and signing key. No Android APK is published by this setup yet; native playback, gallery integration and background download services still need Android implementation and device tests.</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "Check for release"}</Button><Button size="sm" onClick={() => void openExternal(release ?? `${PROJECT.url}/releases`)}>Open releases</Button></div>
        <p role="status">{status}</p>
      </div>
    </SettingsSection>
  </>;
}
