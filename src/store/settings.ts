import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Density, DownloadPreset, Engine, FeedTab, ThemeName } from "@/lib/types";

export interface Settings {
  /* appearance */
  theme: ThemeName;
  accent: string;
  density: Density;
  motion: "full" | "reduced";
  foldThumbs: boolean;
  showNotes: boolean;
  onboardingDone: boolean;
  downloadNotifications: boolean;
  recordHistory: boolean;
  showContinueWatching: boolean;

  /* playback */
  engine: Engine;
  defaultSpeed: number;
  rememberSpeedPerChannel: boolean;
  defaultQuality: string;
  premiumStreaming: boolean;
  preferHighestFps: boolean;
  preloadNext: boolean;
  ambientMode: boolean;
  showStats: boolean;
  autoplayNext: boolean;
  resumePlayback: boolean;
  seekStepSec: number;
  volume: number;

  /* focus / anti-algorithm */
  focusMode: boolean;
  hideRecommendations: boolean;
  hideComments: boolean;
  hideShorts: boolean;
  hideEndScreen: boolean;
  hideSidebarRecs: boolean;
  hideLiveChat: boolean;
  autoPlayDisabledInFocus: boolean;
  keywordBlocklist: string[];
  channelBlocklist: string[];
  dailyWatchLimitMin: number; // 0 = off

  /* enrich */
  sponsorBlock: boolean;
  sponsorCategories: string[];
  sponsorMuteInsteadOfSkip: boolean;
  dearrow: boolean;
  showOriginalTitles: boolean;
  returnYoutubeDislike: boolean;

  /* downloads */
  downloadPreset: DownloadPreset;
  downloadFolder: string;
  showDownloadsInGallery: boolean;
  downloadSubfoldersByChannel: boolean;
  embedThumbnail: boolean;
  embedChapters: boolean;
  embedSubs: boolean;
  sponsorCutOnDownload: boolean;
  downloadConcurrency: number;
  wifiOnlyDownloads: boolean;
  maxStorageGb: number;
  autoDownloadNewVideos: boolean;
  autoDownloadPreset: DownloadPreset;

  /* data */
  syncEnabled: boolean;
  backupOnQuit: boolean;

  /* account */
  googleConnected: boolean;
  googleEmail: string | null;
  dataApiKey: string;
  oauthClientId: string;

  /* sync folder */
  syncFolder: string;

  /* tabs */
  homeTabs: FeedTab[];
}

export const defaultSettings: Settings = {
  theme: "oled",
  accent: "#2dd4bf",
  density: "comfortable",
  motion: "full",
  foldThumbs: false,
  showNotes: true,
  onboardingDone: false,
  downloadNotifications: false,
  recordHistory: true,
  showContinueWatching: true,

  engine: "auto",
  defaultSpeed: 1,
  rememberSpeedPerChannel: true,
  defaultQuality: "auto",
  premiumStreaming: true,
  preferHighestFps: true,
  preloadNext: true,
  ambientMode: true,
  showStats: false,
  autoplayNext: true,
  resumePlayback: true,
  seekStepSec: 10,
  volume: 1,

  focusMode: false,
  hideRecommendations: false,
  hideComments: false,
  hideShorts: false,
  hideEndScreen: true,
  hideSidebarRecs: false,
  hideLiveChat: true,
  autoPlayDisabledInFocus: true,
  keywordBlocklist: [],
  channelBlocklist: [],
  dailyWatchLimitMin: 0,

  sponsorBlock: true,
  sponsorCategories: ["sponsor", "selfpromo", "interaction", "intro", "outro"],
  sponsorMuteInsteadOfSkip: false,
  dearrow: true,
  showOriginalTitles: false,
  returnYoutubeDislike: true,

  downloadPreset: "1080p",
  downloadFolder: "~/Videos/LumaTube",
  showDownloadsInGallery: true,
  downloadSubfoldersByChannel: true,
  embedThumbnail: true,
  embedChapters: true,
  embedSubs: false,
  sponsorCutOnDownload: false,
  downloadConcurrency: 2,
  wifiOnlyDownloads: false,
  maxStorageGb: 50,
  autoDownloadNewVideos: false,
  autoDownloadPreset: "480p",

  syncEnabled: false,
  backupOnQuit: false,

  googleConnected: false,
  googleEmail: null,
  dataApiKey: "",
  oauthClientId: "",

  syncFolder: "~/LumaTube/sync",

  homeTabs: [
    { id: "t_new", label: "New today", kind: "feed", icon: "sparkles" },
    { id: "t_continue", label: "Continue watching", kind: "continue", icon: "play" },
    { id: "t_tech", label: "Tech", kind: "folder", icon: "folder", folderId: "f_tech" },
    { id: "t_music", label: "Music", kind: "folder", icon: "music", folderId: "f_music" },
  ],
};

export const ACCENTS = [
  { name: "Teal", value: "#2dd4bf" },
  { name: "Red", value: "#f43f5e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Violet", value: "#a78bfa" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Lime", value: "#a3e635" },
  { name: "Orange", value: "#fb923c" },
  { name: "Pink", value: "#ec4899" },
];

export const SPEEDS = [
  0.25, 0.5, 0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4,
];

/** Nearest supported rate — <video> clamps out-of-range values silently. */
export function clampSpeed(v: number) {
  return Math.min(4, Math.max(0.0625, v));
}

export const QUALITY_OPTIONS = [
  { value: "auto", label: "Auto (adaptive)" },
  { value: "4320p", label: "4320p · 8K" },
  { value: "2160p", label: "2160p · 4K" },
  { value: "1440p", label: "1440p · 2K" },
  { value: "1080p", label: "1080p · Full HD" },
  { value: "720p", label: "720p · HD" },
  { value: "480p", label: "480p · data saver" },
  { value: "360p", label: "360p · low" },
] as const;

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  patch: (p: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      patch: (p) => set(p),
      reset: () => set(defaultSettings),
    }),
    { name: "localtube.settings.v1" },
  ),
);
