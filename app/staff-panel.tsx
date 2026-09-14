'use client';
import { t } from '@/lib/i18n';

import { useCallback, useEffect, useState } from 'react';
import {
  Crown,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  gameBackend,
  backendMessage,
  type Account,
  type GameBackend,
  type PublishedLevel,
  type StaffUser,
  type SavedRecipe,
} from '@/lib/backend';
import ReleaseComposer from './release-composer';
import { type CourseRecipe } from '@/lib/course-builder';
import './account-panel.css';
import { Input } from '@/components/ui/input';

export default function StaffPanel({
  account,
  draft,
  saved,
  onEdit,
  onPublished,
  editing: updating,
  setEditing: setUpdating,
  backend = gameBackend,
}: {
  account: Account | null;
  draft: CourseRecipe;
  saved: SavedRecipe[];
  onEdit: (recipe: CourseRecipe) => void;
  editing: PublishedLevel | null;
  setEditing: (level: PublishedLevel | null) => void;
  onPublished: () => void | Promise<void>;
  backend?: GameBackend;
}) {
  const [catalog, setCatalog] = useState<PublishedLevel[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isStaff = !!account && account.role !== 'player';
  const refresh = useCallback(async () => {
    if (isStaff) setCatalog(await backend.staffCatalog());
  }, [backend, isStaff]);
  useEffect(() => {
    let alive = true;
    if (isStaff)
      void backend
        .staffCatalog()
        .then((rows) => {
          if (alive) setCatalog(rows);
        })
        .catch((cause) => {
          if (alive) setError(backendMessage(cause));
        });
    return () => {
      alive = false;
    };
  }, [backend, isStaff]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (cause) {
      setError(backendMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  if (!isStaff) return null;
  const search = (e: { preventDefault(): void }) => {
    e.preventDefault();
    void run(async () => {
      setUsers(await backend.searchStaff(query));
      setSearched(true);
    });
  };
  return (
    <section className="tc-online-panel tc-staff-panel">
      <div className="tc-panel-heading">
        <div className="tc-panel-symbol">
          <Crown />
        </div>
        <div>
          <span className="tc-eyebrow">
            {t(account.role === 'owner' ? 'Club owner' : 'Course designer')}
          </span>
          <h2>{t('Design studio')}</h2>
        </div>
      </div>
      <ReleaseComposer
        saved={saved}
        catalog={catalog}
        draft={draft}
        editing={updating}
        backend={backend}
        busy={busy}
        run={run}
        onClear={() => setUpdating(null)}
        onPublished={async (version) => {
          await refresh();
          await onPublished();
          setMessage(
            `Published ${version}. Courses are now in the main course sequence.`,
          );
        }}
      />
      <div className="tc-section-heading">
        <h3>
          {t('Published courses')}
          {t(' ')}
          <span>{catalog.filter((c) => !c.retiredAt).length}</span>
        </h3>
        <button
          type="button"
          className="tc-icon-button"
          aria-label={t('Refresh published courses')}
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <ul className="tc-catalog-list">
        {catalog
          .filter((level) => !level.retiredAt)
          .map((level) => (
            <li key={level.id}>
              <div>
                <strong>
                  {t(level.courseNumber ? `${level.courseNumber}. ` : '')}
                  {level.recipe.name}
                </strong>
                <small>
                  {level.recipe.segments.length}
                  {t(' sections · revision')}
                  {t(' ')}
                  {level.revision}
                </small>
              </div>
              <div className="tc-inline-actions">
                <button
                  className="tc-icon-button"
                  type="button"
                  aria-label={t(`Edit ${level.recipe.name}`)}
                  disabled={busy}
                  onClick={() => {
                    setUpdating(level);
                    onEdit(level.recipe);
                    setMessage(
                      `“${level.recipe.name}” loaded into the builder. Open the builder to change it, then return here to publish the update.`,
                    );
                  }}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="tc-icon-button"
                  type="button"
                  aria-label={t(`Retire ${level.recipe.name}`)}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await backend.retire(level);
                      if (updating?.id === level.id) setUpdating(null);
                      await refresh();
                      await onPublished();
                      setMessage(
                        `“${level.recipe.name}” has been removed from the public list. Its history is preserved.`,
                      );
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </li>
          ))}
      </ul>
      {!catalog.some((level) => !level.retiredAt) && (
        <p className="tc-muted">
          {t('Your first published course will appear here.')}
        </p>
      )}
      {account.role === 'owner' && (
        <section className="tc-staff-roles">
          <div className="tc-section-heading">
            <h3>
              <ShieldCheck size={18} />
              {t('Course designers')}
            </h3>
          </div>
          <p className="tc-muted">
            {t(
              'Designers can publish and retire courses. Only you can manage this permission.',
            )}
          </p>
          <form className="tc-search-form" onSubmit={search}>
            <label htmlFor="tc-staff-search">
              {t('Find a player')}
              <Input
                id="tc-staff-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Username or full account email')}
                minLength={3}
                maxLength={128}
                required
              />
            </label>
            <button type="submit" className="tc-secondary" disabled={busy}>
              <Search size={17} />
              {t('Search')}
            </button>
          </form>
          <ul className="tc-catalog-list">
            {users.map((user) => (
              <li key={user.userId}>
                <div>
                  <strong>{t(user.username ?? 'Player name not set')}</strong>
                  <small>{t(user.email)}</small>
                </div>
                {user.role === 'owner' ? (
                  <span className="tc-role-badge">{t('Owner')}</span>
                ) : (
                  <button
                    type="button"
                    className="tc-secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const enabled = user.role !== 'designer';
                        await backend.setDesigner(user.userId, enabled);
                        setUsers((current) =>
                          current.map((u) =>
                            u.userId === user.userId
                              ? { ...u, role: enabled ? 'designer' : 'player' }
                              : u,
                          ),
                        );
                        setMessage(
                          `${user.username ?? user.email} ${enabled ? 'can now publish courses' : 'no longer has designer access'}.`,
                        );
                      })
                    }
                  >
                    {t(
                      user.role === 'designer'
                        ? 'Remove access'
                        : 'Make designer',
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {searched && !users.length && (
            <p className="tc-muted">
              {t(
                'No verified players found. Try their full email address or the start of their username.',
              )}
            </p>
          )}
        </section>
      )}
      {error && (
        <p className="tc-notice tc-error" role="alert">
          {t(error)}
        </p>
      )}
      {message && <output className="tc-notice">{t(message)}</output>}
    </section>
  );
}
