import * as THREE from 'three';
import { createAvatar, disposeAvatar } from './avatar.ts';
import {
  DEFAULT_COSMETICS,
  SHOP_ITEMS,
  equipItem,
  type Cosmetics,
} from './cosmetics.ts';
function setup(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight('#d7fbff', '#403268', 2.5));
  const key = new THREE.DirectionalLight('#fff5de', 3);
  key.position.set(-4, 6, -5);
  scene.add(key);
}
export class AvatarView {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(33, 1, 0.1, 30);
  avatar: THREE.Group;
  observer: ResizeObserver;
  frame = 0;
  yaw = 0.2;
  tilt = 0;
  disposed = false;
  constructor(container: HTMLElement, outfit: Cosmetics) {
    setup(this.scene);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor('#0a1832', 0);
    this.camera.position.set(0, 1.7, -6.8);
    this.camera.lookAt(0, 1.5, 0);
    this.avatar = createAvatar(outfit);
    this.scene.add(this.avatar);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Rotatable 3D character preview',
    );
    this.observer = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    });
    this.observer.observe(container);
    let last = 0;
    const draw = (now: number) => {
      if (this.disposed) return;
      if (now - last > 32) {
        last = now;
        this.avatar.rotation.set(this.tilt, this.yaw, 0, 'YXZ');
        this.renderer.render(this.scene, this.camera);
      }
      this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
  }
  setOutfit(outfit: Cosmetics) {
    this.scene.remove(this.avatar);
    disposeAvatar(this.avatar);
    this.avatar = createAvatar(outfit);
    this.scene.add(this.avatar);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    disposeAvatar(this.avatar);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
const thumbnails = new Map<string, string>();
export async function avatarThumbnails(
  onBatch: (images: Record<string, string>) => void,
  cancelled: () => boolean,
) {
  if (thumbnails.size === SHOP_ITEMS.length) {
    onBatch(Object.fromEntries(thumbnails));
    return;
  }
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(160, 160);
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  setup(scene);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  try {
    for (const [i, item] of SHOP_ITEMS.entries()) {
      if (cancelled()) return;
      if (!thumbnails.has(item.id)) {
        const avatar = createAvatar(
          equipItem({ ...DEFAULT_COSMETICS, color: item.color }, item),
        );
        scene.add(avatar);
        camera.position.set(
          item.slot === 'back' ? 2 : -2,
          2,
          item.slot === 'back' ? 6 : -6,
        );
        camera.lookAt(0, 1.4, 0);
        renderer.render(scene, camera);
        thumbnails.set(
          item.id,
          renderer.domElement.toDataURL('image/webp', 0.78),
        );
        scene.remove(avatar);
        disposeAvatar(avatar);
      }
      if (i % 6 === 0) {
        onBatch(Object.fromEntries(thumbnails));
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
    }
    onBatch(Object.fromEntries(thumbnails));
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
