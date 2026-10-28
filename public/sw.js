/**
 * RemiCare AI — Service Worker
 * Tuân thủ cam kết Zero-Retention & Privacy:
 * TUYỆT ĐỐI KHÔNG cache các request API y tế, gửi ảnh, luồng đo hoặc kết quả phân tích.
 */

const CACHE_NAME = 'remicare-shell-v1';

const APP_SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon-180x180.png',
  '/icons/favicon-32x32.png',
  '/images/logo.jpg',
];

// Cài đặt: Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
  // Không ép skipWaiting ngay để user có thể bấm nút reload
});

// Kích hoạt: Dọn dẹp cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Lắng nghe thông điệp cập nhật phiên bản
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Kiểm tra xem URL có phải là API y tế hoặc endpoint nhạy cảm không
function isSensitiveOrApiRequest(request) {
  // Chỉ cache GET
  if (request.method !== 'GET') {
    return true;
  }

  const url = new URL(request.url);

  // Danh mục tuyệt đối không cache: API, phân tích AI, TTS
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/screening/') ||
    url.pathname.includes('/hirschberg/') ||
    url.pathname.includes('/cover-test/') ||
    url.pathname.includes('/predict') ||
    url.pathname.includes('/analyze') ||
    url.hostname.includes('translate.google')
  ) {
    return true;
  }

  return false;
}

// Xử lý Fetch
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Không can thiệp vào các API đo lường hoặc gửi dữ liệu (Zero-Retention)
  if (isSensitiveOrApiRequest(request)) {
    return;
  }

  // 2. Navigation Request (người dùng chuyển trang HTML): Network-First kèm Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Khi ngoại tuyến, trước hết thử trả về App Shell từ cache (để SPA React Router hoạt động)
          return caches.match('/').then((response) => {
            if (response) return response;
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate hoặc Cache-First
  const url = new URL(request.url);
  const isStaticAsset =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest' ||
    /\.(js|css|png|jpg|jpeg|webp|svg|woff2?|wasm)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Trả về bản cache ngay, đồng thời cập nhật cache ngầm (Stale-While-Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {
              // Bỏ qua lỗi mạng ngầm
            });
          return cachedResponse;
        }

        // Nếu chưa có trong cache, fetch từ mạng và lưu vào cache
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  }
});
