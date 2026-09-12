import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'https://example.test/fall-guys/';
const workerUrl = base + 'sw.js';
const dist = join(root, 'web-dist');
const source = readFileSync(join(root, 'public', 'sw.js'), 'utf8');
const prepare = readFileSync(join(root, 'scripts', 'prepare-pwa.mjs'), 'utf8');
let generated;
const fakeFs = {
  readdirSync(path) {
    assert.equal(path, 'web-dist/assets');
    return readdirSync(join(dist, 'assets'));
  },
  readFileSync(path) {
    assert.equal(path, 'public/sw.js');
    return source;
  },
  writeFileSync(path, text) {
    assert.equal(path, 'web-dist/sw.js');
    generated = text;
  },
};
vm.runInNewContext(prepare.replace(/^import .*;\r?$/gm, ''), {
  fs: fakeFs,
  crypto: { createHash },
  console: { log() {} },
});

function environment(script) {
  const events = new Map(),
    storage = new Map();
  let online = true,
    claimed = false;
  const key = (value) =>
    new URL(typeof value === 'string' ? value : value.url, workerUrl).href;
  async function fetchFile(request) {
    if (!online) throw new TypeError('Offline test network');
    const url = new URL(key(request));
    assert.equal(url.origin, new URL(base).origin);
    const suffix =
      decodeURIComponent(url.pathname.slice(new URL(base).pathname.length)) ||
      'index.html';
    const file = resolve(dist, suffix);
    assert.ok(!relative(dist, file).startsWith('..'));
    if (!existsSync(file)) return new Response('Not found', { status: 404 });
    return new Response(readFileSync(file), { status: 200 });
  }
  class Cache {
    values = new Map();
    async match(request) {
      return this.values.get(key(request))?.clone();
    }
    async put(request, response) {
      this.values.set(key(request), response.clone());
    }
    async addAll(requests) {
      const pairs = await Promise.all(
        requests.map(async (r) => [r, await fetchFile(r)]),
      );
      if (pairs.some(([, response]) => !response.ok))
        throw new Error('Precache install failed');
      for (const [request, response] of pairs)
        await this.put(request, response);
    }
  }
  const caches = {
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Cache());
      return storage.get(name);
    },
    async keys() {
      return [...storage.keys()];
    },
    async delete(name) {
      return storage.delete(name);
    },
    async match(request) {
      for (const cache of storage.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
    },
  };
  const context = vm.createContext({
    URL,
    Promise,
    caches,
    fetch: fetchFile,
    self: {
      location: { href: workerUrl, origin: new URL(base).origin },
      clients: {
        claim() {
          claimed = true;
        },
      },
      skipWaiting() {},
      addEventListener(name, callback) {
        events.set(name, callback);
      },
    },
  });
  vm.runInContext(script, context);
  return {
    caches,
    storage,
    events,
    version: vm.runInContext('VERSION', context),
    precache: Array.from(vm.runInContext('PRECACHE', context)),
    setOffline() {
      online = false;
    },
    async install() {
      let pending = Promise.resolve();
      events.get('install')({
        waitUntil(p) {
          pending = p;
        },
      });
      await pending;
    },
    async activate() {
      let pending = Promise.resolve();
      events.get('activate')({
        waitUntil(p) {
          pending = p;
        },
      });
      await pending;
      assert.ok(claimed);
    },
    async request(url, { mode = 'cors', method = 'GET' } = {}) {
      let handled = false,
        pending = Promise.resolve();
      events.get('fetch')({
        request: { url: new URL(url, base).href, mode, method },
        respondWith(value) {
          handled = true;
          pending = value;
        },
      });
      return { handled, response: await pending };
    },
  };
}

test('PWA build precaches every production asset including lazy scene/network chunks', async () => {
  assert.ok(generated);
  const worker = environment(generated);
  const assets = readdirSync(join(dist, 'assets')).filter(
    (name) => !name.endsWith('.map'),
  );
  for (const file of assets)
    assert.ok(worker.precache.includes('./assets/' + file));
  assert.ok(worker.precache.includes('./'));
  await worker.install();
  assert.ok(worker.storage.get(worker.version));
});

test('installed PWA can load the shell and every lazy asset with the network unavailable', async () => {
  const worker = environment(generated);
  await worker.install();
  await worker.activate();
  worker.setOffline();
  const home = await worker.request('./', { mode: 'navigate' });
  assert.ok(home.handled);
  assert.equal(home.response.status, 200);
  const html = await home.response.text();
  assert.match(html, /<html/);
  const htmlAssets = [
    ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
  ].map((match) => match[1]);
  assert.ok(htmlAssets.length >= 2, 'production HTML should name JS and CSS');
  for (const file of [
    ...htmlAssets,
    ...worker.precache.filter((file) => file.startsWith('./assets/')),
  ]) {
    const result = await worker.request(file);
    assert.ok(result.handled);
    assert.equal(result.response.status, 200, file);
  }
});

test('PWA bypasses authentication endpoints, other sites, POST requests, and paths outside scope', async () => {
  const worker = environment(generated);
  await worker.install();
  for (const [url, options] of [
    ['https://backend.example/auth/v1/token', {}],
    ['https://backend.example/auth/v1/token.js', {}],
    ['/another-app/index.js', {}],
    ['./assets/private.js', { method: 'POST' }],
  ])
    assert.equal((await worker.request(url, options)).handled, false, url);
});

test('PWA activation deletes old Tumble caches and preserves unrelated applications', async () => {
  const worker = environment(generated);
  await worker.caches.open('other-application');
  await worker.caches.open('tumble-club-old-build');
  await worker.install();
  await worker.activate();
  const keys = await worker.caches.keys();
  assert.ok(keys.includes(worker.version));
  assert.ok(keys.includes('other-application'));
  assert.ok(!keys.includes('tumble-club-old-build'));
});
