/* 무소음 비주얼 타이머 (Focus Disk) Service Worker
 * - 앱 화면을 캐시해 두어 비행기 모드·지하철에서도 바로 열립니다.
 * - 같은 폴더(scope) 안의 파일만 다룹니다.
 */
const CACHE_NAME = 'focus-disk-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // 하나라도 실패해도 설치는 계속되도록 개별 처리
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  // 외부 CDN(Tailwind, Pretendard) 등은 그대로 네트워크로 보냅니다.
  if (url.origin !== self.location.origin) return;

  // 화면 이동 요청은 캐시된 index.html을 우선 사용(오프라인에서도 열림)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./') || Response.error()))
    );
    return;
  }

  // 나머지 같은 출처 파일은 캐시 우선 + 백그라운드 갱신
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit || Response.error());
      return hit || network;
    })
  );
});
