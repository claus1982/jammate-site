/* JamMate — FASE 1: Palco (marketplace band ↔ locali)
 * Prenotazione con conferma, recensioni a due lati verificate, pagamenti SIMULATI.
 * Usa gli helper globali definiti in app.js ($,el,esc,openModal,toast,avatarTag,
 * save,state,navigate,formatDate,GENRES,INSTRUMENTS,options,chips,toggleChip,currentView).
 * Reso modulare apposta: in futuro questo diventa il "modulo booking" estraibile. */

// Icone risolte a render time (vedi statusLabel): niente ic() al parse, così l'ordine di caricamento
// degli script non è più un accoppiamento fragile (icons.js potrebbe non essere ancora pronto).
const STATUS = {
  requested: { k: "gigs.status_requested", c: "warn" },
  quoted: { k: "gigs.status_quoted", c: "accent" },
  counter: { k: "gigs.status_counter", ic: "refresh", c: "warn" },
  declined: { k: "gigs.status_declined", c: "muted" },
  confirmed: { k: "gigs.status_confirmed", ic: "check", c: "ok" },
  completed: { k: "gigs.status_completed", c: "accent" },
  reviewed: { k: "gigs.status_reviewed", ic: "star", c: "ok" }
};
// Compone l'etichetta di stato (testo + icona opzionale) a render time.
// st.t = testo già localizzato (fallback per stati sconosciuti); st.k = chiave i18n.
function statusLabel(st) { return `${esc(st.k ? t(st.k) : st.t)}${st.ic ? " " + ic(st.ic) : ""}`; }

// --- Luogo: regione → provincia → città (per band e locali) ---
function regionOptions(sel) { return `<option value="">${esc(t('gigs.region_dash'))}</option>` + REGIONI_NAMES.map(r => `<option value="${esc(r)}"${r === sel ? " selected" : ""}>${esc(r)}</option>`).join(""); }
function provinceOptions(region, sel) { return `<option value="">${esc(t('gigs.province_dash'))}</option>` + (REGIONI[region] || []).map(p => `<option value="${esc(p)}"${p === sel ? " selected" : ""}>${esc(p)}</option>`).join(""); }
function allProvinces() { return REGIONI_NAMES.reduce((a, r) => a.concat(REGIONI[r]), []).sort((a, b) => a.localeCompare(b)); }
function inProvince(obj, province) { if (!province) return true; if (obj.province) return obj.province === province; return (obj.city || "") === province; }

function allVenues() {
  const source = (typeof isProductionRuntime === "function" && isProductionRuntime()) ? (state.venues || []) : SEED_VENUES;
  return [...(state.myVenue ? [Object.assign({ mine: true }, state.myVenue)] : []), ...source];
}
function myBand() { return (state.bands || [])[0] || null; }
function stars(r) { return ic('star') + " " + (r / 10).toFixed(1); }
function bookingsPending() { return (state.bookings || []).filter(b => b.status !== "reviewed" && b.status !== "declined").length; }

// --- Strumenti: match per famiglia/sottostringa (fix tassonomia filtro) ---
// I members band sono generici ("Chitarra") mentre #vfIns offre INSTRUMENTS specifici
// ("Chitarra elettrica"): confronto bidirezionale + famiglia per non escludere tutto.
function instrumentMatches(member, filter) {
  if (!filter) return true;
  const x = (member || "").toLowerCase(), f = filter.toLowerCase();
  if (x === f || x.includes(f) || f.includes(x)) return true;
  const fam = (typeof INSTRUMENT_FAMILY !== "undefined") ? INSTRUMENT_FAMILY : {};
  return !!fam[member] && !!fam[filter] && fam[member] === fam[filter];
}

// --- Parsing budget/fee tollerante: estrae il valore numerico più alto da stringhe
// libere ("300–450€", "400€", "600-900€"). Ritorna null se non trova numeri. ---
function parseMoney(s) {
  if (s == null) return null;
  // Convenzione EU: '.' = separatore migliaia, ',' = decimali. Estrae il valore più alto da range
  // liberi ("300–450€", "2.250,00€") senza fondere le cifre come faceva la versione precedente.
  const tokens = String(s).match(/\d[\d.,]*/g);
  if (!tokens) return null;
  const vals = tokens.map(t => parseFloat(t.replace(/\./g, "").replace(",", "."))).filter(n => !isNaN(n));
  if (!vals.length) return null;
  return Math.max(...vals);
}
// Il budget del locale copre la fee della band? Tollerante: se manca un dato → true.
function feeMatchesBudget(fee, budget) {
  const f = parseMoney(fee), b = parseMoney(budget);
  if (f == null || b == null) return true;
  return b >= f;
}

// --- Ranking per rilevanza (calcolato a render, niente persistenza) ---
// BACKEND HOOK: ranking server-side (query ordinata per match score + geo + freschezza) sostituirà venueRelevance/bandRelevance lato client.
function freshOpenNight(v) {
  if (!v.openNight || !v.openNight.date) return 0;
  const days = (new Date(v.openNight.date) - new Date(todayISO())) / 864e5;
  if (days < 0) return -1000;           // serata scaduta: in coda
  if (days <= 30) return 8;             // serata fresca: in testa
  return 0;
}
function venueRelevance(v, band) {
  let s = 0;
  const vgen = [...(v.genres || []), ...(v.openNight ? [v.openNight.genre] : [])];
  s += genreOverlap(band ? band.genres : [], vgen) * 12;
  if (band && inProvince(v, band.province || band.city)) s += 10;
  s += freshOpenNight(v);
  if (band && v.openNight && feeMatchesBudget(band.fee, v.openNight.budget)) s += 6;
  return s;
}
function bandRelevance(b, venue) {
  let s = 0;
  s += genreOverlap(b.genres, venue ? venue.genres : []) * 12;
  if (venue && inProvince(b, venue.province || venue.city)) s += 10;
  s += b.available ? 6 : -8;
  return s;
}
// Sort stabile per rilevanza decrescente con tie-breaker su id (coerente fra render).
function byRelevance(scoreFn) {
  return (a, b) => { const d = scoreFn(b) - scoreFn(a); return d !== 0 ? d : String(a.id).localeCompare(String(b.id)); };
}

// --- Continuità "risonanza": chip + segnali di scena sulle card del Palco ---
// BACKEND HOOK: i segnali "già jammato"/affinità arriveranno dal grafo relazioni server invece che da hasJammedWith locale.
// entity = venue|band|musician card subject; ref = il contesto corrente (band mia o locale mio).
function palcoSceneSignals(entity, ref) {
  const out = [];
  const overlap = genreOverlap(entity.genres || [], (ref && ref.genres) || []);
  if (overlap) out.push({ icon: "music-note", text: overlap > 1 ? t('gigs.signal_same_genres') : t('gigs.signal_one_genre') });
  const refProv = ref && (ref.province || ref.city);
  if (refProv && inProvince(entity, refProv)) out.push({ icon: "map-pin", text: t('gigs.signal_near_you') });
  if (typeof hasJammedWith === "function" && hasJammedWith(entity)) out.push({ icon: "heart", text: t('gigs.signal_jammed') });
  return out.slice(0, 3);
}
function palcoSceneSignalsHtml(entity, ref) {
  const s = palcoSceneSignals(entity, ref); if (!s.length) return "";
  return `<div class="scene-signals">${s.map(x => `<span class="scene-sig">${ic(x.icon)} ${esc(x.text)}</span>`).join("")}</div>`;
}
function inResonance(entity, ref) { return genreOverlap(entity.genres || [], (ref && ref.genres) || []) > 0; }
// Converte rating storico /10 in scala 1–5 (per recensioni controparte demo).
function ratingFromHistory(entity) {
  const r = entity && typeof entity.rating === "number" ? entity.rating : 0;
  return Math.max(1, Math.min(5, Math.round(r / 2)));
}

// Sposta il focus sul primo campo della sheet appena aperta (a11y).
function focusFirstField(id) { setTimeout(() => { try { const f = id ? $("#" + id) : document.querySelector(".modal input,.modal textarea,.modal select"); if (f) f.focus(); } catch (_) {} }, 60); }

// --- Empty-state propositivi: messaggio + CTA cliccabili (cross-link). ---
// Ritorna un nodo <div.empty>; ctas = [{label, icon?, on}]. Lega gli onclick dopo il render.
function emptyState(msg, ctas, illusName) {
  const node = el(`<div class="empty">${illusName ? illus(illusName) : ""}<div>${esc(msg)}</div>
    <div class="empty-ctas">${(ctas || []).map((c, i) => `<button class="btn small${i ? " secondary" : ""}" data-cta="${i}">${c.icon ? ic(c.icon) + " " : ""}${esc(c.label)}</button>`).join("")}</div>
  </div>`);
  (ctas || []).forEach((c, i) => { const b = node.querySelector(`[data-cta="${i}"]`); if (b) b.onclick = c.on; });
  return node;
}

// --- Dedup + conflitti di data prima di prenotare ---
// BACKEND HOOK: unique constraint (band_id,venue_id,date) e calendario disponibilità reale lato server; available→agenda con date occupate.
function bookingExists(bandId, venueId, date) {
  return (state.bookings || []).some(b => b.bandId === bandId && b.venueId === venueId && b.date === date && b.status !== "declined");
}
function hasDateConflict(bandId, date, exceptVenueId) {
  return (state.bookings || []).some(b => b.bandId === bandId && b.date === date && b.venueId !== exceptVenueId && b.status === "confirmed");
}

