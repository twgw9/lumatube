import type { Chapter, Segment, Video, Channel, Note, DownloadJob, WatchEvent } from "./types";

/* ───────────────────────────────────────────────────────────────
   Demo dataset.
   Used when the app runs in a browser (no Rust backend). With the
   Tauri backend present, `bridge.ts` swaps these out for real RSS /
   Data API / yt-dlp results. Keep shapes identical.
   ─────────────────────────────────────────────────────────────── */

const now = Date.now();
const H = 3_600_000;
const D = 86_400_000;

const ch = (
  id: string,
  name: string,
  handle: string,
  subs: number,
  avatarColor: string,
): Channel => ({
  id,
  name,
  handle,
  subscribers: subs,
  avatar: `https://ui-avatars.com/api/?background=${avatarColor}&color=fff&bold=true&name=${encodeURIComponent(
    name.slice(0, 2),
  )}&size=128`,
  subscribed: true,
});

export const demoChannels: Channel[] = [
  ch("UCcodeharry", "CodeWithHarry", "CodeWithHarry", 2_100_000, "1c1c22"),
  ch("UCfireship", "Fireship", "fireship", 3_400_000, "1c1c22"),
  ch("UCtauri", "Tauri Apps", "tauriapps", 210_000, "0f766e"),
  ch("UCtechburner", "Tech Burner", "TechBurner", 11_200_000, "7c2d12"),
  ch("UCveritasium", "Veritasium", "veritasium", 15_800_000, "1e3a8a"),
  ch("UClofi", "Chill Lo-Fi", "chilllofi", 890_000, "4c1d95"),
  ch("UCnews", "Bihar Tech News", "bihartech", 74_000, "064e3b"),
];

const v = (
  id: string,
  channelId: string,
  title: string,
  durationSec: number,
  hoursAgo: number,
  views: number,
  extra: Partial<Video> = {},
): Video => {
  const c = demoChannels.find((x) => x.id === channelId)!;
  return {
    id,
    title,
    channelId,
    channelName: c.name,
    channelAvatar: c.avatar,
    publishedAt: new Date(now - hoursAgo * H).toISOString(),
    durationSec,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    views,
    ...extra,
  };
};

export const demoVideos: Video[] = [
  v("dQw4w9WgXcQ", "UCcodeharry", "Rust Ownership Explained Clearly", 1_464, 5, 512_000, {
    likes: 24_100,
    dislikes: 310,
    description:
      "Ownership, borrowing and lifetimes explained with real examples.\n\nChapters\n00:00 Intro\n00:48 Ownership rules\n02:35 String slices borrow\n04:10 Borrow checker demo\n06:20 Summary",
    chapters: [
      { startSec: 0, title: "Intro" },
      { startSec: 48, title: "Ownership rules" },
      { startSec: 155, title: "String slices borrow" },
      { startSec: 250, title: "Borrow checker demo" },
      { startSec: 380, title: "Summary" },
    ],
  }),
  v("aQ2xYz9kLm1", "UCtauri", "Tauri v2 in 100 Seconds — Build 8MB Desktop Apps", 612, 22, 88_400, {
    likes: 6_200,
    dislikes: 41,
    description: "Rust backend, web frontend, native performance.\n0:00 What is Tauri\n1:10 Setup\n3:40 IPC\n7:20 Build",
    chapters: [
      { startSec: 0, title: "What is Tauri" },
      { startSec: 70, title: "Setup" },
      { startSec: 220, title: "IPC" },
      { startSec: 440, title: "Build" },
    ],
  }),
  v("bZ7kQp3mNv2", "UCfireship", "The 100 second guide to YouTube clients", 118, 40, 1_240_000, {
    likes: 71_000,
    dislikes: 2_400,
  }),
  v("cVideoId0001", "UCtechburner", "Can This Phone Last 24 Hours? (Battery Test)", 1_022, 52, 940_000, {
    likes: 44_000,
    dislikes: 1_100,
  }),
  v("dVideoId0002", "UCveritasium", "Why the Speed of Light is the Limit", 1_586, 76, 8_400_000, {
    likes: 412_000,
    dislikes: 6_100,
  }),
  v("eVideoId0003", "UClofi", "lofi beats to code / relax to 🌙", 7_200, 90, 2_900_000, {
    likes: 121_000,
    dislikes: 800,
    isLive: true,
  }),
  v("fVideoId0004", "UCnews", "The AI Startup Scene in Patna — Local Builders Speak", 842, 100, 42_800, {
    likes: 3_100,
    dislikes: 90,
  }),
  v("gVideoId0005", "UCcodeharry", "TypeScript Generics — Poora Funda 20 Minute Me", 1_210, 120, 380_000, {
    likes: 18_400,
    dislikes: 220,
  }),
  v("hVideoId0006", "UCtauri", "Auto-update + sidecar binaries in Tauri v2", 905, 134, 51_200, {
    likes: 4_400,
    dislikes: 33,
  }),
  v("iVideoId0007", "UCfireship", "This new UI framework is FAST", 214, 150, 760_000, {
    likes: 39_000,
    dislikes: 1_900,
    isShort: true,
  }),
  v("jVideoId0008", "UClofi", "Deep focus — 2 hours ambient study session", 7_200, 168, 1_100_000, {
    likes: 62_000,
    dislikes: 400,
  }),
  v("kVideoId0009", "UCveritasium", "The Maths of Perfect Guesswork", 1_342, 190, 5_200_000, {
    likes: 240_000,
    dislikes: 3_300,
  }),
];

