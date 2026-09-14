'use client';
import { t } from '@/lib/i18n';

import { useMemo, useState } from 'react';
import RouteMap from './course-map';
import ObstacleEditor from './obstacle-editor';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Flag,
  Hammer,
  Mountain,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Users,
  Waves,
  Zap,
  GripVertical,
  CornerUpLeft,
  CornerUpRight,
  GitFork,
  Route,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  MODULES,
  DEFAULT_RECIPE,
  MIN_SEGMENTS,
  MAX_SEGMENTS,
  buildCourse,
  recipeKey,
  parseRecipe,
  type CourseRecipe,
  type ModuleKey,
  type Segment,
} from '@/lib/course-builder';

const moduleIcons = [
  Flag,
  RotateCcw,
  Mountain,
  Zap,
  Hammer,
  Sparkles,
  Waves,
  ArrowDown,
  ArrowUp,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  GitFork,
  Route,
];
type Props = {
  saved: CourseRecipe[];
  cloud?: boolean;
  inParty: boolean;
  roomCourses: CourseRecipe[];
  draft: CourseRecipe;
  setDraft: (draft: CourseRecipe) => void;
  editingKey?: number;
  setEditingKey: (key?: number) => void;
  courseMessage: string;
  onSave: (recipe: CourseRecipe, replaces?: number) => string | Promise<string>;
  onDelete: (key: number) => void | Promise<void>;
  onTest: (recipe: CourseRecipe) => void;
  onAddToRoom: (recipe: CourseRecipe) => boolean;
};
export default function CourseEditor({
  saved,
  cloud = false,
  inParty,
  roomCourses,
  draft,
  setDraft,
  editingKey,
  setEditingKey,
  courseMessage,
  onSave,
  onDelete,
  onTest,
  onAddToRoom,
}: Props) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const course = useMemo(() => buildCourse(draft), [draft]);
  const valid = parseRecipe(draft);
  const inPool =
    !!valid && roomCourses.some((r) => recipeKey(r) === recipeKey(valid));
  const update = (segments: Segment[]) => {
    setDraft({ ...draft, segments });
    setMessage('');
  };
  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= draft.segments.length || from === to) return;
    const next = [...draft.segments];
    next.splice(to, 0, next.splice(from, 1)[0]);
    update(next);
  };
  const save = async () => {
    if (saving) return;
    if (!valid) {
      setMessage(
        `Enter a name and arrange ${MIN_SEGMENTS}–${MAX_SEGMENTS} sections.`,
      );
      return;
    }
    setSaving(true);
    const result = await onSave(valid, editingKey);
    setSaving(false);
    setMessage(result);
    if (result.startsWith('Saved')) {
      setEditingKey(recipeKey(valid));
      setDraft(valid);
    }
  };
  return (
    <div className="course-editor">
      <div className="editor-topline">
        <label htmlFor="custom-name">
          {t('Course name')}
          <Input
            id="custom-name"
            value={draft.name}
            maxLength={36}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <button
          className="secondary-button"
          onClick={() => {
            setDraft(structuredClone(DEFAULT_RECIPE));
            setEditingKey(undefined);
            setMessage('');
          }}
        >
          <Plus size={17} />
          {t(' New course')}
        </button>
      </div>
      <div className="editor-layout">
        <section className="module-palette" aria-label={t('Add a section')}>
          <h3>{t('Add a section')}</h3>
          <div className="module-grid">
            {MODULES.map((m, i) => {
              const Icon = moduleIcons[i];
              return (
                <button
                  key={m.key}
                  title={t(m.hint)}
                  disabled={draft.segments.length >= MAX_SEGMENTS}
                  onClick={() =>
                    update([...draft.segments, { type: m.key, difficulty: 1 }])
                  }
                >
                  <Icon size={23} style={{ color: m.color }} />
                  <strong>{t(m.name)}</strong>
                  <span>{t(m.hint)}</span>
                  <Plus size={14} />
                </button>
              );
            })}
          </div>
        </section>
        <section className="sequence-panel" aria-label={t('Course sequence')}>
          <div className="sequence-heading">
            <h3>{t('Your route')}</h3>
            <span>
              {draft.segments.length} / {MAX_SEGMENTS}
              {t(' sections')}
            </span>
          </div>
          <p className="editor-hint">
            {t(
              'Drag sections or use the arrows to change their order. Each section starts at a checkpoint.',
            )}
          </p>
          <div className="route-end">
            <Flag size={15} />
            {t(' START')}
          </div>
          <ol className="sequence-list">
            {draft.segments.map((section, i) => {
              const sectionInfo = MODULES.find((m) => m.key === section.type)!;
              return (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Labeled up/down buttons provide keyboard and touch reordering.
                <li
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    setDragged(i);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(i));
                  }}
                  onDragEnd={() => setDragged(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged !== null) reorder(dragged, i);
                    setDragged(null);
                  }}
                  className={dragged === i ? 'dragging' : ''}
                >
                  <GripVertical size={16} aria-hidden="true" />
                  <b style={{ color: sectionInfo.color }}>
                    {t(String(i + 1).padStart(2, '0'))}
                  </b>
                  <div className="segment-settings">
                    <NativeSelect
                      aria-label={t(`Section ${i + 1} type`)}
                      value={section.type}
                      onChange={(e) =>
                        update(
                          draft.segments.map((s, n) =>
                            n === i
                              ? {
                                  difficulty: s.difficulty,
                                  type: e.target.value as ModuleKey,
                                }
                              : s,
                          ),
                        )
                      }
                    >
                      {MODULES.map((m) => (
                        <NativeSelectOption key={m.key} value={m.key}>
                          {t(m.name)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <NativeSelect
                      aria-label={t(`Section ${i + 1} difficulty`)}
                      value={section.difficulty}
                      onChange={(e) =>
                        update(
                          draft.segments.map((s, n) =>
                            n === i
                              ? {
                                  ...s,
                                  difficulty: Number(e.target.value) as
                                    | 1
                                    | 2
                                    | 3,
                                }
                              : s,
                          ),
                        )
                      }
                    >
                      <NativeSelectOption value="1">
                        {t('Easy')}
                      </NativeSelectOption>
                      <NativeSelectOption value="2">
                        {t('Medium')}
                      </NativeSelectOption>
                      <NativeSelectOption value="3">
                        {t('Hard')}
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <ObstacleEditor
                    segment={section}
                    onChange={(value) =>
                      update(
                        draft.segments.map((s, n) => (n === i ? value : s)),
                      )
                    }
                  />
                  <div className="segment-actions">
                    <button
                      aria-label={t(`Move section ${i + 1} up`)}
                      disabled={i === 0}
                      onClick={() => reorder(i, i - 1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      aria-label={t(`Move section ${i + 1} down`)}
                      disabled={i === draft.segments.length - 1}
                      onClick={() => reorder(i, i + 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      aria-label={t(`Remove section ${i + 1}`)}
                      disabled={draft.segments.length <= MIN_SEGMENTS}
                      onClick={() =>
                        update(draft.segments.filter((_, n) => n !== i))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="route-end">
            <Flag size={15} />
            {t(' FINISH · ')}
            {Math.round(course.length)} m
          </div>
        </section>
      </div>
      <div className="elevation-preview">
        <span>{t('ROUTE PREVIEW · WHITE START / GOLD FINISH')}</span>
        <RouteMap course={course} />
      </div>
      <div className="editor-actions">
        <button
          className="play-button"
          disabled={!valid || saving}
          onClick={() => void save()}
        >
          <Save size={18} />
          {t(' SAVE COURSE')}
        </button>
        <button
          className="secondary-button"
          disabled={!valid || inParty}
          onClick={() => valid && onTest(valid)}
        >
          <Flag size={18} />
          {t(' Test run')}
        </button>
        <button
          className="secondary-button"
          disabled={!valid || !inParty || inPool}
          onClick={() => {
            if (valid)
              setMessage(
                onAddToRoom(valid)
                  ? ''
                  : 'The room course list is full or the connection is unavailable.',
              );
          }}
        >
          <Users size={18} />
          {t(inPool ? 'In room rotation' : 'Add to room')}
        </button>
      </div>
      <p className="editor-hint">
        {t(
          cloud
            ? 'Saved courses follow your account.'
            : 'Guest courses stay on this device.',
        )}
        {t(' ')}
        {t(
          inParty
            ? 'Add your course to this room so everyone can race it. Solo testing is available outside a room.'
            : 'Create or join a friend room to add your courses to its rotation.',
        )}
      </p>
      {(message || courseMessage) && (
        <output className="editor-message" aria-live="polite">
          {t(message || courseMessage)}
        </output>
      )}
      <section className="saved-courses">
        <h3>
          {t('My courses ')}
          <span>{saved.length} / 16</span>
        </h3>
        {saved.length === 0 ? (
          <p>{t('No saved courses yet. Build a route above and save it.')}</p>
        ) : (
          saved.map((r) => (
            <div key={recipeKey(r)}>
              <div>
                <strong>{t(r.name)}</strong>
                <span>
                  {r.segments.length}
                  {t(' sections')}
                </span>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setDraft(structuredClone(r));
                  setEditingKey(recipeKey(r));
                  setMessage('');
                }}
              >
                {t('Edit')}
              </button>
              <button
                className="text-button"
                disabled={inParty}
                onClick={() => onTest(r)}
              >
                {t('Play')}
              </button>
              <button
                className="icon-button"
                aria-label={t(`Delete saved course ${r.name}`)}
                onClick={() => {
                  void Promise.resolve(onDelete(recipeKey(r))).catch((error) =>
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Course could not be deleted.',
                    ),
                  );
                  if (editingKey === recipeKey(r)) setEditingKey(undefined);
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
