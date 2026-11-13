import { useState } from "react";
import { useSettings } from "@/store/settings";
import { Button, Switch } from "./ui";
const steps = [
  ["Welcome to LumaTube", "A personal space for videos, offline viewing and a calmer feed. Browser playback uses official YouTube embeds. Add a Data API key for public feeds/search, or use native RSS subscriptions without a key."],
  ["Watch your way", "Native playback offers up to 4× speed, quality controls, chapters, a sleep timer and SponsorBlock. Official browser embeds have their own controls. Quality depends on the available source, not a Premium subscription."],
  ["Make it yours", "Pick colours and themes in Settings. Hide notes, pause history, disable recommendations, and set your download storage limit. Auto-download starts off."],
  ["Local first, always your choice", "Your library stays on this device. External services receive requests when used. Google sign-in and Android background downloads are still in development. See About for source and update details."],
];
export function WelcomeTour() {
  const s = useSettings();
  const [step, setStep] = useState(0);
  if (s.onboardingDone) return null;
  const finish = () => { s.set("onboardingDone", true); setStep(0); };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-lg" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 shadow-2xl anim-pop">
      <div className="mb-7 flex items-center justify-between"><img src="/logo.svg" alt="" className="h-12 w-12" /><button onClick={finish} className="text-sm text-[var(--text-dim)]">Skip tutorial</button></div>
      <p className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">{step + 1} / {steps.length} · LumaTube</p>
      <h1 id="welcome-title" className="text-2xl font-semibold tracking-tight">{steps[step][0]}</h1>
      <p className="my-4 text-sm leading-7 text-[var(--text-dim)]">{steps[step][1]}</p>
      {step === 2 && <Switch checked={s.showNotes} onChange={v => s.set("showNotes", v)} label="Show notes tools" />}
      <div className="mt-7 flex items-center justify-between"><Button size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button><Button variant="primary" onClick={() => step === steps.length - 1 ? finish() : setStep(step + 1)}>{step === steps.length - 1 ? "Start watching" : "Next"}</Button></div>
    </section>
  </div>;
}
