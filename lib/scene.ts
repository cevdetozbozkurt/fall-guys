import * as THREE from 'three';
import { animateRacerRotation } from './racer-pose';
import { buildRibbonGeometry } from './ribbon';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from './courses';
import { platformHeight, MODULES } from './course-builder';
import { Simulation, obstaclePose } from './simulation';
import { toWorld, routeAt, wrapAngle } from './routes';
import {
  normalizeCosmetics,
  DEFAULT_COSMETICS,
  type Cosmetics,
} from './cosmetics';

// The scene is the playable course: all obstacle transforms share the physics model.
export class RaceScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 350);
  world = new THREE.Group();
  characters: THREE.Group[] = [];
  obstacles: THREE.Group[] = [];
  platforms: (THREE.Mesh | null)[] = [];
  particles: THREE.Mesh[] = [];
  warnings: THREE.Mesh[] = [];
  sim: Simulation;
  observer: ResizeObserver;
  look = new THREE.Vector3();
  width = 1;
  height = 1;
  playerColor = 0;
  cameraYaw = 0;
  sun!: THREE.DirectionalLight;
  memberColors = new Map<number, number>();
  memberCosmetics = new Map<number, Cosmetics>();
  playerCosmetics: Cosmetics = { ...DEFAULT_COSMETICS };
  disposed = false;
  constructor(container: HTMLElement, sim: Simulation, color: number) {
    this.sim = sim;
    this.playerColor = color;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        matchMedia('(pointer: coarse)').matches ? 1.3 : 1.7,
      ),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D obstacle race course',
    );
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xa8daff, 0x411570, 2.8));
    const light = new THREE.DirectionalLight(0xcceeff, 3.2);
    light.position.set(-25, 55, 15);
    this.sun = light;
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -65;
    light.shadow.camera.right = 65;
    light.shadow.camera.top = 75;
    light.shadow.camera.bottom = -135;
    light.shadow.camera.far = 230;
    light.shadow.normalBias = 0.045;
    this.scene.add(light);
    this.scene.add(light.target);
    light.target.position.set(0, 0, -50);
    this.scene.add(this.world);
    this.build();
    this.observer = new ResizeObserver(() => this.resize(container));
    this.observer.observe(container);
    this.resize(container);
  }
  material(color: string | number, roughness = 0.66) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.25,
      emissive: color,
      emissiveIntensity: 0.09,
    });
  }
  box(
    w: number,
    h: number,
    d: number,
    color: string | number,
    x = 0,
    y = 0,
    z = 0,
    round = 0.12,
  ) {
    const mesh = new THREE.Mesh(
      round
        ? new RoundedBoxGeometry(
            w,
            h,
            d,
            2,
            Math.min(round, w / 3, h / 3, d / 3),
          )
        : new THREE.BoxGeometry(w, h, d),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  sphere(radius: number, color: string | number, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    return mesh;
  }
  cylinder(
    r: number,
    height: number,
    color: string | number,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, height, 24),
      this.material(color),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  label(text: string, color = '#ffffff', background?: string) {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 160;
    const ctx = c.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.fillStyle = color;
    ctx.font = '900 76px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 85);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 1.67),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    return plane;
  }
  character(color: string, id: number) {
    const g = new THREE.Group();
    const outfit =
      this.memberCosmetics.get(id) ??
      (id === this.sim.playerId
        ? this.playerCosmetics
        : normalizeCosmetics({
            color,
            body: ['bean', 'round', 'tall'][id % 3],
            head: ['none', 'cap', 'mohawk'][id % 3],
            eyes: id % 2 ? 'visor' : 'shades',
          }));
    const torso =
      outfit.body === 'round'
        ? this.sphere(0.7, color, 0, 1.13, 0)
        : this.box(1.12, 1.25, 0.85, color, 0, 1.14, 0, 0.38);
    if (outfit.body === 'tall') g.scale.set(0.9, 1.13, 0.9);
    if (outfit.body === 'round') g.scale.set(1.08, 0.96, 1.08);
    g.add(torso);
    const head = this.sphere(0.58, color, 0, 1.75, 0);
    head.scale.set(1, 0.9, 0.85);
    g.add(head);
    const visor = this.box(0.87, 0.41, 0.19, '#131f49', 0, 1.72, -0.43, 0.16);
    if (outfit.eyes === 'visor') {
      g.add(visor);
      for (const x of [-0.19, 0.19])
        g.add(this.box(0.1, 0.14, 0.045, '#72fff1', x, 1.72, -0.54, 0.04));
    } else {
      this.disposeObject(visor);
      for (const x of [-0.25, 0.25]) {
        g.add(this.box(0.44, 0.32, 0.13, '#101934', x, 1.74, -0.48, 0.1));
        g.add(
          this.box(
            0.32,
            0.22,
            0.04,
            outfit.eyes === 'shades' ? '#36bacf' : '#e0fffc',
            x,
            1.74,
            -0.56,
            0.07,
          ),
        );
        if (outfit.eyes === 'glasses')
          g.add(this.box(0.06, 0.12, 0.035, '#112139', x, 1.74, -0.59, 0.02));
      }
      g.add(this.box(0.18, 0.06, 0.08, '#101934', 0, 1.77, -0.5));
    }
    g.add(this.box(0.8, 0.65, 0.3, '#26315e', 0, 1.1, 0.48, 0.1));
    // Small antenna and contrasting sneakers distinguish these original toy racers.
    if (outfit.head === 'none')
      g.add(
        this.cylinder(0.065, 0.25, '#34254f', 0, 2.31, 0),
        this.sphere(0.13, color, 0, 2.47, 0),
      );
    if (outfit.head === 'cap') {
      const cap = this.sphere(0.6, '#235b95', 0, 2.03, 0);
      cap.scale.y = 0.6;
      g.add(cap);
      g.add(this.box(1.15, 0.1, 0.65, '#42efd7', 0, 2.1, -0.36, 0.15));
    }
    if (outfit.head === 'crown') {
      g.add(this.cylinder(0.5, 0.23, '#ffe16b', 0, 2.27, 0));
      for (let n = 0; n < 5; n++) {
        const angle = (n * Math.PI * 2) / 5,
          tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.15, 0.35, 4),
            this.material('#ffe16b'),
          );
        tip.position.set(Math.cos(angle) * 0.4, 2.53, Math.sin(angle) * 0.4);
        g.add(tip);
      }
    }
    if (outfit.head === 'mohawk')
      for (let n = 0; n < 5; n++)
        g.add(
          this.box(
            0.19,
            0.38 + Math.sin((n * Math.PI) / 4) * 0.2,
            0.18,
            '#ff59c7',
            0,
            2.35,
            n * 0.16 - 0.32,
            0.04,
          ),
        );
    for (const x of [-1, 1]) {
      const arm = this.box(0.28, 0.75, 0.3, color, x * 0.68, 1.16, 0, 0.13);
      arm.name = `arm${x}`;
      arm.rotation.z = x * 0.23;
      g.add(arm);
      const foot = this.box(
        0.4,
        0.28,
        0.61,
        '#fff9e9',
        x * 0.29,
        0.18,
        -0.13,
        0.12,
      );
      foot.name = `foot${x}`;
      g.add(foot);
    }
    const belt = this.box(1.15, 0.14, 0.87, '#fff9e9', 0, 0.68, 0, 0.05);
    g.add(belt);
    if (id === this.sim.playerId) {
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.23, 0.4, 3),
        new THREE.MeshBasicMaterial({ color: '#fffdf1' }),
      );
      marker.rotation.z = Math.PI;
      marker.position.set(0, 3.25, 0);
      marker.name = 'marker';
      g.add(marker);
    }
    return g;
  }
  build() {
    this.clearWorld();
    const c = this.sim.course;
    this.scene.background = null;
    this.scene.fog = new THREE.Fog('#080f28', 95, 225);
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1,
        x = side * (19 + ((i * 11) % 38)),
        z = 15 - i * 6.3;
      const island = new THREE.Group();
      const base = this.cylinder(3 + (i % 3), 0.6, '#173d5d', 0, -1, 0);
      island.add(base);
      for (let n = 0; n < 3; n++) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(1.1 + n * 0.4),
          this.material(n % 2 ? '#e068e4' : '#43e6e3'),
        );
        crystal.position.set(n * 1.4 - 1.4, n * 0.6, 0);
        crystal.scale.y = 2;
        island.add(crystal);
      }
      island.position.set(x, -6 + (i % 3) * 2, z);
      island.rotation.y = i;
      this.world.add(island);
    }
    for (const p of c.platforms) {
      if (p.ribbon !== undefined) {
        this.platforms.push(null);
        continue;
      }
      const color =
        p.kind === 'crumble'
          ? '#c94fba'
          : p.kind === 'belt'
            ? '#1a959a'
            : p.kind === 'slide'
              ? '#176a9e'
              : c.color;
      const rise = (p.endY ?? p.y ?? 0) - (p.y ?? 0);
      const platform = this.box(
        p.w,
        0.85,
        Math.hypot(p.d, rise),
        color,
        p.x,
        platformHeight(p, p.z) - 0.46,
        -p.z,
        0.12,
      );
      platform.rotation.set(Math.atan2(rise, p.d), -(p.yaw ?? 0), 0, 'YXZ');
      this.world.add(platform);
      this.platforms.push(platform);
      if (p.kind !== 'crumble') {
        for (const side of [-1, 1]) {
          const rail = this.box(
            0.22,
            0.18,
            Math.hypot(p.d, rise) - 0.2,
            c.accent,
            p.x + side * (p.w / 2 - 0.18),
            platformHeight(p, p.z) + 0.04,
            -p.z,
            0.05,
          );
          const point = toWorld(p, side * (p.w / 2 - 0.18), 0);
          rail.position.x = point.x;
          rail.position.z = -point.z;
          rail.rotation.copy(platform.rotation);
          (rail.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1;
          this.world.add(rail);
        }
        for (let z = p.z - p.d / 2 + 3; z < p.z + p.d / 2; z += 6) {
          const stripe = this.box(
            0.13,
            0.015,
            2,
            '#8bf8ff',
            p.x,
            platformHeight(p, z) + 0.03,
            -z,
            0,
          );
          const point = toWorld(p, 0, z - p.z);
          stripe.position.x = point.x;
          stripe.position.z = -point.z;
          stripe.position.y =
            (p.y ?? 0) + rise * ((z - p.z + p.d / 2) / p.d) + 0.03;
          stripe.rotation.copy(platform.rotation);
          (stripe.material as THREE.MeshStandardMaterial).transparent = true;
          (stripe.material as THREE.MeshStandardMaterial).opacity = 0.45;
          this.world.add(stripe);
          if (p.kind === 'belt' || p.kind === 'slide')
            for (const x of [-5, -2, 2, 5]) {
              const arrow = this.label(
                p.kind === 'slide' ? '»' : p.direction === 1 ? '›' : '‹',
                '#9cfff2',
              );
              arrow.scale.set(0.25, 0.8, 1);
              arrow.rotation.x = -Math.PI / 2 + platform.rotation.x;
              arrow.rotation.z = p.kind === 'slide' ? 0 : Math.PI / 2;
              arrow.position.set(
                x * Math.min(1, p.w / 13),
                platformHeight(p, z) + 0.05,
                -z,
              );
              const point = toWorld(p, x * Math.min(1, p.w / 13), z - p.z);
              arrow.position.set(point.x, stripe.position.y + 0.02, -point.z);
              arrow.rotation.set(
                -Math.PI / 2 + platform.rotation.x,
                -(p.yaw ?? 0),
                p.kind === 'slide' ? 0 : Math.PI / 2,
                'YXZ',
              );
              this.world.add(arrow);
            }
        }
      } else {
        const tileLine = this.box(
          p.w - 0.45,
          0.016,
          0.12,
          '#ffd6e5',
          p.x,
          0.01,
          -p.z,
          0,
        );
        tileLine.rotation.y = -(p.yaw ?? 0);
        this.world.add(tileLine);
      }
    }
    for (const ribbon of c.ribbons ?? []) {
      for (const offset of [
        null,
        -ribbon.width / 2 + 0.18,
        ribbon.width / 2 - 0.18,
      ]) {
        const rail = offset !== null;
        const data = buildRibbonGeometry(
          ribbon,
          rail
            ? { width: 0.22, offset, top: ribbon.y + 0.13, depth: 0.18 }
            : {},
        );
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(data.positions, 3),
        );
        geometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute(data.normals, 3),
        );
        geometry.setIndex(data.indices);
        const material = this.material(rail ? c.accent : c.color);
        if (rail) material.emissiveIntensity = 1.1;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.world.add(mesh);
      }
    }
    for (const z of this.sim.course.checkpoints)
      this.arch(z, '#9ddeab', 'CHECKPOINT', false);
    this.arch(c.length, '#ff5ed5', 'DATA VORTEX', true);
    for (let i = 0; i < 16; i++) {
      const square = this.box(
        1,
        0.018,
        1,
        i % 2 ? '#fff9eb' : '#443566',
        -7.5 + i,
        0.012,
        -c.length,
        0,
      );
      const finish = routeAt(c, c.length),
        sq = toWorld(finish, -7.5 + i, 0);
      square.position.set(sq.x, 0.012, -sq.z);
      square.rotation.y = -finish.yaw;
      this.world.add(square);
      const square2 = this.box(
        1,
        0.018,
        1,
        i % 2 ? '#443566' : '#fff9eb',
        -7.5 + i,
        0.012,
        -c.length - 1,
        0,
      );
      const sq2 = toWorld(finish, -7.5 + i, 1);
      square2.position.set(sq2.x, 0.012, -sq2.z);
      square2.rotation.y = -finish.yaw;
      this.world.add(square2);
    }
    const start = this.label('START', '#ffffff');
    start.rotation.x = -Math.PI / 2;
    start.position.set(0, 0.025, 1.5);
    this.world.add(start);
    for (const o of c.obstacles) {
      const g = new THREE.Group();
      const p = obstaclePose(o, 0);
      if (o.type === 'bar') {
        g.add(
          this.box((o.radius ?? 5) * 2, 0.58, 0.62, c.accent, 0, 0.67, 0, 0.23),
        );
        g.add(
          this.cylinder(0.7, 1.5, '#fff6cf', 0, 0.7, 0),
          this.sphere(0.73, c.accent, 0, 1.45, 0),
        );
        for (const x of [-(o.radius ?? 5) + 0.25, (o.radius ?? 5) - 0.25])
          g.add(this.sphere(0.41, '#fff5dd', x, 0.67, 0));
      } else if (o.type === 'bumper') {
        g.add(
          this.cylinder(o.radius ?? 1.5, 1.8, c.accent, 0, 1, 0),
          this.cylinder((o.radius ?? 1.5) + 0.1, 0.35, '#fff4d6', 0, 1, 0),
        );
        g.add(this.sphere((o.radius ?? 1.5) * 0.95, c.accent, 0, 1.82, 0));
      } else if (o.type === 'hammer') {
        const frame = new THREE.Group();
        frame.add(this.box(17, 0.35, 0.35, '#1ccdcf', 0, 6.5, 0));
        for (const x of [-8, 8])
          frame.add(this.box(0.3, 6.6, 0.3, '#354c86', x, 3, 0));
        frame.position.set(o.x, o.y ?? 0, -o.z);
        frame.rotation.y = -(o.yaw ?? 0);
        this.world.add(frame);
        g.add(this.box(3.1, 1.5, 1.8, '#ff69c9', 0, 0, 0, 0.2));
        g.add(
          this.box(0.4, 1.6, 1.9, '#83fff0', -1.3, 0, 0),
          this.box(0.4, 1.6, 1.9, '#83fff0', 1.3, 0, 0),
        );
        const handle = this.cylinder(0.13, 5.5, '#b8a5ff', 0, 2.75, 0);
        handle.name = 'hammer-handle';
        g.add(handle);
      } else if (o.type === 'falling') {
        const meteor = new THREE.Mesh(
          new THREE.IcosahedronGeometry(o.radius ?? 1.25, 0),
          this.material('#ff8b58'),
        );
        g.add(meteor);
        const warning = new THREE.Mesh(
          new THREE.RingGeometry(
            (o.radius ?? 1.25) + 0.2,
            (o.radius ?? 1.25) + 0.48,
            32,
          ),
          new THREE.MeshBasicMaterial({
            color: '#ff6788',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
          }),
        );
        warning.rotation.x = -Math.PI / 2;
        warning.position.set(o.x, (o.y ?? 0) + 0.06, -o.z);
        warning.userData.obstacle = this.obstacles.length;
        this.world.add(warning);
        this.warnings.push(warning);
      } else if (o.type === 'pendulum') {
        for (const x of [-8, 8])
          this.world.add(this.box(0.35, 9, 0.35, '#8e7dbb', x, 4.1, -o.z));
        this.world.add(this.box(16.5, 0.4, 0.4, '#8e7dbb', 0, 8.45, -o.z));
        g.add(this.sphere(o.radius ?? 1.5, c.accent));
        const band = this.cylinder((o.radius ?? 1.5) + 0.02, 0.3, '#fff3d3');
        g.add(band);
        const rope = this.cylinder(0.075, 7, '#fff4d8', 0, 3.5, 0);
        rope.name = 'rope';
        g.add(rope);
      } else
        g.add(
          this.box(
            o.width ?? 4,
            o.type === 'hurdle' ? 0.85 : 2,
            1,
            c.accent,
            0,
            o.type === 'hurdle' ? 0.42 : 1,
            0,
            0.22,
          ),
        );
      g.position.set(
        p.x,
        ['pendulum', 'hammer', 'falling'].includes(o.type) ? p.y : (o.y ?? 0),
        -p.z,
      );
      g.rotation.y = -(o.yaw ?? 0);
      this.world.add(g);
      this.obstacles.push(g);
    }
    for (const r of this.sim.racers) {
      const char = this.character(
        COLORS[
          this.memberColors.get(r.id) ??
            (r.id === this.sim.playerId
              ? this.playerColor
              : r.id % COLORS.length)
        ],
        r.id,
      );
      char.position.set(r.x, r.y, -r.z);
      this.world.add(char);
      this.characters.push(char);
    }
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.7, 0.22, 12, 40),
        this.material(i % 2 ? c.accent : '#47e8f4'),
      );
      ring.position.set(
        (i % 2 ? -1 : 1) * (13 + (i % 3) * 3),
        4 + (i % 3) * 2,
        -10 - i * 23,
      );
      ring.rotation.y = (i % 2 ? 1 : -1) * 0.4;
      this.world.add(ring);
      (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
    }
    const recipe = c.recipe;
    for (const [i, z] of c.checkpoints.entries()) {
      const sign = this.label(
        recipe
          ? (MODULES.find(
              (m) => m.key === recipe.segments[i]?.type,
            )?.name.toUpperCase() ?? 'NEXT SECTOR')
          : i % 2
            ? 'COSMIC RUN'
            : c.name.toUpperCase(),
        '#6dfbee',
        '#132142',
      );
      const frame = routeAt(c, z),
        point = toWorld(frame, i % 2 ? 11 : -11, 0);
      sign.position.set(point.x, 5.7, -point.z);
      sign.rotation.y = -frame.yaw + (i % 2 ? -0.3 : 0.3);
      this.world.add(
        sign,
        this.box(0.2, 5, 0.2, '#67e0e8', sign.position.x, 2.5, sign.position.z),
      );
    }
    for (const lane of c.routes ?? []) {
      if (!lane.id.endsWith('hard')) continue;
      const frame = routeAt(c, lane.points[0].progress + 7, lane.id);
      for (const side of [-1, 1]) {
        const point = toWorld(frame, side * 5, 0),
          sign = this.label(
            side < 0 ? '← SHORTCUT · HARD' : 'DETOUR · EASY →',
            side < 0 ? '#ff91c9' : '#78ffde',
            '#11233b',
          );
        sign.scale.set(0.62, 0.62, 1);
        sign.position.set(point.x, 4.5, -point.z);
        sign.rotation.y = -frame.yaw;
        this.world.add(sign);
      }
    }
    this.cameraYaw = 0;
    this.camera.position.set(34, 31, 33);
    this.look.set(0, 0, -23);
    this.camera.lookAt(this.look);
  }
  arch(z: number, color: string, text: string, finish: boolean) {
    const frame = routeAt(this.sim.course, z),
      group = new THREE.Group();
    group.position.set(frame.x, 0, -frame.z);
    group.rotation.y = -frame.yaw;
    z = 0;
    for (const x of [-7.4, 7.4])
      group.add(
        this.box(
          0.65,
          finish ? 6 : 4,
          0.7,
          color,
          x,
          (finish ? 6 : 4) / 2 - 0.15,
          -z,
          0.24,
        ),
      );
    group.add(
      this.box(
        15.5,
        finish ? 1.9 : 0.3,
        0.7,
        color,
        0,
        finish ? 5.5 : 4,
        -z,
        0.16,
      ),
    );
    if (finish) {
      const l = this.label(text, '#ffffff');
      l.position.set(0, 5.5, -z + 0.38);
      group.add(l);
    } else {
      for (const x of [-7.4, 7.4])
        group.add(this.sphere(0.45, '#e5ffe3', x, 4, -z));
    }
    this.world.add(group);
  }
  setCosmetics(value: Cosmetics) {
    this.playerCosmetics = normalizeCosmetics(value);
    this.setColor(Math.max(0, COLORS.indexOf(this.playerCosmetics.color)));
  }
  setColor(color: number) {
    this.playerColor = color;
    this.playerCosmetics = {
      ...this.playerCosmetics,
      color: COLORS[color] as Cosmetics['color'],
    };
    const id = this.sim.playerId;
    const old = this.characters[id];
    if (old) {
      this.world.remove(old);
      this.disposeObject(old);
    }
    const char = this.character(COLORS[color], id);
    this.world.add(char);
    this.characters[id] = char;
  }
  setMembers(
    members: {
      id: number;
      color: number;
      name: string;
      cosmetics?: Cosmetics;
    }[],
  ) {
    this.memberCosmetics = new Map(
      members
        .filter((m) => m.cosmetics)
        .map((m) => [m.id, normalizeCosmetics(m.cosmetics)]),
    );
    this.memberColors = new Map(members.map((p) => [p.id, p.color]));
    for (const racer of this.sim.racers) {
      const old = this.characters[racer.id];
      if (old) {
        this.world.remove(old);
        this.disposeObject(old);
      }
      const member = members.find((p) => p.id === racer.id);
      const char = this.character(
        COLORS[
          member?.color ??
            (racer.id === this.sim.playerId
              ? this.playerColor
              : racer.id % COLORS.length)
        ],
        racer.id,
      );
      char.position.set(racer.x, racer.y, -racer.z);
      if (member) {
        const name = this.label(member.name, '#e4faff', '#142341');
        name.scale.set(0.35, 0.35, 1);
        name.position.set(0, 2.9, 0);
        name.name = 'nameplate';
        char.add(name);
      }
      this.world.add(char);
      this.characters[racer.id] = char;
    }
  }
  resize(container: HTMLElement) {
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.updateProjectionMatrix();
  }
  render(dt: number) {
    if (this.disposed) return;
    const s = this.sim,
      t = s.worldTime;
    const lobby = s.state === 'lobby';
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = s.course.obstacles[i],
        p = obstaclePose(o, t),
        g = this.obstacles[i];
      g.position.set(
        p.x,
        ['pendulum', 'hammer', 'falling'].includes(o.type) ? p.y : (o.y ?? 0),
        -p.z,
      );
      if (o.type === 'falling') {
        g.rotation.set(t * 0.8, t * 1.2, t * 0.4);
        g.visible = p.y > -2;
      }
      if (o.type === 'hammer') {
        const handle = g.getObjectByName('hammer-handle')!;
        handle.rotation.z = p.angle;
        handle.position.set(
          -Math.sin(p.angle) * 2.75,
          Math.cos(p.angle) * 2.75,
          0,
        );
      }
      if (o.type !== 'falling')
        g.rotation.y = o.type === 'bar' ? p.angle : -(o.yaw ?? 0);
      if (o.type === 'pendulum') {
        const rope = g.getObjectByName('rope')!;
        rope.rotation.z = p.angle;
        rope.position.set(-Math.sin(p.angle) * 3.5, Math.cos(p.angle) * 3.5, 0);
      }
    }
    for (const warning of this.warnings) {
      const p = obstaclePose(s.course.obstacles[warning.userData.obstacle], t);
      warning.visible = !!p.warning;
      (warning.material as THREE.MeshBasicMaterial).opacity =
        p.y < 8 ? 0.95 : 0.35 + Math.sin(t * 7) * 0.2;
    }
    for (let i = 0; i < this.platforms.length; i++) {
      const mesh = this.platforms[i],
        start = s.tiles.get(i),
        age = start === undefined ? 0 : t - start;
      if (!mesh) continue;
      mesh.visible = age < 0.7 || age >= 3.4;
      mesh.position.y =
        platformHeight(s.course.platforms[i], s.course.platforms[i].z) -
        0.46 +
        (age > 0 && age < 0.7 ? Math.sin(age * 65) * 0.05 : 0);
    }
    for (const r of s.racers) {
      const g = this.characters[r.id];
      if (
        s.multiplayer &&
        s.playerId !== 0 &&
        g.position.distanceTo(new THREE.Vector3(r.x, r.y, -r.z)) < 8
      )
        g.position.lerp(
          new THREE.Vector3(r.x, r.y, -r.z),
          Math.min(1, dt * 22),
        );
      else g.position.set(r.x, r.y, -r.z);
      const nameplate = g.getObjectByName('nameplate');
      if (nameplate)
        nameplate.quaternion.copy(
          g.quaternion.clone().invert().multiply(this.camera.quaternion),
        );
      const moving = Math.hypot(r.vx, r.vz) > 0.5;
      const bounce = lobby
        ? Math.sin(t * 2.5 + r.id) * 0.04
        : moving && r.grounded
          ? Math.abs(Math.sin(t * 16 + r.id)) * 0.08
          : 0;
      g.position.y += bounce;
      animateRacerRotation(g.rotation, r, dt, t, lobby);
      for (const side of [-1, 1]) {
        g.getObjectByName(`foot${side}`)!.position.z =
          -0.13 + (moving ? Math.sin(t * 17 + side) * 0.26 : 0);
        g.getObjectByName(`arm${side}`)!.rotation.x = moving
          ? Math.sin(t * 17 + side) * 0.55
          : Math.sin(t * 2 + side) * 0.1;
      }
      const marker = g.getObjectByName('marker');
      if (marker) marker.position.y = 3.3 + Math.sin(t * 3) * 0.12;
    }
    if (lobby) {
      const narrow = this.width < 750;
      this.camera.position.lerp(
        new THREE.Vector3(narrow ? 30 : 32, 32, narrow ? 37 : 32),
        Math.min(1, dt * 2),
      );
      this.look.lerp(
        new THREE.Vector3(narrow ? 0 : -8, 0, -24),
        Math.min(1, dt * 2),
      );
    } else {
      const r = s.player;
      const heading = routeAt(s.course, r.progress + 2, r.lane).yaw;
      this.cameraYaw +=
        wrapAngle(heading - this.cameraYaw) * (1 - Math.exp(-dt / 0.8));
      this.sun.position.set(r.x - 25, 55, -r.z + 15);
      this.sun.target.position.set(r.x, 0, -r.z - 20);
      this.camera.position.lerp(
        new THREE.Vector3(
          r.x - Math.sin(this.cameraYaw) * 20,
          14 + Math.max(0, r.y) * 0.85,
          -r.z + Math.cos(this.cameraYaw) * 20,
        ),
        Math.min(1, dt * 5),
      );
      this.look.lerp(
        new THREE.Vector3(
          r.x + Math.sin(this.cameraYaw) * 9,
          1 + Math.max(0, r.y) * 0.7,
          -r.z - Math.cos(this.cameraYaw) * 9,
        ),
        Math.min(1, dt * 6),
      );
    }
    this.camera.lookAt(this.look);
    if (s.state === 'finished' && s.player.finished) {
      if (this.particles.length < 90) {
        for (let n = 0; n < 4; n++) {
          const p = this.box(
            0.15,
            0.09,
            0.24,
            COLORS[this.particles.length % 6],
            s.player.x + (Math.random() - 0.5) * 16,
            8 + Math.random() * 8,
            -s.player.z + (Math.random() - 0.5) * 10,
            0,
          );
          p.castShadow = false;
          this.particles.push(p);
          this.world.add(p);
        }
      }
      for (const p of this.particles) {
        p.position.y -= dt * 2;
        p.rotation.x += dt * 2;
        p.rotation.z += dt * 3;
        if (p.position.y < 0) p.position.y = 12;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
  disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of mats) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });
  }
  clearWorld() {
    this.disposeObject(this.world);
    this.world.clear();
    this.characters = [];
    this.obstacles = [];
    this.platforms = [];
    this.particles = [];
    this.warnings = [];
  }
  destroy() {
    this.disposed = true;
    this.observer.disconnect();
    this.clearWorld();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
