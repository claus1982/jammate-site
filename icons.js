/* JamMate — libreria icone BESPOKE "Risonanza".
 * Grammatica (vedi STYLEGUIDE.md): forme costruite sul DNA del marchio bolla-suono.
 *  - Famiglia "suono" (alta frequenza): cavità/forma + equalizer-bars o semi-onda + NODO rosa.
 *  - Famiglia "onesta" (gear/calendar/...): forma + un solo nodo rosa.
 *  - Gesti singoli (check/plus/x/frecce): monolinea currentColor (adattivi: es. check verde).
 *  - Glifi-firma: resonance-profile = onda-S bicroma; match = clasp di due semi-onde (currentColor
 *    per restare leggibile sul tab attivo a gradiente).
 * viewBox 24 · stroke 1.85 · base=currentColor · accento ACC viola · NODO rosa (fill).
 * Convenzioni identiche a tab-ic/hd-ic in index.html. */
(function (global) {
  "use strict";
  var ACC = "#8b6cff", NODE = "#ff5c9d";

  var ICONS = {
    // ————— Famiglia "suono" —————
    // cerca = lente che "ascolta": lente + manico viola + mini-equalizer rosa nel fuoco
    search: '<circle cx="10" cy="10" r="5.6"/><path d="M14.1 14.1 19.4 19.4" stroke="' + ACC + '"/><path d="M8.3 11.1V8.9" stroke="' + NODE + '" stroke-width="1.6"/><path d="M10 12.1V7.9" stroke="' + NODE + '" stroke-width="1.6"/><path d="M11.7 11.1V9.4" stroke="' + NODE + '" stroke-width="1.6"/>',
    // chat = bolla + equalizer (marchio bolla-suono)
    "chat-bubble": '<path d="M20.5 11.3a7.7 7.7 0 0 1-11.1 6.9L4 20l1.8-4.3A7.7 7.7 0 1 1 20.5 11.3z"/><path d="M9 13.4V11" stroke="' + NODE + '" stroke-width="1.6"/><path d="M12 14.3V9.1" stroke="' + NODE + '" stroke-width="1.6"/><path d="M15 13.4V10.4" stroke="' + NODE + '" stroke-width="1.6"/>',
    // campana + batacchio-nodo rosa
    bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 5 2.2 6 2.2 6H3.8s2.2-1 2.2-6"/><circle cx="12" cy="19.4" r="1.7" fill="' + NODE + '" stroke="none"/>',
    // megafono che trasmette barre viola/rosa
    megaphone: '<path d="M3.5 10.4 14 6.6v10.8L3.5 13.6z"/><path d="M6.6 14V17a1.6 1.6 0 0 0 3.2 0v-2.2"/><path d="M17 9.6V14.4" stroke="' + ACC + '" stroke-width="1.7"/><path d="M20 8.2V15.8" stroke="' + NODE + '" stroke-width="1.7"/>',
    // nota: gambo + testa-nodo rosa
    "music-note": '<path d="M10.8 16.6V6.4c2.8.3 4.4 1.6 4.4 4"/><ellipse cx="8" cy="16.6" rx="2.9" ry="2.4" fill="' + NODE + '" stroke="none"/>',
    // play: triangolo "suono" arrotondato + NODO rosa (controllo di riproduzione, famiglia suono)
    play: '<path d="M9 6.5 18 12 9 17.5Z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="11.6" cy="12" r="1.45" fill="' + NODE + '" stroke="none"/>',
    // microfono + onda d'ascolto viola
    microphone: '<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0 0 12 0" stroke="' + ACC + '"/><path d="M12 17v3M8.5 20h7"/>',
    // filtri = mixer a fader verticali + manopole-nodo rosa
    sliders: '<path d="M6 5V19M12 5V19M18 5V19"/><circle cx="6" cy="9" r="2.2" fill="' + NODE + '" stroke="none"/><circle cx="12" cy="14.5" r="2.2" fill="' + NODE + '" stroke="none"/><circle cx="18" cy="8" r="2.2" fill="' + NODE + '" stroke="none"/>',

    // ————— Famiglia "onesta" (forma + nodo) —————
    "map-pin": '<path d="M12 21s6.3-5.3 6.3-10A6.3 6.3 0 0 0 5.7 11c0 4.7 6.3 10 6.3 10z"/><circle cx="12" cy="10.7" r="2.2" fill="' + NODE + '" stroke="none"/>',
    // mappa ripiegata: forma a 3 ante (zig-zag), pieghe viola + nodo-luogo rosa
    map: '<path d="M3 7.2 9 5l6 2.2L21 5v11.8L15 19l-6-2.2L3 19z"/><path d="M9 5v11.8M15 7.2V19" stroke="' + ACC + '"/><circle cx="13.4" cy="11.9" r="1.8" fill="' + NODE + '" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2.3M12 18.1v2.3M3.6 12h2.3M18.1 12h2.3M6.05 6.05 7.7 7.7M16.3 16.3l1.65 1.65M17.95 6.05 16.3 7.7M7.7 16.3l-1.65 1.65"/><circle cx="12" cy="12" r="1.4" fill="' + NODE + '" stroke="none"/>',
    "alert-triangle": '<path d="M12 4.4 21 19.6H3z"/><path d="M12 10v4.2"/><circle cx="12" cy="16.8" r="1.15" fill="' + NODE + '" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.4V12l3.1 2" stroke="' + ACC + '"/><circle cx="12" cy="12" r="1.3" fill="' + NODE + '" stroke="none"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16"/><path d="M8.5 3.6v3.8M15.5 3.6v3.8" stroke="' + ACC + '"/><circle cx="8.4" cy="14.4" r="1.4" fill="' + NODE + '" stroke="none"/>',
    camera: '<rect x="3" y="7.4" width="18" height="12.1" rx="2.6"/><path d="M8 7.4 9.4 5.3h5.2L16 7.4"/><circle cx="12" cy="13.4" r="3.1" stroke="' + ACC + '"/><circle cx="12" cy="13.4" r="1.1" fill="' + NODE + '" stroke="none"/>',
    video: '<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.2 21 7.4v9.2L16 13.8z" stroke="' + ACC + '"/>',
    save: '<path d="M5.5 4.5h10L19.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 5.5 4.5z"/><path d="M8 4.5v4.3h6.5V4.5"/><rect x="8" y="12.5" width="8" height="7" rx="0.8" stroke="' + ACC + '"/>',
    building: '<rect x="5.5" y="3.5" width="13" height="17" rx="1.6"/><path d="M9 7.4h2M13 7.4h2M9 11h2M13 11h2M9 14.6h2M13 14.6h2"/><path d="M10 20.5v-3.2h4v3.2" stroke="' + ACC + '"/>',
    "graduation-cap": '<path d="M2.5 9.5 12 5.5l9.5 4-9.5 4z"/><path d="M6.6 11.4V15c0 1.5 2.4 2.6 5.4 2.6s5.4-1.1 5.4-2.6v-3.6"/><path d="M21.5 9.7v4.6" stroke="' + ACC + '"/><circle cx="21.5" cy="15.2" r="1.4" fill="' + NODE + '" stroke="none"/>',
    list: '<path d="M8.5 7H20M8.5 12H20M8.5 17H20"/><circle cx="4.6" cy="7" r="1.5" fill="' + NODE + '" stroke="none"/><circle cx="4.6" cy="12" r="1.5" fill="' + NODE + '" stroke="none"/><circle cx="4.6" cy="17" r="1.5" fill="' + NODE + '" stroke="none"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.8h11.2l-2.4 3.6 2.4 3.6H5.5" stroke="' + ACC + '"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.8" stroke="' + ACC + '"/><circle cx="12" cy="12" r="1.3" fill="' + NODE + '" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2v4.6" stroke="' + ACC + '"/><circle cx="12" cy="8" r="1.15" fill="' + NODE + '" stroke="none"/>',
    "face-neutral": '<circle cx="12" cy="12" r="8.4"/><circle cx="9" cy="10.4" r="1.1" fill="' + NODE + '" stroke="none"/><circle cx="15" cy="10.4" r="1.1" fill="' + NODE + '" stroke="none"/><path d="M8.8 15.1h6.4"/>',
    "thumbs-up": '<path d="M7 11.2 11 4.4a2 2 0 0 1 2 2.1V10h5.2a1.9 1.9 0 0 1 1.85 2.3l-1 5.4A2 2 0 0 1 17.1 19.5H7"/><rect x="3.4" y="11.2" width="3.6" height="8.3" rx="1" stroke="' + ACC + '"/>',
    sparkles: '<path d="M11.5 4l1.5 4.1 4.1 1.5-4.1 1.5L11.5 15.2 10 11.1 5.9 9.6 10 8.1z"/><path d="M17.6 14.5l.75 1.9 1.9.75-1.9.75-.75 1.9-.75-1.9-1.9-.75 1.9-.75z" fill="' + NODE + '" stroke="none"/>',
    celebration: '<circle cx="12" cy="12" r="2.3" fill="' + NODE + '" stroke="none"/><path d="M12 6.4V3.5M12 20.5v-2.9M5.9 12H3M21 12h-2.9M7.6 7.6 5.6 5.6M18.4 18.4l-2-2M16.4 7.6l2-2M5.6 18.4l2-2" stroke="' + ACC + '"/>',

    // ————— Gesti singoli (monolinea, adattivi) —————
    // Gesti-firma: monolinea currentColor + micro NODO rosa al punto-chiave (resa "Risonanza")
    check: '<path d="M5 12.8l4.2 4.2L19 7.2"/><circle cx="9.2" cy="17" r="1.5" fill="' + NODE + '" stroke="none"/>',
    plus: '<path d="M12 6.4V17.6"/><path d="M6.4 12H17.6"/><circle cx="12" cy="12" r="1.5" fill="' + NODE + '" stroke="none"/>',
    // x: gesto-chiusura → monolinea pulita (massima chiarezza, è la X universale dei modali)
    x: '<path d="M6 6 18 18M18 6 6 18"/>',
    // cestino (famiglia "onesta": forma + nodo rosa) — azione elimina, esplicita
    trash: '<path d="M4.5 7.2h15"/><path d="M9.4 7.2V5.7A1.7 1.7 0 0 1 11.1 4h1.8A1.7 1.7 0 0 1 14.6 5.7V7.2"/><path d="M6.6 7.2l.85 11A2 2 0 0 0 9.45 20h5.1a2 2 0 0 0 2-1.8l.85-11"/><path d="M10.3 10.6v5.4M13.7 10.6v5.4" stroke="' + ACC + '"/><circle cx="12" cy="5.4" r="1.05" fill="' + NODE + '" stroke="none"/>',
    // Chevron bespoke (sostituisce il carattere tipografico › nelle hub-row): monolinea coerente coi gesti
    chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    "arrow-up": '<path d="M12 19V5.5"/><path d="M6.4 11.1 12 5.5l5.6 5.6"/>',
    "arrow-down": '<path d="M12 5v13.5"/><path d="M6.4 12.9 12 18.5l5.6-5.6"/>',
    send: '<path d="M20.6 3.4 14 20.6l-3.6-7-7-3.6z"/><path d="M20.6 3.4 10.4 13.6" stroke="' + ACC + '"/>',
    // link esterno: riquadro + freccia che esce (viola), stessa sotto-famiglia di send/refresh
    "external": '<path d="M11 6.5H6.5A1.5 1.5 0 0 0 5 8v9.5A1.5 1.5 0 0 0 6.5 19H16a1.5 1.5 0 0 0 1.5-1.5V13"/><path d="M13.5 5.5H19V11" stroke="' + ACC + '"/><path d="M19 5.5 11 13.5" stroke="' + ACC + '"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M17.8 3.6v3.9h-3.9" stroke="' + ACC + '"/>',
    heart: '<path d="M12 19.5 4.8 12.3a4.4 4.4 0 0 1 6.2-6.2l1 1 1-1a4.4 4.4 0 0 1 6.2 6.2z"/>',
    star: '<path d="M12 3.6l2.55 5.16 5.7.83-4.12 4.02.97 5.67L12 16.97 6.9 19.3l.97-5.67L3.75 9.6l5.7-.83z"/>',

    // ————— Glifi-firma (clasp due-voci) —————
    // onda-S bicroma viola→rosa + nodo rosa: due voci che formano un'unica onda
    "resonance-profile": '<path d="M3 12C5 12 5.5 7 8 7S10.5 12 12 12" stroke="' + ACC + '"/><path d="M12 12C13.5 12 14 17 16.5 17S19 12 21 12" stroke="' + NODE + '"/><circle cx="12" cy="12" r="2.1" fill="' + NODE + '" stroke="none"/>',
    // clasp: due semi-onde che convergono in un nodo (currentColor: leggibile sul tab attivo a gradiente)
    match: '<path d="M3 8.4C6.5 8.4 5.6 14 9.4 14"/><path d="M21 8.4C17.5 8.4 18.4 14 14.6 14"/><circle cx="12" cy="14" r="2.3" fill="currentColor" stroke="none"/>'
  };

  // Illustrazioni d'onda per gli empty-state (currentColor a var(--muted))
  var ILLUS = {
    radiant: '<circle cx="40" cy="24" r="2.6" fill="currentColor" stroke="none"/><path d="M48 16a12 12 0 0 1 0 16"/><path d="M32 16a12 12 0 0 0 0 16"/><path d="M55 10.5a20 20 0 0 1 0 27" opacity=".55"/><path d="M25 10.5a20 20 0 0 0 0 27" opacity=".55"/>',
    convergent: '<path d="M5 24c7 0 9-8.5 15-8.5s7.2 7.4 11 8.1"/><path d="M75 24c-7 0-9-8.5-15-8.5s-7.2 7.4-11 8.1"/><circle cx="36" cy="23.6" r="1.7" fill="currentColor" stroke="none" opacity=".85"/><circle cx="44" cy="23.6" r="1.7" fill="currentColor" stroke="none" opacity=".85"/>',
    quiet: '<path d="M5 24h24c2.5 0 2.5-3.4 5-3.4s2.5 3.4 5 3.4h31" opacity=".75"/>',
    inphase: '<path d="M5 24c6 0 6-11 11.5-11S22 24 28 24s6-11 11.5-11S45 24 51 24s6-11 11.5-11S68 24 75 24"/><circle cx="40" cy="24" r="2.6" fill="currentColor" stroke="none"/>'
  };

  // Spot art (illustrazioni brandizzate, viewBox 240x170, usano #jmGrad globale in index.html)
  var SPOT = {
    trova: '<circle cx="120" cy="92" r="20" stroke="#2c3050"/><circle cx="120" cy="92" r="44" stroke="#2c3050" opacity=".7"/><circle cx="120" cy="92" r="68" stroke="#2c3050" opacity=".4"/><g transform="translate(108,80)"><rect x="0" y="0" width="24" height="17" rx="7" fill="url(#jmGrad)"/><rect x="13.7" y="16.5" width="2.6" height="6.5" rx="1.3" fill="url(#jmGrad)"/><g fill="#0e0f1a"><rect x="5" y="9.5" width="2" height="3.5" rx="1"/><rect x="9" y="7" width="2" height="6" rx="1"/><rect x="13" y="5" width="2" height="8" rx="1"/><rect x="17" y="8" width="2" height="5" rx="1"/></g></g><circle cx="58" cy="60" r="4" fill="#969cc4"/><circle cx="186" cy="118" r="4" fill="#969cc4"/><circle cx="64" cy="132" r="4" fill="#969cc4"/><circle cx="182" cy="50" r="6" fill="#ff5c9d"/><circle cx="182" cy="50" r="11" stroke="#ff5c9d" opacity=".5"/><path d="M132 84 Q 160 60 176 53" stroke="#8b6cff" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/>',
    sintonia: '<path d="M8 92 C 34 64, 58 64, 84 92" stroke="#8b6cff" stroke-width="2.5" stroke-linecap="round" opacity=".55"/><path d="M232 92 C 206 120, 182 120, 156 92" stroke="#ff5c9d" stroke-width="2.5" stroke-linecap="round" opacity=".55"/><path d="M40 92 C 66 56, 92 56, 120 92 S 174 128, 200 92" stroke="url(#jmGrad)" stroke-width="4.5" stroke-linecap="round"/><circle cx="120" cy="92" r="7" fill="url(#jmGrad)"/><circle cx="120" cy="92" r="15" stroke="url(#jmGrad)" opacity=".4"/>',
    suonate: '<g stroke="#8b6cff" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M120 36V24"/><path d="M120 148v12"/><path d="M156 56l9-9"/><path d="M75 127l-9 9"/><path d="M165 122l9 9"/><path d="M66 47l-9-9"/></g><g transform="translate(78,68) rotate(-8)"><rect x="0" y="0" width="34" height="24" rx="10" fill="#8b6cff"/><rect x="19" y="23" width="3.6" height="9" rx="1.8" fill="#8b6cff"/><g fill="#0e0f1a"><rect x="7" y="13" width="2.6" height="5" rx="1.3"/><rect x="12.5" y="9.5" width="2.6" height="8.5" rx="1.3"/><rect x="18" y="7" width="2.6" height="11" rx="1.3"/><rect x="24" y="11" width="2.6" height="7" rx="1.3"/></g></g><g transform="translate(120,76) rotate(8)"><rect x="0" y="0" width="34" height="24" rx="10" fill="#ff5c9d"/><rect x="11" y="23" width="3.6" height="9" rx="1.8" fill="#ff5c9d"/><g fill="#0e0f1a"><rect x="7" y="11" width="2.6" height="7" rx="1.3"/><rect x="12.5" y="7" width="2.6" height="11" rx="1.3"/><rect x="18" y="9.5" width="2.6" height="8.5" rx="1.3"/><rect x="24" y="13" width="2.6" height="5" rx="1.3"/></g></g>'
  };

  function spot(name, cls) {
    var body = SPOT[name];
    if (!body) return "";
    return '<svg class="spot' + (cls ? " " + cls : "") + '" viewBox="0 0 240 170" fill="none" aria-hidden="true">' + body + "</svg>";
  }

  function ic(name, cls) {
    var body = ICONS[name];
    if (!body) return "";
    return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }
  function illus(name, cls) {
    var body = ILLUS[name];
    if (!body) return "";
    return '<svg class="empty-ill' + (cls ? " " + cls : "") + '" viewBox="0 0 80 48" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }

  global.ICONS = ICONS;
  global.ILLUS = ILLUS;
  global.SPOT = SPOT;
  global.ic = ic;
  global.illus = illus;
  global.spot = spot;
})(typeof window !== "undefined" ? window : this);
