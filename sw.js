/* 일본 편의점 도감 — 오프라인에서도 도감·체크리스트가 열리도록 캐시 */
const VERSION = "v2";
const APP_CACHE = "japan-app-" + VERSION;
const IMG_CACHE = "japan-img-" + VERSION;

const APP_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "app-icon-180.png",
  "app-icon-192.png",
  "app-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== APP_CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 폰트 등 외부 리소스는 브라우저에 맡김

  // 상품 사진: 캐시 우선(한 번 받으면 오프라인에서도 표시)
  if (url.pathname.includes("/assets/items/")) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit))
      )
    );
    return;
  }

  // 문서/앱 셸: 네트워크 우선, 실패하면 캐시
  if (req.mode === "navigate" || APP_FILES.includes(url.pathname.split("/").pop())) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(APP_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(APP_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
