import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
let checks = 0;
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const recipe = {
  version: 1,
  name: 'Test route',
  segments: [
    { type: 'spin', difficulty: 2 },
    { type: 'climb', difficulty: 3 },
    { type: 'jump', difficulty: 1 },
  ],
};
const peer = (n) => `player-${n}`;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
};
async function as(n, fn, role = 'authenticated') {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      n ? uid(n) : '',
    ]);
    return fn(tx);
  });
}
async function rpc(n, name, args = []) {
  return as(
    n,
    async (tx) =>
      (
        await tx.query(
          `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`,
          args,
        )
      ).rows[0].result,
  );
}
const fails = (fn, code) => assert.rejects(fn, (e) => !code || e.code === code);
async function emptyNetwork() {
  await db.exec('truncate tumble_private.queue,tumble_private.matches cascade');
}
async function group(numbers) {
  for (const n of numbers) await rpc(n, 'tc_queue_tick', [peer(n), true]);
  return Promise.all(
    numbers.map((n) => rpc(n, 'tc_queue_tick', [peer(n), false])),
  );
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  const sql = await readFile(
    new URL('../backend/001-platform.sql', import.meta.url),
    'utf8',
  );
  await db.exec(sql);
  await db.exec(
    await readFile(
      new URL('../backend/002-status-snapshot.sql', import.meta.url),
      'utf8',
    ),
  );
  for (let n = 1; n <= 40; n++)
    await db.query('insert into auth.users values($1,$2,now(),false)', [
      uid(n),
      `player${n}@example.com`,
    ]);
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [
    uid(40),
  ]);
  await check(
    'core UUID randomness and transaction advisory locks execute',
    async () => {
      const { rows } = await db.query(
        'select gen_random_uuid() as id,pg_try_advisory_xact_lock(99) as locked',
      );
      assert.match(rows[0].id, /^[0-9a-f-]{36}$/);
      assert.equal(rows[0].locked, true);
    },
  );
  await check(
    'no first-user admin; exactly one explicitly seeded owner',
    async () => {
      assert.equal((await rpc(1, 'tc_account')).role, 'player');
      await db.query(
        "insert into tumble_private.roles(user_id,role) values($1,'owner')",
        [uid(1)],
      );
      await fails(
        () =>
          db.query(
            "insert into tumble_private.roles(user_id,role) values($1,'owner')",
            [uid(2)],
          ),
        '23505',
      );
      assert.equal((await rpc(1, 'tc_account')).role, 'owner');
    },
  );
  await check(
    'anonymous and unverified users cannot call account RPCs',
    async () => {
      await fails(
        () => as(null, (tx) => tx.query('select public.tc_account()'), 'anon'),
        '42501',
      );
      await fails(() => rpc(40, 'tc_account'), '42501');
    },
  );
  for (let n = 1; n < 40; n++)
    await rpc(n, 'tc_profile_save', [
      `Player_${n}`,
      { color: '#ff8755', body: 'bean', head: 'none', eyes: 'visor' },
    ]);
  await check(
    'profile validation, case-insensitive usernames, and row read isolation',
    async () => {
      await fails(() => rpc(2, 'tc_profile_save', ['player_1', {}]), '23505');
      await fails(() => rpc(2, 'tc_profile_save', ['x', {}]), '22023');
      await fails(
        () => rpc(2, 'tc_profile_save', ['Player_2', { role: 'owner' }]),
        '22023',
      );
      assert.equal(
        (await as(2, (tx) => tx.query('select * from public.tc_profiles'))).rows
          .length,
        1,
      );
      await fails(
        () =>
          as(2, (tx) =>
            tx.query(
              'update public.tc_profiles set username=$1 where user_id=$2',
              ['Taken', uid(1)],
            ),
          ),
        '42501',
      );
      await fails(
        () => as(2, (tx) => tx.query('select * from auth.users')),
        '42501',
      );
      await fails(
        () => as(2, (tx) => tx.query('select * from tumble_private.roles')),
        '42501',
      );
    },
  );
  await check(
    'saved recipe ownership, shape validation, and serialized limit',
    async () => {
      const first = await rpc(2, 'tc_recipe_save', [recipe]);
      await fails(() => rpc(3, 'tc_recipe_save', [recipe, first.id]), '42501');
      await fails(
        () => rpc(2, 'tc_recipe_save', [{ ...recipe, segments: [] }]),
        '22023',
      );
      await fails(
        () => rpc(2, 'tc_recipe_save', [{ ...recipe, secret: true }]),
        '22023',
      );
      await fails(
        () =>
          rpc(2, 'tc_recipe_save', [
            {
              ...recipe,
              segments: [...recipe.segments, { type: 'sql', difficulty: 1 }],
            },
          ]),
        '22023',
      );
      for (let i = 1; i < 16; i++) await rpc(2, 'tc_recipe_save', [recipe]);
      await fails(() => rpc(2, 'tc_recipe_save', [recipe]), '22023');
      assert.equal(
        (await as(3, (tx) => tx.query('select * from public.tc_saved_recipes')))
          .rows.length,
        0,
      );
      await rpc(3, 'tc_recipe_delete', [first.id]);
      assert.equal(
        (await as(2, (tx) => tx.query('select * from public.tc_saved_recipes')))
          .rows.length,
        16,
      );
      await rpc(2, 'tc_recipe_delete', [first.id]);
      assert.equal(
        (await as(2, (tx) => tx.query('select * from public.tc_saved_recipes')))
          .rows.length,
        15,
      );
    },
  );
  await check(
    'owner-only staff lookup/grants and immediate designer revocation',
    async () => {
      await fails(() => rpc(2, 'tc_staff_search', ['player']), '42501');
      await fails(
        () => rpc(2, 'tc_staff_set_designer', [uid(3), true]),
        '42501',
      );
      const result = (
        await as(1, (tx) =>
          tx.query('select * from public.tc_staff_search($1)', [
            'player3@example.com',
          ]),
        )
      ).rows;
      assert.equal(result.length, 1);
      assert.equal(result[0].user_id, uid(3));
      await rpc(1, 'tc_staff_set_designer', [uid(3), true]);
      assert.equal((await rpc(3, 'tc_account')).role, 'designer');
      await fails(
        () => rpc(3, 'tc_staff_set_designer', [uid(2), true]),
        '42501',
      );
      await fails(
        () => rpc(1, 'tc_staff_set_designer', [uid(1), false]),
        '42501',
      );
      await rpc(1, 'tc_staff_set_designer', [uid(3), false]);
      await fails(() => rpc(3, 'tc_level_publish', [recipe]), '42501');
      await rpc(1, 'tc_staff_set_designer', [uid(3), true]);
    },
  );
  await check(
    'published catalog, optimistic editing, retirement, and write denial',
    async () => {
      const first = await rpc(3, 'tc_level_publish', [recipe]);
      const updated = await rpc(3, 'tc_level_publish', [
        { ...recipe, name: 'Edited' },
        first.id,
        first.revision,
      ]);
      assert.equal(updated.revision, 2);
      await fails(
        () => rpc(3, 'tc_level_publish', [recipe, first.id, first.revision]),
        '40001',
      );
      assert.equal(
        (
          await as(
            null,
            (tx) => tx.query('select * from public.tc_published_levels'),
            'anon',
          )
        ).rows.length,
        1,
      );
      await fails(
        () => as(3, (tx) => tx.query('delete from public.tc_published_levels')),
        '42501',
      );
      await rpc(3, 'tc_level_retire', [first.id, 2]);
      assert.equal(
        (
          await as(
            null,
            (tx) => tx.query('select * from public.tc_published_levels'),
            'anon',
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await as(3, (tx) =>
            tx.query('select * from public.tc_staff_catalog()'),
          )
        ).rows.length,
        1,
      );
      await fails(() => rpc(2, 'tc_staff_catalog'), '42501');
    },
  );
  await check(
    'queue allocates exactly five once, preserving admission tickets',
    async () => {
      for (let n = 10; n < 14; n++)
        assert.equal(
          (await rpc(n, 'tc_queue_tick', [peer(n), true])).state,
          'searching',
        );
      const fifth = await rpc(14, 'tc_queue_tick', [peer(14), true]);
      assert.equal(fifth.state, 'matched');
      assert.equal(fifth.members.length, 5);
      const states = await Promise.all(
        [10, 11, 12, 13, 14].map((n) =>
          rpc(n, 'tc_queue_tick', [peer(n), false]),
        ),
      );
      assert.equal(new Set(states.map((s) => s.match_id)).size, 1);
      assert.equal(new Set(states.map((s) => s.join_ticket)).size, 5);
      assert.ok(
        states.every((s) => s.members.every((m) => !('join_ticket' in m))),
      );
      assert.equal(
        (await db.query('select count(*) from tumble_private.matches')).rows[0]
          .count,
        1,
      );
      assert.equal(
        (await db.query('select count(*) from tumble_private.queue')).rows[0]
          .count,
        0,
      );
      const host = states[0];
      await fails(() => rpc(10, 'tc_match_start', [host.match_id]), '22023');
      await fails(
        () =>
          rpc(11, 'tc_match_validate_join', [
            host.match_id,
            uid(11),
            states[1].join_ticket,
            peer(11),
          ]),
        '42501',
      );
      assert.equal(
        (
          await rpc(10, 'tc_match_validate_join', [
            host.match_id,
            uid(11),
            uid(39),
            peer(11),
          ])
        ).accepted,
        false,
      );
      assert.equal(
        (
          await rpc(10, 'tc_match_validate_join', [
            host.match_id,
            uid(11),
            states[1].join_ticket,
            'wrong-peer',
          ])
        ).accepted,
        false,
      );
      for (let i = 1; i < 5; i++)
        assert.equal(
          (
            await rpc(10, 'tc_match_validate_join', [
              host.match_id,
              uid(10 + i),
              states[i].join_ticket,
              peer(10 + i),
            ])
          ).accepted,
          true,
        );
      assert.equal(
        (await rpc(10, 'tc_match_start', [host.match_id])).phase,
        'playing',
      );
      await fails(
        () => rpc(11, 'tc_queue_tick', ['different-tab', true]),
        '22023',
      );
    },
  );
  await check(
    'guest exit preserves playing room; host exit releases and requeues guests',
    async () => {
      const host = await rpc(10, 'tc_queue_tick', [peer(10), false]);
      assert.equal(
        (await rpc(11, 'tc_match_leave', [host.match_id])).state,
        'idle',
      );
      assert.equal(
        (await rpc(10, 'tc_queue_tick', [peer(10), false])).members.length,
        4,
      );
      await rpc(10, 'tc_match_leave', [host.match_id]);
      assert.equal(
        (await rpc(12, 'tc_queue_tick', [peer(12), false])).state,
        'searching',
      );
      assert.equal(
        (await rpc(10, 'tc_queue_tick', [peer(10), false])).state,
        'idle',
      );
    },
  );
  await check(
    'cancel after allocation returns matched, explicit admission exit recovers four',
    async () => {
      await emptyNetwork();
      const states = await group([15, 16, 17, 18, 19]);
      assert.equal((await rpc(16, 'tc_queue_cancel')).state, 'matched');
      await rpc(16, 'tc_match_leave', [states[0].match_id]);
      assert.equal(
        (await rpc(15, 'tc_queue_tick', [peer(15), false])).state,
        'searching',
      );
      assert.equal(
        (await rpc(16, 'tc_queue_tick', [peer(16), false])).state,
        'idle',
      );
      assert.equal(
        (await db.query('select count(*) from tumble_private.queue')).rows[0]
          .count,
        4,
      );
    },
  );
  await check(
    'stale queue entries expire and cancel is idempotent',
    async () => {
      await emptyNetwork();
      for (const n of [20, 21, 22, 23])
        await rpc(n, 'tc_queue_tick', [peer(n), true]);
      await db.exec(
        "update tumble_private.queue set last_seen=now()-interval '30 seconds'",
      );
      assert.equal(
        (await rpc(24, 'tc_queue_tick', [peer(24), true])).players,
        1,
      );
      await rpc(24, 'tc_queue_cancel');
      await rpc(24, 'tc_queue_cancel');
      assert.equal(
        (await rpc(24, 'tc_queue_tick', [peer(24), false])).state,
        'idle',
      );
    },
  );
  await check(
    'host heartbeat failure closes once and recovers live guests with revoked tickets',
    async () => {
      await emptyNetwork();
      const states = await group([25, 26, 27, 28, 29]);
      await db.query(
        "update tumble_private.matches set host_seen=now()-interval '35 seconds' where id=$1",
        [states[0].match_id],
      );
      assert.equal(
        (await rpc(26, 'tc_queue_tick', [peer(26), false])).state,
        'searching',
      );
      assert.equal(
        (await db.query('select count(*) from tumble_private.queue')).rows[0]
          .count,
        4,
      );
      assert.equal(
        (
          await db.query(
            'select count(*) from tumble_private.match_members where active',
          )
        ).rows[0].count,
        0,
      );
      await fails(
        () =>
          rpc(25, 'tc_match_validate_join', [
            states[0].match_id,
            uid(26),
            states[1].join_ticket,
            peer(26),
          ]),
        '42501',
      );
      await rpc(27, 'tc_queue_tick', [peer(27), false]);
      assert.equal(
        (await db.query('select count(*) from tumble_private.queue')).rows[0]
          .count,
        4,
      );
    },
  );
  await check(
    'connecting deadline expires even if host keeps heartbeating',
    async () => {
      await emptyNetwork();
      const states = await group([30, 31, 32, 33, 34]);
      await db.query(
        "update tumble_private.matches set created_at=now()-interval '50 seconds' where id=$1",
        [states[0].match_id],
      );
      assert.equal(
        (await rpc(31, 'tc_queue_tick', [peer(31), false])).state,
        'searching',
      );
      assert.equal(
        (await rpc(30, 'tc_queue_tick', [peer(30), false])).state,
        'idle',
      );
    },
  );
  await check(
    'all app definer functions fix search_path and anon has no mutation grants',
    async () => {
      const funcs = (
        await db.query(`select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','tumble_private')
      and (p.proname like 'tc_%' or n.nspname='tumble_private')`)
      ).rows;
      assert.ok(
        funcs
          .filter((f) => f.prosecdef)
          .every((f) => f.proconfig?.includes('search_path=""')),
      );
      for (const f of funcs)
        assert.equal(
          (
            await db.query(
              "select has_function_privilege('anon',$1,'EXECUTE') as allowed",
              [f.oid],
            )
          ).rows[0].allowed,
          false,
        );
    },
  );
  console.log(
    `\n${checks} database/RLS scenario groups passed. Native concurrent-session testing remains required.`,
  );
} catch (e) {
  console.error({
    message: e.message,
    code: e.code,
    detail: e.detail,
    where: e.where,
    stack: e instanceof assert.AssertionError ? e.stack : undefined,
  });
  process.exitCode = 1;
} finally {
  await db.close();
}
