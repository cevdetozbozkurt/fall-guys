'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function useGameInstall() {
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
  return {
    installed,
    prompt,
    install: async () => {
      if (prompt) {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }
    },
  };
}
export default function InstallGame({
  controller,
}: {
  controller: ReturnType<typeof useGameInstall>;
}) {
  const [help, setHelp] = useState(false);
  if (controller.installed)
    return (
      <p className="tc-muted">
        Game installed · ready to launch from your home screen.
      </p>
    );
  return (
    <div className="install-menu">
      <button
        className="tc-secondary"
        onClick={() => {
          if (controller.prompt) void controller.install();
          else setHelp(!help);
        }}
      >
        <Download size={17} />
        Install game
      </button>
      {help && (
        <output>
          On iPhone or iPad, open this game in Safari. Tap Share → Add to Home
          Screen → Add. If shown, leave “Open as Web App” on. On Android or
          desktop, use your browser menu → Install app or Add to Home Screen.
        </output>
      )}
    </div>
  );
}