// --------------------------------------------------- Vista Palco
function renderPalco(app) {
  let seg = state.ui.palcoMode || "band";
  if (seg === "lessons") seg = "band"; // Lezioni ora è una tab a sé
  app.appendChild(el(`<div>
    <div class="row-between"><h1 class="view-title">Palco ${ic('microphone')}</h1>
      <button class="btn small secondary" id="bookingsBtn">${ic('list')} ${t('gigs.palco_bookings')}${bookingsPending() ? " · " + bookingsPending() : ""}</button></div>
    <p class="view-sub">${t('gigs.palco_sub')}</p>
    <div class="segmented" aria-label="${esc(t('gigs.palco_side_aria'))}">
      <button data-m="band" aria-pressed="${seg === "band"}" class="${seg === "band" ? "on" : ""}">${ic('music-note')} ${t('gigs.palco_band')}</button>
      <button data-m="venue" aria-pressed="${seg === "venue"}" class="${seg === "venue" ? "on" : ""}">${ic('building')} ${t('gigs.palco_venue')}</button>
    </div>
    <div id="palcoBody"></div>
  </div>`));
  app.querySelectorAll(".segmented button").forEach(b => b.onclick = () => { state.ui.palcoMode = b.dataset.m; save(); rerenderPalco(); });
  $("#bookingsBtn").onclick = openBookings;
  if (seg === "venue") renderVenueSide($("#palcoBody"));
  else renderBandSide($("#palcoBody"));
}
function rerenderPalco() { if (currentView === "palco") { $("#app").innerHTML = ""; renderPalco($("#app")); applyToggleA11y($("#app")); } }

// --------------------------------------------------- Lato "La mia band"
function renderBandSide(box) {
  const band = myBand();
  if (!band) {
    box.appendChild(el(`<div class="empty">${spot("trova")}${t('gigs.band_empty')}</div>`));
    const b = el(`<button class="btn">${ic('plus')} ${t('gigs.create_band_cta')}</button>`); b.onclick = () => openCreateBand(); box.appendChild(b);
    return;
  }
  // Card band con badge "Pronta & Disponibile"
  const ready = band.available && (band.repertoire || []).length && band.genres.length;
  const c = el(`<div class="card flat">
    <div class="card-head">${avatarTag(band)}<div class="meta">
      <div class="name">${esc(band.name)} ${ready ? `<span class="tag lvl">${ic('check')} ${t('gigs.band_ready')}</span>` : `<span class="tag">${t('gigs.band_draft')}</span>`}</div>
      <div class="loc">${ic('map-pin')} ${esc([band.city, band.province].filter(Boolean).join(", "))} · ${band.members.length} ${t('gigs.elements')} · ${ic('target')} ${esc(band.fee || "—")}</div>
    </div></div>
    <div class="tags">${band.genres.map(g => `<span class="tag accent">${esc(genreLabel(g))}</span>`).join("")}</div>
    <div class="row-between" style="margin-top:12px;flex-wrap:wrap;gap:10px">
      <label style="display:flex;align-items:center;gap:8px;font-size:.9rem"><input type="checkbox" id="availTgl" ${band.available ? "checked" : ""}> ${t('gigs.avail_for_nights')}</label>
      <button class="btn small secondary" id="editBand">${t('gigs.edit_epk')}</button>
    </div>
  </div>`);
  box.appendChild(c);
  $("#availTgl").onchange = e => { band.available = e.target.checked; save(); rerenderPalco(); };
  $("#editBand").onclick = () => openCreateBand(band);

  renderBandInvites(box, band);

  if ((band.media || []).length) {
    box.appendChild(el(`<div class="section-label">${t('gigs.epk.your_compilation')}</div>`));
    const mb = el(`<div></div>`); box.appendChild(mb);
    renderBandMedia(mb, band, { editable: false });
  }

  box.appendChild(bandSearchPanel(band));
}

// --- Pannello ricerca locali (lato band), speculare a venueSearchPanel ---
// BACKEND HOOK: ricerca locali e proposta a freddo passano da endpoint server con stessi filtri.
const bandFilter = { genre: "", province: "", type: "" };
function venueMatchesBandFilter(v) {
  return (!bandFilter.genre || [...(v.genres || []), v.openNight && v.openNight.genre].includes(bandFilter.genre))
    && (!bandFilter.type || v.type === bandFilter.type)
    && inProvince(v, bandFilter.province);
}
function bandSearchPanel(band) {
  const TYPES = [...new Set(allVenues().map(v => v.type).filter(Boolean))].sort();
  const wrap = el(`<div>
    <div class="section-label">${ic('search')} ${t('gigs.venues_seeking')}</div>
    <div class="filters">
      <div class="filter-row">
        <select id="bfGen">${options(GENRES, bandFilter.genre, t('gigs.all_genres'), genreLabel)}</select>
        <select id="bfType">${options(TYPES, bandFilter.type, t('gigs.all_types'))}</select>
      </div>
      <div class="filter-row">
        <select id="bfProv">${["", ...allProvinces()].map(p => `<option value="${esc(p)}"${p === bandFilter.province ? " selected" : ""}>${p ? esc(p) : esc(t('gigs.all_provinces'))}</option>`).join("")}</select>
      </div>
    </div>
    <div id="bResults"></div>
  </div>`);
  const paint = () => {
    const rb = wrap.querySelector("#bResults"); rb.innerHTML = "";
    const list = allVenues().filter(v => !v.mine && venueMatchesBandFilter(v)).slice().sort(byRelevance(v => venueRelevance(v, band)));
    if (!list.length) {
      rb.appendChild(emptyState(t('gigs.no_venues_filter'), [
        { label: t('gigs.reset_filters'), icon: "refresh", on: () => { bandFilter.genre = bandFilter.province = bandFilter.type = ""; rerenderPalco(); } },
        { label: t('gigs.search_nights_board'), icon: "megaphone", on: () => navigate("board") }
      ]));
      return;
    }
    list.forEach(v => rb.appendChild(venueOpenCard(v, band)));
  };
  wrap.querySelector("#bfGen").onchange = e => { bandFilter.genre = e.target.value; paint(); };
  wrap.querySelector("#bfType").onchange = e => { bandFilter.type = e.target.value; paint(); };
  wrap.querySelector("#bfProv").onchange = e => { bandFilter.province = e.target.value; paint(); };
  paint();
  return wrap;
}

function venueOpenCard(v, band) {
  const ris = inResonance(v, band) ? " " + risonanzaChip(t('gigs.in_resonance')) : "";
  const fresh = freshOpenNight(v) > 0;
  const c = el(`<div class="card">
    <div class="card-head">${avatarTag(v)}<div class="meta">
      <div class="name">${esc(v.name)}${ris} <span class="score">${stars(v.rating)}</span></div>
      <div class="loc">${esc(v.type)} · ${ic('map-pin')} ${esc(v.city)} · ${t('gigs.cap')} ${v.capacity}</div>
    </div></div>
    ${palcoSceneSignalsHtml(v, band)}
    <div class="card" style="margin:10px 0 0;cursor:default;background:rgba(255,255,255,.03)">
      <div class="event-date">${ic('calendar')} ${formatDate(v.openNight.date)}${fresh ? ` <span class="tag accent">${ic('clock')} ${t('gigs.fresh')}</span>` : ""} · ${t('gigs.seeks')}: ${esc(v.openNight.genre)}</div>
      <div class="loc" style="margin-top:4px">${ic('target')} ${t('gigs.budget')}: ${esc(v.openNight.budget)}</div>
    </div>
  </div>`);
  clickableCard(c, () => openVenueSheet(v, band));
  return c;
}

// --------------------------------------------------- Lato "Sono un locale"
function renderVenueSide(box) {
  const v = state.myVenue;
  if (!v) {
    box.appendChild(el(`<div class="empty">${spot("trova")}${t('gigs.venue_empty')}</div>`));
    const b = el(`<button class="btn">${ic('plus')} ${t('gigs.register_venue_cta')}</button>`); b.onclick = () => openCreateVenue(); box.appendChild(b);
    return;
  }
  const place = [v.city, v.province].filter(Boolean).join(", ") || "—";
  const c = el(`<div class="card flat venue-area">
    <div class="card-head">${avatarTag(v)}<div class="meta">
      <div class="name">${esc(v.name)} <span class="tag accent">${ic('building')} ${t('gigs.venue_area')}</span></div>
      <div class="loc">${esc(v.type)} · ${ic('map-pin')} ${esc(place)} · ${t('gigs.cap')} ${v.capacity}</div>
    </div><button class="btn small secondary" id="editVenue">${t('gigs.edit')}</button></div>
    <div class="tags">${(v.genres || []).map(g => `<span class="tag accent">${esc(genreLabel(g))}</span>`).join("")}</div>
    <div class="filter-row" style="margin-top:12px">
      <button class="btn small" id="vPostReq">${ic('megaphone')} ${t('gigs.post_request')}</button>
      <button class="btn small secondary" id="vReqs">${ic('list')} ${t('gigs.proposals')}${venueBookings().length ? " · " + venueBookings().length : ""}</button>
    </div>
    <p class="view-sub" style="margin-top:10px;font-size:.78rem">${t('gigs.venue_note')}</p>
  </div>`);
  box.appendChild(c);
  $("#editVenue").onclick = () => openCreateVenue(v);
  $("#vPostReq").onclick = () => openVenueRequest(v);
  $("#vReqs").onclick = () => openVenueBookings(v);
  box.appendChild(venueSearchPanel(v));
}

