import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { HomePage } from "@/pages/HomePage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { WatchPage } from "@/pages/WatchPage";
import { DownloadsPage } from "@/pages/DownloadsPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { NotesPage } from "@/pages/NotesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SearchPage } from "@/pages/SearchPage";
import { ChannelPage } from "@/pages/ChannelPage";
import { useSettings } from "@/store/settings";

export function App() {
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const motion = useSettings((s) => s.motion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motion;
    root.style.setProperty("--accent", accent);
  }, [theme, accent, motion]);

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/channel/:id" element={<ChannelPage />} />
        {/* watch has its own full-bleed layout inside Shell */}
        <Route path="/watch/:id" element={<WatchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
