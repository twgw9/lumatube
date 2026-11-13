import { useInbox } from "@/store/inbox";
import { Bell, BellOff } from "lucide-react";
import type { Channel } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { Button } from "./ui";
import { Check, Plus } from "lucide-react";
/** Device-local subscriptions; does not alter a Google account. */
export function SubscribeButton({ channel }: { channel: Channel }) {
  const current = useLibrary(s => s.channels.find(c => c.id === channel.id));
  const subscribed = Boolean(current && current.subscribed !== false);
  const muted = useInbox(s => s.muted.includes(channel.id));
  return <div className="flex items-center gap-1"><Button size="sm" variant={subscribed ? "secondary" : "primary"} aria-pressed={subscribed} title="Saved on this device (not synced to Google)" onClick={() => {
    const lib = useLibrary.getState();
    if (current) lib.toggleSubscribe(channel.id);
    else lib.addChannel({ ...channel, subscribed: true });
  }}>{subscribed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{subscribed ? "Subscribed" : "Subscribe"}</Button>{subscribed && <button aria-label={muted ? "Enable channel upload alerts" : "Mute channel upload alerts"} aria-pressed={!muted} title={muted ? "Enable refresh-based upload alerts" : "Mute refresh-based upload alerts"} onClick={() => useInbox.getState().toggleChannel(channel.id)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--bg-elev-2)]">{muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</button>}</div>;
}