// --- Dashboard Locale: cerca e ingaggia musicisti & band (con filtri di luogo) ---
const venueFilter = { kind: "band", instrument: "", genre: "", province: "", onlyAvailable: false };
function bandMatchesVenueFilter(b) {
  return (!venueFilter.instrument || (b.members || []).some(m => instrumentMatches(m, venueFilter.instrument)))
    && (!venueFilter.genre || (b.genres || []).includes(venueFilter.genre))
    && (!venueFilter.onlyAvailable || b.available)
    && inProvince(b, venueFilter.province);
}
function musicianMatchesVenueFilter(p) {
  return (!venueFilter.instrument || (p.instruments || []).includes(venueFilter.instrument))
    && (!venueFilter.genre || (p.genres || []).includes(venueFilter.genre))
    && inProvince(p, venueFilter.province);
}
function venueMusicianCard(p, v) {
  const ris = inResonance(p, v) ? " " + risonanzaChip(t('gigs.in_resonance')) : "";
  const c = el(`<div class="card">
    <div class="card-head author-clickable">${avatarTag(p)}<div class="meta">
      <div class="name">${esc(p.name)}${ris} <span class="score">${ic('star')} ${avgScore(p.endo)}</span></div>
      <div class="loc">${esc((p.instruments || []).map(vocabLabel).join(", "))} · ${ic('map-pin')} ${esc(p.city)}</div></div></div>
    ${palcoSceneSignalsHtml(p, v)}
    <div class="tags" style="margin-top:8px">${(p.genres || []).map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}</div>
    <button class="btn small secondary" data-contact style="margin-top:10px">${ic('send')} ${t('gigs.contact')}</button>
  </div>`);
  clickableCard(c.querySelector(".card-head"), () => openProfileSheet(p));
  c.querySelector("[data-contact]").onclick = (e) => { e.stopPropagation(); dmContact({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, city: p.city, distanceKm: p.distanceKm }); };
  return c;
}
function venueSearchPanel(v) {
  const wrap = el(`<div>
    <div class="section-label">${t('gigs.who_to_hire')}</div>
    <div class="segmented" aria-label="${esc(t('gigs.profile_type_aria'))}">
      <button data-vk="band" aria-pressed="${venueFilter.kind === "band"}" class="${venueFilter.kind === "band" ? "on" : ""}">${ic('music-note')} ${t('gigs.palco_band')}</button>
      <button data-vk="musician" aria-pressed="${venueFilter.kind === "musician"}" class="${venueFilter.kind === "musician" ? "on" : ""}">${ic('microphone')} ${t('gigs.musicians')}</button>
    </div>
    <div class="filters">
      <div class="filter-row">
        <select id="vfIns">${options(INSTRUMENTS, venueFilter.instrument, t('gigs.all_instruments'))}</select>
        <select id="vfGen">${options(GENRES, venueFilter.genre, t('gigs.all_genres'), genreLabel)}</select>
      </div>
      <div class="filter-row">
        <select id="vfProv">${["", ...allProvinces()].map(p => `<option value="${esc(p)}"${p === venueFilter.province ? " selected" : ""}>${p ? esc(p) : esc(t('gigs.all_provinces'))}</option>`).join("")}</select>
      </div>
      <label class="avail-filter"${venueFilter.kind === "band" ? "" : ' style="display:none"'}><input type="checkbox" id="vfAvail" ${venueFilter.onlyAvailable ? "checked" : ""}> ${ic('check')} ${t('gigs.only_available')}</label>
    </div>
    <div id="vResults"></div>
  </div>`);
  const paint = () => {
    const rb = wrap.querySelector("#vResults"); rb.innerHTML = "";
    if (venueFilter.kind === "band") {
      const sourceBands = (typeof isProductionRuntime === "function" && isProductionRuntime()) ? (state.publicBands || []) : SEED_BANDS;
      const list = sourceBands.filter(bandMatchesVenueFilter).slice().sort(byRelevance(b => bandRelevance(b, v)));
      if (!list.length) {
        rb.appendChild(emptyState(t('gigs.no_bands_filter'), [
          { label: t('gigs.reset_filters'), icon: "refresh", on: () => { venueFilter.instrument = venueFilter.genre = venueFilter.province = ""; venueFilter.onlyAvailable = false; rerenderPalco(); } },
          { label: t('gigs.post_a_request'), icon: "megaphone", on: () => { closeModal(); openVenueRequest(v); } }
        ]));
        return;
      }
      list.forEach(b => rb.appendChild(bandHireCard(b, v)));
    } else {
      const list = (state.profiles || []).filter(musicianMatchesVenueFilter).slice().sort((a, b) => { const d = affinityPct(b) - affinityPct(a); return d !== 0 ? d : String(a.id).localeCompare(String(b.id)); });
      if (!list.length) {
        rb.appendChild(emptyState(t('gigs.no_musicians_filter'), [
          { label: t('gigs.reset_filters'), icon: "refresh", on: () => { venueFilter.instrument = venueFilter.genre = venueFilter.province = ""; rerenderPalco(); } },
          { label: t('gigs.post_a_request'), icon: "megaphone", on: () => { closeModal(); openVenueRequest(v); } }
        ]));
        return;
      }
      list.forEach(p => rb.appendChild(venueMusicianCard(p, v)));
    }
  };
  wrap.querySelectorAll(".segmented button").forEach(b => b.onclick = () => { venueFilter.kind = b.dataset.vk; rerenderPalco(); });
  wrap.querySelector("#vfIns").onchange = e => { venueFilter.instrument = e.target.value; paint(); };
  wrap.querySelector("#vfGen").onchange = e => { venueFilter.genre = e.target.value; paint(); };
  wrap.querySelector("#vfProv").onchange = e => { venueFilter.province = e.target.value; paint(); };
  wrap.querySelector("#vfAvail").onchange = e => { venueFilter.onlyAvailable = e.target.checked; paint(); };
  paint();
  return wrap;
}
function venueBookings() { const v = state.myVenue; return v ? (state.bookings || []).filter(b => b.venueId === v.id) : []; }
function openVenueBookings(v) {
  const list = venueBookings();
  openModal(`<h2>${ic('list')} ${t('gigs.proposals_bookings')}</h2>
    <div class="aff-note">${t('gigs.proposals_note')}</div>
    <div id="bkList" data-modal="venueBookings" style="margin-top:8px">${list.length ? list.map(bookingRow).join("") : ""}</div>`);
  if (!list.length) {
    $("#bkList").appendChild(emptyState(t('gigs.no_proposals'), [
      { label: t('gigs.search_a_band'), icon: "search", on: () => { closeModal(); rerenderPalco(); } },
      { label: t('gigs.post_a_request'), icon: "megaphone", on: () => { closeModal(); openVenueRequest(v); } }
    ]));
  }
  bindBookingActions();
}
// Il locale pubblica una richiesta che finisce in Bacheca per i musicisti.
function openVenueRequest(v) {
  openModal(`
    <h2>${t('gigs.post_request_title')} ${ic('megaphone')}</h2>
    <p class="view-sub">${t('gigs.post_request_sub')}</p>
    <label class="field">${t('gigs.title')}</label><input type="text" id="vrTitle" placeholder="${esc(t('gigs.request_title_ph'))}">
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">${t('gigs.city')}</label><input type="text" id="vrCity" value="${esc(v.city || "")}"></div>
      <div><label class="field">${t('gigs.date')}</label><input type="date" id="vrDate"></div>
    </div>
    <label class="field" style="margin-top:10px">${t('gigs.genres')}</label><div class="chips" id="vrGen">${chips(GENRES, v.genres || [], genreLabel)}</div>
    <label class="field" style="margin-top:10px">${t('gigs.instruments_lineup')}</label><div id="vrIns"></div>
    <label class="field" style="margin-top:10px">${t('gigs.budget_label')}</label><input type="text" id="vrBudget" placeholder="${esc(t('gigs.budget_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.description')}</label><textarea id="vrDesc" placeholder="${esc(t('gigs.request_desc_ph'))}"></textarea>
    <button class="btn" id="vrSave" style="margin-top:16px">${t('gigs.publish_board')}</button>
  `);
  const selGen = (v.genres || []).slice(), selIns = [];
  document.querySelectorAll("#vrGen .chip").forEach(c => c.onclick = () => toggleChip(c, selGen));
  instrumentPicker($("#vrIns"), selIns, { placeholder: t('gigs.instrument_wanted_ph') });
  focusFirstField("vrTitle");
  $("#vrSave").onclick = () => {
    const title = $("#vrTitle").value.trim(); if (!title) return markFieldError("#vrTitle", t('gigs.give_request_title'));
    const budget = $("#vrBudget").value.trim();
    const desc = ($("#vrDesc").value.trim() + (budget ? `\n${t('gigs.budget_prefix')}: ${budget}` : "")).trim();
    state.events.unshift({
      id: "ve" + Date.now(), title, author: v.name, authorAvatar: v.avatar || "🏢",
      city: $("#vrCity").value.trim() || v.city || "Milano", distanceKm: 0,
      date: $("#vrDate").value || new Date().toISOString().slice(0, 10),
      createdAt: Date.now(), featured: false, // coerente con openNewEvent: abilita badge "Nuovo" + bump rilevanza
      genres: selGen, description: desc, budget: budget || "", // BACKEND HOOK: budget come campo strutturato così la Bacheca può mostrarlo/filtrarlo
      slots: (selIns.length ? selIns : [t('gigs.full_band')]).map(i => ({ instrument: i, filled: false })),
      fromVenue: true
    });
    save(); closeModal(); toast(t('gigs.request_published'), ic('megaphone'));
    if (typeof notify === "function") notify("megaphone", t('gigs.request_online', { title }), { view: "board" });
  };
}

