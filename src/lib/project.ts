export const PROJECT = {
  name: "LumaTube",
  version: "0.1.0",
  owner: "twgw9",
  repo: "newww", // Rename request was denied by the GitHub integration (403).
  url: "https://github.com/twgw9/newww",
};
export async function openExternal(url: string) {
  if (!(url.startsWith("https://github.com/") || url.startsWith("https://api.github.com/"))) return;
  if ("__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener,noreferrer");
}
