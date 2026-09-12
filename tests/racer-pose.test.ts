import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Euler, Vector3 } from 'three';
import { animateRacerRotation } from '../lib/racer-pose.ts';
import { Simulation, EMPTY_INPUT } from '../lib/simulation.ts';

void test('diving and sliding lean the head along travel after left, right and reverse turns', () => {
  for (const [vx, vz] of [
    [-8, 0],
    [8, 0],
    [0, 8],
    [0, -8],
    [-6, 6],
  ]) {
    for (const sliding of [false, true]) {
      const rotation = new Euler();
      const racer = { vx, vz, diveTime: sliding ? 0 : 0.5, sliding, stun: 0 };
      for (let frame = 0; frame < 90; frame++)
        animateRacerRotation(rotation, racer, 1 / 60, 0, false);
      // The face is on local -Z. The head is above local +Y.
      // Scene mirrors simulation Z; both projections must follow render-space travel.
      for (const point of [new Vector3(0, 0, -1), new Vector3(0, 1, 0)]) {
        point.applyEuler(rotation).setY(0).normalize();
        assert.ok(
          point.dot(new Vector3(vx, 0, -vz).normalize()) > 0.999,
          `Head snapped away from (${vx}, ${vz})`,
        );
      }
      const yaw = rotation.y;
      animateRacerRotation(
        rotation,
        { ...racer, vx: 0, vz: 0 },
        1 / 60,
        0,
        false,
      );
      assert.equal(
        rotation.y,
        yaw,
        'Stopping preserves the last facing direction',
      );
    }
  }
});

void test('releasing steering immediately before a dive preserves airborne travel direction', () => {
  for (const [vx, vz] of [
    [-8, 0],
    [8, 0],
    [0, -8],
    [-6, 6],
  ]) {
    const simulation = new Simulation();
    simulation.course = { ...simulation.course, obstacles: [] };
    Object.assign(simulation.player, {
      vx,
      vz,
      y: 3,
      grounded: false,
      dived: false,
    });
    simulation.move(simulation.player, { ...EMPTY_INPUT, dive: true }, 1 / 60);
    assert.equal(simulation.player.dived, true);
    const { vx: nextX, vz: nextZ } = simulation.player;
    assert.ok(Math.hypot(nextX, nextZ) > Math.hypot(vx, vz) + 5);
    assert.ok(
      Math.abs(nextX * vz - nextZ * vx) < 0.001,
      'Dive must not redirect toward the original course heading',
    );
  }
});