function bandHireCard(b, venue) {
  const ris = inResonance(b, venue) ? " " + risonanzaChip(t('gigs.in_resonance')) : "";
  const avail = b.available ? `<span class="tag lvl">${ic('check')} ${t('gigs.available')}</span>` : `<span class="tag warn">${ic('alert-triangle')} ${t('gigs.busy')}</span>`;
  const c = el(`<div class="card">
    <div class="card-head">${avatarTag(b)}<div class="meta">
      <div class="name">${esc(b.name)}${ris} <span class="score">${stars(b.rating)}</span> ${avail}</div>
      <div class="loc">${ic('map-pin')} ${esc(b.city)} · ${b.members.length} ${t('gigs.elements')} · ${ic('target')} ${esc(b.fee)}</div>
    </div></div>
    ${palcoSceneSignalsHtml(b, venue)}
    <div class="tagline" style="margin:8px 0 0;font-style:italic;color:var(--muted)">“${esc(b.tagline)}”</div>
    <div class="tags" style="margin-top:8px">${b.genres.map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}</div>
  </div>`);
  clickableCard(c, () => openBandSheet(b, venue));
  return c;
}

// --------------------------------------------------- EPK band (vista) + azione locale
function openBandSheet(b, venue) {
  const busy = !b.available;
  openModal(`
    <div style="text-align:center"><div style="display:flex;justify-content:center">${avatarTag(b, true)}</div>
      <h2>${esc(b.name)}</h2>
      <div class="loc">${ic('map-pin')} ${esc(b.city)} · ${b.members.length} ${t('gigs.elements')} · <span class="score">${stars(b.rating)}</span> (${b.ratings})</div>
      <div style="margin-top:6px;font-weight:800;color:var(--accent)">${ic('target')} ${esc(b.fee)} ${t('gigs.per_night')}</div>
    </div>
    <div class="tags" style="justify-content:center;margin-top:10px">${b.genres.map(g => `<span class="tag accent">${esc(genreLabel(g))}</span>`).join("")}</div>
    ${busy ? `<div class="aff-note warn-note" style="margin-top:12px">${ic('alert-triangle')} ${t('gigs.band_busy_note')}</div>` : ""}
    <div class="section-label">${t('gigs.lineup')}</div><div class="tags">${b.members.map(m => `<span class="tag">${esc(vocabLabel(m))}</span>`).join("")}</div>
    <div class="section-label">${t('gigs.repertoire_excerpt')}</div>
    ${(b.repertoire || []).map(s => `<div class="rep-item"><span class="song">${esc(s)}</span></div>`).join("")}
    ${(b.media || []).length ? `<div class="section-label">${t('gigs.epk.listen_watch')}</div><div id="bandSheetMedia"></div>` : ""}
    <div class="section-label">${t('gigs.verified_reviews')}</div>
    <div class="aff-note">${t('gigs.review_quote', { stars: starsRating(ratingFromHistory(b)), rating: stars(b.rating), ratings: b.ratings })}</div>
    ${venue ? `<button class="btn" id="reqBtn" style="margin-top:18px">${ic('calendar')} ${t('gigs.request_booking')}</button>` : `<div class="aff-note" style="margin-top:16px">${t('gigs.create_venue_to_book')}</div>`}
  `);
  if ((b.media || []).length) renderBandMedia($("#bandSheetMedia"), b, { editable: false });
  if (venue) $("#reqBtn").onclick = () => { closeModal(); openRequestSheet(b, venue); };
}

