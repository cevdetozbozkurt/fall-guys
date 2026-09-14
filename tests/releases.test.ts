/* oxlint-disable typescript/no-explicit-any -- RPC fixtures intentionally inspect untyped Postgres JSON returned by the isolated test database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_RECIPE,
  parseRecipe,
  buildCourse,
  defaultObstacles,
  MODULES,
} from '../lib/course-builder.ts';
import { isSentence, estimatedTargets } from '../lib/releases.ts';
import { roadSurface } from '../lib/road-surface.ts';
import { translate } from '../lib/i18n.ts';
import { COURSES, installCatalog } from '../lib/courses.ts';
import { installRewards } from '../lib/course-rewards.ts';
import {
  newProgression,
  recordFinish,
  unlockedThrough,
  parseProgression,
  earnedStars,
} from '../lib/progression.ts';
import { Simulation } from '../lib/simulation.ts';
import { Party } from '../lib/multiplayer.ts';

void test('published courses unlock sequentially, retain retired stars, and keep online identity before guest catalog refresh', () => {
  try {
    installRewards(
      [51, 52].map((id) => ({ id, gold: 40, silver: 55, target: 70 })),
    );
    const levels = [51, 52].map((courseNumber) => ({
      courseNumber,
      recipe: { ...DEFAULT_RECIPE, name: `Course ${courseNumber}` },
      description: 'A new challenge awaits.',
      retiredAt: null,
    }));
    installCatalog(levels);
    let progress = newProgression();
    assert.equal(recordFinish(progress, 51, 60), progress);
    for (let id = 1; id <= 50; id++) progress = recordFinish(progress, id, 100);
    assert.equal(unlockedThrough(progress), 51);
    progress = recordFinish(progress, 51, 60);
    assert.equal(unlockedThrough(progress), 52);
    const callbacks = { change() {}, prepare() {}, roster() {}, ended() {} };
    const host = new Party(new Simulation(COURSES[50]), callbacks);
    host.round = 1;
    const packet = host.roundPacket();
    assert.equal(packet.catalogNumber, 51);
    installCatalog([]);
    const guest = new Party(new Simulation(), callbacks);
    guest.receiveHost(packet);
    assert.equal(guest.sim.course.id, 51);
    assert.equal(guest.sim.course.name, 'Course 51');
    installCatalog(levels.slice(1));
    const restored = parseProgression(progress);
    assert.equal(restored.best[51], 60);
    assert.equal(earnedStars(restored), earnedStars(progress));
    assert.equal(unlockedThrough(restored), 52);
  } finally {
    installCatalog([]);
  }
});

void test('every section supports exact obstacle counts, branches, positions and canonical saving', () => {
  for (const part of MODULES) {
    const lane = part.key === 'fork' ? 'cruise' : 'main';
    const recipe = {
      ...DEFAULT_RECIPE,
      segments: [
        {
          type: part.key,
          difficulty: 2,
          obstacles: [{ type: 'hammer', lane, at: 65, offset: -0.3 }],
        },
        ...DEFAULT_RECIPE.segments.slice(1),
      ],
    };
    const parsed = parseRecipe(recipe)!;
    assert.ok(parsed);
    assert.deepEqual(parseRecipe(JSON.parse(JSON.stringify(parsed))), parsed);
    const edited = buildCourse(parsed),
      empty = buildCourse({
        ...parsed,
        segments: [
          { ...parsed.segments[0], obstacles: [] },
          ...parsed.segments.slice(1),
        ],
      });
    assert.equal(edited.obstacles.length, empty.obstacles.length + 1);
    assert.ok(
      edited.obstacles.every(
        (o) =>
          Number.isFinite(o.x) && Number.isFinite(o.z) && Number.isFinite(o.y),
      ),
    );
    assert.ok(roadSurface(edited).length);
  }
  for (const difficulty of [1, 2, 3] as const)
    assert.equal(
      defaultObstacles({ type: 'slalom', difficulty }).filter(
        (o) => o.type === 'falling',
      ).length,
      3 + difficulty,
    );
  for (const at of [NaN, -1, 101])
    assert.equal(
      parseRecipe({
        ...DEFAULT_RECIPE,
        segments: DEFAULT_RECIPE.segments.map((s) => ({
          ...s,
          obstacles: [{ type: 'falling', lane: 'main', at, offset: 0 }],
        })),
      }),
      null,
    );
});
void test('Turkish default vocabulary and all four languages cover publishing and signs', () => {
  assert.equal(translate('Play', 'tr'), 'Oyna');
  assert.equal(translate('Play', 'en'), 'Play');
  assert.equal(translate('Play', 'fr'), 'Jouer');
  assert.equal(translate('Play', 'de'), 'Spielen');
  assert.equal(translate('Publish 10 courses', 'tr'), '10 parkuru yayımla');
  assert.equal(translate('← SHORTCUT · HARD', 'tr'), '← KESTİRME · ZOR');
  assert.equal(translate('My own name', 'tr'), 'My own name');
  assert.equal(isSentence('Too short'), false);
  assert.equal(isSentence('Bu parkur oldukça eğlenceli.'), true);
});
void test('release transaction enforces roles, saves batches as 51+, rejects missing notes and retains IDs on edits', async () => {
  const db = new PGlite();
  const uid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of [
      '001-platform.sql',
      '002-status-snapshot.sql',
      '003-progression-shop.sql',
      '004-course-releases.sql',
    ])
      await db.exec(
        await readFile(new URL('../backend/' + file, import.meta.url), 'utf8'),
      );
    for (let n = 1; n <= 3; n++)
      await db.query('insert into auth.users values($1,$2,now(),false)', [
        uid(n),
        `test${n}@example.com`,
      ]);
    await db.query(
      "insert into tumble_private.roles(user_id,role) values($1,'owner'),($2,'designer')",
      [uid(1), uid(2)],
    );
    const rpc = (n: number, name: string, args: unknown[] = []) =>
      db.transaction(async (tx) => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          uid(n),
        ]);
        return (
          await tx.query<{ v: any }>(
            `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as v`,
            args,
          )
        ).rows[0].v;
      });
    const saved = [];
    for (let i = 0; i < 10; i++)
      saved.push(
        await rpc(1, 'tc_recipe_save', [
          {
            ...DEFAULT_RECIPE,
            name: `Saved design ${i + 1}`,
            segments: DEFAULT_RECIPE.segments.map((s) => ({
              ...s,
              obstacles: [],
            })),
          },
        ]),
      );
    const entries = saved.map((s) => ({
      recipe: s.recipe,
      source_id: s.id,
      id: null,
      revision: null,
      description: 'Bu parkur yeni engeller sunuyor.',
    }));
    const comment = 'Bu sürüm on yeni parkur ekliyor.';
    await assert.rejects(
      rpc(3, 'tc_release_publish', [comment, entries, uid(101)]),
    );
    await assert.rejects(
      rpc(1, 'tc_release_publish', ['Incomplete', entries, uid(101)]),
    );
    await assert.rejects(
      rpc(1, 'tc_release_publish', [
        comment,
        entries.map((e, i) => (i === 9 ? { ...e, description: 'Missing' } : e)),
        uid(101),
      ]),
    );
    assert.equal((await rpc(1, 'tc_course_catalog')).levels.length, 0);
    const release = await rpc(1, 'tc_release_publish', [
      comment,
      entries,
      uid(101),
    ]);
    assert.equal(release.version, 'v0.0.1');
    assert.deepEqual(
      release.levels.map((l: any) => l.course_number),
      Array.from({ length: 10 }, (_, i) => 51 + i),
    );
    assert.deepEqual(
      release.levels.map((l: any) => l.recipe.name),
      saved.map((s) => s.recipe.name),
    );
    assert.deepEqual(
      await rpc(1, 'tc_release_publish', [comment, entries, uid(101)]),
      release,
    );
    await assert.rejects(rpc(1, 'tc_level_publish', [DEFAULT_RECIPE]));
    const edit = {
      ...entries[0],
      id: release.levels[0].id,
      revision: 1,
      recipe: { ...entries[0].recipe, name: 'Updated real design' },
    };
    const next = await rpc(1, 'tc_release_publish', [
      'Bu sürüm ilk parkuru güncelliyor.',
      [edit],
      uid(102),
    ]);
    assert.equal(next.version, 'v0.0.2');
    assert.equal(next.levels[0].course_number, 51);
    assert.equal(next.levels[0].revision, 2);
    await assert.rejects(
      rpc(1, 'tc_release_publish', [comment, [edit], uid(103)]),
    );
    assert.equal((await rpc(1, 'tc_course_catalog')).version, 'v0.0.2');
    assert.equal(
      (
        await db.query<{ recipe: any }>(
          'select recipe from public.tc_published_levels where course_number=51',
        )
      ).rows[0].recipe.name,
      'Updated real design',
    );
    const targets = (await rpc(1, 'tc_course_catalog')).targets.find(
      (t: any) => t.id === 51,
    );
    assert.deepEqual(
      { gold: targets.gold, silver: targets.silver, target: targets.target },
      estimatedTargets(entries[0].recipe),
    );
    await assert.rejects(rpc(1, 'tc_course_finish', [51, 70]));
    for (let id = 1; id <= 50; id++) await rpc(1, 'tc_course_finish', [id, 80]);
    assert.equal((await rpc(1, 'tc_course_finish', [51, 70])).best['51'], 70);
    await rpc(1, 'tc_level_retire', [next.levels[0].id, 2]);
    assert.equal((await rpc(1, 'tc_course_catalog')).levels.length, 9);
    assert.equal((await rpc(1, 'tc_course_finish', [52, 80])).best['51'], 70);
    const maxRecipe = {
      ...DEFAULT_RECIPE,
      segments: Array.from({ length: 10 }, () => ({
        type: 'fork',
        difficulty: 3,
        obstacles: Array.from({ length: 16 }, () => ({
          type: 'hammer',
          lane: 'cruise',
          at: 90,
          offset: 0.5,
        })),
      })),
    };
    assert.ok(await rpc(2, 'tc_recipe_save', [maxRecipe]));
    await assert.rejects(
      rpc(2, 'tc_recipe_save', [
        {
          ...maxRecipe,
          segments: [
            {
              type: 'open',
              difficulty: 2,
              obstacles: [{ type: null, lane: 'main', at: 50, offset: 0 }],
            },
            ...maxRecipe.segments.slice(1),
          ],
        },
      ]),
    );
  } finally {
    await db.close();
  }
});
