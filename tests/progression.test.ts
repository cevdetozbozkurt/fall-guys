import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { COURSES } from '../lib/courses.ts';
import {
  newProgression,
  starsFor,
  recordFinish,
  unlockedThrough,
  earnedStars,
  starBalance,
  purchaseItems,
  parseProgression,
} from '../lib/progression.ts';
import {
  SHOP_ITEMS,
  OUTFIT_BUNDLES,
  DEFAULT_COSMETICS,
  equipItem,
} from '../lib/cosmetics.ts';
import { createAvatar, disposeAvatar } from '../lib/avatar.ts';
import * as THREE from 'three';
void test('all fifty courses have extended routes and distinct achievable star thresholds', () => {
  assert.equal(COURSES.length, 50);
  for (const course of COURSES) {
    assert.ok(course.length > 400, course.name);
    const { gold, silver, target } = course.starTimes!;
    assert.ok(
      gold < silver && silver < target && target >= 50 && target <= 150,
      course.name,
    );
    assert.equal(starsFor(course.id, gold), 3);
    assert.equal(starsFor(course.id, gold + 0.01), 2);
    assert.equal(starsFor(course.id, silver), 2);
    assert.equal(starsFor(course.id, silver + 0.01), 1);
    assert.equal(starsFor(course.id, 150), 1);
    assert.equal(starsFor(course.id, 150.01), 0);
  }
});
void test('sequential unlocks, personal best awards and spending never farm stars', () => {
  let p = newProgression();
  assert.equal(unlockedThrough(p), 1);
  assert.equal(recordFinish(p, 2, 50), p);
  assert.equal(recordFinish(p, 1, NaN), p);
  p = recordFinish(p, 1, 149);
  assert.equal(unlockedThrough(p), 2);
  assert.equal(earnedStars(p), 1);
  for (let i = 0; i < 50; i++) p = recordFinish(p, 1, 149);
  assert.equal(earnedStars(p), 1);
  p = recordFinish(p, 1, COURSES[0].starTimes!.silver);
  assert.equal(earnedStars(p), 2);
  p = recordFinish(p, 1, COURSES[0].starTimes!.gold);
  assert.equal(earnedStars(p), 3);
  const item = SHOP_ITEMS.find((i) => i.price === 3)!;
  p = purchaseItems(p, item.id);
  assert.equal(starBalance(p), 0);
  assert.equal(earnedStars(p), 3);
  assert.deepEqual(purchaseItems(p, item.id), p);
  assert.throws(() =>
    purchaseItems(p, SHOP_ITEMS.find((i) => i.price === 2)!.id),
  );
  assert.equal(starBalance(recordFinish(p, 1, COURSES[0].starTimes!.gold)), 0);
  for (let id = 2; id <= 50; id++)
    p = recordFinish(p, id, COURSES[id - 1].starTimes!.gold);
  assert.equal(earnedStars(p), 150);
  assert.equal(unlockedThrough(p), 50);
  for (const bundle of OUTFIT_BUNDLES) p = purchaseItems(p, bundle.id);
  for (const item of SHOP_ITEMS) p = purchaseItems(p, item.id);
  assert.equal(p.owned.length, SHOP_ITEMS.length);
  assert.equal(
    p.spent,
    SHOP_ITEMS.reduce((n, i) => n + i.price, 0),
  );
  assert.ok(starBalance(p) >= 0);
  assert.deepEqual(parseProgression(p), p);
  assert.deepEqual(
    parseProgression({ version: 1, best: { 1: 8 }, spent: 0 }),
    newProgression(),
  );
  assert.equal(
    unlockedThrough(
      parseProgression({ version: 2, best: { 50: 5 }, spent: 0, owned: [] }),
    ),
    1,
  );
});
void test('56 wearables generate finite, distinct low-poly geometry with shared animation joints', () => {
  assert.ok(SHOP_ITEMS.filter((i) => i.value !== 'none').length >= 50);
  const shapes = new Map<string, Set<string>>();
  for (const item of SHOP_ITEMS) {
    const avatar = createAvatar(equipItem(DEFAULT_COSMETICS, item)),
      hash = createHash('sha256');
    let vertices = 0;
    avatar.updateMatrixWorld(true);
    avatar.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const position = node.geometry.getAttribute('position');
      vertices += position.count;
      assert.ok(Array.from(position.array).every(Number.isFinite), item.id);
      hash.update(Buffer.from(position.array.buffer));
      hash.update(JSON.stringify(node.matrixWorld.elements));
    });
    assert.ok(vertices < 60000, item.id + ' stays lightweight');
    assert.ok(avatar.getObjectByName('foot1'));
    assert.ok(avatar.getObjectByName('arm-1'));
    if (item.value !== 'none') {
      const set = shapes.get(item.slot) ?? new Set();
      set.add(hash.digest('hex'));
      shapes.set(item.slot, set);
    }
    disposeAvatar(avatar);
  }
  for (const [slot, signatures] of shapes)
    assert.equal(
      signatures.size,
      SHOP_ITEMS.filter((i) => i.slot === slot && i.value !== 'none').length,
      slot + ' geometry variants',
    );
});
