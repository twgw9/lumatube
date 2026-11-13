export type Engine = "auto" | "ytdlp" | "innertube" | "official";

export interface Channel {
  id: string;
  name: string;
  handle?: string;
  avatar?: string;
  subscribers?: number;
  subscribed?: boolean;
  tags?: string[];
  note?: string;
  folderIds?: string[];
}

export interface Video {
  id: string;
  title: string;
  /** original title from YouTube (kept when DeArrow replaces `title`) */
  originalTitle?: string;
  channelId: string;
  channelName: string;
  channelAvatar?: string;
  publishedAt: string;
  durationSec: number;
  thumb: string;
  originalThumb?: string;
  views?: number;
  likes?: number;
  dislikes?: number;
  description?: string;
  isLive?: boolean;
  isShort?: boolean;
  chapters?: Chapter[];
  /** DeArrow markers */
  dearrow?: boolean;
}

export interface Chapter {
  startSec: number;
  title: string;
  thumb?: string;
}

export interface Segment {
  category: SponsorCategory;
  startSec: number;
  endSec: number;
  action: "skip" | "mute" | "full";
  uuid?: string;
  votes?: number;
}

export type SponsorCategory =
  | "sponsor"
  | "selfpromo"
  | "interaction"
  | "intro"
  | "outro"
  | "preview"
  | "music_offtopic"
  | "filler"
  | "highlight"
  | "poi_highlight";

export interface Note {
  id: string;
  videoId: string;
  videoTitle: string;
  channelName: string;
  tsSec: number;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Clip {
  id: string;
  videoId: string;
  videoTitle: string;
  thumb: string;
  startSec: number;
  endSec?: number;
  label: string;
  createdAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  videoIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type ProgressState = "unwatched" | "in-progress" | "done";

export interface Progress {
  videoId: string;
  positionSec: number;
  durationSec: number;
  percent: number;
  updatedAt: number;
  completed: boolean;
}

export interface DownloadJob {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumb: string;
  preset: DownloadPreset;
  status: "queued" | "running" | "paused" | "done" | "error" | "canceled";
  progress: number; // 0..1
  speedBps?: number;
  etaSec?: number;
  bytesTotal?: number;
  bytesDone?: number;
  filePath?: string;
  error?: string;
  createdAt: number;
  finishedAt?: number;
  /** gallery visibility switch per item */
  showInGallery?: boolean;
}

export type DownloadPreset =
  | "1080p"
  | "4k"
  | "720p"
  | "480p"
  | "audio-m4a"
  | "audio-mp3"
  | "sponsor-free"
  | "subs-only";

/** persisted playback progress row shown on cards */
export interface WatchEvent {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumb: string;
  watchedAt: number;
  secondsWatched: number;
}

export interface FeedTab {
  id: string;
  label: string;
  kind: "feed" | "continue" | "folder" | "playlist" | "notes" | "downloads";
  folderId?: string;
  playlistId?: string;
  icon?: string;
}

export type Density = "comfortable" | "compact" | "grid";
export type ThemeName = "oled" | "graphite" | "sepia" | "light";
