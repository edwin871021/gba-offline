const CACHE_NAME = 'gba-offline-v2';

// 安裝階段：只打包「自己家」的檔案，避開 Apple 跨網域阻擋，保證 100% 安裝成功
const CORE_ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).catch(err => console.error('Core assets cache failed', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截連線階段：動態快取策略 (網路有通就抓並存起來，沒通就拿存好的)
self.addEventListener('fetch', (e) => {
  // 排除非 HTTP 的特殊請求
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // 1. 如果 iPhone 記憶體裡已經有存了，直接秒開 (斷網時的救星)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 如果記憶體沒有，去網路上抓，抓到後「順手」存進 iPhone 記憶體
      return fetch(e.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // 把 Tailwind 和 FontAwesome 這些外部檔案偷偷備份起來
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // 3. 萬一完全斷網，而且剛好沒快取到，強制退回首頁
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});