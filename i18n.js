/* JamMate — i18n runtime (Tappa i18n).
 *
 * Vanilla, zero-dipendenze, coerente con lo stile no-build dell'app: caricato PRIMA degli altri
 * moduli così che t() sia globale ovunque. Espone JM.i18n e una window.t() di comodo.
 *
 * Lingua di default = preferenza salvata → lingua del dispositivo/paese (navigator.language) →
 * fallback Inglese se quella lingua non è tra le supportate. La scelta è persistita via JM.Storage.
 */
(function () {
  "use strict";
  var JM = (window.JM = window.JM || {});

  var SUPPORTED = ["en", "it", "de", "es", "fr", "pt"];
  var DEFAULT = "en";            // fallback quando la lingua del paese non è supportata
  var STORAGE_KEY = "jm_locale"; // valore: "auto" oppure un codice in SUPPORTED

  // Endonimi (nomi delle lingue nella lingua stessa) — NON tradotti.
  var NAMES = { en: "English", it: "Italiano", de: "Deutsch", es: "Español", fr: "Français", pt: "Português" };

  // ---- Cataloghi. Inglese è la base/source; le altre lingue traducono per chiave. ----
  // Fase 1: shell dell'app (header/tabbar/titolo) + pannello Impostazioni + selettore lingua.
  // Il contenuto delle schermate viene migrato per file in fasi successive (vedi ROADMAP i18n).
  var CATALOGS = {
    en: {
      "nav.discover": "Discover", "nav.feed": "Feed", "nav.board": "Board", "nav.chat": "Chat",
      "nav.profile": "Profile", "nav.main": "Main navigation",
      "header.notifications": "Notifications", "header.change_city": "Change city", "header.profile_menu": "Profile & menu",
      "app.title": "JamMate — Find who plays with you",
      "settings.title": "Settings", "settings.account": "Account",
      "settings.account_note": "You're a musician. To register as a <b>Venue</b>, go to <b>Stage › Venue</b>.",
      "settings.pro_active": "JamMate Pro · active", "settings.pro_upsell": "JamMate Pro · remove ads",
      "settings.notifications": "Notifications", "settings.notif_simulated": "Notifications (simulated)",
      "settings.privacy": "Privacy", "settings.show_status": "Show my activity status",
      "settings.show_exact_distance": "Show exact distance", "settings.show_exact_distance_sub": "· otherwise only the area",
      "settings.links_after_match": "Listening links only after the match", "settings.appear_discover": "Appear in Discover",
      "settings.backend_note": "The choices above take effect with the backend.",
      "settings.privacy_policy": "Privacy policy", "settings.manage_consents": "Manage consents",
      "settings.your_data": "Your data", "settings.export_data": "Export my data (JSON)", "settings.reset_demo": "Reset demo data",
      "settings.proto_version": "JamMate · prototype v0.1.0",
      "settings.reset_confirm_title": "Reset demo data?",
      "settings.reset_confirm_body": "You'll return to the initial state: profile, matches, bookings and presets will be restored.",
      "settings.reset_confirm_yes": "Reset",
      "settings.language": "Language", "settings.language_auto": "Automatic (device)"
    },
    it: {
      "nav.discover": "Scopri", "nav.feed": "Feed", "nav.board": "Bacheca", "nav.chat": "Chat",
      "nav.profile": "Profilo", "nav.main": "Navigazione principale",
      "header.notifications": "Notifiche", "header.change_city": "Cambia città", "header.profile_menu": "Profilo e menù",
      "app.title": "JamMate — Trova chi suona con te",
      "settings.title": "Impostazioni", "settings.account": "Account",
      "settings.account_note": "Sei un musicista. Per registrarti come <b>Locale</b> vai su <b>Palco › Locale</b>.",
      "settings.pro_active": "JamMate Pro · attivo", "settings.pro_upsell": "JamMate Pro · togli la pubblicità",
      "settings.notifications": "Notifiche", "settings.notif_simulated": "Notifiche (simulate)",
      "settings.privacy": "Privacy", "settings.show_status": "Mostra il mio stato di attività",
      "settings.show_exact_distance": "Mostra distanza esatta", "settings.show_exact_distance_sub": "· altrimenti solo la zona",
      "settings.links_after_match": "Link d'ascolto solo dopo il match", "settings.appear_discover": "Comparire in Scopri",
      "settings.backend_note": "Le scelte sopra diventano effettive col backend.",
      "settings.privacy_policy": "Informativa privacy", "settings.manage_consents": "Gestisci i consensi",
      "settings.your_data": "I tuoi dati", "settings.export_data": "Esporta i miei dati (JSON)", "settings.reset_demo": "Azzera dati demo",
      "settings.proto_version": "JamMate · prototipo v0.1.0",
      "settings.reset_confirm_title": "Azzerare i dati demo?",
      "settings.reset_confirm_body": "Tornerai allo stato iniziale: profilo, match, prenotazioni e preset verranno ripristinati.",
      "settings.reset_confirm_yes": "Azzera",
      "settings.language": "Lingua", "settings.language_auto": "Automatica (dispositivo)"
    },
    de: {
      "nav.discover": "Entdecken", "nav.feed": "Feed", "nav.board": "Pinnwand", "nav.chat": "Chat",
      "nav.profile": "Profil", "nav.main": "Hauptnavigation",
      "header.notifications": "Benachrichtigungen", "header.change_city": "Stadt ändern", "header.profile_menu": "Profil & Menü",
      "app.title": "JamMate — Finde, wer mit dir spielt",
      "settings.title": "Einstellungen", "settings.account": "Konto",
      "settings.account_note": "Du bist Musiker:in. Um dich als <b>Venue</b> zu registrieren, geh zu <b>Bühne › Venue</b>.",
      "settings.pro_active": "JamMate Pro · aktiv", "settings.pro_upsell": "JamMate Pro · Werbung entfernen",
      "settings.notifications": "Benachrichtigungen", "settings.notif_simulated": "Benachrichtigungen (simuliert)",
      "settings.privacy": "Datenschutz", "settings.show_status": "Meinen Aktivitätsstatus anzeigen",
      "settings.show_exact_distance": "Genaue Entfernung anzeigen", "settings.show_exact_distance_sub": "· sonst nur die Gegend",
      "settings.links_after_match": "Hörlinks erst nach dem Match", "settings.appear_discover": "In Entdecken erscheinen",
      "settings.backend_note": "Die Optionen oben werden mit dem Backend wirksam.",
      "settings.privacy_policy": "Datenschutzerklärung", "settings.manage_consents": "Einwilligungen verwalten",
      "settings.your_data": "Deine Daten", "settings.export_data": "Meine Daten exportieren (JSON)", "settings.reset_demo": "Demodaten zurücksetzen",
      "settings.proto_version": "JamMate · Prototyp v0.1.0",
      "settings.reset_confirm_title": "Demodaten zurücksetzen?",
      "settings.reset_confirm_body": "Du kehrst zum Ausgangszustand zurück: Profil, Matches, Buchungen und Presets werden wiederhergestellt.",
      "settings.reset_confirm_yes": "Zurücksetzen",
      "settings.language": "Sprache", "settings.language_auto": "Automatisch (Gerät)"
    },
    es: {
      "nav.discover": "Descubrir", "nav.feed": "Feed", "nav.board": "Tablón", "nav.chat": "Chat",
      "nav.profile": "Perfil", "nav.main": "Navegación principal",
      "header.notifications": "Notificaciones", "header.change_city": "Cambiar ciudad", "header.profile_menu": "Perfil y menú",
      "app.title": "JamMate — Encuentra con quién tocar",
      "settings.title": "Ajustes", "settings.account": "Cuenta",
      "settings.account_note": "Eres músico. Para registrarte como <b>Local</b> ve a <b>Escenario › Local</b>.",
      "settings.pro_active": "JamMate Pro · activo", "settings.pro_upsell": "JamMate Pro · quitar la publicidad",
      "settings.notifications": "Notificaciones", "settings.notif_simulated": "Notificaciones (simuladas)",
      "settings.privacy": "Privacidad", "settings.show_status": "Mostrar mi estado de actividad",
      "settings.show_exact_distance": "Mostrar distancia exacta", "settings.show_exact_distance_sub": "· si no, solo la zona",
      "settings.links_after_match": "Enlaces de escucha solo tras el match", "settings.appear_discover": "Aparecer en Descubrir",
      "settings.backend_note": "Las opciones de arriba se aplican con el backend.",
      "settings.privacy_policy": "Política de privacidad", "settings.manage_consents": "Gestionar consentimientos",
      "settings.your_data": "Tus datos", "settings.export_data": "Exportar mis datos (JSON)", "settings.reset_demo": "Restablecer datos de demo",
      "settings.proto_version": "JamMate · prototipo v0.1.0",
      "settings.reset_confirm_title": "¿Restablecer los datos de demo?",
      "settings.reset_confirm_body": "Volverás al estado inicial: perfil, matches, reservas y presets se restaurarán.",
      "settings.reset_confirm_yes": "Restablecer",
      "settings.language": "Idioma", "settings.language_auto": "Automático (dispositivo)"
    },
    fr: {
      "nav.discover": "Découvrir", "nav.feed": "Feed", "nav.board": "Tableau", "nav.chat": "Chat",
      "nav.profile": "Profil", "nav.main": "Navigation principale",
      "header.notifications": "Notifications", "header.change_city": "Changer de ville", "header.profile_menu": "Profil et menu",
      "app.title": "JamMate — Trouve qui joue avec toi",
      "settings.title": "Réglages", "settings.account": "Compte",
      "settings.account_note": "Tu es musicien·ne. Pour t'inscrire comme <b>Lieu</b>, va dans <b>Scène › Lieu</b>.",
      "settings.pro_active": "JamMate Pro · actif", "settings.pro_upsell": "JamMate Pro · enlever la publicité",
      "settings.notifications": "Notifications", "settings.notif_simulated": "Notifications (simulées)",
      "settings.privacy": "Confidentialité", "settings.show_status": "Afficher mon statut d'activité",
      "settings.show_exact_distance": "Afficher la distance exacte", "settings.show_exact_distance_sub": "· sinon seulement la zone",
      "settings.links_after_match": "Liens d'écoute seulement après le match", "settings.appear_discover": "Apparaître dans Découvrir",
      "settings.backend_note": "Les choix ci-dessus prennent effet avec le backend.",
      "settings.privacy_policy": "Politique de confidentialité", "settings.manage_consents": "Gérer les consentements",
      "settings.your_data": "Tes données", "settings.export_data": "Exporter mes données (JSON)", "settings.reset_demo": "Réinitialiser les données démo",
      "settings.proto_version": "JamMate · prototype v0.1.0",
      "settings.reset_confirm_title": "Réinitialiser les données démo ?",
      "settings.reset_confirm_body": "Tu reviendras à l'état initial : profil, matchs, réservations et presets seront restaurés.",
      "settings.reset_confirm_yes": "Réinitialiser",
      "settings.language": "Langue", "settings.language_auto": "Automatique (appareil)"
    },
    pt: {
      "nav.discover": "Descobrir", "nav.feed": "Feed", "nav.board": "Mural", "nav.chat": "Chat",
      "nav.profile": "Perfil", "nav.main": "Navegação principal",
      "header.notifications": "Notificações", "header.change_city": "Mudar cidade", "header.profile_menu": "Perfil e menu",
      "app.title": "JamMate — Encontre quem toca com você",
      "settings.title": "Configurações", "settings.account": "Conta",
      "settings.account_note": "Você é músico. Para se registrar como <b>Local</b>, vá em <b>Palco › Local</b>.",
      "settings.pro_active": "JamMate Pro · ativo", "settings.pro_upsell": "JamMate Pro · remover anúncios",
      "settings.notifications": "Notificações", "settings.notif_simulated": "Notificações (simuladas)",
      "settings.privacy": "Privacidade", "settings.show_status": "Mostrar meu status de atividade",
      "settings.show_exact_distance": "Mostrar distância exata", "settings.show_exact_distance_sub": "· caso contrário, só a região",
      "settings.links_after_match": "Links de áudio só depois do match", "settings.appear_discover": "Aparecer em Descobrir",
      "settings.backend_note": "As opções acima passam a valer com o backend.",
      "settings.privacy_policy": "Política de privacidade", "settings.manage_consents": "Gerenciar consentimentos",
      "settings.your_data": "Seus dados", "settings.export_data": "Exportar meus dados (JSON)", "settings.reset_demo": "Redefinir dados de demonstração",
      "settings.proto_version": "JamMate · protótipo v0.1.0",
      "settings.reset_confirm_title": "Redefinir os dados de demonstração?",
      "settings.reset_confirm_body": "Você voltará ao estado inicial: perfil, matches, reservas e presets serão restaurados.",
      "settings.reset_confirm_yes": "Redefinir",
      "settings.language": "Idioma", "settings.language_auto": "Automático (dispositivo)"
    }
  };

  function storageGet(k) {
    try { if (JM.Storage) { var v = JM.Storage.get(k); if (v != null) return v; } } catch (e) {}
    try { if (typeof localStorage !== "undefined") return localStorage.getItem(k); } catch (e) {}
    return null;
  }
  function storageSet(k, v) {
    try { if (JM.Storage) { JM.Storage.set(k, v); return; } } catch (e) {}
    try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch (e) {}
  }

  // Riduce un tag BCP-47 ("pt-BR", "en-US", "it") alla lingua base supportata, altrimenti null.
  function normalize(tag) {
    if (!tag) return null;
    var base = String(tag).toLowerCase().split("-")[0];
    return SUPPORTED.indexOf(base) >= 0 ? base : null;
  }

  // Lingua del paese/dispositivo da cui ci si collega; Inglese se non supportata.
  function deviceLocale() {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages
      : [navigator.language || navigator.userLanguage];
    for (var i = 0; i < langs.length; i++) { var n = normalize(langs[i]); if (n) return n; }
    return DEFAULT;
  }

  // Preferenza salvata ("auto" o codice) → lingua dispositivo → fallback Inglese.
  function detect() {
    var saved = storageGet(STORAGE_KEY);
    if (saved && saved !== "auto") { var n = normalize(saved); if (n) return n; }
    return deviceLocale();
  }

  var current = detect();
  var listeners = [];

  function interpolate(str, params) {
    if (!params) return str;
    return String(str).replace(/\{(\w+)\}/g, function (_, k) { return (k in params) ? params[k] : "{" + k + "}"; });
  }

  // Traduce una chiave nella lingua attiva; fallback Inglese; ultima spiaggia: la chiave stessa.
  function t(key, params) {
    var cat = CATALOGS[current] || CATALOGS[DEFAULT];
    var v = cat[key];
    if (v == null) v = CATALOGS[DEFAULT][key];
    if (v == null) return key;
    return interpolate(v, params);
  }

  function setLocale(loc, opts) {
    opts = opts || {};
    var n;
    if (loc === "auto") { storageSet(STORAGE_KEY, "auto"); n = deviceLocale(); }
    else { n = normalize(loc) || DEFAULT; if (opts.persist !== false) storageSet(STORAGE_KEY, n); }
    current = n;
    try { if (document.documentElement) document.documentElement.lang = n; } catch (e) {}
    applyStatic();
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](n); } catch (e) {} }
  }

  // Applica le traduzioni ai nodi statici: [data-i18n] -> textContent;
  // [data-i18n-attr="attr:key;attr2:key2"] -> attributi.
  function applyStatic(root) {
    if (typeof document === "undefined") return;
    root = root || document;
    var nodes = root.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    var attrNodes = root.querySelectorAll("[data-i18n-attr]");
    for (var j = 0; j < attrNodes.length; j++) {
      var pairs = attrNodes[j].getAttribute("data-i18n-attr").split(";");
      for (var p = 0; p < pairs.length; p++) {
        var kv = pairs[p].split(":");
        if (kv.length === 2) attrNodes[j].setAttribute(kv[0].trim(), t(kv[1].trim()));
      }
    }
  }

  JM.i18n = {
    supported: SUPPORTED.slice(),
    names: NAMES,
    get locale() { return current; },
    get savedPreference() { return storageGet(STORAGE_KEY) || "auto"; },
    t: t,
    setLocale: setLocale,
    detect: detect,
    deviceLocale: deviceLocale,
    applyStatic: applyStatic,
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    // Register a feature catalog: { en: {key: val, …}, it: {…}, … }. Loaded modules (e.g.
    // i18n.affinity.js) call this so per-feature strings live next to the feature, not in one file.
    extend: function (partial) {
      if (!partial) return;
      for (var loc in partial) {
        if (!Object.prototype.hasOwnProperty.call(partial, loc)) continue;
        CATALOGS[loc] = CATALOGS[loc] || {};
        var keys = partial[loc];
        for (var k in keys) { if (Object.prototype.hasOwnProperty.call(keys, k)) CATALOGS[loc][k] = keys[k]; }
      }
    }
  };
  // Comodità: l'app chiama t(...) ovunque.
  window.t = t;

  // Imposta <html lang> il prima possibile.
  try { if (document.documentElement) document.documentElement.lang = current; } catch (e) {}
})();
