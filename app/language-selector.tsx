'use client';
/* oxlint-disable next/no-img-element -- Bundled tiny SVG flags are served by the static Vite game. */
import { useState, useSyncExternalStore } from 'react';
import {
  LANGUAGES,
  getLanguage,
  setLanguage,
  subscribeLanguage,
  t,
} from '@/lib/i18n';
export default function LanguageSelector() {
  const language = useSyncExternalStore(
      subscribeLanguage,
      getLanguage,
      () => 'tr',
    ),
    [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === language)!;
  return (
    <div className="language-selector">
      <button
        type="button"
        className="language-current"
        aria-label={t('Choose language')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <img src={`./flags/${current.flag}.svg`} alt="" />
        <span>{current.code.toUpperCase()}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <fieldset
          className="language-options"
          aria-label={t('Choose language')}
        >
          {LANGUAGES.map((l) => (
            <button
              type="button"
              key={l.code}
              aria-pressed={language === l.code}
              lang={l.code}
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
            >
              <img src={`./flags/${l.flag}.svg`} alt="" />
              {l.name}
              <span>{l.code === language ? '✓' : ''}</span>
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