export const demoNoteSeed: Note[] = [
  {
    id: "n1",
    videoId: "dQw4w9WgXcQ",
    videoTitle: "Rust Ownership Explained Clearly",
    channelName: "CodeWithHarry",
    tsSec: 155,
    body: "String slices are references into a String — they don't take ownership. Example: `&str`.",
    tags: ["rust", "borrow"],
    createdAt: now - 2 * H,
    updatedAt: now - 2 * H,
  },
  {
    id: "n2",
    videoId: "dQw4w9WgXcQ",
    videoTitle: "Rust Ownership Explained Clearly",
    channelName: "CodeWithHarry",
    tsSec: 48,
    body: "Ownership rules: every value has one owner; only one owner at a time; the value drops when the owner leaves scope.",
    tags: ["rust"],
    createdAt: now - 5 * H,
    updatedAt: now - 5 * H,
  },
  {
    id: "n3",
    videoId: "aQ2xYz9kLm1",
    videoTitle: "Tauri v2 in 100 Seconds",
    channelName: "Tauri Apps",
    tsSec: 220,
    body: "IPC: `invoke()` frontend → `#[tauri::command]` Rust. Capabilities file me permissions tight rakhna.",
    tags: ["tauri", "ipc"],
    createdAt: now - 26 * H,
    updatedAt: now - 26 * H,
  },
];

export const demoHistorySeed: WatchEvent[] = [
  {
    id: "w1",
    videoId: "aQ2xYz9kLm1",
    title: "Tauri v2 in 100 Seconds — Build 8MB Desktop Apps",
    channelName: "Tauri Apps",
    thumb: `https://i.ytimg.com/vi/aQ2xYz9kLm1/hqdefault.jpg`,
    watchedAt: now - 3 * H,
    secondsWatched: 512,
  },
  {
    id: "w2",
    videoId: "kVideoId0009",
    title: "The Maths of Perfect Guesswork",
    channelName: "Veritasium",
    thumb: `https://i.ytimg.com/vi/kVideoId0009/hqdefault.jpg`,
    watchedAt: now - 30 * H,
    secondsWatched: 1_342,
  },
  {
    id: "w3",
    videoId: "eVideoId0003",
    title: "lofi beats to code / relax to 🌙",
    channelName: "Chill Lo-Fi",
    thumb: `https://i.ytimg.com/vi/eVideoId0003/hqdefault.jpg`,
    watchedAt: now - 2 * D,
    secondsWatched: 3_600,
  },
];

export const demoDownloadSeed: DownloadJob[] = [
  {
    id: "dl_1",
    videoId: "dQw4w9WgXcQ",
    title: "Rust Ownership Explained Clearly",
    channelName: "CodeWithHarry",
    thumb: `https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg`,
    preset: "1080p",
    status: "done",
    progress: 1,
    bytesTotal: 268_435_456,
    bytesDone: 268_435_456,
    filePath: "C:/Users/you/Videos/LumaTube/CodeWithHarry/Rust Ownership Explained Clearly.mp4",
    createdAt: now - 20 * H,
    finishedAt: now - 20 * H,
    showInGallery: true,
  },
  {
    id: "dl_2",
    videoId: "jVideoId0008",
    title: "Deep focus — 2 hours ambient study session",
    channelName: "Chill Lo-Fi",
    thumb: `https://i.ytimg.com/vi/jVideoId0008/hqdefault.jpg`,
    preset: "audio-m4a",
    status: "running",
    progress: 0.42,
    bytesTotal: 58_720_256,
    bytesDone: 24_662_508,
    speedBps: 3_355_443,
    createdAt: now - 0.2 * H,
    showInGallery: true,
  },
];

/* ─── SponsorBlock demo segments (real API used when available) ─── */
export const demoSegments: Record<string, Segment[]> = {
  dQw4w9WgXcQ: [
    { category: "sponsor", startSec: 320, endSec: 372, action: "skip" },
    { category: "selfpromo", startSec: 900, endSec: 948, action: "skip" },
    { category: "intro", startSec: 0, endSec: 8, action: "skip" },
    { category: "outro", startSec: 1_402, endSec: 1_464, action: "skip" },
    { category: "highlight", startSec: 155, endSec: 250, action: "full" },
  ],
  aQ2xYz9kLm1: [
    { category: "sponsor", startSec: 300, endSec: 330, action: "skip" },
    { category: "selfpromo", startSec: 520, endSec: 560, action: "skip" },
  ],
  bZ7kQp3mNv2: [{ category: "intro", startSec: 0, endSec: 4, action: "skip" }],
};

/* ─── Transcript demo (timed lines) ─── */
export const demoTranscript: Record<string, { t: number; text: string }[]> = {
  dQw4w9WgXcQ: [
    { t: 0, text: "Today we are going to understand Rust ownership from scratch." },
    { t: 8, text: "Ownership is the most unique feature Rust has." },
    { t: 22, text: "Every value has exactly one owner at a time." },
    { t: 48, text: "Remember three rules: one owner, one at a time, dropped at end of scope." },
    { t: 96, text: "Now let us look at what a move actually does." },
    { t: 155, text: "String slices are references, they never take ownership." },
    { t: 188, text: "&str is simply a borrowed string slice." },
    { t: 250, text: "The borrow checker catches all of this at compile time." },
    { t: 296, text: "That is why data races cannot happen in Rust." },
    { t: 320, text: "This video is brought to you by our sponsor." },
    { t: 372, text: "And now back to the content." },
    { t: 380, text: "Summary: ownership, borrowing, lifetimes." },
    { t: 420, text: "Use the playground to practise along." },
  ],
};
