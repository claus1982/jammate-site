/* JamMate — FASE 1: Palco (marketplace band ↔ locali)
 * Prenotazione con conferma, recensioni a due lati verificate, pagamenti SIMULATI.
 * Usa gli helper globali definiti in app.js ($,el,esc,openModal,toast,avatarTag,
 * save,state,navigate,formatDate,GENRES,INSTRUMENTS,options,chips,toggleChip,currentView).
 * Reso modulare apposta: in futuro questo diventa il "modulo booking" estraibile. */

// Icone risolte a render time (vedi statusLabel): niente ic() al parse, così l'ordine di caricamento
// degli script non è più un accoppiamento fragile (icons.js potrebbe non essere ancora pronto).
const STATUS = {
  requested: { t: "In attesa del preventivo", c: "warn" },
  quoted: { t: "Preventivo ricevuto", c: "accent" },
  counter: { t: "Controproposta", ic: "refresh", c: "warn" },
  declined: { t: "Declinata", c: "muted" },
  confirmed: { t: "Confermata", ic: "check", c: "ok" },
  completed: { t: "Serata completata", c: "accent" },
  reviewed: { t: "Recensita", ic: "star", c: "ok" }
};
// Compone l'etichetta di stato (testo + icona opzionale) a render time.
function statusLabel(st) { return `${esc(st.t)}${st.ic ? " " + ic(st.ic) : ""}`; }

// --- Luogo: regione → provincia → città (per band e locali) ---
function regionOptions(sel) { return `<option value="">— Regione —</option>` + REGIONI_NAMES.map(r => `<option value="${esc(r)}"${r === sel ? " selected" : ""}>${esc(r)}</option>`).join(""); }
function provinceOptions(region, sel) { return `<option value="">— Provincia —</option>` + (REGIONI[region] || []).map(p => `<option value="${esc(p)}"${p === sel ? " selected" : ""}>${esc(p)}</option>`).join(""); }
function allProvinces() { return REGIONI_NAMES.reduce((a, r) => a.concat(REGIONI[r]), []).sort((a, b) => a.localeCompare(b)); }
function inProvince(obj, province) { if (!province) return true; if (obj.province) return obj.province === province; return (obj.city || "") === province; }

