import type { Channel } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { Button } from "./ui";
import { Check, Plus } from "lucide-react";
/** Device-local subscriptions; does not alter a Google account. */
export function SubscribeButton({ channel }: { channel: Channel }) {
  const current = useLibrary(s => s.channels.find(c => c.id === channel.id));
  const subscribed = Boolean(current && current.subscribed !== false);
  return <Button size="sm" variant={subscribed ? "secondary" : "primary"} aria-pressed={subscribed} title="Saved on this device (not synced to Google)" onClick={() => {
    const lib = useLibrary.getState();
    if (current) lib.toggleSubscribe(channel.id);
    else lib.addChannel({ ...channel, subscribed: true });
  }}>{subscribed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{subscribed ? "Subscribed" : "Subscribe"}</Button>;
}
