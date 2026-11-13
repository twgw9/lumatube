export const PROJECT = {
  name: "LumaTube",
  version: "0.1.0",
  owner: "twgw9",
  repo: "lumatube",
  url: "https://github.com/twgw9/lumatube",
  windowsPreview: "https://github.com/twgw9/lumatube/actions/runs/43466613113/artifacts/14059672438",
  windowsBuild: "https://github.com/twgw9/lumatube/actions/runs/43466613113",
  windowsCommit: "f6087e9",

};
export async function openExternal(url: string) {
  if (!(url.startsWith("https://github.com/") || url.startsWith("https://api.github.com/"))) return;
  if ("__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener,noreferrer");
}
