'use client';
import { t } from '@/lib/i18n';

import { useRef, useState } from 'react';
import { isSentence } from '@/lib/releases';
import { type CourseRecipe } from '@/lib/course-builder';
import {
  type PublishedLevel,
  type SavedRecipe,
  type GameBackend,
} from '@/lib/backend';

export default function ReleaseComposer({
  saved,
  catalog,
  draft,
  editing,
  backend,
  busy,
  run,
  onPublished,
  onClear,
}: {
  saved: SavedRecipe[];
  catalog: PublishedLevel[];
  draft: CourseRecipe;
  editing: PublishedLevel | null;
  backend: GameBackend;
  busy: boolean;
  run: (work: () => Promise<void>) => void;
  onPublished: (version: string) => Promise<void>;
  onClear: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [comment, setComment] = useState(''),
    [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const entries = editing
    ? [
        {
          recipe: draft,
          sourceId: editing.sourceId,
          id: editing.id,
          revision: editing.revision,
          description: descriptions[editing.id] ?? '',
        },
      ]
    : saved
        .filter((s) => selected.includes(s.id))
        .map((s) => {
          const existing = catalog.find(
            (l) => l.sourceId === s.id && !l.retiredAt,
          );
          return {
            recipe: s.recipe,
            sourceId: s.id,
            id: existing?.id,
            revision: existing?.revision,
            description: descriptions[s.id] ?? '',
          };
        });
  const valid =
    entries.length > 0 &&
    isSentence(comment) &&
    entries.every((e) => isSentence(e.description));
  return (
    <section className="release-composer tc-card">
      <h3>
        {t(
          editing
            ? `Update course ${editing.courseNumber}: ${editing.recipe.name}`
            : 'Publish a course release',
        )}
      </h3>
      <p>
        {t(
          'Saved courses join the main course sequence after course 50. Each publication increments the release version: v0.0.1, v0.0.2…',
        )}
      </p>
      {editing ? (
        <div className="release-draft">
          <strong>{draft.name}</strong>
          <span>
            {draft.segments.length}
            {t(' sections · Edited course preview')}
          </span>
          <button className="tc-secondary" disabled={busy} onClick={onClear}>
            {t('Cancel update')}
          </button>
        </div>
      ) : (
        <>
          <p>
            {t(
              'Save your designs in the builder, then select up to 16 courses below. Publishing an existing saved course updates its original course number.',
            )}
          </p>
          <button
            className="tc-secondary"
            disabled={busy || !saved.length}
            onClick={() =>
              setSelected(
                selected.length === saved.length ? [] : saved.map((s) => s.id),
              )
            }
          >
            {t('Select / clear all')}
          </button>
          {!saved.length && (
            <p>
              {t('No saved courses yet. Save a course in the builder first.')}
            </p>
          )}
          <div className="release-selection">
            {saved.map((s) => (
              <label key={s.id} aria-label={s.recipe.name}>
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  disabled={busy}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, s.id]
                        : selected.filter((id) => id !== s.id),
                    )
                  }
                />
                <span>
                  <strong>{s.recipe.name}</strong>
                  <small>
                    {s.recipe.segments.length}
                    {t(' sections · ')}
                    {t(
                      catalog.find((l) => l.sourceId === s.id)?.courseNumber
                        ? 'Update existing course'
                        : 'New main course',
                    )}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
      {entries.length > 0 && (
        <div className="release-notes">
          <label>
            {t('Release comment')}
            <textarea
              maxLength={1200}
              value={comment}
              disabled={busy}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t(
                'Describe what this release adds in at least one complete sentence.',
              )}
            />
          </label>
          {entries.map((e, i) => {
            const key = editing?.id ?? e.sourceId!;
            return (
              <label key={key}>
                <strong>
                  {t('Level ')}
                  {i + 1}: {e.recipe.name}
                </strong>
                <textarea
                  maxLength={1200}
                  value={e.description}
                  disabled={busy}
                  onChange={(event) =>
                    setDescriptions({
                      ...descriptions,
                      [key]: event.target.value,
                    })
                  }
                  placeholder={t(
                    'Describe this course in at least one complete sentence.',
                  )}
                />
                <small>
                  {t(
                    isSentence(e.description)
                      ? 'Description ready'
                      : 'Write at least 3 words, 12 characters and end with . ! or ?',
                  )}
                </small>
              </label>
            );
          })}
        </div>
      )}
      <button
        className="tc-primary"
        disabled={busy || !valid}
        onClick={() =>
          run(async () => {
            const fingerprint = JSON.stringify({ comment, entries });
            if (request.current?.fingerprint !== fingerprint)
              request.current = { fingerprint, id: crypto.randomUUID() };
            const result = await backend.publishRelease(
              comment,
              entries,
              request.current.id,
            );
            await onPublished(result.version);
            setSelected([]);
            setComment('');
            setDescriptions({});
            onClear();
            request.current = null;
          })
        }
      >
        {t(
          busy
            ? 'Publishing…'
            : `Publish ${entries.length} course${entries.length === 1 ? '' : 's'}`,
        )}
      </button>
      <small>
        {t(
          'All selected courses and notes publish together. Incomplete descriptions keep this button disabled.',
        )}
      </small>
    </section>
  );
}
