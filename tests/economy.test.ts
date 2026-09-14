import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { COURSES } from '../lib/courses.ts';
import { SHOP_ITEMS, DEFAULT_COSMETICS } from '../lib/cosmetics.ts';
import {
  parseProgression,
  earnedStars,
  starBalance,
} from '../lib/progression.ts';
void test('database economy enforces identity, sequential completion, atomic spending and cosmetic ownership', async () => {
  const db = new PGlite(),
    uid = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  try {
    await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
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
      await db.query('insert into auth.users values($1,$2,$3,false)', [
        uid(n),
        `test${n}@example.com`,
        n === 3 ? null : new Date().toISOString(),
      ]);
    const as = async (
      n: number,
      sql: string,
      args: unknown[] = [],
      role = 'authenticated',
    ) =>
      db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          n ? uid(n) : '',
        ]);
        return tx.query<{ v: unknown }>(sql, args);
      });
    const rpc = async (n: number, name: string, args: unknown[] = []) =>
      (
        await as(
          n,
          `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as v`,
          args,
        )
      ).rows[0].v;
    const progress = async (n: number) =>
      parseProgression(await rpc(n, 'tc_progress'));
    await assert.rejects(as(0, 'select public.tc_progress()', [], 'anon'));
    await assert.rejects(rpc(3, 'tc_progress'));
    await assert.rejects(as(1, 'select * from tumble_private.wallets'));
    await assert.rejects(as(1, 'update tumble_private.wallets set spent=0'));
    assert.equal(starBalance(await progress(1)), 0);
    await assert.rejects(rpc(1, 'tc_course_finish', [2, 50]));
    for (const value of [0, -1, 151, NaN, Infinity])
      await assert.rejects(rpc(1, 'tc_course_finish', [1, value]));
    await assert.rejects(rpc(1, 'tc_shop_buy', ['body:robot']));
    await assert.rejects(rpc(1, 'tc_shop_buy', ['not-an-item']));
    await assert.rejects(
      rpc(1, 'tc_profile_save', [
        'Player1',
        { ...DEFAULT_COSMETICS, body: 'robot' },
      ]),
    );
    await rpc(1, 'tc_course_finish', [1, 149]);
    assert.equal(earnedStars(await progress(1)), 1);
    await rpc(1, 'tc_course_finish', [1, COURSES[0].starTimes!.silver]);
    assert.equal(earnedStars(await progress(1)), 2);
    await rpc(1, 'tc_course_finish', [1, COURSES[0].starTimes!.gold]);
    assert.equal(earnedStars(await progress(1)), 3);
    await Promise.all([
      rpc(1, 'tc_shop_buy', ['body:robot']),
      rpc(1, 'tc_shop_buy', ['body:robot']),
    ]);
    assert.equal((await progress(1)).spent, 3);
    assert.equal(starBalance(await progress(1)), 0);
    await rpc(1, 'tc_course_finish', [1, 149]);
    assert.equal(starBalance(await progress(1)), 0);
    await rpc(1, 'tc_profile_save', [
      'Player1',
      { ...DEFAULT_COSMETICS, body: 'robot' },
    ]);
    assert.equal(starBalance(await progress(2)), 0);
    assert.ok(!(await progress(2)).owned.includes('body:robot'));
    await assert.rejects(
      rpc(2, 'tc_profile_save', [
        'Player2',
        { ...DEFAULT_COSMETICS, body: 'robot' },
      ]),
    );
    for (let id = 2; id <= 50; id++)
      await rpc(1, 'tc_course_finish', [id, COURSES[id - 1].starTimes!.gold]);
    assert.equal(earnedStars(await progress(1)), 150);
    await rpc(1, 'tc_shop_buy', ['space-cadet']);
    const before = (await progress(1)).spent;
    await rpc(1, 'tc_shop_buy', ['space-cadet']);
    assert.equal((await progress(1)).spent, before);
    for (const item of SHOP_ITEMS) await rpc(1, 'tc_shop_buy', [item.id]);
    const final = await progress(1);
    assert.equal(final.owned.length, SHOP_ITEMS.length);
    assert.equal(
      final.spent,
      SHOP_ITEMS.reduce((sum, item) => sum + item.price, 0),
    );
    assert.ok(starBalance(final) >= 0);
    const targets = (
      await db.query<{ gold: number; silver: number; target: number }>(
        'select * from tumble_private.course_targets order by id',
      )
    ).rows;
    for (const [i, t] of targets.entries())
      assert.deepEqual(
        [t.gold, t.silver, t.target],
        Object.values(COURSES[i].starTimes!),
      );
  } finally {
    await db.close();
  }
});
