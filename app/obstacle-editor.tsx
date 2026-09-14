'use client';
import { t } from '@/lib/i18n';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  defaultObstacles,
  OBSTACLE_TYPES,
  MAX_OBSTACLES,
  type Segment,
  type ObstaclePlacement,
} from '@/lib/course-builder';

export const obstacleNames = {
  bar: 'Spinning arm',
  hurdle: 'Jump barrier',
  hammer: 'Hammer',
  falling: 'Meteor',
  bumper: 'Moving bumper',
  pendulum: 'Pendulum',
  pusher: 'Pusher',
};
export default function ObstacleEditor({
  segment,
  onChange,
}: {
  segment: Segment;
  onChange: (s: Segment) => void;
}) {
  const [lane, setLane] = useState<ObstaclePlacement['lane']>(
    segment.type === 'fork' ? 'risk' : 'main',
  );
  const selectedLane =
    segment.type === 'fork' ? (lane === 'main' ? 'risk' : lane) : 'main';
  const obstacles = segment.obstacles ?? defaultObstacles(segment);
  const change = (i: number, value: Partial<ObstaclePlacement>) =>
    onChange({
      ...segment,
      obstacles: obstacles.map((o, n) => (n === i ? { ...o, ...value } : o)),
    });
  const visible = obstacles
    .map((o, i) => ({ ...o, i }))
    .filter((o) => o.lane === selectedLane);
  return (
    <details className="obstacle-editor">
      <summary>
        {t('Obstacles ')}
        <b>{obstacles.length}</b>
        {' · '}
        {t('Position & layout')}
      </summary>
      <p>
        {t(
          'Difficulty changes path width, gap size and obstacle speed. Automatic layouts also add obstacles. Custom layouts keep your exact count and positions.',
        )}
      </p>
      <p className="difficulty-facts">
        {t(
          segment.difficulty === 1
            ? 'Easy: wide paths · 3.35 m jumps · slower hazards'
            : segment.difficulty === 2
              ? 'Medium: paths 2 m narrower · 3.70 m jumps · faster hazards'
              : 'Hard: paths 4 m narrower · 4.05 m jumps · fastest hazards',
        )}
      </p>
      {segment.type === 'fork' && (
        <div className="obstacle-lanes">
          {(['risk', 'cruise'] as const).map((l) => (
            <button
              type="button"
              key={l}
              aria-pressed={selectedLane === l}
              onClick={() => setLane(l)}
            >
              {t(
                l === 'risk' ? 'Risk · left shortcut' : 'Cruise · right detour',
              )}
            </button>
          ))}
        </div>
      )}
      <div
        className="placement-strip"
        aria-label={t('Obstacle positions from start to finish')}
      >
        <span>{t('START')}</span>
        <span>{t('FINISH')}</span>
        {visible.map((o) => (
          <b
            key={o.i}
            title={t(`${obstacleNames[o.type]} · ${o.at}%`)}
            style={{ left: `${o.at}%`, top: `${50 + o.offset * 25}%` }}
          >
            {o.i + 1}
          </b>
        ))}
      </div>
      <div className="obstacle-rows">
        {visible.map((o) => (
          <div className="obstacle-row" key={o.i}>
            <label>
              {t('Obstacle ')}
              {o.i + 1}
              <select
                value={o.type}
                onChange={(e) =>
                  change(o.i, {
                    type: e.target.value as ObstaclePlacement['type'],
                  })
                }
              >
                {OBSTACLE_TYPES.map((kind) => (
                  <option value={kind} key={kind}>
                    {t(obstacleNames[kind])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Along path (%)')}
              <input
                type="number"
                min="5"
                max="95"
                step="1"
                value={o.at}
                onChange={(e) =>
                  change(o.i, {
                    at: Math.max(5, Math.min(95, Number(e.target.value))),
                  })
                }
              />
            </label>
            <label>
              {t('Across path (%)')}
              <input
                type="number"
                min="-100"
                max="100"
                step="5"
                value={Math.round(o.offset * 100)}
                onChange={(e) =>
                  change(o.i, {
                    offset: Math.max(
                      -1,
                      Math.min(1, Number(e.target.value) / 100),
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              aria-label={t(`Remove obstacle ${o.i + 1}`)}
              onClick={() =>
                onChange({
                  ...segment,
                  obstacles: obstacles.filter((_, i) => i !== o.i),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <p>
        {t(
          'Across path: −100 left, 0 centre, +100 right. Positions follow curves and the selected fork.',
        )}
      </p>
      <div className="obstacle-actions">
        <button
          type="button"
          disabled={obstacles.length >= MAX_OBSTACLES}
          onClick={() =>
            onChange({
              ...segment,
              obstacles: [
                ...obstacles,
                { type: 'hurdle', at: 50, offset: 0, lane: selectedLane },
              ],
            })
          }
        >
          <Plus size={16} />
          {t(' Add obstacle')}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...segment, obstacles: [] })}
        >
          {t('Clear obstacles')}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = { ...segment };
            delete next.obstacles;
            onChange(next);
          }}
        >
          {t('Use difficulty preset')}
        </button>
      </div>
    </details>
  );
}
