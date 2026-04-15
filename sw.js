/* ============================================================
   QuizBlast Service Worker — v1.0
   Offline support + smart caching
   ============================================================ */

const CACHE_NAME    = "quizblast-v1";
const OFFLINE_PAGE  = "/offline.html";

// Files to cache immediately on install
const PRECACHE = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/data.js",
  "/js/script.js",
  "/js/supabase.js",
  "/manifest.json",
  "/offline.html",
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Pre-caching app shell");
      return cache.addAll(PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch Strategy ───────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls (always need fresh data)
  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.hostname.includes("fonts.googleapis.com")) return;
  if (url.hostname.includes("fonts.gstatic.com")) return;
  if (url.hostname.includes("cdn.jsdelivr.net")) return;

  // App shell: Cache First, then Network
  if (
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname === "/" ||
    url.pathname === "/index.html"
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => caches.match(OFFLINE_PAGE));
      })
    );
    return;
  }

  // Everything else: Network First, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match(OFFLINE_PAGE)
        )
      )
  );
});

// ── Background Sync (future use) ─────────────────────────────
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
