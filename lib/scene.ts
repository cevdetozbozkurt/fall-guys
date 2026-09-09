import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from './courses';
import { Simulation, obstaclePose } from './simulation';

// The scene is the playable course: all obstacle transforms share the physics model.
export class RaceScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 350);
  world = new THREE.Group();
  characters: THREE.Group[] = [];
  obstacles: THREE.Group[] = [];
  platforms: THREE.Mesh[] = [];
  particles: THREE.Mesh[] = [];
  sim: Simulation;
  observer: ResizeObserver;
  look = new THREE.Vector3();
  width = 1;
  height = 1;
  playerColor = 0;
  memberColors = new Map<number, number>();
  disposed = false;
  constructor(container: HTMLElement, sim: Simulation, color: number) {
    this.sim = sim;
    this.playerColor = color;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D obstacle race course',
    );
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9182ba, 2.5));
    const light = new THREE.DirectionalLight(0xfff4e1, 3.5);
    light.position.set(-25, 55, 15);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
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
      metalness: 0.02,
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
    const torso = this.box(1.12, 1.25, 0.85, color, 0, 1.14, 0, 0.38);
    g.add(torso);
    const head = this.sphere(0.58, color, 0, 1.75, 0);
    head.scale.set(1, 0.9, 0.85);
    g.add(head);
    const visor = this.box(0.76, 0.37, 0.17, '#fff9e9', 0, 1.72, -0.43, 0.16);
    g.add(visor);
    for (const x of [-0.19, 0.19])
      g.add(this.box(0.09, 0.15, 0.045, '#34254f', x, 1.72, -0.535, 0.04));
    // Small antenna and contrasting sneakers distinguish these original toy racers.
    g.add(
      this.cylinder(0.065, 0.25, '#34254f', 0, 2.31, 0),
      this.sphere(0.13, color, 0, 2.47, 0),
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
    this.scene.background = new THREE.Color(c.sky);
    this.scene.fog = new THREE.Fog(c.sky, 105, 235);
    const ground = this.box(550, 2, 550, c.sky, 0, -14, -70, 0);
    ground.castShadow = false;
    this.world.add(ground);
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? -1 : 1,
        x = side * (19 + ((i * 11) % 38)),
        z = 15 - i * 6.3;
      const cloud = new THREE.Group();
      for (let n = 0; n < 3; n++) {
        const puff = this.sphere(2 + (n % 2) * 1.3, '#f5ffff', n * 2.2, 0, 0);
        puff.scale.y = 0.42;
        puff.castShadow = false;
        cloud.add(puff);
      }
      cloud.position.set(x, -6 + (i % 3) * 1.5, z);
      this.world.add(cloud);
    }
    for (const p of c.platforms) {
      const color =
        p.kind === 'crumble'
          ? '#f49db7'
          : p.kind === 'belt'
            ? '#7ecbb6'
            : c.color;
      const platform = this.box(p.w, 0.85, p.d, color, p.x, -0.46, -p.z, 0.18);
      this.world.add(platform);
      this.platforms.push(platform);
      if (p.kind !== 'crumble') {
        for (const side of [-1, 1])
          this.world.add(
            this.box(
              0.22,
              0.18,
              p.d - 0.2,
              '#f5d888',
              p.x + side * (p.w / 2 - 0.18),
              0.04,
              -p.z,
              0.05,
            ),
          );
        for (let z = p.z - p.d / 2 + 3; z < p.z + p.d / 2; z += 6) {
          const stripe = this.box(0.13, 0.015, 2, '#ffffff', p.x, 0.01, -z, 0);
          (stripe.material as THREE.MeshStandardMaterial).transparent = true;
          (stripe.material as THREE.MeshStandardMaterial).opacity = 0.45;
          this.world.add(stripe);
          if (p.kind === 'belt')
            for (const x of [-5, -2, 2, 5]) {
              const arrow = this.label(
                p.direction === 1 ? '›' : '‹',
                '#247e68',
              );
              arrow.scale.set(0.25, 0.8, 1);
              arrow.rotation.x = -Math.PI / 2;
              arrow.rotation.z = Math.PI / 2;
              arrow.position.set(x, 0.015, -z);
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
        this.world.add(tileLine);
      }
    }
    for (const z of this.sim.course.checkpoints)
      this.arch(z, '#9ddeab', 'CHECKPOINT', false);
    this.arch(c.length, '#ffd271', 'FINISH', true);
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
      g.position.set(p.x, o.type === 'pendulum' ? p.y : 0, -p.z);
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
        this.material(i % 2 ? c.accent : '#f4ca60'),
      );
      ring.position.set(
        (i % 2 ? -1 : 1) * (13 + (i % 3) * 3),
        4 + (i % 3) * 2,
        -10 - i * 23,
      );
      ring.rotation.y = (i % 2 ? 1 : -1) * 0.4;
      this.world.add(ring);
    }
    this.camera.position.set(34, 31, 33);
    this.look.set(0, 0, -23);
    this.camera.lookAt(this.look);
  }
  arch(z: number, color: string, text: string, finish: boolean) {
    for (const x of [-7.4, 7.4])
      this.world.add(
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
    this.world.add(
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
      const l = this.label(text, '#403052');
      l.position.set(0, 5.5, -z + 0.38);
      this.world.add(l);
    } else {
      for (const x of [-7.4, 7.4])
        this.world.add(this.sphere(0.45, '#e5ffe3', x, 4, -z));
    }
  }
  setColor(color: number) {
    this.playerColor = color;
    const id = this.sim.playerId;
    const old = this.characters[id];
    this.world.remove(old);
    this.disposeObject(old);
    const char = this.character(COLORS[color], id);
    this.world.add(char);
    this.characters[id] = char;
  }
  setMembers(members: { id: number; color: number; name: string }[]) {
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
        const name = this.label(member.name, '#44305d', '#fff7df');
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
      g.position.set(p.x, o.type === 'pendulum' ? p.y : 0, -p.z);
      if (o.type === 'bar') g.rotation.y = p.angle;
      if (o.type === 'pendulum') {
        const rope = g.getObjectByName('rope')!;
        rope.rotation.z = p.angle;
        rope.position.set(-Math.sin(p.angle) * 3.5, Math.cos(p.angle) * 3.5, 0);
      }
    }
    for (let i = 0; i < this.platforms.length; i++) {
      const mesh = this.platforms[i],
        start = s.tiles.get(i),
        age = start === undefined ? 0 : t - start;
      mesh.visible = age < 0.7 || age >= 3.4;
      mesh.position.y =
        age > 0 && age < 0.7 ? -0.46 + Math.sin(age * 65) * 0.05 : -0.46;
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
      if (moving)
        g.rotation.y = THREE.MathUtils.lerp(
          g.rotation.y,
          Math.atan2(-r.vx, r.vz),
          Math.min(1, dt * 12),
        );
      else if (lobby) g.rotation.y = Math.PI - 0.5;
      g.rotation.x =
        r.diveTime > 0 ? -1.1 : r.stun > 0 ? Math.sin(t * 25) * 0.3 : 0;
      g.rotation.z = r.stun > 0 ? Math.cos(t * 25) * 0.3 : 0;
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
      this.camera.position.lerp(
        new THREE.Vector3(r.x * 0.55, 14 + Math.max(0, r.y) * 0.25, -r.z + 20),
        Math.min(1, dt * 5),
      );
      this.look.lerp(
        new THREE.Vector3(r.x * 0.45, 1, -r.z - 9),
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
            (Math.random() - 0.5) * 16,
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
  }
  destroy() {
    this.disposed = true;
    this.observer.disconnect();
    this.clearWorld();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
