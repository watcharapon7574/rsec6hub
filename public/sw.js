// เพิ่มเวอร์ชันทุกครั้งที่ deploy ใหม่ เพื่อบังคับให้ล้างแคชเก่า
const CACHE_NAME = 'rsec6-officehub-v1.4.7';
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
  'QzfacJHb'    // Fix for the specific JS bundle
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
  self.skipWaiting();
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