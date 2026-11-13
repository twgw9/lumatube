import { isTauri } from "@/lib/utils";
import { useState } from "react";
import { PROJECT, openExternal } from "@/lib/project";
import { Badge, Button, SettingsSection } from "./ui";

export function ProjectInfo() {
  const [copied, setCopied] = useState("");
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
        <p>[Unofficial / Risky] YouTube extraction and community metadata may break. Fallback: update the extractor, disable enrichment, or watch on YouTube. Browser playback uses official YouTube embeds; ads, regional restrictions and embed errors may apply. Public feeds require your Data API key. Native playback currently exposes combined audio/video formats only.</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void openExternal(PROJECT.url)}>View source</Button><Button size="sm" onClick={() => void openExternal(`${PROJECT.url}/issues`)}>Report an issue</Button></div>
      </div>
    </SettingsSection>
    <SettingsSection title="Install on Windows" description="Build verified · unsigned preview · runtime testing needed">
      <div className="space-y-3 py-4 text-sm leading-relaxed text-[var(--text-dim)]">
        <p>The Windows installer compiled successfully at commit {PROJECT.windowsCommit}. This does not verify live playback or downloads. This preview is for Windows x64, not Android or macOS.</p>
        <ol className="list-decimal space-y-2 pl-5"><li>Download the artifact ZIP from GitHub. GitHub sign-in may be required.</li><li>Extract the ZIP and inspect the included notices. Run the .exe installer only if you trust the source.</li><li>Open LumaTube → For you, then try Search and a channel subscription. Native discovery does not require a Google account or API key.</li></ol>
        <p>Unsigned apps may trigger Windows security warnings. Do not disable your system protections. Review source and build logs if unsure. Artifacts expire; if the download is unavailable, open the build page to inspect its status.</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => void openExternal(PROJECT.windowsPreview)}>Download Windows preview</Button><Button size="sm" onClick={() => void openExternal(PROJECT.windowsBuild)}>View build verification</Button></div>
      </div>
    </SettingsSection>
    <SettingsSection title="Troubleshooting" description="Share useful details without exposing account credentials or history.">
      <div className="space-y-3 py-4 text-sm text-[var(--text-dim)]">
        <p>Feed empty? Check the connection and refresh. Native extraction failed? Check extractor health in Settings → Downloads. Google sign-in and Android installation are not available yet.</p>
        <Button size="sm" onClick={async () => {
          const report = `LumaTube v${PROJECT.version}\nMode: ${isTauri() ? "Native" : "Browser"}\nPlatform: ${navigator.platform}\nVerified installer commit: ${PROJECT.windowsCommit}\nDescribe the issue and reproduction steps below:\n`;
          try { await navigator.clipboard.writeText(report); setCopied("Copied. No API key, searches or watch history included."); }
          catch { setCopied("Clipboard unavailable. Report your app version, platform, error text and reproduction steps manually."); }
        }}>Copy safe diagnostic info</Button>
        <p role="status" className="text-xs">{copied}</p>
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
