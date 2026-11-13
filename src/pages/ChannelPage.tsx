import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Bell, Users } from "lucide-react";
import { demoChannels, demoVideos } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { VideoCard } from "@/components/VideoCard";
import { Button, Badge, EmptyState } from "@/components/ui";
import { formatCount, timeAgo } from "@/lib/utils";

export function ChannelPage() {
  const { id = "" } = useParams();
  const channel = useMemo(
    () => useLibrary.getState().channels.find((c) => c.id === id) ?? demoChannels[0],
    [id],
  );
  const videos = demoVideos.filter((v) => v.channelId === channel.id);
  const toggleSubscribe = useLibrary((s) => s.toggleSubscribe);
  const subscribed = useLibrary((s) => s.channels.find((c) => c.id === channel.id)?.subscribed);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pb-16 sm:px-6">
      <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="h-24 bg-gradient-to-r from-[color-mix(in_oklab,var(--accent)_25%,transparent)] to-transparent sm:h-32" />
        <div className="flex flex-wrap items-end gap-4 px-4 pb-4 sm:px-6">
          <img
            src={channel.avatar}
            alt=""
            className="-mt-8 h-20 w-20 rounded-full object-cover ring-4 ring-[var(--bg-elev)]"
          />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-[18px] font-semibold">{channel.name}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-[var(--text-mute)]">
              {channel.handle && <span>@{channel.handle}</span>}
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {formatCount(channel.subscribers)} subscribers
              </span>
              <span>·</span>
              <span>{videos.length} videos</span>
            </p>
          </div>
          <div className="flex gap-2 pb-1">
            <Button variant="secondary" size="md">
              <Bell className="h-4 w-4" /> Notify
            </Button>
            <Button
              variant={subscribed ? "secondary" : "primary"}
              size="md"
              onClick={() => toggleSubscribe(channel.id)}
            >
              {subscribed ? "Subscribed" : "Subscribe"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Badge tone="accent">RSS feed</Badge>
        <span className="text-[11.5px] text-[var(--text-mute)]">
          Last checked {timeAgo(new Date().toISOString())}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {videos.length ? (
          videos.map((v) => <VideoCard key={v.id} video={v} />)
        ) : (
          <div className="col-span-full">
            <EmptyState title="No videos from this channel" />
          </div>
        )}
      </div>
    </div>
  );
}