// ===================== EPK · Audio/Video showcase (AUDIO_SHOWCASE.md) =====================
// Embed-first a COSTO 0: la band incolla un link; mostriamo una card con poster + ▶ e carichiamo
// l'iframe della terza parte SOLO al click (facade), dopo un consenso una-tantum per provider (ePrivacy).
// SoundCloud/YouTube/Vimeo = player in-app; Spotify (scelta #1) e Bandcamp = card di solo rimando.
// Mirror client di backend/functions/src/lib/oembed.js.
// BACKEND HOOK: in produzione lista/aggiunta passano da JM.Api.bands.media (oEmbed + poster first-party
// lato server); qui nel prototipo i media vivono in band.media e il poster è un placeholder a gradiente.
const BAND_MEDIA_PROVIDERS = {
  soundcloud: { label: "SoundCloud", kind: "audio", mode: "embed", test: (h) => h === "soundcloud.com" || h.endsWith(".soundcloud.com") },
  youtube:    { label: "YouTube",    kind: "video", mode: "embed", test: (h) => h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" },
  vimeo:      { label: "Vimeo",      kind: "video", mode: "embed", test: (h) => h === "vimeo.com" || h.endsWith(".vimeo.com") },
  spotify:    { label: "Spotify",    kind: "audio", mode: "link",  test: (h) => h === "open.spotify.com" || h === "spotify.com" },
  bandcamp:   { label: "Bandcamp",   kind: "audio", mode: "link",  test: (h) => h === "bandcamp.com" || h.endsWith(".bandcamp.com") },
};
const MEDIA_CAP = 6;                       // cap "calling card" EPK (specchio del backend)

// Rileva il provider da un URL https (kind/mode derivano dal provider). null se non in allowlist.
function detectMediaProvider(raw) {
  let u; try { u = new URL(raw); } catch (_) { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  for (const name in BAND_MEDIA_PROVIDERS) if (BAND_MEDIA_PROVIDERS[name].test(host)) return Object.assign({ name }, BAND_MEDIA_PROVIDERS[name]);
  return null;
}

// src dell'iframe player (solo provider 'embed'); YouTube via -nocookie. null se l'id non è estraibile.
function mediaEmbedSrc(prov, url) {
  let u; try { u = new URL(url); } catch (_) { return null; }
  if (prov.name === "soundcloud")
    return "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url) +
           "&color=%238b6cff&auto_play=true&hide_related=true&show_comments=false&show_teaser=false";
  if (prov.name === "youtube") {
    const id = u.hostname === "youtu.be" ? u.pathname.slice(1)
      : (u.searchParams.get("v") || (u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/) || [])[1]);
    return id ? "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0" : null;
  }
  if (prov.name === "vimeo") {
    const vid = (u.pathname.match(/\/(\d+)/) || [])[1];
    return vid ? "https://player.vimeo.com/video/" + encodeURIComponent(vid) + "?autoplay=1" : null;
  }
  return null;
}

const hasEmbedConsent = (name) => !!(state.ui && state.ui.embedConsent && state.ui.embedConsent[name]);
function grantEmbedConsent(name) {
  state.ui = state.ui || {};
  state.ui.embedConsent = state.ui.embedConsent || {};
  state.ui.embedConsent[name] = true; save();
}

// Una card media (facade). item = { id, kind, mode, provider, url, title, poster? }
function bandMediaCard(item, opts = {}) {
  const prov = BAND_MEDIA_PROVIDERS[item.provider]
    ? Object.assign({ name: item.provider }, BAND_MEDIA_PROVIDERS[item.provider])   // il map non porta `name`: serve a mediaEmbedSrc/consenso
    : { name: item.provider, label: item.provider || "Link", kind: item.kind, mode: item.mode };
  const title = item.title || (prov.kind === "video" ? t('gigs.epk.video') : t('gigs.epk.track'));
  const card = el(`
    <div class="epk-media" data-kind="${esc(prov.kind)}">
      <div class="epk-poster">
        <span class="epk-prov">${prov.kind === "video" ? ic("video") : ic("music-note")} ${esc(prov.label)}</span>
        ${prov.mode === "embed"
          ? `<button type="button" class="epk-play" aria-label="${esc(t('gigs.epk.play_aria', { title }))}">${ic("play")}</button>`
          : `<a class="epk-play" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer nofollow" aria-label="${esc(t('gigs.epk.open_on', { provider: prov.label }))}">${ic("play")}</a>`}
      </div>
      <div class="epk-cap">
        <span class="epk-title">${esc(title)}</span>
        ${prov.mode === "link" ? `<span class="epk-ext">${ic("external")} ${esc(prov.label)}</span>` : ""}
        ${opts.editable ? `<button type="button" class="epk-del" aria-label="${esc(t('gigs.epk.remove'))}">${ic("x")}</button>` : ""}
      </div>
    </div>`);
  if (item.poster) card.querySelector(".epk-poster").style.backgroundImage = `url(${JSON.stringify(item.poster)})`;
  if (prov.mode === "embed") wireEpkFacade(card, item, prov);
  if (opts.editable && opts.onRemove) card.querySelector(".epk-del").onclick = () => opts.onRemove(item);
  return card;
}

// Click-to-load: al ▶ chiede consenso una-tantum per provider, poi inietta l'iframe (niente terze parti prima).
function wireEpkFacade(card, item, prov) {
  const poster = card.querySelector(".epk-poster");
  const play = poster.querySelector(".epk-play");
  const load = () => {
    const src = mediaEmbedSrc(prov, item.url);
    if (!src) return toast(t('gigs.epk.not_playable'));
    const f = document.createElement("iframe");
    f.className = "epk-frame";
    f.src = src;
    f.loading = "lazy";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.referrerPolicy = "no-referrer";
    f.title = item.title || prov.label;
    f.setAttribute("allowfullscreen", "");
    poster.replaceWith(f);
  };
  play.onclick = () => {
    if (hasEmbedConsent(prov.name)) return load();
    play.style.visibility = "hidden";
    const gate = el(`
      <div class="epk-consent">${t('gigs.epk.consent', { provider: esc(prov.label) })}
        <div class="epk-consent-row">
          <button type="button" class="btn small">${t('gigs.epk.load')}</button>
          <button type="button" class="btn small secondary epk-cancel">${t('gigs.epk.cancel')}</button>
        </div>
      </div>`);
    poster.appendChild(gate);
    gate.querySelector(".btn:not(.secondary)").onclick = () => { grantEmbedConsent(prov.name); load(); };
    gate.querySelector(".epk-cancel").onclick = () => { gate.remove(); play.style.visibility = ""; };
  };
}

// Lista media di una band (lettura; + gestione se opts.editable).
function renderBandMedia(container, band, opts = {}) {
  if (!container) return;
  const media = band.media || [];
  container.innerHTML = "";
  if (!media.length && !opts.editable) return;          // lato booker: niente sezione vuota
  if (!media.length) container.appendChild(el(`<p class="view-sub" style="margin:0 0 8px">${t('gigs.epk.empty')}</p>`));
  const grid = el(`<div class="epk-grid"></div>`);
  media.forEach((m) => grid.appendChild(bandMediaCard(m, {
    editable: opts.editable,
    onRemove: opts.editable ? (it) => { band.media = (band.media || []).filter((x) => x.id !== it.id); save(); renderBandMedia(container, band, opts); } : null,
  })));
  container.appendChild(grid);
  if (opts.editable) {
    const add = el(`<button type="button" class="btn small secondary" style="margin-top:10px">${ic("plus")} ${t('gigs.epk.add_from_link')}</button>`);
    add.onclick = () => openAddBandMedia(band, () => renderBandMedia(container, band, opts));
    container.appendChild(add);
  }
}

// Modale "aggiungi media da link": rileva il provider client-side (in prod oEmbed/poster li fa il backend).
function openAddBandMedia(band, onDone) {
  openModal(`
    <h2>${t('gigs.epk.add_title')} ${ic("music-note")}</h2>
    <p class="view-sub">${t('gigs.epk.add_sub')}</p>
    <label class="field" style="margin-top:10px">${t('gigs.epk.link')}</label><input type="url" id="bmUrl" placeholder="https://soundcloud.com/...">
    <label class="field" style="margin-top:10px">${t('gigs.epk.title_opt')}</label><input type="text" id="bmTitle" placeholder="${esc(t('gigs.epk.title_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.epk.rights')}</label>
    <select id="bmRights"><option value="original">${t('gigs.epk.rights_original')}</option><option value="cover">${t('gigs.epk.rights_cover')}</option><option value="other">${t('gigs.epk.rights_other')}</option></select>
    <p class="aff-note">${ic("info")} ${t('gigs.epk.rights_note')}</p>
    <button class="btn" id="bmSave" style="margin-top:16px">${t('gigs.epk.add')}</button>
  `);
  $("#bmSave").onclick = () => {
    const url = $("#bmUrl").value.trim();
    const prov = detectMediaProvider(url);
    if (!prov) return markFieldError("#bmUrl", t('gigs.epk.invalid_link'));
    if ((band.media || []).length >= MEDIA_CAP) return toast(t('gigs.epk.max_items', { n: MEDIA_CAP }));
    band.media = band.media || [];
    band.media.push({
      id: "bm" + Date.now(), kind: prov.kind, mode: prov.mode, provider: prov.name,
      url, title: $("#bmTitle").value.trim() || null, rights: $("#bmRights").value,
    });
    save(); closeModal(); toast(t('gigs.epk.added')); if (onDone) onDone();
  };
}

// EPK locale (vista) + azione band
function openVenueSheet(v, band) {
  openModal(`
    <div style="text-align:center"><div style="display:flex;justify-content:center">${avatarTag(v, true)}</div>
      <h2>${esc(v.name)}</h2>
      <div class="loc">${esc(v.type)} · ${ic('map-pin')} ${esc(v.city)} · ${t('gigs.cap')} ${v.capacity} · <span class="score">${stars(v.rating)}</span></div>
    </div>
    <div class="tags" style="justify-content:center;margin-top:10px">${v.genres.map(g => `<span class="tag accent">${esc(genreLabel(g))}</span>`).join("")}</div>
    <div class="section-label">${t('gigs.night_sought')}</div>
    <div class="card flat" style="background:rgba(255,255,255,.03)">
      <div class="event-date">${ic('calendar')} ${formatDate(v.openNight.date)}</div>
      <div class="loc" style="margin-top:4px">${ic('music-note')} ${esc(v.openNight.genre)} · ${ic('target')} ${esc(v.openNight.budget)}</div>
    </div>
    ${band ? `<button class="btn" id="propBtn" style="margin-top:18px">${ic('send')} ${t('gigs.propose_for_night', { name: esc(band.name) })}</button>` : `<div class="aff-note" style="margin-top:16px">${t('gigs.create_band_to_propose')}</div>`}
  `);
  if (band) $("#propBtn").onclick = () => { closeModal(); openProposeSheet(v, band); };
}

// --------------------------------------------------- Creazione band / locale
function openCreateBand(existing) {
  const b = existing || {};
  openModal(`
    <h2>${existing ? t('gigs.edit_band_title') : t('gigs.create_band_title')} ${ic('music-note')}</h2>
    <label class="field">${t('gigs.band_name')}</label><input type="text" id="bName" value="${esc(b.name || "")}" placeholder="${esc(t('gigs.band_name_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.indicative_fee')}</label><input type="text" id="bFee" value="${esc(b.fee || "")}" placeholder="${esc(t('gigs.fee_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.catchphrase')}</label><input type="text" id="bTag" value="${esc(b.tagline || "")}" placeholder="${esc(t('gigs.catchphrase_ph'))}">
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">${t('gigs.region')}</label><select id="bRegion">${regionOptions(b.region)}</select></div>
      <div><label class="field">${t('gigs.province')}</label><select id="bProvince">${provinceOptions(b.region, b.province)}</select></div>
    </div>
    <label class="field" style="margin-top:10px">${t('gigs.city')}</label><input type="text" id="bCity" value="${esc(b.city || state.me.city)}" placeholder="${esc(t('gigs.city_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.genres')}</label><div class="chips" id="bGen">${chips(GENRES, b.genres || [], genreLabel)}</div>
    <label class="field" style="margin-top:10px">${t('gigs.lineup_label')}</label><div id="bMem"></div>
    <div class="row-between" style="margin-top:10px"><label class="field" style="margin:0">${t('gigs.repertoire_one_per_line')}</label>${(state.me.repertoire || []).length ? `<button class="btn small secondary" id="bRepImport" type="button">${ic('save')} ${t('gigs.import_from_profile')}</button>` : ""}</div>
    <textarea id="bRep" placeholder="Wonderwall&#10;Hotel California">${esc((b.repertoire || []).join("\n"))}</textarea>
    ${existing ? `<div class="section-label">${t('gigs.epk.section')}</div><div id="bMedia"></div>` : ""}
    <button class="btn" id="bSave" style="margin-top:16px">${existing ? t('gigs.save') : t('gigs.create_band_save')}</button>
  `);
  const selG = (b.genres || []).slice(), selM = (b.members || []).slice();
  document.querySelectorAll("#bGen .chip").forEach(c => c.onclick = () => toggleChip(c, selG));
  instrumentPicker($("#bMem"), selM, { placeholder: t('gigs.add_instrument_ph') });
  if (existing) renderBandMedia($("#bMedia"), existing, { editable: true });   // gestione EPK media (facade)
  $("#bRegion").onchange = e => { $("#bProvince").innerHTML = provinceOptions(e.target.value, ""); };
  if ($("#bRepImport")) $("#bRepImport").onclick = () => {
    const titles = (state.me.repertoire || []).map(r => r.title).filter(Boolean);
    const merged = $("#bRep").value.split("\n").map(s => s.trim()).filter(Boolean);
    titles.forEach(t => { if (!merged.some(x => x.toLowerCase() === t.toLowerCase())) merged.push(t); });
    $("#bRep").value = merged.join("\n");
    toast(t('gigs.imported_songs', { count: titles.length }));
  };
  $("#bSave").onclick = async () => {
    const name = $("#bName").value.trim(); if (!name) return markFieldError("#bName", t('gigs.give_band_name'));
    if (!selM.length) return toast(t('gigs.add_one_instrument'));
    const band = Object.assign(existing || { id: "mb" + Date.now(), avatar: "🎸", color: GRADS[Math.floor(Math.random() * GRADS.length)], rating: 0, ratings: 0, available: true, invites: [] }, {
      name, region: $("#bRegion").value, province: $("#bProvince").value, city: $("#bCity").value.trim() || state.me.city,
      fee: $("#bFee").value.trim(), tagline: $("#bTag").value.trim(),
      genres: selG, members: selM, repertoire: $("#bRep").value.split("\n").map(s => s.trim()).filter(Boolean)
    });
    if (typeof isProductionRuntime === "function" && isProductionRuntime()) {
      try {
        if (existing) await JM.Api.bands.update(existing.id, band);
        else band.id = (await JM.Api.bands.create(band)).id;
      } catch (error) {
        return toast(error.message || "Band non salvata", ic("alert-triangle"), { error: true });
      }
    }
    if (!existing) state.bands = [band]; save(); closeModal(); toast(t('gigs.band_saved')); rerenderPalco();
  };
}

function openCreateVenue(existing) {
  const v = existing || {};
  const TYPES = ["Pub", "Jazz club", "Ristorante", "Sala eventi", "Circolo", "Azienda", "Privato"];
  openModal(`
    <h2>${existing ? t('gigs.edit_venue_title') : t('gigs.register_venue_title')} ${ic('building')}</h2>
    ${existing ? "" : `<p class="view-sub">${t('gigs.create_venue_sub')}</p>`}
    <label class="field">${t('gigs.venue_name')}</label><input type="text" id="vName" value="${esc(v.name || "")}" placeholder="${esc(t('gigs.venue_name_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.type')}</label><select id="vType">${options(TYPES, v.type || "Pub")}</select>
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">${t('gigs.region')}</label><select id="vRegion">${regionOptions(v.region)}</select></div>
      <div><label class="field">${t('gigs.province')}</label><select id="vProvince">${provinceOptions(v.region, v.province)}</select></div>
    </div>
    <label class="field" style="margin-top:10px">${t('gigs.city')}</label><input type="text" id="vCity" value="${esc(v.city || state.me.city)}">
    <label class="field" style="margin-top:10px">${t('gigs.capacity')}</label><input type="text" id="vCap" value="${esc(v.capacity || "")}" placeholder="${esc(t('gigs.capacity_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.preferred_genres')}</label><div class="chips" id="vGen">${chips(GENRES, v.genres || [], genreLabel)}</div>
    <button class="btn" id="vSave" style="margin-top:16px">${existing ? t('gigs.save') : t('gigs.register_venue_save')}</button>
  `);
  const selG = (v.genres || []).slice();
  document.querySelectorAll("#vGen .chip").forEach(c => c.onclick = () => toggleChip(c, selG));
  $("#vRegion").onchange = e => { $("#vProvince").innerHTML = provinceOptions(e.target.value, ""); };
  $("#vSave").onclick = async () => {
    const name = $("#vName").value.trim(); if (!name) return markFieldError("#vName", t('gigs.give_venue_name'));
    state.myVenue = Object.assign(existing || { id: "mv" + Date.now(), avatar: "🏢", color: GRADS[1], rating: 0, ratings: 0 }, {
      name, type: $("#vType").value, region: $("#vRegion").value, province: $("#vProvince").value, city: $("#vCity").value.trim(), capacity: $("#vCap").value.trim() || "—", genres: selG
    });
    if (typeof isProductionRuntime === "function" && isProductionRuntime()) {
      try {
        const payload = Object.assign({}, state.myVenue, { capacity: parseInt(state.myVenue.capacity, 10) || null });
        if (existing) await JM.Api.venues.update(existing.id, payload);
        else state.myVenue.id = (await JM.Api.venues.create(payload)).id;
      } catch (error) {
        return toast(error.message || "Locale non salvato", ic("alert-triangle"), { error: true });
      }
    }
    save(); closeModal(); toast(t('gigs.venue_saved')); rerenderPalco();
  };
}

// --------------------------------------------------- Flusso prenotazione
function openProposeSheet(v, band) { // la band propone al locale (con preventivo)
  const cold = !v.openNight;            // proposta "a freddo": il locale non ha una serata aperta
  const night = v.openNight || {};
  openModal(`
    <h2>${cold ? t('gigs.propose_your_band') : t('gigs.propose_for_the_night')}</h2>
    <div class="aff-note">${esc(band.name)} → ${esc(v.name)}${cold ? "" : ` · ${ic('calendar')} ${formatDate(night.date)} · ${t('gigs.budget_word')} ${esc(night.budget || "—")}`}</div>
    ${cold ? `<label class="field" style="margin-top:12px">${t('gigs.proposed_date')}</label><input type="date" id="pDate">` : ""}
    <label class="field" style="margin-top:12px">${t('gigs.your_quote')}</label><input type="text" id="pQuote" value="${esc(band.fee || "")}" placeholder="${esc(t('gigs.fee_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.message_optional')}</label><textarea id="pMsg" placeholder="${esc(t('gigs.propose_msg_ph'))}"></textarea>
    <button class="btn" id="pSend" style="margin-top:16px">${t('gigs.send_proposal')}</button>
  `);
  focusFirstField(cold ? "pDate" : "pQuote");
  $("#pSend").onclick = () => {
    const quote = $("#pQuote").value.trim() || band.fee || "—";
    const date = cold ? ($("#pDate") && $("#pDate").value || new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10)) : night.date;
    const budget = cold ? quote : (night.budget || "—");
    const bk = addBooking({ kind: "band", bandId: band.id, bandName: band.name, venueId: v.id, venueName: v.name, venueAvatar: v.avatar, venueColor: v.color, bandAvatar: band.avatar, bandColor: band.color, date, budget, quote, msg: ($("#pMsg") && $("#pMsg").value.trim()) || "", status: "quoted" });
    if (!bk) return;                     // bloccata da dedup/conflitto (toast già mostrato)
    closeModal(); toast(t('gigs.proposal_sent'), ic('send')); navigate("palco");
    // La proposta resta "quoted" (in attesa): è il locale a decidere. Esito probabilistico.
    simulateOutcome(bk.id);
  };
}

function openRequestSheet(b, venue) { // il locale richiede la band
  const busy = !b.available;
  openModal(`
    <h2>${t('gigs.request_booking_title')}</h2>
    <div class="aff-note">${esc(venue.name)} → ${esc(b.name)}</div>
    ${busy ? `<div class="aff-note warn-note" style="margin-top:10px">${ic('alert-triangle')} ${t('gigs.band_busy_request_note', { name: esc(b.name) })}</div>` : ""}
    <label class="field" style="margin-top:12px">${t('gigs.date')}</label><input type="date" id="rDate">
    <label class="field" style="margin-top:10px">${t('gigs.proposed_budget')}</label><input type="text" id="rBudget" placeholder="${esc(t('gigs.fee_ph'))}">
    <label class="field" style="margin-top:10px">${t('gigs.message_optional')}</label><textarea id="rMsg" placeholder="${esc(t('gigs.request_msg_ph'))}"></textarea>
    <button class="btn" id="rSend" style="margin-top:16px">${t('gigs.send_request')}</button>
  `);
  focusFirstField("rDate");
  $("#rSend").onclick = () => {
    const date = $("#rDate").value || new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
    const bk = addBooking({ kind: "venue", bandId: b.id, bandName: b.name, venueId: venue.id, venueName: venue.name, venueAvatar: venue.avatar, venueColor: venue.color, bandAvatar: b.avatar, bandColor: b.color, date, budget: $("#rBudget").value.trim() || "—", quote: b.fee, msg: ($("#rMsg") && $("#rMsg").value.trim()) || "", status: "requested" });
    if (!bk) return;                     // bloccata da dedup/conflitto
    closeModal(); toast(t('gigs.request_sent'), ic('send')); navigate("palco");
    simulate(bk.id, "quoted", t('gigs.band_replied_quote', { name: b.name, fee: b.fee }), "music-note");
  };
}

// addBooking ritorna null se la proposta/richiesta è duplicata o in conflitto di data.
// BACKEND HOOK: validazione unicità + agenda lato server; qui dedup e conflitto sono lato client.
function addBooking(data) {
  if (bookingExists(data.bandId, data.venueId, data.date)) { toast(t('gigs.dup_proposal'), ic('alert-triangle')); return null; }
  if (hasDateConflict(data.bandId, data.date, data.venueId)) { toast(t('gigs.band_confirmed_elsewhere'), ic('alert-triangle')); return null; }
  const ts = Date.now();
  const bk = Object.assign({ id: "bk" + ts, history: [{ status: data.status, ts }] }, data);
  state.bookings = state.bookings || []; state.bookings.unshift(bk); save();
  if (typeof isProductionRuntime === "function" && isProductionRuntime()) {
    JM.Api.bookings.create(data).then((remote) => {
      Object.assign(bk, remote);
      save();
    }).catch((error) => {
      state.bookings = state.bookings.filter((item) => item !== bk);
      save();
      toast(error.message || "Prenotazione non creata", ic("alert-triangle"), { error: true });
    });
  }
  return bk;
}
// Applica una transizione di stato registrandola nella mini-timeline bk.history.
function setBookingStatus(bk, status, extra) {
  bk.status = status; bk.history = bk.history || []; bk.history.push({ status, ts: Date.now() });
  if (extra) Object.assign(bk, extra); save();
  if (typeof isProductionRuntime === "function" && isProductionRuntime()) {
    JM.Api.bookings.setStatus(bk.id, status, extra && (extra.quote || extra.counterQuote)).catch((error) =>
      toast(error.message || "Stato prenotazione non aggiornato", ic("alert-triangle"), { error: true })
    );
  }
}
// Conferma una prenotazione SOLO se la band non è già confermata altrove in quella data:
// l'invariante anti-doppia-prenotazione va riverificata a ogni conferma, non solo alla creazione.
function confirmBooking(bk, extra) {
  if (hasDateConflict(bk.bandId, bk.date, bk.venueId)) { toast(t('gigs.band_already_confirmed'), ic('alert-triangle')); return false; }
  setBookingStatus(bk, "confirmed", extra); return true;
}
// simulate "semplice": forza uno stato dopo un delay (usato per la risposta col preventivo).
function simulate(id, status, msg, iconName) {
  if (typeof isProductionRuntime === "function" && isProductionRuntime()) return;
  setTimeout(() => {
    const bk = (state.bookings || []).find(x => x.id === id); if (!bk) return;
    setBookingStatus(bk, status); toast(msg);
    if (typeof notify === "function") notify(iconName || "microphone", msg, { view: "palco" });
    refreshBookingsView();
  }, 1600);
}
// Esito probabilistico della proposta band→locale: confirmed / counter / declined,
// pesato dalla compatibilità budget↔fee. Aggiunge una scadenza informativa all'offerta.
// BACKEND HOOK: la decisione reale del locale (accetta/rilancia/rifiuta) e lo scambio preventivi passano dal server; simulate è solo prototipo.
function simulateOutcome(id) {
  if (typeof isProductionRuntime === "function" && isProductionRuntime()) return;
  setTimeout(() => {
    const bk = (state.bookings || []).find(x => x.id === id); if (!bk || bk.status !== "quoted") return;
    const ok = feeMatchesBudget(bk.quote, bk.budget);
    const r = Math.random();
    let status, msg, extra = {};
    if (ok ? r < 0.75 : r < 0.3) {
      status = "confirmed"; msg = t('gigs.venue_confirmed', { venue: bk.venueName, band: bk.bandName });
    } else if (r < (ok ? 0.92 : 0.75)) {
      // controproposta: il locale rilancia un budget ancorato al proprio range
      const base = parseMoney(bk.budget) || parseMoney(bk.quote) || 300;
      const counter = Math.round(base * 0.9 / 10) * 10;
      status = "counter"; extra = { counterQuote: counter + "€", expiresAt: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) };
      msg = t('gigs.venue_countered', { venue: bk.venueName, amount: counter });
    } else {
      status = "declined"; msg = t('gigs.venue_declined', { venue: bk.venueName });
    }
    // Se nel frattempo la band ha confermato altrove in quella data, il locale non può confermare.
    if (status === "confirmed" && hasDateConflict(bk.bandId, bk.date, bk.venueId)) { status = "declined"; extra = {}; msg = t('gigs.venue_cannot_confirm', { venue: bk.venueName }); }
    setBookingStatus(bk, status, extra);
    toast(msg, status === "declined" ? ic('face-neutral') : status === "counter" ? ic('refresh') : ic('celebration', 'accent'));
    if (typeof notify === "function") notify(status === "declined" ? "face-neutral" : status === "counter" ? "refresh" : "celebration", msg, { view: "palco" });
    refreshBookingsView();
  }, 1700);
}
// Aggiorna la vista bookings senza perdere il contesto della modale aperta (fix simulate-clobber).
function refreshBookingsView() {
  rerenderPalco();
  const list = $("#bkList");
  if (!list) return;
  if (list.dataset.modal === "venueBookings") openVenueBookings(state.myVenue);
  else openBookings();
}

// --------------------------------------------------- Prenotazioni + recensioni
function openBookings() {
  const list = state.bookings || [];
  openModal(`<h2>${ic('list')} ${t('gigs.your_bookings')}</h2>
    <div class="aff-note">${t('gigs.bookings_note')}</div>
    <div id="bkList" data-modal="bookings" style="margin-top:8px">${list.length ? list.map(bookingRow).join("") : ""}</div>`);
  if (!list.length) {
    $("#bkList").appendChild(emptyState(t('gigs.no_bookings'), [
      { label: t('gigs.search_a_venue'), icon: "search", on: () => { closeModal(); state.ui.palcoMode = "band"; navigate("palco"); } },
      { label: t('gigs.search_a_band'), icon: "music-note", on: () => { closeModal(); state.ui.palcoMode = "venue"; navigate("palco"); } }
    ]));
  }
  bindBookingActions();
}
function tagClass(c) { return c === "ok" ? "lvl" : c === "accent" ? "accent" : c === "warn" ? "warn" : ""; }
function bookingRow(bk) {
  const st = STATUS[bk.status] || { t: bk.status, c: "" };
  const fee = bk.quote || bk.budget;
  let action = "";
  if (bk.status === "requested") action = `<div class="loc">${t('gigs.await_band_quote')}</div>`;
  else if (bk.status === "quoted" && bk.kind === "venue") action = `<button class="btn small" data-act="confirm" data-id="${bk.id}">${ic('check')} ${t('gigs.confirm_deposit')}</button>`;
  else if (bk.status === "quoted" && bk.kind === "band") action = `<div class="loc">${ic('clock')} ${t('gigs.await_venue_decision')}</div>`;
  else if (bk.status === "counter") action = `<div class="loc" style="margin-bottom:8px">${ic('refresh')} ${t('gigs.counter_label', { amount: esc(bk.counterQuote || fee) })}${bk.expiresAt ? ` · ${ic('clock')} ${t('gigs.expires_on', { date: formatDate(bk.expiresAt) })}` : ""}</div>
      <div class="filter-row"><button class="btn small" data-act="counter-accept" data-id="${bk.id}">${ic('check')} ${t('gigs.accept')}</button><button class="btn small secondary" data-act="counter-counter" data-id="${bk.id}">${ic('refresh')} ${t('gigs.raise')}</button><button class="btn small secondary" data-act="counter-reject" data-id="${bk.id}">${ic('face-neutral')} ${t('gigs.reject')}</button></div>`;
  else if (bk.status === "declined") action = `<div class="loc">${ic('face-neutral')} ${t('gigs.proposal_declined')}</div>`;
  else if (bk.status === "confirmed") action = `<button class="btn small secondary" data-act="complete" data-id="${bk.id}">${t('gigs.mark_night_completed')}</button>`;
  else if (bk.status === "completed") action = `<button class="btn small" data-act="review" data-id="${bk.id}">${ic('star')} ${t('gigs.leave_review')}</button>`;
  else if (bk.status === "reviewed") action = reviewsHtml(bk);
  const payline = (bk.status === "confirmed" || bk.status === "completed" || bk.status === "reviewed")
    ? `<div class="loc" style="margin-top:4px">${ic('target')} ${t('gigs.payline', { fee: esc(fee) })}</div>` : "";
  return `<div class="card flat" style="margin-bottom:10px">
    <div class="row-between"><b>${esc(bk.bandName)} ↔ ${esc(bk.venueName)}</b><span class="tag ${tagClass(st.c)}">${statusLabel(st)}</span></div>
    <div class="loc" style="margin-top:4px">${ic('calendar')} ${formatDate(bk.date)} · ${ic('target')} ${esc(fee)}</div>
    ${payline}
    <div style="margin-top:10px">${action}</div>
  </div>`;
}
function reviewsHtml(bk) {
  const mine = bk.myReview || { rating: 0, text: "" };
  const revealed = bk.reviewRevealed && bk.counterReview;
  const other = revealed
    ? `<div class="aff-note" style="margin-top:6px">${ic('star')} <b>${t('gigs.review_received', { demo: bk.counterReview.demo ? t('gigs.demo_suffix') : "" })}</b> ${starsRating(bk.counterReview.rating)} — ${esc(bk.counterReview.text)}</div>`
    : `<div class="aff-note" style="margin-top:6px">${ic('clock')} ${t('gigs.await_counterpart_review')}</div>`;
  return `<div class="aff-note">${ic('star')} <b>${t('gigs.your_review')}</b> ${starsRating(mine.rating)} — ${esc(mine.text || t('gigs.no_comment'))}</div>${other}`;
}
function bindBookingActions() {
  const root = $("#bkList") || document;
  root.querySelectorAll("[data-act][data-id]").forEach(btn => btn.onclick = () => {
    const bk = (state.bookings || []).find(x => x.id === btn.dataset.id); if (!bk) return;
    const act = btn.dataset.act;
    // Controproposta scaduta: non più azionabile (coerente con "scade il …" mostrato in UI).
    if (bk.status === "counter" && bk.expiresAt && bk.expiresAt < todayISO() && (act === "counter-accept" || act === "counter-counter")) {
      setBookingStatus(bk, "declined"); toast(t('gigs.counter_expired'), ic('clock')); refreshBookingsView(); return;
    }
    if (act === "confirm") { if (confirmBooking(bk)) toast(t('gigs.confirmed_deposit_escrow'), ic('check')); refreshBookingsView(); }
    else if (act === "counter-accept") { if (confirmBooking(bk, { quote: bk.counterQuote || bk.quote })) toast(t('gigs.counter_accepted'), ic('check')); refreshBookingsView(); }
    else if (act === "counter-reject") { setBookingStatus(bk, "declined"); toast(t('gigs.counter_rejected'), ic('face-neutral')); refreshBookingsView(); }
    else if (act === "counter-counter") {
      // rilancio della band sul valore controproposto: torna "quoted", il locale ridecide
      setBookingStatus(bk, "quoted", { quote: bk.counterQuote || bk.quote, counterQuote: null });
      toast(t('gigs.raise_sent'), ic('refresh')); refreshBookingsView(); simulateOutcome(bk.id);
    }
    else if (act === "complete") {
      setBookingStatus(bk, "completed");
      // jamCount cresce SOLO per jam reali (social.js): qui conta i gig della band, non gonfia il musicista.
      // Incremento solo se è la mia band e non sto agendo dal lato locale.
      const mine = myBand();
      if (mine && bk.bandId === mine.id && bk.kind !== "venue") { mine.gigsDone = (mine.gigsDone || 0) + 1; save(); }
      toast(t('gigs.night_completed'), ic('celebration', 'accent')); refreshBookingsView();
    }
    else if (act === "review") openReviewSheet(bk);
  });
}
function openReviewSheet(bk) {
  // chi recensisco? se ho proposto come band -> recensisco il locale; se sono locale -> la band
  const target = bk.kind === "band" ? bk.venueName : bk.bandName;
  let rating = 5;
  openModal(`<h2>${ic('star')} ${t('gigs.review_target', { target: esc(target) })}</h2>
    <div class="aff-note">${t('gigs.review_note')}</div>
    <div class="lk" style="margin-top:12px"><div class="lk-q" id="rvStarsLbl">${t('gigs.rating')}</div>
      <div class="likert" id="rvStars" role="radiogroup" aria-labelledby="rvStarsLbl">${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" data-v="${v}" aria-label="${esc(t('gigs.star_aria', { v }))}" aria-checked="${v === 5 ? "true" : "false"}" class="${v === 5 ? "on" : ""}">${v}${ic('star')}</button>`).join("")}</div></div>
    <label class="field" style="margin-top:10px">${t('gigs.comment')}</label><textarea id="rvText" placeholder="${esc(t('gigs.review_text_ph'))}"></textarea>
    <button class="btn" id="rvSend" style="margin-top:14px">${t('gigs.send_review')}</button>`);
  focusFirstField();
  document.querySelectorAll("#rvStars button").forEach(b => b.onclick = () => { document.querySelectorAll("#rvStars button").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); }); b.classList.add("on"); b.setAttribute("aria-checked", "true"); rating = +b.dataset.v; });
  $("#rvSend").onclick = () => {
    bk.myReview = { rating, text: $("#rvText").value.trim(), ts: Date.now() };
    // Doppio cieco onesto: prepara la controparte ma NON rivelarla subito.
    // La controparte demo è generata da segnali reali (rating storico /10 → 1–5).
    const bands = (typeof isProductionRuntime === "function" && isProductionRuntime()) ? (state.publicBands || []) : SEED_BANDS;
    const entity = bk.kind === "band" ? (allVenues().find(x => x.id === bk.venueId) || { rating: 0 }) : (bands.find(x => x.id === bk.bandId) || { rating: 0 });
    const canned = bk.kind === "band"
      ? [t('gigs.review_canned_band_1'), t('gigs.review_canned_band_2')]
      : [t('gigs.review_canned_venue_1'), t('gigs.review_canned_venue_2')];
    bk.counterReview = { rating: ratingFromHistory(entity), text: canned[Math.floor(Math.random() * canned.length)], ts: Date.now(), demo: true };
    bk.reviewRevealed = false;
    setBookingStatus(bk, "reviewed");
    toast(t('gigs.review_sent_await'), ic('star'));
    refreshBookingsView();
    // BACKEND HOOK: reveal simultaneo server-side quando entrambe le parti recensiscono; qui un simulate "rivela" la demo.
    setTimeout(() => {
      const cur = (state.bookings || []).find(x => x.id === bk.id); if (!cur || !cur.counterReview) return;
      cur.reviewRevealed = true; save();
      toast(t('gigs.counterpart_reviewed_you', { target }), ic('star'));
      if (typeof notify === "function") notify("star", t('gigs.counterpart_reviewed_you', { target }), { view: "palco" });
      refreshBookingsView();
    }, 1900);
  };
}

// --------------------------------------------------- Inviti musicisti in band (#6)
// Dai match/profili in "Scopri" inviti un musicista a entrare nella tua band.
// Prototipo: invito locale con accettazione simulata. Col backend (band_invites)
// diventa invito reale + accettazione del destinatario.
const INVITE_STATUS = {
  pending:  { k: "gigs.invite_pending", c: "warn" },
  accepted: { k: "gigs.invite_accepted", ic: "check", c: "ok" },
  declined: { k: "gigs.invite_declined", c: "" }
};

function openInviteToBand(p) {
  const band = myBand();
  if (!band) {
    closeModal(); toast(t('gigs.create_band_first'), ic('music-note'));
    state.ui.palcoMode = "band"; navigate("palco"); return;
  }
  const existing = (band.invites || []).find(i => i.profileId === p.id && i.status !== "declined");
  if (existing) {
    toast(existing.status === "accepted"
      ? t('gigs.already_in_lineup', { name: p.name.split(" ")[0] })
      : t('gigs.already_invited', { name: p.name.split(" ")[0] }));
    return;
  }
  const instr = (p.instruments && p.instruments.length) ? p.instruments : INSTRUMENTS;
  openModal(`
    <h2>${t('gigs.invite_to_band_title', { band: esc(band.name) })} ${ic('music-note')}</h2>
    <div class="aff-note">${t('gigs.invite_note', { name: esc(p.name) })}</div>
    <label class="field" style="margin-top:12px">${t('gigs.role_instrument')}</label>
    <select id="invInstr">${options(instr, instr[0])}</select>
    <label class="field" style="margin-top:10px">${t('gigs.message_optional')}</label>
    <textarea id="invMsg" placeholder="${esc(t('gigs.invite_msg_ph'))}"></textarea>
    <button class="btn" id="invSend" style="margin-top:16px">${t('gigs.send_invite')} ${ic('send')}</button>
  `);
  focusFirstField("invInstr");
  $("#invSend").onclick = () => {
    const inv = {
      id: "inv" + Date.now(), profileId: p.id, name: p.name,
      avatar: p.avatar, color: p.color, photo: p.photo || "",
      instrument: $("#invInstr").value, message: $("#invMsg").value.trim(),
      status: "pending", ts: Date.now()
    };
    band.invites = band.invites || []; band.invites.unshift(inv); save();
    closeModal(); toast(t('gigs.invite_sent'), ic('send'));
    state.ui.palcoMode = "band"; navigate("palco");
    simulateInvite(inv.id);
  };
}

function simulateInvite(inviteId) {
  setTimeout(() => {
    const band = myBand(); if (!band) return;
    const inv = (band.invites || []).find(i => i.id === inviteId);
    if (!inv || inv.status !== "pending") return;
    const accepted = Math.random() < 0.75;
    inv.status = accepted ? "accepted" : "declined";
    // se accetta e copre uno strumento non presente, lo aggiunge alla formazione
    if (accepted && !band.members.includes(inv.instrument)) band.members.push(inv.instrument);
    save();
    const fn = inv.name.split(" ")[0];
    toast(accepted ? t('gigs.member_joined', { name: fn, band: band.name })
                   : t('gigs.member_declined', { name: fn }), accepted ? ic('celebration','accent') : "");
    if (typeof notify === "function") notify(accepted ? "music-note" : "face-neutral", accepted ? t('gigs.member_joined', { name: fn, band: band.name }) : t('gigs.member_declined', { name: fn }), { view: "palco" });
    rerenderPalco();
  }, 1800);
}

function renderBandInvites(box, band) {
  box.appendChild(el(`<div class="section-label">${t('gigs.lineup_and_invites')}</div>`));
  const invites = (band.invites || []).slice();
  if (!invites.length) {
    box.appendChild(emptyState(t('gigs.no_invites'), [
      { label: t('gigs.go_to_discover'), icon: "search", on: () => navigate("discover") }
    ]));
    return;
  }
  invites.forEach(inv => {
    const st = INVITE_STATUS[inv.status] || { t: inv.status, c: "" };
    const removable = inv.status !== "pending";
    const c = el(`<div class="card flat" style="margin-bottom:8px">
      <div class="card-head">${avatarTag(inv)}<div class="meta">
        <div class="name">${esc(inv.name)} <span class="tag ${st.c === "ok" ? "lvl" : st.c === "warn" ? "accent" : ""}">${statusLabel(st)}</span></div>
        <div class="loc">${ic('music-note')} ${esc(inv.instrument)}</div>
      </div><button class="btn small secondary" data-act>${removable ? t('gigs.remove') : t('gigs.cancel')}</button></div>
    </div>`);
    c.querySelector("[data-act]").onclick = () => {
      band.invites = (band.invites || []).filter(i => i.id !== inv.id);
      // Se rimuovo un invito ACCETTATO, tolgo il suo strumento dalla formazione solo se nessun
      // altro accettato lo usa ancora (evita la chip "fantasma" e il conteggio elementi gonfiato).
      if (inv.status === "accepted") {
        const stillUsed = (band.invites || []).some(i => i.status === "accepted" && i.instrument === inv.instrument);
        if (!stillUsed) band.members = (band.members || []).filter(m => m !== inv.instrument);
      }
      save();
      toast(removable ? t('gigs.removed_from_lineup') : t('gigs.invite_cancelled'));
      rerenderPalco();
    };
    box.appendChild(c);
  });
}

// --------------------------------------------------- "Le tue Pagine" (hub entità gestite)
// Modello "un account + Pagine": Band e Locale sono entità con profilo/prenotazioni propri,
// gestite dall'account personale. Qui le vedi e le apri; i flussi di creazione/modifica sono
// quelli già esistenti (openCreateBand / openCreateVenue) — niente duplicazione.
function pagesCount() { return (myBand() ? 1 : 0) + (state.myVenue ? 1 : 0); }
function openPages() {
  const band = myBand(), v = state.myVenue;
  const pages = [];
  if (band) pages.push({ type: t('gigs.page_band'), icon: "music-note", obj: band, manage: () => { closeModal(); openCreateBand(band); } });
  if (v) pages.push({ type: t('gigs.page_venue'), icon: "building", obj: v, manage: () => { closeModal(); openCreateVenue(v); } });
  openModal(`
    <h2>${ic('building')} ${t('gigs.your_pages')}</h2>
    <div class="aff-note">${t('gigs.pages_note')}</div>
    <div id="pagesList">${pages.length ? "" : `<div class="empty">${spot("trova")}${t('gigs.no_pages')}</div>`}</div>
    <div class="section-label">${t('gigs.create_a_page')}</div>
    <div class="filter-row">
      ${band ? "" : `<button class="btn small" id="pgNewBand" type="button">${ic('music-note')} ${t('gigs.create_a_band')}</button>`}
      ${v ? "" : `<button class="btn small" id="pgNewVenue" type="button">${ic('building')} ${t('gigs.register_a_venue')}</button>`}
    </div>
    ${band && v ? `<p class="view-sub" style="font-size:.74rem;margin-top:10px">${t('gigs.manage_both')}</p>` : ""}`);
  const list = $("#pagesList");
  pages.forEach(pg => {
    const row = el(`<div class="card flat" style="margin-bottom:8px"><div class="card-head">${avatarTag(pg.obj)}<div class="meta">
      <div class="name">${esc(pg.obj.name)} <span class="tag">${pg.type}</span></div>
      <div class="loc">${ic(pg.icon)} ${esc([pg.obj.city, pg.obj.province].filter(Boolean).join(", ")) || pg.type}</div>
    </div><button class="btn small secondary" data-manage type="button">${t('gigs.manage')}</button></div></div>`);
    row.querySelector("[data-manage]").onclick = pg.manage;
    list.appendChild(row);
  });
  if ($("#pgNewBand")) $("#pgNewBand").onclick = () => { closeModal(); openCreateBand(); };
  if ($("#pgNewVenue")) $("#pgNewVenue").onclick = () => { closeModal(); openCreateVenue(); };
}

window.renderPalco = renderPalco;
window.openInviteToBand = openInviteToBand;
window.openPages = openPages;
window.pagesCount = pagesCount;
