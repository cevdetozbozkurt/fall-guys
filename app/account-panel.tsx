'use client';
import { t } from '@/lib/i18n';

import { useCallback, useEffect, useRef, useState, useId } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Check,
  Crown,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {
  gameBackend,
  backendMessage,
  OUTFIT_COLORS,
  type Account,
  type Cosmetics,
  type GameBackend,
} from '@/lib/backend';
import './account-panel.css';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

export function useAccount(backend: GameBackend = gameBackend) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(backend.configured);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const nextSession = await backend.getSession();
      const nextAccount = nextSession?.user.email_confirmed_at
        ? await backend.account()
        : null;
      if (current !== generation.current) return;
      setSession(nextSession);
      setAccount(nextAccount);
      setError('');
    } catch (cause) {
      if (current === generation.current) setError(backendMessage(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [backend]);
  useEffect(() => {
    let active = true;
    const unsubscribe = backend.subscribe((next, recovering) => {
      if (!active) return;
      setSession(next);
      if (!next) {
        ++generation.current;
        setAccount(null);
        setRecovery(false);
      }
      if (recovering) setRecovery(true);
      // Auth callbacks run inside the auth lock. Read the database after release.
      window.setTimeout(() => {
        if (active) void refresh();
      }, 0);
    });
    // oxlint-disable-next-line react/react-compiler -- Load the external auth session; refresh awaits the SDK before committing state.
    void refresh();
    return () => {
      active = false;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the latest pending request, not the mount-time request.
      ++generation.current;
      unsubscribe();
    };
  }, [backend, refresh]);
  const finishRecovery = useCallback(() => {
    setRecovery(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('recover');
    window.history.replaceState({}, '', url);
  }, []);
  return {
    session,
    account,
    loading,
    error,
    recovery,
    refresh,
    finishRecovery,
  };
}
export type AccountController = ReturnType<typeof useAccount>;

export function OutfitControls({
  value,
  onChange,
}: {
  value: Cosmetics;
  onChange: (value: Cosmetics) => void;
}) {
  const outfitId = useId();
  return (
    <fieldset className="tc-outfit">
      <legend>{t('Your look')}</legend>
      <fieldset className="tc-swatches" aria-label={t('Body color')}>
        {OUTFIT_COLORS.map((color, index) => (
          <button
            type="button"
            key={color}
            className={value.color === color ? 'selected' : ''}
            style={{ background: color }}
            aria-label={t(
              ['Coral', 'Lavender', 'Mint', 'Sunshine', 'Pink', 'Sky'][index],
            )}
            aria-pressed={value.color === color}
            onClick={() => onChange({ ...value, color })}
          >
            {value.color === color && <Check size={18} />}
          </button>
        ))}
      </fieldset>
      <div className="tc-form-grid">
        <label htmlFor={`${outfitId}-body`}>
          {t('Body')}
          <NativeSelect
            id={`${outfitId}-body`}
            value={value.body}
            onChange={(e) =>
              onChange({ ...value, body: e.target.value as Cosmetics['body'] })
            }
          >
            <NativeSelectOption value="bean">{t('Classic')}</NativeSelectOption>
            <NativeSelectOption value="round">{t('Round')}</NativeSelectOption>
            <NativeSelectOption value="tall">{t('Tall')}</NativeSelectOption>
          </NativeSelect>
        </label>
        <label htmlFor={`${outfitId}-head`}>
          {t('Hair &amp; hats')}
          <NativeSelect
            id={`${outfitId}-head`}
            value={value.head}
            onChange={(e) =>
              onChange({ ...value, head: e.target.value as Cosmetics['head'] })
            }
          >
            <NativeSelectOption value="none">{t('None')}</NativeSelectOption>
            <NativeSelectOption value="cap">{t('Cap')}</NativeSelectOption>
            <NativeSelectOption value="crown">{t('Crown')}</NativeSelectOption>
            <NativeSelectOption value="mohawk">
              {t('Mohawk')}
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <label htmlFor={`${outfitId}-eyes`}>
          {t('Eyewear')}
          <NativeSelect
            id={`${outfitId}-eyes`}
            value={value.eyes}
            onChange={(e) =>
              onChange({ ...value, eyes: e.target.value as Cosmetics['eyes'] })
            }
          >
            <NativeSelectOption value="visor">{t('Visor')}</NativeSelectOption>
            <NativeSelectOption value="glasses">
              {t('Glasses')}
            </NativeSelectOption>
            <NativeSelectOption value="shades">
              {t('Sunglasses')}
            </NativeSelectOption>
          </NativeSelect>
        </label>
      </div>
      <p className="tc-muted">
        {t('Every outfit has the same speed, jump, and hitbox.')}
      </p>
    </fieldset>
  );
}

export default function AccountPanel({
  controller,
  cosmetics,
  onCustomize,
  onBeforeSignOut,
  onStaff,
  backend = gameBackend,
}: {
  controller: AccountController;
  cosmetics: Cosmetics;
  onCosmeticsChange: (value: Cosmetics) => void;
  onCustomize?: () => void;
  onBeforeSignOut?: () => Promise<void>;
  onStaff?: () => void;
  backend?: GameBackend;
}) {
  const {
    session,
    account,
    loading,
    error,
    recovery,
    refresh,
    finishRecovery,
  } = controller;
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(account?.profile?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailure('');
    setMessage('');
    try {
      await action();
    } catch (cause) {
      setFailure(backendMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: { preventDefault(): void }) => {
    event.preventDefault();
    void run(async () => {
      if (recovery) {
        await backend.updatePassword(password);
        setPassword('');
        finishRecovery();
        setMessage('Your password has been updated.');
        return;
      }
      if (mode === 'reset') {
        await backend.resetPassword(email);
        setMessage(
          'If this email has an account, a reset link is on its way. Open it on this device to choose a new password.',
        );
        return;
      }
      if (mode === 'register') {
        const result = await backend.register(email, password, username);
        setPassword('');
        setMessage(
          result.confirmed
            ? 'Account created. Choose your player name below.'
            : 'Check your email to confirm your account, then come back and sign in.',
        );
      } else {
        await backend.signIn(email, password);
        setPassword('');
      }
      await refresh();
    });
  };
  if (!backend.configured)
    return (
      <section className="tc-online-panel">
        <div className="tc-panel-symbol">
          <UserRound />
        </div>
        <h2>{t('Your player account')}</h2>
        <p>
          {t(
            'Accounts and public matchmaking are not available yet. Solo courses and private friend rooms are ready to play.',
          )}
        </p>
        <button type="button" className="tc-secondary" onClick={onCustomize}>
          {t('Open star shop & outfits')}
        </button>
      </section>
    );
  return (
    <section className="tc-online-panel">
      <div className="tc-panel-heading">
        <div className="tc-panel-symbol">
          <UserRound />
        </div>
        <div>
          <span className="tc-eyebrow">{t('Tumble Club')}</span>
          <h2>
            {t(
              recovery
                ? 'Choose a new password'
                : session
                  ? (account?.profile?.username ?? 'Make it yours')
                  : 'Your next adventure starts here',
            )}
          </h2>
        </div>
      </div>
      {loading ? (
        <output>{t('Loading your account…')}</output>
      ) : session && !recovery ? (
        <>
          <div className="tc-account-status">
            <Mail size={16} />
            <span>{t(session.user.email)}</span>
            {session.user.email_confirmed_at && (
              <ShieldCheck size={17} aria-label={t('Verified email')} />
            )}
          </div>
          {!session.user.email_confirmed_at ? (
            <p className="tc-notice">
              {t('Confirm your email before joining public games.')}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await backend.saveProfile(username, cosmetics);
                  await refresh();
                  setMessage('Player profile saved.');
                });
              }}
            >
              <label htmlFor="tc-player-name">
                {t('Player name')}
                <Input
                  id="tc-player-name"
                  autoComplete="nickname"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  pattern="[A-Za-z0-9_]{3,24}"
                  minLength={3}
                  maxLength={24}
                  placeholder={t('CosmicRunner')}
                />
              </label>
              <p className="tc-muted">
                {t(
                  '3–24 letters, numbers, or underscores. Other racers see this name.',
                )}
              </p>
              <button
                type="button"
                className="tc-secondary"
                onClick={onCustomize}
              >
                {t('Open star shop & outfits')}
              </button>
              <button className="tc-primary" type="submit" disabled={busy}>
                <Check size={17} />
                {t(busy ? 'Saving…' : 'Save player profile')}
              </button>
            </form>
          )}
          <div className="tc-inline-actions">
            {account && account.role !== 'player' && onStaff && (
              <button type="button" className="tc-secondary" onClick={onStaff}>
                <Crown size={16} />
                {t(
                  account.role === 'owner'
                    ? 'Manage the club'
                    : 'Design studio',
                )}
              </button>
            )}
            <button
              type="button"
              className="tc-text-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await onBeforeSignOut?.();
                  await backend.signOut();
                  await refresh();
                })
              }
            >
              <LogOut size={16} />
              {t('Sign out')}
            </button>
          </div>
        </>
      ) : (
        <>
          {!recovery && backend.providers.email && (
            <fieldset className="tc-auth-tabs" aria-label={t('Account action')}>
              {(['login', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={mode === tab}
                  onClick={() => {
                    setMode(tab);
                    setFailure('');
                    setMessage('');
                  }}
                >
                  {t(tab === 'login' ? 'Sign in' : 'Create account')}
                </button>
              ))}
            </fieldset>
          )}
          {!recovery &&
            mode !== 'reset' &&
            (backend.providers.google || backend.providers.apple) && (
              <>
                <div className="tc-social-buttons">
                  {backend.providers.google && (
                    <button
                      type="button"
                      className="tc-secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(() => backend.signInProvider('google'))
                      }
                    >
                      <span aria-hidden="true" className="tc-provider-letter">
                        G
                      </span>
                      {t('Continue with Google')}
                    </button>
                  )}
                  {backend.providers.apple && (
                    <button
                      type="button"
                      className="tc-secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(() => backend.signInProvider('apple'))
                      }
                    >
                      <span aria-hidden="true" className="tc-provider-letter">
                        ●
                      </span>
                      {t('Continue with Apple')}
                    </button>
                  )}
                </div>
                {backend.providers.email && (
                  <div className="tc-divider">{t('or use email')}</div>
                )}
              </>
            )}
          {(recovery || backend.providers.email) && (
            <form onSubmit={submit}>
              {!recovery && mode === 'register' && (
                <label htmlFor="tc-player-name">
                  {t('Player name')}
                  <Input
                    id="tc-player-name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="nickname"
                    pattern="[A-Za-z0-9_]{3,24}"
                    minLength={3}
                    maxLength={24}
                    placeholder={t('CosmicRunner')}
                  />
                </label>
              )}
              {!recovery && (
                <label htmlFor="tc-email">
                  {t('Email')}
                  <Input
                    id="tc-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={254}
                    placeholder={t('you@example.com')}
                  />
                </label>
              )}
              {(recovery || mode !== 'reset') && (
                <label htmlFor="tc-password">
                  {t(recovery ? 'New password' : 'Password')}
                  <Input
                    id="tc-password"
                    type="password"
                    autoComplete={
                      mode === 'register' || recovery
                        ? 'new-password'
                        : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'login' && !recovery ? undefined : 8}
                    maxLength={128}
                    placeholder={t(
                      mode === 'register' || recovery
                        ? 'At least 8 characters'
                        : 'Your password',
                    )}
                  />
                </label>
              )}
              <button className="tc-primary" type="submit" disabled={busy}>
                {mode === 'register' ? (
                  <Sparkles size={17} />
                ) : (
                  <LogIn size={17} />
                )}
                {t(
                  busy
                    ? 'Please wait…'
                    : recovery
                      ? 'Save new password'
                      : mode === 'register'
                        ? 'Create account'
                        : mode === 'reset'
                          ? 'Send reset link'
                          : 'Sign in',
                )}
              </button>
            </form>
          )}
          {!recovery && !backend.providers.email && (
            <p className="tc-muted">
              {t(
                'Continue with Google to create an account or sign in. Email signup and password-reset emails are not available yet.',
              )}
            </p>
          )}
          {!recovery && backend.providers.email && (
            <button
              className="tc-text-button"
              type="button"
              onClick={() => {
                setMode(mode === 'reset' ? 'login' : 'reset');
                setMessage('');
                setFailure('');
              }}
            >
              {t(
                mode === 'reset' ? 'Back to sign in' : 'Forgot your password?',
              )}
            </button>
          )}
        </>
      )}
      {(failure || error) && (
        <p className="tc-notice tc-error" role="alert">
          {t(failure || error)}
        </p>
      )}
      {message && <output className="tc-notice">{t(message)}</output>}
    </section>
  );
}
