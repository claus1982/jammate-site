/* Configurazione runtime: produzione e demo sono ambienti separati. */
(function () {
  "use strict";
  window.JM = window.JM || {};

  const params = new URLSearchParams(location.search);
  const requested = params.get("mode");
  const localHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const mode = requested === "demo" || (localHost && requested !== "production") ? "demo" : "production";

  JM.Runtime = Object.freeze({
    mode,
    demo: mode === "demo",
    apiBaseUrl: localHost ? "http://localhost:8080/v1" : "https://api.jammate.it/v1",
    stateKey: mode === "demo" ? "jammate_demo_state_v2" : "jammate_production_cache_v2",
    tokenKey: "jammate_session_token"
  });
})();
