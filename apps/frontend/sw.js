self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalado correctamente');
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});