function allVenues() { return [...(state.myVenue ? [Object.assign({ mine: true }, state.myVenue)] : []), ...SEED_VENUES]; }
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
  if (overlap) out.push({ icon: "music-note", text: overlap > 1 ? "Suona i tuoi stessi generi" : "Un genere in comune" });
  const refProv = ref && (ref.province || ref.city);
  if (refProv && inProvince(entity, refProv)) out.push({ icon: "map-pin", text: "Vicino a te" });
  if (typeof hasJammedWith === "function" && hasJammedWith(entity)) out.push({ icon: "heart", text: "Hai già jammato insieme" });
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
      <button class="btn small secondary" id="bookingsBtn">${ic('list')} Prenotazioni${bookingsPending() ? " · " + bookingsPending() : ""}</button></div>
    <p class="view-sub">Band che si offrono per serate, e locali che cercano musica. Prenotazione con conferma e recensioni a due lati.</p>
    <div class="segmented" aria-label="Lato del Palco">
      <button data-m="band" aria-pressed="${seg === "band"}" class="${seg === "band" ? "on" : ""}">${ic('music-note')} Band</button>
      <button data-m="venue" aria-pressed="${seg === "venue"}" class="${seg === "venue" ? "on" : ""}">${ic('building')} Locale</button>
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
    box.appendChild(el(`<div class="empty">${spot("trova")}Non hai ancora registrato una band.<br>Creane una per offrirti alle serate locali.</div>`));
    const b = el(`<button class="btn">${ic('plus')} Crea la tua band</button>`); b.onclick = () => openCreateBand(); box.appendChild(b);
    return;
  }
  // Card band con badge "Pronta & Disponibile"
  const ready = band.available && (band.repertoire || []).length && band.genres.length;
  const c = el(`<div class="card flat">
    <div class="card-head">${avatarTag(band)}<div class="meta">
      <div class="name">${esc(band.name)} ${ready ? `<span class="tag lvl">${ic('check')} Pronta & Disponibile</span>` : '<span class="tag">bozza</span>'}</div>
      <div class="loc">${ic('map-pin')} ${esc([band.city, band.province].filter(Boolean).join(", "))} · ${band.members.length} elementi · ${ic('target')} ${esc(band.fee || "—")}</div>
    </div></div>
    <div class="tags">${band.genres.map(g => `<span class="tag accent">${esc(g)}</span>`).join("")}</div>
    <div class="row-between" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;font-size:.9rem"><input type="checkbox" id="availTgl" ${band.available ? "checked" : ""}> Disponibile per serate</label>
      <button class="btn small secondary" id="editBand">Modifica EPK</button>
    </div>
  </div>`);
  box.appendChild(c);
  $("#availTgl").onchange = e => { band.available = e.target.checked; save(); rerenderPalco(); };
  $("#editBand").onclick = () => openCreateBand(band);

  renderBandInvites(box, band);

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
  const TYPES = [...new Set(SEED_VENUES.map(v => v.type))].sort();
  const wrap = el(`<div>
    <div class="section-label">${ic('search')} Locali che cercano una band</div>
    <div class="filters">
      <div class="filter-row">
        <select id="bfGen">${options(GENRES, bandFilter.genre, "Tutti i generi")}</select>
        <select id="bfType">${options(TYPES, bandFilter.type, "Tutti i tipi")}</select>
      </div>
      <div class="filter-row">
        <select id="bfProv">${["", ...allProvinces()].map(p => `<option value="${esc(p)}"${p === bandFilter.province ? " selected" : ""}>${p ? esc(p) : "Tutte le province"}</option>`).join("")}</select>
      </div>
    </div>
    <div id="bResults"></div>
  </div>`);
  const paint = () => {
    const rb = wrap.querySelector("#bResults"); rb.innerHTML = "";
    const list = SEED_VENUES.filter(venueMatchesBandFilter).slice().sort(byRelevance(v => venueRelevance(v, band)));
    if (!list.length) {
      rb.appendChild(emptyState("Nessun locale con questi filtri.", [
        { label: "Azzera filtri", icon: "refresh", on: () => { bandFilter.genre = bandFilter.province = bandFilter.type = ""; rerenderPalco(); } },
        { label: "Cerca serate in Bacheca", icon: "megaphone", on: () => navigate("board") }
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
  const ris = inResonance(v, band) ? " " + risonanzaChip("In risonanza") : "";
  const fresh = freshOpenNight(v) > 0;
  const c = el(`<div class="card">
    <div class="card-head">${avatarTag(v)}<div class="meta">
      <div class="name">${esc(v.name)}${ris} <span class="score">${stars(v.rating)}</span></div>
      <div class="loc">${esc(v.type)} · ${ic('map-pin')} ${esc(v.city)} · cap. ${v.capacity}</div>
    </div></div>
    ${palcoSceneSignalsHtml(v, band)}
    <div class="card" style="margin:10px 0 0;cursor:default;background:rgba(255,255,255,.03)">
      <div class="event-date">${ic('calendar')} ${formatDate(v.openNight.date)}${fresh ? ` <span class="tag accent">${ic('clock')} fresca</span>` : ""} · cerca: ${esc(v.openNight.genre)}</div>
      <div class="loc" style="margin-top:4px">${ic('target')} Budget: ${esc(v.openNight.budget)}</div>
    </div>
  </div>`);
  clickableCard(c, () => openVenueSheet(v, band));
  return c;
}

// --------------------------------------------------- Lato "Sono un locale"
function renderVenueSide(box) {
  const v = state.myVenue;
  if (!v) {
    box.appendChild(el(`<div class="empty">${spot("trova")}Sei un locale, un'azienda o organizzi eventi?<br>Registra l'<b>area Locale</b> per cercare e ingaggiare musicisti e band.</div>`));
    const b = el(`<button class="btn">${ic('plus')} Registra l'area Locale</button>`); b.onclick = () => openCreateVenue(); box.appendChild(b);
    return;
  }
  const place = [v.city, v.province].filter(Boolean).join(", ") || "—";
  const c = el(`<div class="card flat venue-area">
    <div class="card-head">${avatarTag(v)}<div class="meta">
      <div class="name">${esc(v.name)} <span class="tag accent">${ic('building')} Area Locale</span></div>
      <div class="loc">${esc(v.type)} · ${ic('map-pin')} ${esc(place)} · cap. ${v.capacity}</div>
    </div><button class="btn small secondary" id="editVenue">Modifica</button></div>
    <div class="tags">${(v.genres || []).map(g => `<span class="tag accent">${esc(g)}</span>`).join("")}</div>
    <div class="filter-row" style="margin-top:12px">
      <button class="btn small" id="vPostReq">${ic('megaphone')} Pubblica richiesta</button>
      <button class="btn small secondary" id="vReqs">${ic('list')} Proposte${venueBookings().length ? " · " + venueBookings().length : ""}</button>
    </div>
    <p class="view-sub" style="margin-top:10px;font-size:.78rem">Nel prototipo l'area musicista e l'area Locale convivono nello stesso account. Con il backend l'area Locale diventerà un <b>login separato</b> con credenziali proprie.</p>
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
  const ris = inResonance(p, v) ? " " + risonanzaChip("In risonanza") : "";
  const c = el(`<div class="card">
    <div class="card-head author-clickable">${avatarTag(p)}<div class="meta">
      <div class="name">${esc(p.name)}${ris} <span class="score">${ic('star')} ${avgScore(p.endo)}</span></div>
      <div class="loc">${esc((p.instruments || []).join(", "))} · ${ic('map-pin')} ${esc(p.city)}</div></div></div>
    ${palcoSceneSignalsHtml(p, v)}
    <div class="tags" style="margin-top:8px">${(p.genres || []).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div>
    <button class="btn small secondary" data-contact style="margin-top:10px">${ic('send')} Contatta</button>
  </div>`);
  clickableCard(c.querySelector(".card-head"), () => openProfileSheet(p));
  c.querySelector("[data-contact]").onclick = (e) => { e.stopPropagation(); dmContact({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, city: p.city, distanceKm: p.distanceKm }); };
  return c;
}
function venueSearchPanel(v) {
  const wrap = el(`<div>
    <div class="section-label">Cerca chi ingaggiare</div>
    <div class="segmented" aria-label="Tipo di profilo">
      <button data-vk="band" aria-pressed="${venueFilter.kind === "band"}" class="${venueFilter.kind === "band" ? "on" : ""}">${ic('music-note')} Band</button>
      <button data-vk="musician" aria-pressed="${venueFilter.kind === "musician"}" class="${venueFilter.kind === "musician" ? "on" : ""}">${ic('microphone')} Musicisti</button>
    </div>
    <div class="filters">
      <div class="filter-row">
        <select id="vfIns">${options(INSTRUMENTS, venueFilter.instrument, "Tutti gli strumenti")}</select>
        <select id="vfGen">${options(GENRES, venueFilter.genre, "Tutti i generi")}</select>
      </div>
      <div class="filter-row">
        <select id="vfProv">${["", ...allProvinces()].map(p => `<option value="${esc(p)}"${p === venueFilter.province ? " selected" : ""}>${p ? esc(p) : "Tutte le province"}</option>`).join("")}</select>
      </div>
      <label class="avail-filter"${venueFilter.kind === "band" ? "" : ' style="display:none"'}><input type="checkbox" id="vfAvail" ${venueFilter.onlyAvailable ? "checked" : ""}> ${ic('check')} Solo band disponibili</label>
    </div>
    <div id="vResults"></div>
  </div>`);
  const paint = () => {
    const rb = wrap.querySelector("#vResults"); rb.innerHTML = "";
    if (venueFilter.kind === "band") {
      const list = SEED_BANDS.filter(bandMatchesVenueFilter).slice().sort(byRelevance(b => bandRelevance(b, v)));
      if (!list.length) {
        rb.appendChild(emptyState("Nessuna band con questi filtri.", [
          { label: "Azzera filtri", icon: "refresh", on: () => { venueFilter.instrument = venueFilter.genre = venueFilter.province = ""; venueFilter.onlyAvailable = false; rerenderPalco(); } },
          { label: "Pubblica una richiesta", icon: "megaphone", on: () => { closeModal(); openVenueRequest(v); } }
        ]));
        return;
      }
      list.forEach(b => rb.appendChild(bandHireCard(b, v)));
    } else {
      const list = (state.profiles || []).filter(musicianMatchesVenueFilter).slice().sort((a, b) => { const d = affinityPct(b) - affinityPct(a); return d !== 0 ? d : String(a.id).localeCompare(String(b.id)); });
      if (!list.length) {
        rb.appendChild(emptyState("Nessun musicista con questi filtri.", [
          { label: "Azzera filtri", icon: "refresh", on: () => { venueFilter.instrument = venueFilter.genre = venueFilter.province = ""; rerenderPalco(); } },
          { label: "Pubblica una richiesta", icon: "megaphone", on: () => { closeModal(); openVenueRequest(v); } }
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
  openModal(`<h2>${ic('list')} Proposte & prenotazioni</h2>
    <div class="aff-note">Le band che proponi o che ti contattano compaiono qui. Pagamenti e commissione sono <b>simulati</b> nel prototipo.</div>
    <div id="bkList" data-modal="venueBookings" style="margin-top:8px">${list.length ? list.map(bookingRow).join("") : ""}</div>`);
  if (!list.length) {
    $("#bkList").appendChild(emptyState("Ancora nessuna proposta. Cerca una band o pubblica una richiesta.", [
      { label: "Cerca una band", icon: "search", on: () => { closeModal(); rerenderPalco(); } },
      { label: "Pubblica una richiesta", icon: "megaphone", on: () => { closeModal(); openVenueRequest(v); } }
    ]));
  }
  bindBookingActions();
}
// Il locale pubblica una richiesta che finisce in Bacheca per i musicisti.
function openVenueRequest(v) {
  openModal(`
    <h2>Pubblica richiesta ${ic('megaphone')}</h2>
    <p class="view-sub">Cerchi una band o un musicista per una serata? La richiesta comparirà in <b>Bacheca</b> per i musicisti idonei.</p>
    <label class="field">Titolo</label><input type="text" id="vrTitle" placeholder="Es. Cerco cover band anni '80 per sabato">
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">Città</label><input type="text" id="vrCity" value="${esc(v.city || "")}"></div>
      <div><label class="field">Data</label><input type="date" id="vrDate"></div>
    </div>
    <label class="field" style="margin-top:10px">Generi</label><div class="chips" id="vrGen">${chips(GENRES, v.genres || [])}</div>
    <label class="field" style="margin-top:10px">Strumenti / formazione cercati</label><div id="vrIns"></div>
    <label class="field" style="margin-top:10px">Budget</label><input type="text" id="vrBudget" placeholder="Es. 300–450€">
    <label class="field" style="margin-top:10px">Descrizione</label><textarea id="vrDesc" placeholder="Tipo di serata, orari, service…"></textarea>
    <button class="btn" id="vrSave" style="margin-top:16px">Pubblica in Bacheca</button>
  `);
  const selGen = (v.genres || []).slice(), selIns = [];
  document.querySelectorAll("#vrGen .chip").forEach(c => c.onclick = () => toggleChip(c, selGen));
  instrumentPicker($("#vrIns"), selIns, { placeholder: "Strumento cercato (vuoto = band completa)…" });
  focusFirstField("vrTitle");
  $("#vrSave").onclick = () => {
    const title = $("#vrTitle").value.trim(); if (!title) return markFieldError("#vrTitle", "Dai un titolo alla richiesta.");
    const budget = $("#vrBudget").value.trim();
    const desc = ($("#vrDesc").value.trim() + (budget ? `\nBudget: ${budget}` : "")).trim();
    state.events.unshift({
      id: "ve" + Date.now(), title, author: v.name, authorAvatar: v.avatar || "🏢",
      city: $("#vrCity").value.trim() || v.city || "Milano", distanceKm: 0,
      date: $("#vrDate").value || new Date().toISOString().slice(0, 10),
      createdAt: Date.now(), featured: false, // coerente con openNewEvent: abilita badge "Nuovo" + bump rilevanza
      genres: selGen, description: desc, budget: budget || "", // BACKEND HOOK: budget come campo strutturato così la Bacheca può mostrarlo/filtrarlo
      slots: (selIns.length ? selIns : ["Band completa"]).map(i => ({ instrument: i, filled: false })),
      fromVenue: true
    });
    save(); closeModal(); toast("Richiesta pubblicata in Bacheca", ic('megaphone'));
    if (typeof notify === "function") notify("megaphone", `La tua richiesta "${title}" è online in Bacheca.`, { view: "board" });
  };
}

function bandHireCard(b, venue) {
  const ris = inResonance(b, venue) ? " " + risonanzaChip("In risonanza") : "";
  const avail = b.available ? `<span class="tag lvl">${ic('check')} disponibile</span>` : `<span class="tag warn">${ic('alert-triangle')} occupata</span>`;
  const c = el(`<div class="card">
    <div class="card-head">${avatarTag(b)}<div class="meta">
      <div class="name">${esc(b.name)}${ris} <span class="score">${stars(b.rating)}</span> ${avail}</div>
      <div class="loc">${ic('map-pin')} ${esc(b.city)} · ${b.members.length} elementi · ${ic('target')} ${esc(b.fee)}</div>
    </div></div>
    ${palcoSceneSignalsHtml(b, venue)}
    <div class="tagline" style="margin:8px 0 0;font-style:italic;color:var(--muted)">“${esc(b.tagline)}”</div>
    <div class="tags" style="margin-top:8px">${b.genres.map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div>
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
      <div class="loc">${ic('map-pin')} ${esc(b.city)} · ${b.members.length} elementi · <span class="score">${stars(b.rating)}</span> (${b.ratings})</div>
      <div style="margin-top:6px;font-weight:800;color:var(--accent)">${ic('target')} ${esc(b.fee)} / serata</div>
    </div>
    <div class="tags" style="justify-content:center;margin-top:10px">${b.genres.map(g => `<span class="tag accent">${esc(g)}</span>`).join("")}</div>
    ${busy ? `<div class="aff-note warn-note" style="margin-top:12px">${ic('alert-triangle')} Questa band risulta <b>occupata</b>: puoi comunque inviare una richiesta, ma potrebbe non essere disponibile per la data.</div>` : ""}
    <div class="section-label">Formazione</div><div class="tags">${b.members.map(m => `<span class="tag">${esc(m)}</span>`).join("")}</div>
    <div class="section-label">Repertorio (estratto)</div>
    ${(b.repertoire || []).map(s => `<div class="rep-item"><span class="song">${esc(s)}</span></div>`).join("")}
    <div class="section-label">Recensioni verificate</div>
    <div class="aff-note">${starsRating(ratingFromHistory(b))} ${stars(b.rating)} su ${b.ratings} serate verificate. "Puntuali, professionali, hanno fatto ballare tutti." — un locale</div>
    ${venue ? `<button class="btn" id="reqBtn" style="margin-top:18px">${ic('calendar')} Richiedi una prenotazione</button>` : `<div class="aff-note" style="margin-top:16px">Crea un profilo locale per prenotare questa band.</div>`}
  `);
  if (venue) $("#reqBtn").onclick = () => { closeModal(); openRequestSheet(b, venue); };
}

// EPK locale (vista) + azione band
function openVenueSheet(v, band) {
  openModal(`
    <div style="text-align:center"><div style="display:flex;justify-content:center">${avatarTag(v, true)}</div>
      <h2>${esc(v.name)}</h2>
      <div class="loc">${esc(v.type)} · ${ic('map-pin')} ${esc(v.city)} · cap. ${v.capacity} · <span class="score">${stars(v.rating)}</span></div>
    </div>
    <div class="tags" style="justify-content:center;margin-top:10px">${v.genres.map(g => `<span class="tag accent">${esc(g)}</span>`).join("")}</div>
    <div class="section-label">Serata cercata</div>
    <div class="card flat" style="background:rgba(255,255,255,.03)">
      <div class="event-date">${ic('calendar')} ${formatDate(v.openNight.date)}</div>
      <div class="loc" style="margin-top:4px">${ic('music-note')} ${esc(v.openNight.genre)} · ${ic('target')} ${esc(v.openNight.budget)}</div>
    </div>
    ${band ? `<button class="btn" id="propBtn" style="margin-top:18px">${ic('send')} Proponi “${esc(band.name)}” per questa serata</button>` : `<div class="aff-note" style="margin-top:16px">Crea la tua band per proporti.</div>`}
  `);
  if (band) $("#propBtn").onclick = () => { closeModal(); openProposeSheet(v, band); };
}

// --------------------------------------------------- Creazione band / locale
function openCreateBand(existing) {
  const b = existing || {};
  openModal(`
    <h2>${existing ? "Modifica" : "Crea la"} band ${ic('music-note')}</h2>
    <label class="field">Nome della band</label><input type="text" id="bName" value="${esc(b.name || "")}" placeholder="Es. The Riffs">
    <label class="field" style="margin-top:10px">Compenso indicativo / serata</label><input type="text" id="bFee" value="${esc(b.fee || "")}" placeholder="Es. 400€">
    <label class="field" style="margin-top:10px">Frase a effetto</label><input type="text" id="bTag" value="${esc(b.tagline || "")}" placeholder="Es. Cover anni 80, energia pura">
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">Regione</label><select id="bRegion">${regionOptions(b.region)}</select></div>
      <div><label class="field">Provincia</label><select id="bProvince">${provinceOptions(b.region, b.province)}</select></div>
    </div>
    <label class="field" style="margin-top:10px">Città</label><input type="text" id="bCity" value="${esc(b.city || state.me.city)}" placeholder="Es. Milano">
    <label class="field" style="margin-top:10px">Generi</label><div class="chips" id="bGen">${chips(GENRES, b.genres || [])}</div>
    <label class="field" style="margin-top:10px">Formazione</label><div id="bMem"></div>
    <div class="row-between" style="margin-top:10px"><label class="field" style="margin:0">Repertorio (un brano per riga)</label>${(state.me.repertoire || []).length ? `<button class="btn small secondary" id="bRepImport" type="button">${ic('save')} Importa dal profilo</button>` : ""}</div>
    <textarea id="bRep" placeholder="Wonderwall&#10;Hotel California">${esc((b.repertoire || []).join("\n"))}</textarea>
    <button class="btn" id="bSave" style="margin-top:16px">${existing ? "Salva" : "Crea band"}</button>
  `);
  const selG = (b.genres || []).slice(), selM = (b.members || []).slice();
  document.querySelectorAll("#bGen .chip").forEach(c => c.onclick = () => toggleChip(c, selG));
  instrumentPicker($("#bMem"), selM, { placeholder: "Aggiungi uno strumento alla formazione…" });
  $("#bRegion").onchange = e => { $("#bProvince").innerHTML = provinceOptions(e.target.value, ""); };
  if ($("#bRepImport")) $("#bRepImport").onclick = () => {
    const titles = (state.me.repertoire || []).map(r => r.title).filter(Boolean);
    const merged = $("#bRep").value.split("\n").map(s => s.trim()).filter(Boolean);
    titles.forEach(t => { if (!merged.some(x => x.toLowerCase() === t.toLowerCase())) merged.push(t); });
    $("#bRep").value = merged.join("\n");
    toast(`Importati ${titles.length} brani dal profilo (solo titoli)`);
  };
  $("#bSave").onclick = () => {
    const name = $("#bName").value.trim(); if (!name) return markFieldError("#bName", "Dai un nome alla band.");
    if (!selM.length) return toast("Aggiungi almeno uno strumento alla formazione");
    const band = Object.assign(existing || { id: "mb" + Date.now(), avatar: "🎸", color: GRADS[Math.floor(Math.random() * GRADS.length)], rating: 0, ratings: 0, available: true, invites: [] }, {
      name, region: $("#bRegion").value, province: $("#bProvince").value, city: $("#bCity").value.trim() || state.me.city,
      fee: $("#bFee").value.trim(), tagline: $("#bTag").value.trim(),
      genres: selG, members: selM, repertoire: $("#bRep").value.split("\n").map(s => s.trim()).filter(Boolean)
    });
    if (!existing) state.bands = [band]; save(); closeModal(); toast("Band salvata 🎸"); rerenderPalco();
  };
}

function openCreateVenue(existing) {
  const v = existing || {};
  const TYPES = ["Pub", "Jazz club", "Ristorante", "Sala eventi", "Circolo", "Azienda", "Privato"];
  openModal(`
    <h2>${existing ? "Modifica area Locale" : "Registra l'area Locale"} ${ic('building')}</h2>
    ${existing ? "" : `<p class="view-sub">Crea il profilo del tuo locale per cercare e ingaggiare musicisti e band.</p>`}
    <label class="field">Nome locale / azienda</label><input type="text" id="vName" value="${esc(v.name || "")}" placeholder="Es. Pub The Anchor">
    <label class="field" style="margin-top:10px">Tipo</label><select id="vType">${options(TYPES, v.type || "Pub")}</select>
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">Regione</label><select id="vRegion">${regionOptions(v.region)}</select></div>
      <div><label class="field">Provincia</label><select id="vProvince">${provinceOptions(v.region, v.province)}</select></div>
    </div>
    <label class="field" style="margin-top:10px">Città</label><input type="text" id="vCity" value="${esc(v.city || state.me.city)}">
    <label class="field" style="margin-top:10px">Capienza</label><input type="text" id="vCap" value="${esc(v.capacity || "")}" placeholder="Es. 80">
    <label class="field" style="margin-top:10px">Generi graditi</label><div class="chips" id="vGen">${chips(GENRES, v.genres || [])}</div>
    <button class="btn" id="vSave" style="margin-top:16px">${existing ? "Salva" : "Registra area Locale"}</button>
  `);
  const selG = (v.genres || []).slice();
  document.querySelectorAll("#vGen .chip").forEach(c => c.onclick = () => toggleChip(c, selG));
  $("#vRegion").onchange = e => { $("#vProvince").innerHTML = provinceOptions(e.target.value, ""); };
  $("#vSave").onclick = () => {
    const name = $("#vName").value.trim(); if (!name) return markFieldError("#vName", "Dai un nome al locale.");
    state.myVenue = Object.assign(existing || { id: "mv" + Date.now(), avatar: "🏢", color: GRADS[1], rating: 0, ratings: 0 }, {
      name, type: $("#vType").value, region: $("#vRegion").value, province: $("#vProvince").value, city: $("#vCity").value.trim(), capacity: $("#vCap").value.trim() || "—", genres: selG
    });
    save(); closeModal(); toast("Area Locale salvata 🏢"); rerenderPalco();
  };
}

// --------------------------------------------------- Flusso prenotazione
function openProposeSheet(v, band) { // la band propone al locale (con preventivo)
  const cold = !v.openNight;            // proposta "a freddo": il locale non ha una serata aperta
  const night = v.openNight || {};
  openModal(`
    <h2>${cold ? "Proponi la tua band" : "Proponi per la serata"}</h2>
    <div class="aff-note">${esc(band.name)} → ${esc(v.name)}${cold ? "" : ` · ${ic('calendar')} ${formatDate(night.date)} · budget ${esc(night.budget || "—")}`}</div>
    ${cold ? `<label class="field" style="margin-top:12px">Data proposta</label><input type="date" id="pDate">` : ""}
    <label class="field" style="margin-top:12px">Il tuo preventivo</label><input type="text" id="pQuote" value="${esc(band.fee || "")}" placeholder="Es. 400€">
    <label class="field" style="margin-top:10px">Messaggio (opzionale)</label><textarea id="pMsg" placeholder="Disponibili, portiamo service audio…"></textarea>
    <button class="btn" id="pSend" style="margin-top:16px">Invia proposta</button>
  `);
  focusFirstField(cold ? "pDate" : "pQuote");
  $("#pSend").onclick = () => {
    const quote = $("#pQuote").value.trim() || band.fee || "—";
    const date = cold ? ($("#pDate") && $("#pDate").value || new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10)) : night.date;
    const budget = cold ? quote : (night.budget || "—");
    const bk = addBooking({ kind: "band", bandId: band.id, bandName: band.name, venueId: v.id, venueName: v.name, venueAvatar: v.avatar, venueColor: v.color, bandAvatar: band.avatar, bandColor: band.color, date, budget, quote, msg: ($("#pMsg") && $("#pMsg").value.trim()) || "", status: "quoted" });
    if (!bk) return;                     // bloccata da dedup/conflitto (toast già mostrato)
    closeModal(); toast("Proposta inviata", ic('send')); navigate("palco");
    // La proposta resta "quoted" (in attesa): è il locale a decidere. Esito probabilistico.
    simulateOutcome(bk.id);
  };
}

function openRequestSheet(b, venue) { // il locale richiede la band
  const busy = !b.available;
  openModal(`
    <h2>Richiedi prenotazione</h2>
    <div class="aff-note">${esc(venue.name)} → ${esc(b.name)}</div>
    ${busy ? `<div class="aff-note warn-note" style="margin-top:10px">${ic('alert-triangle')} ${esc(b.name)} risulta <b>occupata</b>: la richiesta parte comunque, ma valuta una data alternativa.</div>` : ""}
    <label class="field" style="margin-top:12px">Data</label><input type="date" id="rDate">
    <label class="field" style="margin-top:10px">Budget proposto</label><input type="text" id="rBudget" placeholder="Es. 400€">
    <label class="field" style="margin-top:10px">Messaggio (opzionale)</label><textarea id="rMsg" placeholder="Serata cover, 2 set da 45 min…"></textarea>
    <button class="btn" id="rSend" style="margin-top:16px">Invia richiesta</button>
  `);
  focusFirstField("rDate");
  $("#rSend").onclick = () => {
    const date = $("#rDate").value || new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
    const bk = addBooking({ kind: "venue", bandId: b.id, bandName: b.name, venueId: venue.id, venueName: venue.name, venueAvatar: venue.avatar, venueColor: venue.color, bandAvatar: b.avatar, bandColor: b.color, date, budget: $("#rBudget").value.trim() || "—", quote: b.fee, msg: ($("#rMsg") && $("#rMsg").value.trim()) || "", status: "requested" });
    if (!bk) return;                     // bloccata da dedup/conflitto
    closeModal(); toast("Richiesta inviata", ic('send')); navigate("palco");
    simulate(bk.id, "quoted", `${b.name} ha risposto con un preventivo: ${b.fee}`, "music-note");
  };
}

// addBooking ritorna null se la proposta/richiesta è duplicata o in conflitto di data.
// BACKEND HOOK: validazione unicità + agenda lato server; qui dedup e conflitto sono lato client.
function addBooking(data) {
  if (bookingExists(data.bandId, data.venueId, data.date)) { toast("Esiste già una proposta per questa band e data", ic('alert-triangle')); return null; }
  if (hasDateConflict(data.bandId, data.date, data.venueId)) { toast("Questa band ha già una serata confermata in quella data", ic('alert-triangle')); return null; }
  const ts = Date.now();
  const bk = Object.assign({ id: "bk" + ts, history: [{ status: data.status, ts }] }, data);
  state.bookings = state.bookings || []; state.bookings.unshift(bk); save(); return bk;
}
// Applica una transizione di stato registrandola nella mini-timeline bk.history.
function setBookingStatus(bk, status, extra) {
  bk.status = status; bk.history = bk.history || []; bk.history.push({ status, ts: Date.now() });
  if (extra) Object.assign(bk, extra); save();
}
// Conferma una prenotazione SOLO se la band non è già confermata altrove in quella data:
// l'invariante anti-doppia-prenotazione va riverificata a ogni conferma, non solo alla creazione.
function confirmBooking(bk, extra) {
  if (hasDateConflict(bk.bandId, bk.date, bk.venueId)) { toast("Questa band è già confermata in quella data", ic('alert-triangle')); return false; }
  setBookingStatus(bk, "confirmed", extra); return true;
}
// simulate "semplice": forza uno stato dopo un delay (usato per la risposta col preventivo).
function simulate(id, status, msg, iconName) {
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
  setTimeout(() => {
    const bk = (state.bookings || []).find(x => x.id === id); if (!bk || bk.status !== "quoted") return;
    const ok = feeMatchesBudget(bk.quote, bk.budget);
    const r = Math.random();
    let status, msg, extra = {};
    if (ok ? r < 0.75 : r < 0.3) {
      status = "confirmed"; msg = `${bk.venueName} ha confermato “${bk.bandName}”!`;
    } else if (r < (ok ? 0.92 : 0.75)) {
      // controproposta: il locale rilancia un budget ancorato al proprio range
      const base = parseMoney(bk.budget) || parseMoney(bk.quote) || 300;
      const counter = Math.round(base * 0.9 / 10) * 10;
      status = "counter"; extra = { counterQuote: counter + "€", expiresAt: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) };
      msg = `${bk.venueName} ha rilanciato: ${counter}€`;
    } else {
      status = "declined"; msg = `${bk.venueName} ha declinato la proposta`;
    }
    // Se nel frattempo la band ha confermato altrove in quella data, il locale non può confermare.
    if (status === "confirmed" && hasDateConflict(bk.bandId, bk.date, bk.venueId)) { status = "declined"; extra = {}; msg = `${bk.venueName} non può confermare: la band è occupata in quella data`; }
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
  openModal(`<h2>${ic('list')} Le tue prenotazioni</h2>
    <div class="aff-note">Pagamenti e commissione sono <b>simulati</b> in questo prototipo (in produzione: escrow via Stripe, commissione 5% al locale).</div>
    <div id="bkList" data-modal="bookings" style="margin-top:8px">${list.length ? list.map(bookingRow).join("") : ""}</div>`);
  if (!list.length) {
    $("#bkList").appendChild(emptyState("Nessuna prenotazione ancora. Trova un locale o una band per iniziare.", [
      { label: "Cerca un locale", icon: "search", on: () => { closeModal(); state.ui.palcoMode = "band"; navigate("palco"); } },
      { label: "Cerca una band", icon: "music-note", on: () => { closeModal(); state.ui.palcoMode = "venue"; navigate("palco"); } }
    ]));
  }
  bindBookingActions();
}
function tagClass(c) { return c === "ok" ? "lvl" : c === "accent" ? "accent" : c === "warn" ? "warn" : ""; }
function bookingRow(bk) {
  const st = STATUS[bk.status] || { t: bk.status, c: "" };
  const fee = bk.quote || bk.budget;
  let action = "";
  if (bk.status === "requested") action = `<div class="loc">In attesa del preventivo della band…</div>`;
  else if (bk.status === "quoted" && bk.kind === "venue") action = `<button class="btn small" data-act="confirm" data-id="${bk.id}">${ic('check')} Conferma · acconto 30% (simulato)</button>`;
  else if (bk.status === "quoted" && bk.kind === "band") action = `<div class="loc">${ic('clock')} In attesa della decisione del locale…</div>`;
  else if (bk.status === "counter") action = `<div class="loc" style="margin-bottom:8px">${ic('refresh')} Controproposta: <b>${esc(bk.counterQuote || fee)}</b>${bk.expiresAt ? ` · ${ic('clock')} scade il ${formatDate(bk.expiresAt)}` : ""}</div>
      <div class="filter-row"><button class="btn small" data-act="counter-accept" data-id="${bk.id}">${ic('check')} Accetta</button><button class="btn small secondary" data-act="counter-counter" data-id="${bk.id}">${ic('refresh')} Rilancia</button><button class="btn small secondary" data-act="counter-reject" data-id="${bk.id}">${ic('face-neutral')} Rifiuta</button></div>`;
  else if (bk.status === "declined") action = `<div class="loc">${ic('face-neutral')} Proposta declinata.</div>`;
  else if (bk.status === "confirmed") action = `<button class="btn small secondary" data-act="complete" data-id="${bk.id}">Segna serata completata</button>`;
  else if (bk.status === "completed") action = `<button class="btn small" data-act="review" data-id="${bk.id}">${ic('star')} Lascia recensione</button>`;
  else if (bk.status === "reviewed") action = reviewsHtml(bk);
  const payline = (bk.status === "confirmed" || bk.status === "completed" || bk.status === "reviewed")
    ? `<div class="loc" style="margin-top:4px">${ic('target')} ${esc(fee)} · commissione JamMate 5% (al locale) · acconto in escrow (simulato)</div>` : "";
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
    ? `<div class="aff-note" style="margin-top:6px">${ic('star')} <b>Recensione ricevuta${bk.counterReview.demo ? " (simulata nel prototipo)" : ""}:</b> ${starsRating(bk.counterReview.rating)} — ${esc(bk.counterReview.text)}</div>`
    : `<div class="aff-note" style="margin-top:6px">${ic('clock')} In attesa della recensione della controparte…</div>`;
  return `<div class="aff-note">${ic('star')} <b>La tua recensione:</b> ${starsRating(mine.rating)} — ${esc(mine.text || "(nessun commento)")}</div>${other}`;
}
function bindBookingActions() {
  const root = $("#bkList") || document;
  root.querySelectorAll("[data-act][data-id]").forEach(btn => btn.onclick = () => {
    const bk = (state.bookings || []).find(x => x.id === btn.dataset.id); if (!bk) return;
    const act = btn.dataset.act;
    // Controproposta scaduta: non più azionabile (coerente con "scade il …" mostrato in UI).
    if (bk.status === "counter" && bk.expiresAt && bk.expiresAt < todayISO() && (act === "counter-accept" || act === "counter-counter")) {
      setBookingStatus(bk, "declined"); toast("Controproposta scaduta", ic('clock')); refreshBookingsView(); return;
    }
    if (act === "confirm") { if (confirmBooking(bk)) toast("Confermata! Acconto 30% in escrow (simulato)", ic('check')); refreshBookingsView(); }
    else if (act === "counter-accept") { if (confirmBooking(bk, { quote: bk.counterQuote || bk.quote })) toast("Controproposta accettata — confermata!", ic('check')); refreshBookingsView(); }
    else if (act === "counter-reject") { setBookingStatus(bk, "declined"); toast("Controproposta rifiutata", ic('face-neutral')); refreshBookingsView(); }
    else if (act === "counter-counter") {
      // rilancio della band sul valore controproposto: torna "quoted", il locale ridecide
      setBookingStatus(bk, "quoted", { quote: bk.counterQuote || bk.quote, counterQuote: null });
      toast("Rilancio inviato", ic('refresh')); refreshBookingsView(); simulateOutcome(bk.id);
    }
    else if (act === "complete") {
      setBookingStatus(bk, "completed");
      // jamCount cresce SOLO per jam reali (social.js): qui conta i gig della band, non gonfia il musicista.
      // Incremento solo se è la mia band e non sto agendo dal lato locale.
      const mine = myBand();
      if (mine && bk.bandId === mine.id && bk.kind !== "venue") { mine.gigsDone = (mine.gigsDone || 0) + 1; save(); }
      toast("Serata completata", ic('celebration', 'accent')); refreshBookingsView();
    }
    else if (act === "review") openReviewSheet(bk);
  });
}
function openReviewSheet(bk) {
  // chi recensisco? se ho proposto come band -> recensisco il locale; se sono locale -> la band
  const target = bk.kind === "band" ? bk.venueName : bk.bandName;
  let rating = 5;
  openModal(`<h2>${ic('star')} Recensisci: ${esc(target)}</h2>
    <div class="aff-note">Recensione <b>verificata</b> (solo dopo una serata completata) e a <b>doppio cieco</b>: la recensione della controparte resta nascosta finché non recensisce anche lei. Nel prototipo la controparte è <b>simulata</b>.</div>
    <div class="lk" style="margin-top:12px"><div class="lk-q" id="rvStarsLbl">Valutazione</div>
      <div class="likert" id="rvStars" role="radiogroup" aria-labelledby="rvStarsLbl">${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" data-v="${v}" aria-label="${v} su 5" aria-checked="${v === 5 ? "true" : "false"}" class="${v === 5 ? "on" : ""}">${v}${ic('star')}</button>`).join("")}</div></div>
    <label class="field" style="margin-top:10px">Commento</label><textarea id="rvText" placeholder="Puntualità, professionalità, intesa…"></textarea>
    <button class="btn" id="rvSend" style="margin-top:14px">Invia recensione</button>`);
  focusFirstField();
  document.querySelectorAll("#rvStars button").forEach(b => b.onclick = () => { document.querySelectorAll("#rvStars button").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); }); b.classList.add("on"); b.setAttribute("aria-checked", "true"); rating = +b.dataset.v; });
  $("#rvSend").onclick = () => {
    bk.myReview = { rating, text: $("#rvText").value.trim(), ts: Date.now() };
    // Doppio cieco onesto: prepara la controparte ma NON rivelarla subito.
    // La controparte demo è generata da segnali reali (rating storico /10 → 1–5).
    const entity = bk.kind === "band" ? (allVenues().find(x => x.id === bk.venueId) || { rating: 0 }) : (SEED_BANDS.find(x => x.id === bk.bandId) || { rating: 0 });
    const canned = bk.kind === "band"
      ? ["Band puntuale e coinvolgente, ottima intesa con il pubblico.", "Professionali, suono pulito. Li richiameremo."]
      : ["Locale organizzato, pagamento puntuale, staff gentile.", "Bel palco e pubblico caloroso, esperienza top."];
    bk.counterReview = { rating: ratingFromHistory(entity), text: canned[Math.floor(Math.random() * canned.length)], ts: Date.now(), demo: true };
    bk.reviewRevealed = false;
    setBookingStatus(bk, "reviewed");
    toast("Recensione inviata — in attesa della controparte", ic('star'));
    refreshBookingsView();
    // BACKEND HOOK: reveal simultaneo server-side quando entrambe le parti recensiscono; qui un simulate "rivela" la demo.
    setTimeout(() => {
      const cur = (state.bookings || []).find(x => x.id === bk.id); if (!cur || !cur.counterReview) return;
      cur.reviewRevealed = true; save();
      toast(`${target} ti ha recensito`, ic('star'));
      if (typeof notify === "function") notify("star", `${target} ti ha recensito.`, { view: "palco" });
      refreshBookingsView();
    }, 1900);
  };
}

// --------------------------------------------------- Inviti musicisti in band (#6)
// Dai match/profili in "Scopri" inviti un musicista a entrare nella tua band.
// Prototipo: invito locale con accettazione simulata. Col backend (band_invites)
// diventa invito reale + accettazione del destinatario.
const INVITE_STATUS = {
  pending:  { t: "In attesa", c: "warn" },
  accepted: { t: "In formazione", ic: "check", c: "ok" },
  declined: { t: "Ha declinato", c: "" }
};

function openInviteToBand(p) {
  const band = myBand();
  if (!band) {
    closeModal(); toast("Crea prima la tua band per invitare musicisti", ic('music-note'));
    state.ui.palcoMode = "band"; navigate("palco"); return;
  }
  const existing = (band.invites || []).find(i => i.profileId === p.id && i.status !== "declined");
  if (existing) {
    toast(existing.status === "accepted"
      ? `${p.name.split(" ")[0]} è già nella tua formazione`
      : `Hai già invitato ${p.name.split(" ")[0]}`);
    return;
  }
  const instr = (p.instruments && p.instruments.length) ? p.instruments : INSTRUMENTS;
  openModal(`
    <h2>Invita in “${esc(band.name)}” ${ic('music-note')}</h2>
    <div class="aff-note">Proponi a <b>${esc(p.name)}</b> di entrare in formazione. Nel prototipo la risposta è simulata; col backend riceverà una notifica e potrà accettare.</div>
    <label class="field" style="margin-top:12px">Ruolo / strumento</label>
    <select id="invInstr">${options(instr, instr[0])}</select>
    <label class="field" style="margin-top:10px">Messaggio (opzionale)</label>
    <textarea id="invMsg" placeholder="Ciao! Ci piacerebbe averti con noi…"></textarea>
    <button class="btn" id="invSend" style="margin-top:16px">Invia invito ${ic('send')}</button>
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
    closeModal(); toast("Invito inviato", ic('send'));
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
    toast(accepted ? `${inv.name.split(" ")[0]} è entrato in ${band.name}!`
                   : `${inv.name.split(" ")[0]} ha declinato l'invito`, accepted ? ic('celebration','accent') : "");
    if (typeof notify === "function") notify(accepted ? "music-note" : "face-neutral", accepted ? `${inv.name.split(" ")[0]} è entrato in ${band.name}!` : `${inv.name.split(" ")[0]} ha declinato l'invito.`, { view: "palco" });
    rerenderPalco();
  }, 1800);
}

function renderBandInvites(box, band) {
  box.appendChild(el(`<div class="section-label">Formazione & inviti</div>`));
  const invites = (band.invites || []).slice();
  if (!invites.length) {
    box.appendChild(emptyState("Nessun musicista invitato. Trova chi completa la tua formazione in Scopri.", [
      { label: "Vai a Scopri", icon: "search", on: () => navigate("discover") }
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
      </div><button class="btn small secondary" data-act>${removable ? "Rimuovi" : "Annulla"}</button></div>
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
      toast(removable ? "Rimosso dalla formazione" : "Invito annullato");
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
  if (band) pages.push({ type: "Band", icon: "music-note", obj: band, manage: () => { closeModal(); openCreateBand(band); } });
  if (v) pages.push({ type: "Locale", icon: "building", obj: v, manage: () => { closeModal(); openCreateVenue(v); } });
  openModal(`
    <h2>${ic('building')} Le tue Pagine</h2>
    <div class="aff-note">Le Pagine sono le entità che gestisci — una <b>Band</b> o un <b>Locale</b> — con profilo e prenotazioni propri. Il tuo account personale resta separato.</div>
    <div id="pagesList">${pages.length ? "" : `<div class="empty">${spot("trova")}Non gestisci ancora Pagine. Crea una Band per offrirti alle serate, o registra un Locale per ingaggiare musica.</div>`}</div>
    <div class="section-label">Crea una Pagina</div>
    <div class="filter-row">
      ${band ? "" : `<button class="btn small" id="pgNewBand" type="button">${ic('music-note')} Crea una Band</button>`}
      ${v ? "" : `<button class="btn small" id="pgNewVenue" type="button">${ic('building')} Registra un Locale</button>`}
    </div>
    ${band && v ? `<p class="view-sub" style="font-size:.74rem;margin-top:10px">Gestisci già una Band e un Locale.</p>` : ""}`);
  const list = $("#pagesList");
  pages.forEach(pg => {
    const row = el(`<div class="card flat" style="margin-bottom:8px"><div class="card-head">${avatarTag(pg.obj)}<div class="meta">
      <div class="name">${esc(pg.obj.name)} <span class="tag">${pg.type}</span></div>
      <div class="loc">${ic(pg.icon)} ${esc([pg.obj.city, pg.obj.province].filter(Boolean).join(", ")) || pg.type}</div>
    </div><button class="btn small secondary" data-manage type="button">Gestisci</button></div></div>`);
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
