import type { Euler } from 'three';
import type { Racer } from './simulation.ts';
import { wrapAngle } from './routes.ts';

/** Turn around world-up first, then lean along the racer's own forward axis. */
export function animateRacerRotation(
  rotation: Euler,
  racer: Pick<Racer, 'vx' | 'vz' | 'diveTime' | 'sliding' | 'stun'>,
  dt: number,
  time: number,
  lobby: boolean,
) {
  const moving = Math.hypot(racer.vx, racer.vz) > 0.5;
  const yaw = moving
    ? rotation.y +
      wrapAngle(Math.atan2(-racer.vx, racer.vz) - rotation.y) *
        Math.min(1, dt * 12)
    : lobby
      ? Math.PI - 0.5
      : rotation.y;
  const pitch =
    racer.diveTime > 0
      ? -1.1
      : racer.sliding
        ? -0.6
        : racer.stun > 0
          ? Math.sin(time * 25) * 0.3
          : 0;
  rotation.set(
    pitch,
    yaw,
    racer.stun > 0 ? Math.cos(time * 25) * 0.3 : 0,
    'YXZ',
  );
}
