/* JamMate service worker — precache del solo SHELL CRITICO (HTML/CSS/JS + Leaflet + icone base);
 * gli asset secondari (splash, og-card) sono messi in cache a runtime alla prima richiesta. */
const CACHE = "jammate-v104";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./runtime.js", "./storage.js", "./api.js", "./sync.js", "./bootstrap.js", "./app.js", "./data.js", "./affinity.js", "./icons.js", "./gigs.js", "./social.js",
  "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css", "./vendor/fonts/plus-jakarta-sans.css",
  "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // I tile della mappa (cross-origin) non si cachano: passano diretti al browser.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  // NETWORK-FIRST per lo shell same-origin: online vedi SEMPRE l'ultima versione
  // (niente più "vecchia versione in cache" dopo un deploy). La cache resta solo
  // come fallback offline. Cache-first causava update che arrivavano con uno-due
  // reload di ritardo; questo lo elimina al costo di una fetch di rete quando online.
  e.respondWith(
    fetch(e.request).then((res) => {
      // Aggiorna la cache SOLO con risposte valide same-origin "basic" (no 404/500/opache).
      if (res && res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      // Offline (o rete fallita): servi dalla cache; per le navigazioni ripiega sulla shell.
      caches.match(e.request).then((cached) =>
        cached || (e.request.mode === "navigate" ? caches.match("./index.html") : cached)
      )
    )
  );
});
