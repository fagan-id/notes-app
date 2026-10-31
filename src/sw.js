// The build replaces this with the list of hashed app-shell files; it must appear exactly once.
const PRECACHE = self.__WB_MANIFEST;

// The plugin lists manifest icons on top of globPatterns, and Cache.addAll rejects duplicates.
const precacheUrls = [...new Set(PRECACHE.map((entry) => (typeof entry === "string" ? entry : entry.url)))];

// Any change to the precache list yields a new cache name, so old caches can be dropped.
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

const CACHE_NAME = `notes-app-${hash(
  PRECACHE.map((entry) =>
    typeof entry === "string" ? entry : `${entry.url}@${entry.revision ?? ""}`,
  ).join("|"),
)}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(precacheUrls))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Relative to the scope so it also works under /notes-app/ on GitHub Pages.
    const shell = new URL("index.html", self.registration.scope).href;
    event.respondWith(caches.match(shell).then((cached) => cached || fetch(request)));
    return;
  }

  // Precached responses carry `Vary: Origin` from servers like vite preview, but were stored
  // without an Origin header; crossorigin module scripts send one, so Vary would cause a miss.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request)),
  );
});
