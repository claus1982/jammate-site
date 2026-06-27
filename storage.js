/* JamMate — Data Layer (Tappa 1).
 *
 * Questo modulo è il "seam" (giuntura) tra l'app e dove vivono i dati.
 * Oggi i dati stanno nel browser (localStorage); domani, senza riscrivere
 * la UI, basterà attivare il backend "api" che parla con Azure Functions.
 *
 * L'app NON usa più localStorage direttamente: passa sempre da JM.Storage.
 * Così la migrazione al backend reale è un cambio di backend, non un rewrite.
 */
(function () {
  "use strict";
  window.JM = window.JM || {};

  // --- Backend locale (default): chiave/valore su localStorage del browser ---
  const localBackend = {
    name: "local",
    // Sonda REALE (write+remove): rileva anche i casi in cui localStorage esiste ma setItem fallisce
    // (private mode, quota a zero) — typeof da solo non basta.
    available() {
      try {
        if (typeof localStorage === "undefined") return false;
        const k = "__jm_probe__"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true;
      } catch (e) { return false; }
    },
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    // Ritorna boolean: false su QuotaExceeded/SecurityError invece di lanciare (così save() non aborta mai).
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
  };

  // --- Backend di riserva in memoria (se localStorage è bloccato o pieno) ---
  const memory = {};
  const memoryBackend = {
    name: "memory",
    available() { return true; },
    get(key) { return key in memory ? memory[key] : null; },
    set(key, value) { memory[key] = String(value); return true; },
    remove(key) { delete memory[key]; }
  };

  let active = localBackend.available() ? localBackend : memoryBackend;

  /* API pubblica del data layer.
   * In futuro: JM.Storage.use(apiBackend) per puntare ad Azure (vedi API_CONTRACT). */
  JM.Storage = {
    get backend() { return active.name; },
    use(backend) { active = backend; },
    get(key) { return active.get(key); },
    // Ritorna true SOLO se il dato è stato scritto in modo DUREVOLE (localStorage). Se la scrittura
    // fallisce ripiega sulla memoria volatile (il dato resta in sessione) e ritorna false: il chiamante
    // può così avvisare l'utente che i dati non sopravvivranno al reload.
    set(key, value) {
      if (active.set(key, value)) return active === localBackend;
      if (active !== memoryBackend) { active = memoryBackend; memoryBackend.set(key, value); }
      return false;
    },
    remove(key) { active.remove(key); }
  };
})();
