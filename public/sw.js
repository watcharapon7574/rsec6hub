// CACHE_NAME จะถูกอัปเดตอัตโนมัติทุกครั้งที่ build (ผ่าน vite build script)
const CACHE_NAME = 'fastdoc-v1.4.27-1771384719349';
const urlsToCache = [
  '/',
  '/fastdocIcon.png',
  '/fastdoc.png',
  '/manifest.json'
];

// ไฟล์ที่ต้องการให้โหลดใหม่ทุกครั้ง (Network First - ไม่ใช้ cache ก่อน)
const NETWORK_FIRST_URLS = [
  '/assets/',   // JS และ CSS files
  '/api/',      // API calls
  '/src/',      // Source files
  '.js',        // JavaScript files
  '.css',       // CSS files
  '/index.',    // index.html และ index.*.js
  '.html'       // HTML files
];

// URLs ที่ต้องโหลดจาก network เสมอ (ไม่ใช้ cache เลย)
const ALWAYS_NETWORK_URLS = [
  '/'           // Root index.html - ต้องโหลดใหม่เสมอเพื่อให้ได้ JS bundle ล่าสุด
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, { cache: 'reload' });
        }));
      })
      .catch((error) => {
        console.log('Cache failed:', error);
      })
  );
  // ไม่ skip waiting อัตโนมัติ รอให้ client ส่ง message มาก่อน
  // self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - ใช้ Network First Strategy สำหรับไฟล์สำคัญ
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // ทุก navigation request (เปิดหน้าเว็บ) ต้องโหลดจาก network เสมอ
  // เพื่อให้ได้ HTML ที่อ้างอิง JS bundle ล่าสุด (ป้องกันหน้าดำหลัง deploy ใหม่)
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation) {
    // Network First Strategy สำหรับทุกหน้า
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          console.log('Fetched fresh page from network:', url.pathname);
          return response;
        })
        .catch(() => {
          // Offline fallback - ใช้ cached root index.html
          console.log('Network failed for navigation, serving offline fallback');
          return caches.match('/') || caches.match('/offline.html');
        })
    );
    return;
  }

  // ตรวจสอบว่าเป็น URL ที่ต้องการ Network First หรือไม่
  const shouldUseNetworkFirst = NETWORK_FIRST_URLS.some(url =>
    event.request.url.includes(url)
  );

  if (shouldUseNetworkFirst) {
    // Network First Strategy - ลองโหลดจาก network ก่อน ถ้าไม่ได้ค่อยใช้ cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // ถ้าโหลดสำเร็จ ให้เก็บไว้ใน cache ด้วย
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // ถ้าโหลดจาก network ไม่ได้ ค่อยใช้ cache
          console.log('Network failed, serving from cache:', event.request.url);
          return caches.match(event.request);
        })
    );
  } else {
    // Cache First Strategy - สำหรับไฟล์ static ที่ไม่ค่อยเปลี่ยน
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            console.log('Serving from cache:', event.request.url);
            return response;
          }

          console.log('Fetching from network:', event.request.url);
          return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          }).catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  if (event.tag === 'document-sync') {
    event.waitUntil(syncDocuments());
  }
});

async function syncDocuments() {
  // Implement background sync logic for documents
  console.log('Syncing documents in background...');
}

// รับข้อความจาก client (เมื่อต้องการอัปเดท SW ทันที)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Received SKIP_WAITING message. Activating new service worker...');
    self.skipWaiting();
  }
});