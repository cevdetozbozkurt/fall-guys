import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { normalizeCosmetics, type Cosmetics } from './cosmetics.ts';

/** Shared low-poly model for the race, rotating dressing room and shop thumbnails. */
export function createAvatar(value: Cosmetics) {
  const outfit = normalizeCosmetics(value),
    g = new THREE.Group(),
    color = outfit.color;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (c: string) => {
    let m = materials.get(c);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 });
      materials.set(c, m);
    }
    return m;
  };
  const mesh = (geo: THREE.BufferGeometry, c: string, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    c: string,
    x = 0,
    y = 0,
    z = 0,
    r = 0.07,
  ) =>
    mesh(
      new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3)),
      c,
      x,
      y,
      z,
    );
  const ball = (r: number, c: string, x = 0, y = 0, z = 0) =>
    mesh(new THREE.SphereGeometry(r, 12, 8), c, x, y, z);
  const cone = (r: number, h: number, c: string, x = 0, y = 0, z = 0, n = 12) =>
    mesh(new THREE.ConeGeometry(r, h, n), c, x, y, z);
  const cylinder = (r: number, h: number, c: string, x = 0, y = 0, z = 0) =>
    mesh(new THREE.CylinderGeometry(r, r, h, 12), c, x, y, z);
  const ring = (r: number, tube: number, c: string, x = 0, y = 0, z = 0) =>
    mesh(new THREE.TorusGeometry(r, tube, 6, 20), c, x, y, z);
  const light = '#e8fff5',
    dark = '#172745',
    gold = '#ffe16b',
    pink = '#ff64be',
    mint = '#37e4cf';
  switch (outfit.body) {
    case 'round':
      ball(0.77, color, 0, 1.13).scale.set(1, 0.95, 0.85);
      break;
    case 'tall':
      box(0.91, 1.62, 0.8, color, 0, 1.15, 0, 0.3);
      break;
    case 'robot':
      box(1.2, 1.22, 0.92, color, 0, 1.13);
      box(0.65, 0.48, 0.1, dark, 0, 1.15, -0.5);
      for (let n = 0; n < 3; n++) ball(0.06, mint, n * 0.2 - 0.2, 1.18, -0.57);
      break;
    case 'pear':
      ball(0.77, color, 0, 0.92).scale.z = 0.8;
      ball(0.52, color, 0, 1.49).scale.z = 0.8;
      break;
    case 'diamond':
      mesh(new THREE.OctahedronGeometry(0.9), color, 0, 1.15).scale.set(
        0.9,
        1,
        0.72,
      );
      break;
    case 'astronaut':
      box(1.28, 1.32, 0.99, light, 0, 1.1, 0, 0.25);
      box(0.52, 0.4, 0.13, color, 0, 1.2, -0.54);
      ring(0.48, 0.1, dark, 0, 1.68).rotation.x = Math.PI / 2;
      break;
    case 'pill':
      mesh(new THREE.CapsuleGeometry(0.47, 0.78, 4, 12), color, 0, 1.18);
      box(0.96, 0.16, 0.87, light, 0, 1.11);
      break;
    case 'marshmallow':
      cylinder(0.64, 1.22, color, 0, 1.12);
      box(1.18, 0.16, 0.96, pink, 0, 0.74);
      break;
    case 'starborn':
      cone(0.78, 1.42, color, 0, 1.08, 0, 5);
      ring(0.53, 0.065, gold, 0, 1.23).rotation.x = Math.PI / 2;
      break;
    default:
      box(1.12, 1.25, 0.85, color, 0, 1.14, 0, 0.35);
  }
  ball(0.58, color, 0, 1.78).scale.set(1, 0.9, 0.85);
  // Lenses have different frame geometries, not just color variations.
  const eye = outfit.eyes;
  if (['visor', 'vr', 'ski', 'mask', 'neon_band', 'cyclops'].includes(eye)) {
    const width = eye === 'cyclops' ? 0.44 : eye === 'ski' ? 1.05 : 0.9,
      height = eye === 'neon_band' ? 0.17 : eye === 'vr' ? 0.47 : 0.36;
    box(width, height, eye === 'vr' ? 0.35 : 0.15, dark, 0, 1.78, -0.48);
    if (eye === 'cyclops') ball(0.14, mint, 0, 1.78, -0.59).scale.z = 0.3;
    else if (eye === 'mask')
      for (let n = 0; n < 4; n++)
        box(0.1, 0.035, 0.025, light, n * 0.18 - 0.27, 1.74, -0.58);
    else
      box(
        width * 0.78,
        height * 0.48,
        0.04,
        eye === 'vr' ? pink : mint,
        0,
        1.78,
        eye === 'vr' ? -0.68 : -0.58,
      );
  } else {
    for (const side of [-1, 1]) {
      if ((eye === 'monocle' || eye === 'eyepatch') && side === 1) {
        ball(0.055, dark, side * 0.24, 1.78, -0.5);
        continue;
      }
      const x = side * 0.24;
      if (eye === 'star_specs') {
        const lens = cone(0.24, 0.08, gold, x, 1.78, -0.54, 5);
        lens.rotation.x = Math.PI / 2;
      } else if (eye === 'heart_specs') {
        ball(0.13, pink, x - 0.075, 1.84, -0.54).scale.z = 0.35;
        ball(0.13, pink, x + 0.075, 1.84, -0.54).scale.z = 0.35;
        const tip = cone(0.19, 0.27, pink, x, 1.71, -0.54, 3);
        tip.rotation.z = Math.PI;
        tip.scale.z = 0.25;
      } else if (
        ['round_specs', 'monocle', 'goggles', 'hex_specs', 'aviator'].includes(
          eye,
        )
      ) {
        const frame = ring(
          0.19,
          eye === 'goggles' ? 0.08 : 0.045,
          eye === 'monocle' ? gold : dark,
          x,
          1.78,
          -0.53,
        );
        if (eye === 'aviator') frame.scale.y = 1.2;
        const lens = mesh(
          new THREE.CircleGeometry(0.165, eye === 'hex_specs' ? 6 : 16),
          eye === 'goggles' ? mint : light,
          x,
          1.78,
          -0.54,
        );
        lens.rotation.y = Math.PI;
      } else
        box(
          0.43,
          eye === 'shades' ? 0.23 : 0.3,
          0.14,
          eye === 'eyepatch' ? dark : eye === 'shades' ? dark : light,
          x,
          1.78,
          -0.51,
        );
    }
    box(0.18, 0.055, 0.08, dark, 0, 1.8, -0.53);
  }
  switch (outfit.head) {
    case 'cap':
      ball(0.6, '#235b95', 0, 2.06).scale.y = 0.5;
      box(1.12, 0.1, 0.65, mint, 0, 2.1, -0.33);
      break;
    case 'crown':
      cylinder(0.5, 0.23, gold, 0, 2.28);
      for (let n = 0; n < 5; n++) {
        const a = (n * Math.PI * 2) / 5;
        cone(0.15, 0.35, gold, Math.cos(a) * 0.4, 2.53, Math.sin(a) * 0.4, 4);
      }
      break;
    case 'mohawk':
      for (let n = 0; n < 5; n++)
        box(
          0.2,
          0.38 + Math.sin((n * Math.PI) / 4) * 0.2,
          0.18,
          pink,
          0,
          2.38,
          n * 0.16 - 0.32,
        );
      break;
    case 'beanie':
      ball(0.57, mint, 0, 2.12).scale.y = 0.7;
      ball(0.16, light, 0, 2.59);
      break;
    case 'top_hat':
      cylinder(0.69, 0.1, dark, 0, 2.2);
      cylinder(0.43, 0.7, dark, 0, 2.58);
      cylinder(0.445, 0.14, pink, 0, 2.36);
      break;
    case 'wizard':
      cylinder(0.7, 0.09, '#7657cb', 0, 2.2);
      cone(0.5, 1, '#7657cb', 0, 2.7);
      ball(0.1, gold, 0.17, 2.62, -0.3);
      break;
    case 'pirate':
      box(1.27, 0.39, 0.48, dark, 0, 2.34, 0, 0.12);
      ball(0.13, light, 0, 2.35, -0.27);
      break;
    case 'viking':
      ball(0.58, '#9eabbc', 0, 2.08).scale.y = 0.6;
      for (const side of [-1, 1]) {
        const horn = cone(0.18, 0.65, gold, side * 0.6, 2.34, 0);
        horn.rotation.z = -side * 0.65;
      }
      break;
    case 'bunny':
      for (const side of [-1, 1]) {
        ball(0.23, light, side * 0.28, 2.6).scale.set(0.8, 2, 0.55);
        ball(0.13, pink, side * 0.28, 2.62, -0.11).scale.y = 2.2;
      }
      break;
    case 'cat':
      for (const side of [-1, 1])
        cone(0.27, 0.46, dark, side * 0.4, 2.34, 0, 3);
      break;
    case 'antennae':
      for (const side of [-1, 1]) {
        cylinder(0.035, 0.5, dark, side * 0.3, 2.44);
        ball(0.13, mint, side * 0.3, 2.74);
      }
      break;
    case 'halo':
      ring(0.5, 0.07, gold, 0, 2.58).rotation.x = Math.PI / 2;
      break;
    case 'flower':
      for (let n = 0; n < 7; n++) {
        const a = (n * Math.PI * 2) / 7;
        ball(0.18, pink, Math.cos(a) * 0.55, 2.2, Math.sin(a) * 0.55);
      }
      ball(0.2, gold, 0, 2.25);
      break;
    case 'chef':
      cylinder(0.47, 0.28, light, 0, 2.32);
      for (const x of [-0.3, 0, 0.3]) ball(0.3, light, x, 2.58);
      break;
    case 'headphones':
      ring(0.58, 0.09, dark, 0, 1.97).rotation.y = Math.PI / 2;
      for (const side of [-1, 1]) box(0.22, 0.48, 0.4, pink, side * 0.58, 1.95);
      break;
    case 'afro':
      for (let n = 0; n < 9; n++) {
        const a = (n * Math.PI * 2) / 9;
        ball(
          0.28,
          '#44375c',
          Math.cos(a) * 0.47,
          2.15 + Math.sin(n) * 0.1,
          Math.sin(a) * 0.39,
        );
      }
      ball(0.43, '#44375c', 0, 2.36);
      break;
    case 'ponytail':
      ball(0.54, '#704427', 0, 2.08).scale.y = 0.6;
      ball(0.26, '#704427', 0, 2.08, 0.65).scale.y = 1.6;
      break;
    case 'spikes':
      for (let n = 0; n < 7; n++) {
        const a = (n * Math.PI * 2) / 7;
        cone(0.17, 0.55, mint, Math.cos(a) * 0.35, 2.4, Math.sin(a) * 0.35);
      }
      break;
    case 'propeller':
      ball(0.55, pink, 0, 2.08).scale.y = 0.5;
      cylinder(0.05, 0.25, dark, 0, 2.4);
      box(1.32, 0.06, 0.14, gold, 0, 2.55);
      box(0.14, 0.06, 1.32, mint, 0, 2.55);
      break;
    default:
      cylinder(0.06, 0.22, dark, 0, 2.33);
      ball(0.12, color, 0, 2.48);
  }
  switch (outfit.back) {
    case 'jetpack':
      for (const side of [-1, 1]) {
        cylinder(0.22, 0.9, '#8099b6', side * 0.28, 1.15, 0.63);
        cone(0.17, 0.4, mint, side * 0.28, 0.55, 0.63).rotation.z = Math.PI;
      }
      break;
    case 'angel':
    case 'bat':
      for (const side of [-1, 1]) {
        const wing = mesh(
          new THREE.CircleGeometry(0.66, outfit.back === 'bat' ? 3 : 12),
          outfit.back === 'bat' ? '#523176' : light,
          side * 0.68,
          1.35,
          0.54,
        );
        wing.rotation.y = side * 0.4;
        wing.scale.y = 0.68;
        (wing.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      }
      break;
    case 'rocket':
      cylinder(0.27, 0.85, light, 0, 1.27, 0.65);
      cone(0.28, 0.42, pink, 0, 1.91, 0.65);
      cone(0.19, 0.4, gold, 0, 0.65, 0.65).rotation.z = Math.PI;
      break;
    case 'satchel':
      box(0.85, 0.74, 0.35, '#966446', 0, 1.18, 0.58);
      box(0.7, 0.12, 0.39, gold, 0, 1.27, 0.59);
      break;
    case 'cape':
      box(1.02, 1.24, 0.065, '#d03c79', 0, 0.92, 0.58).rotation.x = -0.18;
      break;
    case 'turtle':
      ball(0.6, '#58a364', 0, 1.15, 0.52).scale.z = 0.55;
      ring(0.45, 0.035, gold, 0, 1.15, 0.84);
      break;
    case 'crystal':
      for (let n = 0; n < 3; n++)
        mesh(
          new THREE.OctahedronGeometry(0.35),
          n % 2 ? pink : mint,
          (n - 1) * 0.3,
          1.3,
          0.65,
        ).scale.y = 1.5;
      break;
    case 'boombox':
      box(1.05, 0.65, 0.3, dark, 0, 1.2, 0.61);
      for (const side of [-1, 1])
        ring(0.18, 0.045, mint, side * 0.29, 1.2, 0.79);
      break;
    case 'life_ring':
      ring(0.53, 0.16, pink, 0, 1.1, 0.63);
      break;
    case 'planet':
      ball(0.48, '#9b91ff', 0, 1.25, 0.77);
      ring(0.68, 0.07, gold, 0, 1.25, 0.77).rotation.x = 0.8;
      break;
    default:
      box(0.62, 0.54, 0.2, dark, 0, 1.13, 0.47);
  }
  for (const side of [-1, 1]) {
    const arm = box(0.28, 0.75, 0.3, color, side * 0.68, 1.16, 0, 0.13);
    arm.name = `arm${side}`;
    arm.rotation.z = side * 0.23;
    const foot = box(0.4, 0.28, 0.61, light, side * 0.29, 0.18, -0.13, 0.12);
    foot.name = `foot${side}`;
  }
  return g;
}
export function disposeAvatar(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  materials.forEach((m) => m.dispose());
}
