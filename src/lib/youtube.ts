import { isAndroidNative, androidInvoke } from "./android";
import { isNativeApp } from "./utils";
import { invokeRequired } from "./bridge";
import type { Channel, Video } from './types';

export interface VideoPage { videos: Video[]; nextPageToken?: string }
interface ApiItem {
  id: string | { videoId?: string };
  snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Record<string, { url: string }>; resourceId?: { videoId?: string } };
  contentDetails?: { duration?: string; relatedPlaylists?: { uploads?: string } };
  statistics?: { viewCount?: string };
}
interface ApiResponse { items?: ApiItem[]; nextPageToken?: string; error?: { message?: string } }
export function durationSeconds(value = '') {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}
export async function youtubeRequest(path: string, params: Record<string, string>, key: string, signal?: AbortSignal): Promise<ApiResponse> {
  if (!key.trim()) throw new Error('Add your YouTube Data API key in Settings → Account, or use native subscription RSS. Google sign-in is not required for public videos.');
  const timeout = AbortSignal.timeout(20000);
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: key.trim() })}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const data: ApiResponse = await res.json();
  if (!res.ok || data.error) throw new Error(res.status === 403 ? 'YouTube API access denied or daily quota exceeded. Check your API key, restrictions and quota.' : `YouTube request failed (${res.status}). Try again later.`);
  return data;
}
export function apiVideo(item: ApiItem): Video | null {
  const id = typeof item.id === 'string' ? item.id : item.id.videoId;
  if (!id || !item.snippet?.title) return null;
  const s = item.snippet;
  return { id, title: s.title!, channelId: s.channelId ?? '', channelName: s.channelTitle ?? 'YouTube', description: s.description, publishedAt: s.publishedAt ?? '', thumb: s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, durationSec: durationSeconds(item.contentDetails?.duration), views: item.statistics?.viewCount ? Number(item.statistics.viewCount) : undefined };
}
export async function videoDetails(ids: string[], key: string, signal?: AbortSignal): Promise<Video[]> {
  if (!ids.length) return [];
  const data = await youtubeRequest('videos', { part: 'snippet,contentDetails,statistics', id: ids.slice(0, 50).join(',') }, key, signal);
  return (data.items ?? []).map(apiVideo).filter((v): v is Video => Boolean(v));
}
async function nativeDiscovery(query: string, token: string, signal?: AbortSignal): Promise<VideoPage> {
  signal?.throwIfAborted();
  if (isAndroidNative()) {
    const result = await androidInvoke<VideoPage>('discover_videos', { query, pageToken: token });
    signal?.throwIfAborted(); return result;
  }
  const page = token ? Number(token) : 0;
  if (!Number.isInteger(page) || page < 0 || page >= 12) throw new Error('Invalid discovery page. Refresh the feed.');
  const result = await invokeRequired<VideoPage>('discover_videos', { query, page });
  signal?.throwIfAborted();
  return result;
}
export async function popularPage(key: string, token = '', signal?: AbortSignal): Promise<VideoPage> {
  if (!key.trim() && isNativeApp()) return nativeDiscovery('popular videos India', token, signal);
  const data = await youtubeRequest('videos', { part: 'snippet,contentDetails,statistics', chart: 'mostPopular', regionCode: 'IN', maxResults: '24', ...(token ? { pageToken: token } : {}) }, key, signal);
  return { videos: (data.items ?? []).map(apiVideo).filter((v): v is Video => Boolean(v)), nextPageToken: data.nextPageToken };
}
export async function searchPage(query: string, key: string, token = '', signal?: AbortSignal): Promise<VideoPage> {
  if (!key.trim() && isNativeApp()) return nativeDiscovery(query, token, signal);
  const data = await youtubeRequest('search', { part: 'snippet', type: 'video', q: query, maxResults: '24', ...(token ? { pageToken: token } : {}) }, key, signal);
  const ids = (data.items ?? []).map(x => typeof x.id === 'object' ? x.id.videoId : x.id).filter((id): id is string => Boolean(id));
  return { videos: await videoDetails(ids, key, signal), nextPageToken: data.nextPageToken };
}
export async function resolvePublicChannel(value: string, key: string): Promise<Channel> {
  const raw = value.trim();
  let input = raw;
  if (/^https?:\/\//.test(raw)) {
    const url = new URL(raw);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) throw new Error('Use a YouTube channel URL, @handle or UC channel ID.');
    input = url.pathname.startsWith('/channel/') ? url.pathname.split('/')[2] : url.pathname.slice(1);
  }
  if (!/^UC[\w-]{22}$/.test(input) && !/^@[\w.\-\u0080-\uFFFF]+$/.test(input)) throw new Error('Enter a valid UC channel ID, @handle or channel URL.');
  const data = await youtubeRequest('channels', { part: 'snippet', ...(/^UC/.test(input) ? { id: input } : { forHandle: input }) }, key);
  const item = data.items?.[0];
  if (!item || typeof item.id !== 'string') throw new Error('Channel not found.');
  return { id: item.id, name: item.snippet?.title ?? input, avatar: item.snippet?.thumbnails?.default?.url, subscribed: true };
}
export async function subscriptionPage(channelId: string, key: string, token = '', signal?: AbortSignal): Promise<VideoPage> {
  // The uploads playlist is discovered once per request; no expensive search call.
  const ch = await youtubeRequest('channels', { part: 'contentDetails', id: channelId }, key, signal);
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('Uploads playlist unavailable for this channel.');
  const data = await youtubeRequest('playlistItems', { part: 'snippet', playlistId: uploads, maxResults: '24', ...(token ? { pageToken: token } : {}) }, key, signal);
  const ids = (data.items ?? []).map(x => x.snippet?.resourceId?.videoId).filter((id): id is string => Boolean(id));
  return { videos: await videoDetails(ids, key, signal), nextPageToken: data.nextPageToken };
}
