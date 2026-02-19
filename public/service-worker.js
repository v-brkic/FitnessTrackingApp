/* simple SW - verziju mijenjaj pri svakom deployu */
const CACHE_VERSION = "v1.0.0"; // <<-- promijeni npr. na v1.0.1 kod idućeg deploya
const APP_CACHE = `app-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",               // SPA entry
  "/index.html",
  "/manifest.json"
  // bundle fajlovi iz builda NE navodimo ručno; njih će browser keširati prema hash imenima
];

// install
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// activate (očisti stare cacheve)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k.startsWith("app-") && k !== APP_CACHE) ? caches.delete(k) : null))
    ).then(() => self.clients.claim())
  );
});

// network-first za HTML (SPA), a cache-first za ostalo (CSS/JS/ikonice/fotke)
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const isHTML = req.headers.get("accept")?.includes("text/html");

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => res)
        .catch(() => caches.match("/index.html"))
    );
  } else {
    e.respondWith(
      caches.match(req).then(cached =>
        cached ||
        fetch(req).then(res => {
          // stavi samo GET i uspješne odgovore u cache
          if (req.method === "GET" && res.ok) {
            const clone = res.clone();
            caches.open(APP_CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
      )
    );
  }
});

// primanje poruke za SKIP_WAITING (kad iz appa pošalješ)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
