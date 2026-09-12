'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallGame() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      typeof window !== 'undefined' &&
      matchMedia('(display-mode: standalone)').matches,
  );
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    if (import.meta.env.PROD && 'serviceWorker' in navigator)
      void navigator.serviceWorker
        .register(new URL('sw.js', window.location.href), { scope: './' })
        .catch(() => {});
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (installed || !prompt) return null;
  return (
    <button
      className="install-game tc-secondary"
      onClick={() => {
        void prompt
          .prompt()
          .then(() => prompt.userChoice)
          .then(() => setPrompt(null));
      }}
    >
      <Download size={17} />
      Install game
    </button>
  );
}
