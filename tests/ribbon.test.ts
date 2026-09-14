import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCourse } from '../lib/course-builder.ts';
import { buildRibbonGeometry, ribbonEdges } from '../lib/ribbon.ts';
import { Simulation } from '../lib/simulation.ts';
import { roadSurface } from '../lib/road-surface.ts';
import { toLocal } from '../lib/routes.ts';

void test('slalom joins have no interior cap borders after a turn or before a conveyor', () => {
  for (const type of ['left', 'right'] as const) {
    const course = buildCourse({
      version: 1,
      name: 'Seam check',
      segments: [
        { type, difficulty: 3 },
        { type: 'slalom', difficulty: 3 },
        { type: 'belt', difficulty: 3 },
      ],
    });
    const slalom = course.ribbons!.at(-1)!;
    for (const point of [slalom.points[0], slalom.points.at(-1)!]) {
      assert.ok(point.yaw !== undefined);
      for (const polygon of roadSurface(course))
        for (const ring of polygon) {
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1],
              b = ring[i];
            const q = toLocal(point, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            assert.ok(
              Math.abs(q.z) > 0.02 || Math.abs(q.x) >= 3.8,
              'Interior seam would draw a rail across the road',
            );
          }
        }
    }
  }
});

void test('continuous bend surfaces and both edge strips have supported floors and upward top faces', () => {
  for (const difficulty of [1, 2, 3] as const) {
    const course = buildCourse({
      version: 1,
      name: 'Curved geometry',
      segments: ['left', 'fork', 'right', 'slalom'].map((type) => ({
        type: type as 'left' | 'fork' | 'right' | 'slalom',
        difficulty,
      })),
    });
    const sim = new Simulation(course);
    assert.equal(
      course.ribbons!.length,
      6,
      'The hard shortcut is two disconnected surfaces',
    );
    for (const ribbon of course.ribbons!) {
      for (const edge of Object.values(ribbonEdges(ribbon))) {
        for (let i = 1; i < edge.length; i++) {
          for (let n = 0; n <= 4; n++) {
            const a = edge[i - 1],
              b = edge[i],
              t = n / 4;
            assert.ok(
              sim.support(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) >= 0,
              `Visible edge has no collision support at ${i}/${edge.length}`,
            );
          }
        }
      }
      for (const offset of [
        null,
        -ribbon.width / 2 + 0.18,
        ribbon.width / 2 - 0.18,
      ]) {
        const data = buildRibbonGeometry(
          ribbon,
          offset === null ? {} : { width: 0.22, offset },
        );
        assert.ok(data.positions.every(Number.isFinite));
        for (let i = 0; i < data.topIndexCount; i += 3) {
          const [a, b, c] = data.indices
            .slice(i, i + 3)
            .map((index) => data.positions.slice(index * 3, index * 3 + 3));
          const ny =
            (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
          assert.ok(
            ny > 0,
            'Road triangles must face upward without folded inner corners',
          );
        }
      }
    }
  }
});

void test('rounded fork keeps its jump gap clear in both rendered surfaces and collision', () => {
  const course = buildCourse({
    version: 1,
    name: 'Fork gap',
    segments: [
      { type: 'fork', difficulty: 3 },
      { type: 'open', difficulty: 1 },
      { type: 'open', difficulty: 1 },
    ],
  });
  const sim = new Simulation(course);
  const [before, after] = course.ribbons!;
  assert.ok(Math.abs(before.points.at(-1)!.z - 45.9) < 1e-8);
  assert.ok(Math.abs(after.points[0].z - 50.1) < 1e-8);
  for (let z = 46.2; z <= 49.8; z += 0.3) {
    assert.equal(sim.support(-12, z), -1);
    for (const ribbon of [before, after]) {
      const data = buildRibbonGeometry(ribbon);
      for (let i = 0; i < data.topIndexCount; i += 3) {
        const zs = data.indices
          .slice(i, i + 3)
          .map((index) => -data.positions[index * 3 + 2]);
        assert.ok(
          Math.max(...zs) < z || Math.min(...zs) > z,
          'A ribbon must not bridge the jump gap',
        );
      }
    }
  }
});
