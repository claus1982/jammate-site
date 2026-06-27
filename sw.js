/* JamMate — service worker "kill-switch" (pagina pre-lancio).
 *
 * Il sito completo (PWA) registrava un service worker con precache dello shell.
 * Mentre teniamo online SOLO la pagina "stiamo per andare live", questo SW —
 * pubblicato allo stesso URL ./sw.js — viene rilevato come aggiornamento dalla
 * registrazione esistente e, all'attivazione: svuota TUTTE le cache, si
 * deregistra e ricarica le schede aperte. Risultato: stato PWA pulito, i
 * visitatori di ritorno vedono subito la pagina pre-lancio, e domani il deploy
 * dell'app vera riparte da zero. Nessun fetch handler → tutto va in rete. */
self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) { /* no-op */ }
    try { await self.clients.claim(); } catch (e) { /* no-op */ }
    try { await self.registration.unregister(); } catch (e) { /* no-op */ }
    try {
      var clients = await self.clients.matchAll({ type: "window" });
      clients.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) { /* no-op */ }
  })());
});
