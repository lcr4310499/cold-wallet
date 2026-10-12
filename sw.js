// 离线缓存：安装时缓存全部文件，之后只从缓存读取、永不向网络更新页面，
// 这样即使托管网站日后被篡改，已安装的设备也不会受影响。
const VERSION = "1.0.0";
const CACHE = "cold-wallet-" + VERSION;
const PAGE = "cold-wallet.html";
const ASSETS = [PAGE, "manifest.webmanifest", "icon-180.png", "icon-512.png"];

const url = (p) => new URL(p, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((p) => new Request(url(p), { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    if (event.request.mode === "navigate") return cache.match(url(PAGE));
    return fetch(event.request);
  })());
});

// 页面询问时，返回缓存中页面文件的版本与 SHA-256，供用户与发布的哈希核对
self.addEventListener("message", (event) => {
  if (event.data !== "status" || !event.ports[0]) return;
  event.waitUntil((async () => {
    const res = await (await caches.open(CACHE)).match(url(PAGE));
    let sha256 = null;
    if (res) {
      const digest = await crypto.subtle.digest("SHA-256", await res.arrayBuffer());
      sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    event.ports[0].postMessage({ version: VERSION, cached: !!res, sha256 });
  })());
});
