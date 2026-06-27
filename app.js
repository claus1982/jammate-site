/* JamMate — logica dell'app (prototipo MVP).
 * Single-page app in JavaScript puro, senza framework e senza build step:
 * basta aprire index.html. I dati persistono nel browser (localStorage). */

// ---------- Stato & persistenza ----------
const STORE_KEY = (window.JM && JM.Runtime && JM.Runtime.stateKey) || "jammate_demo_state_v2";
// Distanza: step non lineari; l'ultimo = "Ovunque" (sentinella alta così
// "p.distanceKm <= d" passa sempre). Default inclusivo (Ovunque), opt-in al restringimento.
const DIST_STEPS = [5, 10, 25, 50, 100, 200, 99999];
const DIST_MAX = 99999;
function isProductionRuntime() { return !!(window.JM && JM.Runtime && !JM.Runtime.demo); }
function distLabel(d) { return d >= DIST_MAX ? t('app.dist_anywhere') : d + " km"; }
function distIndex(d) { const i = DIST_STEPS.indexOf(d); if (i >= 0) return i; const j = DIST_STEPS.findIndex(s => s >= d); return j >= 0 ? j : DIST_STEPS.length - 1; }

function loadState() {
  if (window.JM && JM.InitialState) return applyRemoteState(migrate(structuredClone(JM.InitialState)));
  const raw = JM.Storage.get(STORE_KEY);
  if (raw) {
    try { return applyRemoteState(migrate(JSON.parse(raw))); }
    catch (e) {
      try { JM.Storage.set(STORE_KEY + "_corrupt_backup", raw); } catch (_) {}
      console.warn("JamMate: stato salvato illeggibile — riparto dai dati demo (copia in " + STORE_KEY + "_corrupt_backup).", e);
    }
  }
  return applyRemoteState(freshState());
}
function applyRemoteState(base) {
  const r = window.JM && JM.RemoteData;
  if (!r || (JM.Runtime && JM.Runtime.demo)) return base;
  const own = r.me && r.me.profile;
  if (r.session) {
    base.me.id = r.session.id;
    base.me.name = r.session.displayName || base.me.name;
  }
  if (own) {
    Object.assign(base.me, own, { photo: own.photoUrl || own.photo || "", deep: r.me.deep || base.me.deep });
    base.onboarded = true;
  }
  base.profiles = Array.isArray(r.profiles) ? r.profiles : [];
  base.matches = Array.isArray(r.matches) ? r.matches.map((m) => m.userId) : [];
  base.posts = Array.isArray(r.posts) ? r.posts : [];
  base.jams = Array.isArray(r.jams) ? r.jams : [];
  base.bands = Array.isArray(r.bands) ? r.bands : [];
  base.publicBands = Array.isArray(r.publicBands) ? r.publicBands : [];
  base.venues = Array.isArray(r.venues) ? r.venues : [];
  base.bookings = Array.isArray(r.bookings) ? r.bookings : [];
  base.teachers = Array.isArray(r.teachers) ? r.teachers : [];
  base.lessonBookings = Array.isArray(r.lessonBookings) ? r.lessonBookings : [];
  base.notifications = Array.isArray(r.notifications) ? r.notifications : [];
  return base;
}
function freshState() {
  const demo = !window.JM || !JM.Runtime || JM.Runtime.demo;
  return {
    // Clona i seed: lo stato deve possedere i propri oggetti, altrimenti pushMsg()/jamJoin()
    // muterebbero le costanti di modulo (mai serializzate) e "Azzera dati demo" non ripristinerebbe.
    profiles: demo ? structuredClone(SEED_PROFILES) : [],
    events: demo ? normalizeEvents(structuredClone(SEED_EVENTS)) : [],
    messages: demo ? structuredClone(SEED_MESSAGES) : {},
    me: {
      id: "me", name: "", avatar: "🎵", color: GRADS[0], photo: "", city: "Milano", distanceKm: 0,
      instruments: [], levels: {}, level: "Intermedio", genres: [], bio: "", tagline: "",
      links: { youtube: "", spotify: "", instagram: "" },
      repertoire: [], endo: { puntualita: 0, tecnica: 0, attitudine: 0, endorsements: 0 },
      jamCount: 0,
      deep: { done: false },
      plan: "free",   // 'free' (con spazi promossi nativi) | 'pro' (ad-free) — switch reale col backend/Stripe
      // Modello "un account + capacità": il fan/ascoltatore è il livello base (nessun flag). `plays`
      // = musicista (sblocca Scopri/match/repertorio/Sintonia), `hires` = ingaggia/organizza serate.
      // Le Pagine (Locale/Band) restano entità gestite (state.myVenue / state.bands).
      caps: { plays: true, hires: false },
      verifyStatus: "none"   // 'none' | 'pending' | 'verified' — badge di fiducia (verifica reale col backend)
    },
    liked: [], passed: [], matches: demo ? ["u2"] : [],
    jamsDone: {}, jamFeedback: {}, savedAds: [], boardSeen: 0, tools: {}, teacherStats: {},
    bands: [], myVenue: null, bookings: [], metroPresets: [],
    posts: [], jams: [], teacher: null, lessonBookings: [], contacts: [],
    notifications: demo ? [
      { id: "seed1", icon: "🎤", text: "Giulia Ferri ha visto il tuo profilo.", ts: Date.now() - 2 * 3600e3, read: false, view: "discover" },
      { id: "seed2", icon: "map", text: "Nuova jam vicino a te: “Jam jazz al parco”.", ts: Date.now() - 5 * 3600e3, read: false, view: "board" },
      { id: "seed3", icon: "👋", text: "Benvenuto! Completa il Profilo Accordato per sbloccare la Sintonia.", ts: Date.now() - 26 * 3600e3, read: false, view: "profile" }
    ] : [],
    filters: { instrument: "", level: "", genre: "", distance: DIST_MAX },
    ui: { discoverMode: "match", palcoMode: "band", boardMode: "list", unread: false, notifSeen: true },
    // Registro consensi GDPR (versionato + timestamp): backend-ready. `deep` = consenso ESPLICITO
    // art. 9 per i dati di personalità/valori del Profilo Accordato (categoria particolare).
    consent: { v: 1, ts: 0, noticeSeen: false, deep: false },
    // Guida interattiva una-tantum (versionata: bumpare GUIDE_VERSION la ri-mostra a tutti dopo un grande cambio).
    guide: { v: 1, seen: false, ts: 0 },
    onboarded: false
  };
}
const GUIDE_VERSION = 1;
function migrate(s) {
  const base = freshState();
  const out = Object.assign(base, s, { ui: Object.assign(base.ui, s.ui || {}), me: Object.assign(base.me, s.me || {}) });
  // Profili creati prima dei livelli per-strumento: deriva la mappa dal livello unico.
  if (!out.me.levels || !Object.keys(out.me.levels).length) {
    out.me.levels = {}; (out.me.instruments || []).forEach(i => { out.me.levels[i] = out.me.level || LEVELS[2]; });
  }
  // Repertorio pre-trasposizione: il singolo .key diventa keys[] (tonalità reale = scritta).
  (out.me.repertoire || []).forEach(r => { if (!r.keys) { r.keys = r.key ? [r.key] : []; if (r.transpose == null) r.transpose = 0; } });
  // Difesa: profili salvati da versioni vecchie potrebbero non avere endo/deep.
  (out.profiles || []).forEach(p => {
    if (!p.endo) p.endo = { puntualita: 0, tecnica: 0, attitudine: 0, endorsements: 0 };
    if (!p.deep) p.deep = { done: false };
    // Difesa di forma: i consumer (opener/affinity/deck) dereferenziano questi array.
    if (!Array.isArray(p.instruments)) p.instruments = [];
    if (!Array.isArray(p.genres)) p.genres = [];
    if (!Array.isArray(p.repertoire)) p.repertoire = [];
  });
  out.savedAds = out.savedAds || [];
  if (out.boardSeen == null) out.boardSeen = 0;
  // Coercizione di tipo difensiva: un localStorage manomesso (o un vecchio schema) non deve
  // propagare forme sbagliate nel rendering né, domani, nei body delle richieste JM.Api.
  const arr = (k) => { if (!Array.isArray(out.me[k])) out.me[k] = []; };
  arr("instruments"); arr("genres"); arr("repertoire");
  if (!out.me.links || typeof out.me.links !== "object") out.me.links = { youtube: "", spotify: "", instagram: "" };
  if (out.me.plan !== "pro") out.me.plan = "free";
  // Capacità: utenti esistenti sono musicisti; se gestiscono un locale o band, anche "ingaggia".
  if (!out.me.caps || typeof out.me.caps !== "object") out.me.caps = { plays: true, hires: !!(out.myVenue || (out.bands && out.bands.length)) };
  if (typeof out.me.caps.plays !== "boolean") out.me.caps.plays = true;
  if (typeof out.me.caps.hires !== "boolean") out.me.caps.hires = !!(out.myVenue || (out.bands && out.bands.length));
  if (["none", "pending", "verified"].indexOf(out.me.verifyStatus) === -1) out.me.verifyStatus = "none";
  ["liked", "passed", "matches", "posts", "bands", "bookings", "jams", "lessonBookings", "contacts"].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!out.teacherStats || typeof out.teacherStats !== "object") out.teacherStats = {};
  if (!out.consent || typeof out.consent !== "object") out.consent = { v: 1, ts: 0, noticeSeen: false, deep: false };
  // Stato vecchio con Profilo Accordato già compilato: l'aver salvato i dati art.9 implica il consenso storico.
  if (out.me && out.me.deep && out.me.deep.done && !out.consent.deep) { out.consent.deep = true; if (!out.consent.ts) out.consent.ts = Date.now(); }
  // Guida: top-level non auto-merge → coercizione difensiva (anche contro localStorage malformato).
  if (!out.guide || typeof out.guide !== "object") out.guide = { v: 1, seen: false, ts: 0 };
  if (typeof out.guide.seen !== "boolean") out.guide.seen = false;
  if (typeof out.guide.v !== "number") out.guide.v = 1;
  normalizeEvents(out.events);
  migrateMessages(out);
  return out;
}

let state = loadState();
if (window.JM && JM.Sync) JM.Sync.prime(state);
// save() non deve MAI lanciare: una quota piena (foto/post in dataURL) abortirebbe l'handler
// chiamante lasciando lo stato a metà. JM.Storage.set ripiega in memoria e ritorna false in caso di errore.
let _quotaWarned = false;
function save() {
  const durable = JM.Storage.set(STORE_KEY, JSON.stringify(state));
  if (window.JM && JM.Sync) JM.Sync.schedule(state);
  // Scrittura non durevole (quota piena / storage bloccato): i dati restano in sessione ma non oltre
  // il reload. Avvisa UNA sola volta e non lanciare mai (l'handler chiamante non deve abortire).
  if (!durable && !_quotaWarned) {
    _quotaWarned = true;
    console.warn("JamMate: storage durevole non disponibile — uso la memoria volatile (dati non persistiti tra sessioni).");
    if (typeof toast === "function") toast(t('app.storage_full'), ic('alert-triangle'), { error: true });
  }
  return durable;
}

// ---------- Utility ----------
const $ = (sel, root = document) => root.querySelector(sel);
// Crea un nodo da HTML. Se il template ha più elementi radice (es. più tool-card),
// li avvolge in un <div> così non se ne perdono (prima restava solo il primo).
const el = (html) => {
  const t = document.createElement("template"); t.innerHTML = html.trim();
  if (t.content.children.length > 1) { const w = document.createElement("div"); w.appendChild(t.content); return w; }
  return t.content.firstElementChild;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Sicurezza: consenti solo URL http/https nei link utente (blocca javascript:, data:, ecc.)
const safeUrl = (u) => { const s = String(u ?? "").trim(); return /^https?:\/\//i.test(s) ? s : "#"; };
// Sicurezza: immagini usabili in CSS url() o <img src>. Allow-list (dataURL immagine o https
// senza caratteri di breakout): blocca CSS/markup injection quando i dati arriveranno dal backend.
const IMG_OK = /^(?:data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s'"()<>\\]+)$/i;
const safeImg = (u) => { const s = String(u ?? "").trim(); return IMG_OK.test(s) ? s : ""; };
// Sicurezza: nei background ammetti SOLO i gradienti della palette GRADS (niente CSS injection via color).
const safeColor = (c) => (typeof GRADS !== "undefined" && GRADS.indexOf(c) !== -1) ? c : "var(--card-hi)";
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
// ---------- Vocabolario controllato: SOLO display (valore canonico invariato) ----------
// I valori canonici di data.js (INSTRUMENTS/LEVELS/GENRES/famiglie) restano la fonte
// di verità: persistiti, confrontati nel codice e dal backend. Qui ne risolviamo solo
// la LABEL localizzata via i18n.vocab.js, con fallback al valore canonico.
// Schema slug/namespace (deve combaciare byte-per-byte con le chiavi di i18n.vocab.js):
//   slug(v) = lower → NFD → drop diacritici → [^a-z0-9]+ → "_" → trim "_"
//   strumenti  → "vocab." + slug        · famiglie → "vocab.fam_" + slug
//   livelli    → "vocab.level_" + slug  · generi   → "vocab.genre_" + slug
// I prefissi (fam_/level_/genre_) evitano collisioni tra categorie (es. famiglia "Voce"
// vs strumento "Voce", o genere/strumento omonimi).
function vocabSlug(v) {
  return String(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function vocabResolve(prefix, v) {
  const k = "vocab." + prefix + vocabSlug(v);
  const s = window.t(k);            // window.t: robusto anche se 't' è ombreggiato localmente
  return s === k ? v : s;           // nessuna chiave ⇒ valore canonico
}
const vocabLabel = (v) => vocabResolve("", v);        // strumenti (slug nudo)
const vocabFamily = (f) => vocabResolve("fam_", f);   // famiglie strumenti
const levelLabel = (l) => vocabResolve("level_", l);  // livelli
const genreLabel = (g) => vocabResolve("genre_", g);  // generi
// Tag strumento + livello per-strumento (es. "Sax · Avanzato"). Vedi levelsOf() in data.js.
const instrTags = (p) => { const m = levelsOf(p); return (p.instruments || []).map(i => `<span class="tag accent">${esc(vocabLabel(i))}${m[i] ? ` · ${esc(levelLabel(m[i]))}` : ""}</span>`).join(""); };

let _toastEl = null;
// toast(msg, icon, {error, actionLabel, onAction, duration}) — accessibile (role/aria-live) + azione opzionale (es. "Annulla").
function toast(msg, icon, opts) {
  opts = opts || {};
  if (_toastEl) { try { _toastEl.remove(); } catch (_) {} _toastEl = null; }
  const hasAction = opts.actionLabel && typeof opts.onAction === "function";
  const t = el(`<div class="toast${opts.error ? " error" : ""}" role="${opts.error ? "alert" : "status"}" aria-live="${opts.error ? "assertive" : "polite"}">${icon || ""}<span>${esc(msg)}</span>${hasAction ? `<button type="button" class="toast-action">${esc(opts.actionLabel)}</button>` : ""}</div>`);
  document.body.appendChild(t); _toastEl = t;
  const dur = opts.duration || (hasAction ? 5000 : 2200);
  const timer = setTimeout(() => { t.remove(); if (_toastEl === t) _toastEl = null; }, dur);
  if (hasAction) t.querySelector(".toast-action").onclick = () => { clearTimeout(timer); t.remove(); if (_toastEl === t) _toastEl = null; opts.onAction(); };
  return t;
}
// Feedback tattile: Capacitor Haptics (nativo) con fallback navigator.vibrate (web/PWA).
function haptic(style) {
  try {
    const C = window.Capacitor;
    if (C && C.Plugins && C.Plugins.Haptics) { C.Plugins.Haptics.impact({ style: style || "Light" }); return; }
    if (navigator.vibrate) navigator.vibrate(style === "Heavy" ? [10, 30, 14] : style === "Medium" ? 14 : 8);
  } catch (_) {}
}
// value/data-*/selected restano CANONICI; solo il testo mostrato passa dal resolver `label`
// (default vocabLabel = strumenti; per livelli/generi passa levelLabel/genreLabel). Per liste
// non-vocab (regioni, province, tipi locale, tonalità) il resolver torna il valore inalterato.
function options(list, selected, placeholder, label) {
  label = label || vocabLabel;
  let o = placeholder ? `<option value="">${esc(placeholder)}</option>` : "";
  return o + list.map(v => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(label(v))}</option>`).join("");
}
function chips(list, selected, label) {
  label = label || vocabLabel;
  return list.map(v => `<span class="chip${selected.includes(v) ? " on" : ""}" data-chip="${esc(v)}" role="button" tabindex="0" aria-pressed="${selected.includes(v)}">${esc(label(v))}</span>`).join("");
}
function toggleChip(node, arr) { const v = node.dataset.chip, i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); node.classList.toggle("on"); node.setAttribute("aria-pressed", node.classList.contains("on")); }
// Menu core condiviso tra Profilo (prefix "hub") e Drawer (prefix "drw"): unica fonte di verità
// per griglia hub + righe (Pagine/Pro/Verifica/Boost · Impostazioni/Aiuto/Segnala). Gli id restano
// distinti per prefisso così le due viste possono coesistere nel DOM con handler propri.
function hubGrid() {
  return `<div class="hub-grid">
          <button class="hub-item" data-go="palco"><span>${ic('microphone')}</span><small>${t('app.hub_palco')}</small></button>
          <button class="hub-item" data-go="lessons"><span>${ic('graduation-cap')}</span><small>${t('app.hub_lessons')}</small></button>
          <button class="hub-item" data-go="tools"><span>${ic('sliders')}</span><small>${t('app.hub_tools')}</small></button>
        </div>`;
}
function menuRows(p) {
  const m = state.me, chev = `<span class="hub-chev">${ic('chevron')}</span>`;
  return `<div class="hub-list" style="margin-top:10px">
          <button class="hub-row" id="${p}Pages"><span>${ic('building')} ${typeof pagesCount === "function" && pagesCount() ? t('app.hub_pages_one', { count: pagesCount() }) : t('app.hub_pages')}</span>${chev}</button>
          <button class="hub-row" id="${p}Pro"><span>${ic('resonance-profile', 'grad')} ${m.plan === "pro" ? t('app.hub_pro_active') : t('app.hub_pro')}</span>${chev}</button>
          <button class="hub-row" id="${p}Verify"><span>${ic('check')} ${m.verifyStatus === "verified" ? t('app.hub_verified') : (m.verifyStatus === "pending" ? t('app.hub_verify_pending') : t('app.hub_verify'))}</span>${chev}</button>
          <button class="hub-row" id="${p}Boost"><span>${ic('sparkles')} ${t('app.hub_boost')}</span>${chev}</button>
        </div>
        <div class="section-label">${t('app.hub_account_support')}</div>
        <div class="hub-list">
          <button class="hub-row" id="${p}Settings"><span>${ic('gear')} ${t('app.hub_settings')}</span>${chev}</button>
          <button class="hub-row" id="${p}Help"><span>${ic('info')} ${t('app.hub_help')}</span>${chev}</button>
          <button class="hub-row" id="${p}Report"><span>${ic('flag')} ${t('app.hub_report')}</span>${chev}</button>
        </div>`;
}
// a11y: i segmented sono a selezione SINGOLA (tab-like) → pattern radiogroup/radio + aria-checked,
// non aria-pressed (che li farebbe annunciare come toggle indipendenti). I chip restano multi-select
// (button + aria-pressed). Da chiamare dopo ogni render.
function applyToggleA11y(root) {
  root = root || document;
  root.querySelectorAll(".segmented").forEach(group => {
    if (!group.hasAttribute("role")) group.setAttribute("role", "radiogroup");
    group.querySelectorAll("button").forEach(b => {
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", b.classList.contains("on") ? "true" : "false");
    });
  });
  root.querySelectorAll(".chip[data-chip]").forEach(c => {
    if (!c.hasAttribute("role")) { c.setAttribute("role", "button"); c.setAttribute("tabindex", "0"); }
    c.setAttribute("aria-pressed", c.classList.contains("on"));
  });
}
// chip operabili da tastiera (Enter/Spazio): un solo listener delegato.
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if ((e.key === "Enter" || e.key === " ") && t && t.classList && t.classList.contains("chip") && t.hasAttribute("data-chip")) { e.preventDefault(); t.click(); }
});

// ---------- Selettore strumenti riusabile (ricerca + browse a famiglie + Proponi) ----------
// Campo a digitazione: a vuoto mostra "Recenti/Popolari" + accordion per famiglia;
// digitando filtra (con sinonimi e famiglia accanto). Se non esiste, "＋ Proponi «…»"
// lo usa subito (tag) ma lo registra come proposta in revisione (no doppioni nel catalogo).
// `selected` è mutato in place. Usato in onboarding, profilo, bacheca, band, lezioni, jam.
const POPULAR_INSTRUMENTS = ["Chitarra", "Voce", "Basso", "Batteria", "Pianoforte", "Tastiere", "Sax", "Violino", "Tromba", "Chitarra elettrica"];
function recentInstruments() { try { return JSON.parse(JM.Storage.get("jm_instr_recent") || "[]"); } catch (e) { return []; } }
function pushRecentInstrument(name) { try { let r = recentInstruments().filter(x => x !== name); r.unshift(name); JM.Storage.set("jm_instr_recent", JSON.stringify(r.slice(0, 8))); } catch (e) {} }
function proposeInstrument(name) {
  try { const k = "jm_instrument_proposals", list = JSON.parse(JM.Storage.get(k) || "[]");
    if (!list.some(x => (x.name || "").toLowerCase() === name.toLowerCase()) && !INSTRUMENTS.some(i => i.toLowerCase() === name.toLowerCase()))
      { list.push({ name, ts: Date.now(), status: "pending" }); JM.Storage.set(k, JSON.stringify(list)); }
  } catch (e) {}
}
function instrumentPicker(mount, selected, opts) {
  opts = opts || {};
  const onChange = opts.onChange || (() => {});
  const list = opts.list || INSTRUMENTS;
  const grouped = (list === INSTRUMENTS && typeof INSTRUMENT_GROUPS !== "undefined");
  mount.classList.add("ins-picker");
  mount.innerHTML = `
    <div class="ins-tags"></div>
    <div class="ins-input-wrap">
      <input type="text" class="ins-input" role="combobox" aria-expanded="false" aria-autocomplete="list" placeholder="${esc(opts.placeholder || t('app.ins_placeholder'))}" autocomplete="off">
      <div class="ins-suggest" role="listbox" hidden></div>
    </div>`;
  const tagsBox = mount.querySelector(".ins-tags");
  const input = mount.querySelector(".ins-input");
  const sugg = mount.querySelector(".ins-suggest");
  let activeIdx = -1;
  const takenSet = () => new Set(selected.map(s => s.toLowerCase()));
  const hl = (s, q) => { const i = s.toLowerCase().indexOf(q); return i < 0 ? esc(s) : esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + q.length)) + "</mark>" + esc(s.slice(i + q.length)); };
  const rows = () => [...sugg.querySelectorAll(".ins-opt")];
  const hide = () => { sugg.hidden = true; input.setAttribute("aria-expanded", "false"); activeIdx = -1; };
  const setActive = (i) => { const r = rows(); r.forEach(x => x.classList.remove("active")); if (r[i]) { r[i].classList.add("active"); r[i].scrollIntoView({ block: "nearest" }); activeIdx = i; } };
  const paintTags = () => {
    tagsBox.innerHTML = selected.map((i, idx) => `<span class="ins-tag">${esc(vocabLabel(i))}<button type="button" data-rm="${idx}" aria-label="${esc(t('app.remove_action'))}">${ic('x')}</button></span>`).join("");
    tagsBox.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { selected.splice(+b.dataset.rm, 1); paintTags(); onChange(); });
  };
  const add = (name, isProposal) => {
    name = (name || "").trim(); if (!name) return;
    if (!selected.some(s => s.toLowerCase() === name.toLowerCase())) { selected.push(name); pushRecentInstrument(name); if (isProposal) proposeInstrument(name); onChange(); }
    input.value = ""; hide(); paintTags(); input.focus();
  };
  const bind = () => {
    sugg.querySelectorAll("[data-add]").forEach(b => b.onclick = () => add(b.dataset.add));
    sugg.querySelectorAll("[data-propose]").forEach(b => b.onclick = () => add(b.dataset.propose, true));
  };
  // data-add resta CANONICO; in browse mostriamo la label localizzata, in ricerca evidenziamo
  // il match sul valore canonico (è ciò che il filtro confronta con la query digitata).
  const opt = (i, q) => { const fam = grouped ? INSTRUMENT_FAMILY[i] : ""; return `<button type="button" role="option" class="ins-opt" data-add="${esc(i)}">${q ? hl(i, q) : esc(vocabLabel(i))}${fam ? `<span class="ins-fam-tag">${esc(vocabFamily(fam))}</span>` : ""}</button>`; };
  const browse = () => {
    const taken = takenSet();
    const rec = recentInstruments().filter(i => list.includes(i) && !taken.has(i.toLowerCase())).slice(0, 6);
    const pop = POPULAR_INSTRUMENTS.filter(i => list.includes(i) && !taken.has(i.toLowerCase()) && !rec.includes(i)).slice(0, 8);
    let html = "";
    if (rec.length) html += `<div class="ins-sect">${t('app.ins_recent')}</div>` + rec.map(i => opt(i)).join("");
    if (pop.length) html += `<div class="ins-sect">${t('app.ins_popular')}</div>` + pop.map(i => opt(i)).join("");
    if (grouped) html += INSTRUMENT_GROUPS.map(g => { const items = g.items.filter(i => !taken.has(i.toLowerCase())); return items.length ? `<details class="ins-fam"><summary>${esc(vocabFamily(g.family))} <span>${items.length}</span></summary>${items.map(i => opt(i)).join("")}</details>` : ""; }).join("");
    sugg.innerHTML = html || `<div class="ins-empty">${t('app.ins_start_typing')}</div>`;
    bind(); sugg.hidden = false; input.setAttribute("aria-expanded", "true"); activeIdx = -1;
  };
  const search = () => {
    const q = input.value.trim().toLowerCase(); if (!q) return browse();
    const taken = takenSet();
    const hits = list.filter(i => i.toLowerCase().includes(q) && !taken.has(i.toLowerCase())).slice(0, 8);
    const exact = list.some(i => i.toLowerCase() === q);
    const syn = (typeof INSTRUMENT_SYNONYMS !== "undefined") ? INSTRUMENT_SYNONYMS[q] : null;
    let html = "";
    if (syn && !hits.includes(syn) && !taken.has(syn.toLowerCase())) html += `<button type="button" role="option" class="ins-opt ins-syn" data-add="${esc(syn)}">${t('app.ins_did_you_mean', { name: esc(vocabLabel(syn)) })}</button>`;
    html += hits.map(i => opt(i, q)).join("");
    if (!exact && input.value.trim().length >= 2) html += `<button type="button" role="option" class="ins-opt ins-other" data-propose="${esc(input.value.trim())}">${ic('plus')} ${t('app.ins_propose', { name: esc(input.value.trim()) })} <span class="ins-fam-tag">${t('app.ins_in_review')}</span></button>`;
    sugg.innerHTML = html || `<div class="ins-empty">${t('app.ins_no_results')}</div>`;
    bind(); sugg.hidden = false; input.setAttribute("aria-expanded", "true"); activeIdx = -1;
  };
  sugg.addEventListener("mousedown", e => e.preventDefault()); // tiene il focus sull'input (accordion/click non chiudono)
  input.oninput = search;
  input.onfocus = () => { input.value.trim() ? search() : browse(); };
  input.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (sugg.hidden) { input.value.trim() ? search() : browse(); } setActive(Math.min(activeIdx + 1, rows().length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const r = rows(); if (activeIdx >= 0 && r[activeIdx]) r[activeIdx].click(); else { const f = sugg.querySelector("[data-add],[data-propose]"); if (f) f.click(); else add(input.value, true); } }
    else if (e.key === "Escape") { hide(); }
  };
  input.onblur = () => setTimeout(hide, 180);
  paintTags();
}

// ---------- Trasposizione tonalità (strumenti traspositori) ----------
// Tonalità (nome it.) → classe d'altezza 0–11 + modo. Gestisce diesis e i
// bemolli presenti nei seed (Mib, Sib, Lab…).
const KEY_PC = { "do": 0, "do#": 1, "reb": 1, "re": 2, "re#": 3, "mib": 3, "mi": 4, "fa": 5, "fa#": 6, "solb": 6, "sol": 7, "sol#": 8, "lab": 8, "la": 9, "la#": 10, "sib": 10, "si": 11, "dob": 11 };
function keyToPc(key) {
  if (!key) return null;
  let k = String(key).trim().toLowerCase();
  const minor = k.endsWith("m");
  if (minor) k = k.slice(0, -1);
  const pc = KEY_PC[k];
  return pc == null ? null : { pc, minor };
}
function pcToKey(pc, minor) { pc = ((pc % 12) + 12) % 12; return NOTE_IT[pc] + (minor ? "m" : ""); }
// Tonalità concertistica (piano) data la scritta + i semitoni dello strumento.
function concertKey(writtenKey, semi) { const p = keyToPc(writtenKey); if (!p) return ""; return pcToKey(p.pc - (semi || 0), p.minor); }
// Tonalità di un brano del repertorio: scritte (multi/facoltative, retro-compat
// col vecchio campo singolo .key) e reali/concertistiche (trasposte).
function repWrittenKeys(r) { return (r.keys && r.keys.length) ? r.keys : (r.key ? [r.key] : []); }
function repConcertKeys(r) { return repWrittenKeys(r).map(k => concertKey(k, r.transpose || 0)).filter(Boolean); }
// Semitoni di trasposizione di default dedotti dagli strumenti dell'utente.
function defaultTransposeFor(instruments) { for (const i of (instruments || [])) { if (INSTRUMENT_TRANSPOSE[i]) return INSTRUMENT_TRANSPOSE[i]; } return 0; }
function transposeIdxForSemi(semi) { const i = TRANSPOSERS.findIndex(t => t.semi === semi); return i < 0 ? 0 : i; }
function avgScore(e) { return Math.round((e.puntualita + e.tecnica + e.attitudine) / 3); }
// Badge "jam suonate": gamification leggera sui traguardi (#7).
function jamBadge(n) {
  n = n || 0;
  if (n >= 50) return { icon: ic('sparkles'), tier: t('app.badge_legend') };
  if (n >= 25) return { icon: ic('star'), tier: t('app.badge_veteran') };
  if (n >= 10) return { icon: ic('star'), tier: t('app.badge_regular') };
  if (n >= 5)  return { icon: ic('thumbs-up'), tier: t('app.badge_launching') };
  if (n >= 1)  return { icon: ic('music-note'), tier: t('app.badge_rookie') };
  return { icon: ic('sparkles'), tier: t('app.badge_ready') };
}

// ---------- Standing di partecipazione (percentile circoscritto per città) ----------
// Niente titoli fantasy: status sobrio e LOCALE (alla Reddit-flair/LinkedIn "top X%"/
// Strava Local Legend). Calcolato dal participationScore tra i musicisti della stessa
// città; mostrato SOLO con bacino ≥ MIN e SOLO per posizioni alte (mai "sei indietro").
function participationScore(p) {
  const e = p.endo || {};
  return (p.jamCount || 0) * 10            // jam completate (verificate)
    + (e.endorsements || 0) * 4            // endorsement RICEVUTI (peer-validati)
    + (p.repertoire ? p.repertoire.length : 0) * 3
    + (p.instruments ? p.instruments.length : 0) * 3
    + (p.genres ? p.genres.length : 0)
    + (p.deep && p.deep.done ? 8 : 0);
}
const STANDING_MIN_POOL = 8;
function cityPool(city) {
  const norm = (c) => (c || "").trim().toLowerCase();
  const list = (state.profiles || []).filter(p => norm(p.city) === norm(city));
  if (state.me && norm(state.me.city) === norm(city) && !list.some(p => p === state.me)) list.push(state.me);
  return list;
}
// { tier, topPct, pool, city } oppure null se non mostrabile (bacino piccolo o sotto metà).
function cityStanding(p) {
  if (!p || !p.city) return null;
  const pool = cityPool(p.city);
  if (pool.length < STANDING_MIN_POOL) return null;          // campione troppo piccolo → niente percentile
  const myScore = participationScore(p);
  const better = pool.filter(x => participationScore(x) > myScore).length; // quanti sopra di me
  const topPct = Math.round((better / pool.length) * 100);  // sono nel "top topPct%"
  let tier;
  if (topPct <= 5) tier = t('app.standing_top');
  else if (topPct <= 20) tier = t('app.standing_very');
  else if (topPct <= 45) tier = t('app.standing_active');
  else return null;                                          // sotto la metà: nessuna posizione (mai shaming)
  return { tier, topPct, pool: pool.length, city: p.city };
}
function statusPill(s) { return `<span class="status-pill${s.topPct <= 5 ? " top" : ""}" title="${esc(t('app.standing_calc', { pool: s.pool, city: s.city }))}">${esc(t('app.standing_pill', { tier: s.tier, city: s.city }))}</span>`; }
function standingFlair(p, center) {
  if (p === state.me && state.settings && state.settings.hideStatus) return "";
  const s = cityStanding(p);
  if (!s) return "";
  return `<div class="rank-line${center ? " rl-center" : ""}">${statusPill(s)}</div>`;
}
// Riepilogo attività sul proprio profilo (trasparenza, niente XP/livelli rumorosi).
// Riassunto ruolo (capacità) per la chip glanceable nel profilo.
function roleSummary(m) {
  const c = (m && m.caps) || {}; const r = [];
  if (c.plays) r.push(t('app.role_musician')); if (c.hires) r.push(t('app.role_organizer'));
  return r.length ? r.join(" · ") : t('app.role_listener');
}
function activitySummary(m) {
  const e = m.endo || {};
  const s = (state.settings && state.settings.hideStatus) ? null : cityStanding(m);
  const parts = [];
  if (m.jamCount) parts.push(t('app.activity_jam', { count: m.jamCount }));
  if (e.endorsements) parts.push(t('app.activity_endorsement', { count: e.endorsements }));
  if ((m.repertoire || []).length) parts.push(t('app.activity_songs', { count: m.repertoire.length }));
  const insCount = (m.instruments || []).length;
  parts.push(t(insCount === 1 ? 'app.activity_instruments_one' : 'app.activity_instruments_other', { count: insCount }));
  return `${s ? `<div class="rank-line rl-center">${statusPill(s)}</div>` : ""}
    <div class="view-sub" style="font-size:.8rem">${esc(t('app.your_activity', { parts: parts.join(" · ") }))}</div>`;
}

// Avatar: foto se presente, altrimenti emoji su gradiente "mesh"
function avatarTag(o, lg) {
  const cls = "avatar" + (lg ? " lg" : "");
  const photo = o && o.photo ? safeImg(o.photo) : "";
  if (photo) return `<div class="${cls} photo" style="background-image:url(&quot;${esc(photo)}&quot;)"></div>`;
  return `<div class="${cls}" style="background:${safeColor(o && o.color)}">${esc((o && o.avatar) || "🎵")}</div>`;
}
// Scelta + compressione foto profilo (resize 256px, salvata come dataURL)
function pickPhoto() {
  const inp = el(`<input type="file" accept="image/*" style="display:none">`);
  document.body.appendChild(inp);
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) { inp.remove(); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = 256, c = document.createElement("canvas"); c.width = s; c.height = s;
        const ctx = c.getContext("2d"), r = Math.max(s / img.width, s / img.height);
        const w = img.width * r, h = img.height * r;
        ctx.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
        try { state.me.photo = c.toDataURL("image/jpeg", 0.82); if (save()) toast(t('app.photo_updated'), ic('camera')); navigate("profile"); }
        catch (e) { console.warn("JamMate: foto non elaborabile", e); toast(t('app.invalid_image'), ic('alert-triangle'), { error: true }); }
        inp.remove();
      };
      img.onerror = () => { toast(t('app.invalid_image')); inp.remove(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  inp.click();
}
function endoBlock(e) {
  return `<div class="endo">${[[t('app.endo_punctuality'), e.puntualita], [t('app.endo_technique'), e.tecnica], [t('app.endo_attitude'), e.attitudine]].map(([l, n]) => `
    <span class="lbl">${l}</span><span class="num">${n}%</span>
    <div class="bar" style="grid-column:1/-1"><i style="width:${n}%"></i></div>`).join("")}</div>`;
}
function formatDate(iso) {
  try { return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" }); }
  catch (e) { return iso; }
}

// ---------- Compatibilità (l'idea distintiva: brani in comune) ----------
function sharedGenres(p) { return (p.genres || []).filter(g => state.me.genres.includes(g)); }
function songKey(r) { return (r.title || "").trim().toLowerCase() + "|" + (r.artist || "").trim().toLowerCase(); }
function sharedSongs(p) {
  const mine = new Set((state.me.repertoire || []).map(songKey));
  return (p.repertoire || []).filter(r => mine.has(songKey(r)));
}
function compatibility(p) {
  let s = 46;
  s += sharedGenres(p).length * 9;
  s += sharedSongs(p).length * 13;
  s += Math.max(0, 15 - p.distanceKm);
  s += Math.round(avgScore(p.endo) / 12);
  if (!state.me.genres.length && !state.me.repertoire.length) s += hash(p.id) % 16;
  return Math.max(38, Math.min(99, Math.round(s)));
}

// Affinità: usa la "Sintonia" (motore affinity.js) se entrambi hanno il
// Profilo Accordato, altrimenti il punteggio base. Engine isolato in affinity.js.
function meProfile() {
  return { id: "me", name: state.me.name, instruments: state.me.instruments, genres: state.me.genres, repertoire: state.me.repertoire, deep: state.me.deep, endo: state.me.endo };
}
function getAffinity(p) {
  if (state.me.deep && state.me.deep.done && p.deep && p.deep.done && window.JamAffinity)
    return { mode: "sintonia", res: window.JamAffinity.computeAffinity(meProfile(), p) };
  return { mode: "base", score: baseScore(p) };
}
// Punteggio "base" arricchito: compatibilità + strumento complementare + jam in comune.
function complementaryInstrument(p) {
  const mine = state.me.instruments || [];
  return (p.instruments || []).some(i => !mine.includes(i));
}
function baseScore(p) {
  let s = compatibility(p);
  if (complementaryInstrument(p)) s += 6;            // ruoli complementari = band
  if (typeof hasJammedWith === "function" && hasJammedWith(p)) s += 8;
  return Math.max(38, Math.min(99, Math.round(s)));
}
// UN'UNICA metrica: il numero MOSTRATO = quello che ordina il mazzo e governa la probabilità di match.
function affinityPct(p) { const a = getAffinity(p); return a.mode === "sintonia" ? a.res.score : a.score; }
function affLabel(aff) { return aff.mode === "sintonia" ? `${ic("resonance-profile")} ${t('app.aff_sintonia', { pct: aff.res.score })}` : `${ic("resonance-profile")} ${t('app.aff_affinity', { pct: aff.score })}`; }
// Riga "perché vi trovate" con icona bespoke (testo sanificato con esc(), icona fuori da esc()).
function commonMeta(p) {
  const g = sharedGenres(p), so = sharedSongs(p);
  if (so.length) return { icon: "music-note", text: t(so.length > 1 ? 'app.songs_in_common_other' : 'app.songs_in_common_one', { count: so.length, songs: so.map(x => x.title).join(", ") }) };
  if (g.length) return { icon: "target", text: t('app.genres_in_common', { genres: g.join(", ") }) };
  return { icon: "map-pin", text: t('app.km_from_you', { km: p.distanceKm }) };
}
function affCommonHtml(aff, p) {
  if (aff.mode === "sintonia") return `${ic("resonance-profile")} ${esc(aff.res.parts[0].text)}`;
  const m = commonMeta(p); return `${ic(m.icon)} ${esc(m.text)}`;
}
// Segnali "di scena" su un profilo: aggancio reale a jam/feed/bacheca (riusa gli helper esistenti).
function sceneSignals(p) {
  const out = [];
  if (typeof hasJammedWith === "function" && hasJammedWith(p)) out.push({ icon: "match", text: t('app.already_jammed') });
  const today = (typeof todayISO === "function") ? todayISO() : "";
  const jam = (typeof allJams === "function") ? allJams().find(j => j.hostId === p.id && j.date >= today) : null;
  if (jam) out.push({ icon: "microphone", text: t('app.hosts_a_jam', { date: formatDate(jam.date) }) });
  const feed = (typeof SEED_POSTS !== "undefined") && [...(state.posts || []), ...SEED_POSTS].some(po => po.authorId === p.id);
  if (feed) out.push({ icon: "chat-bubble", text: t('app.active_in_feed') });
  const ad = (state.events || []).some(e => e.author === p.name);
  if (ad) out.push({ icon: "megaphone", text: t('app.has_board_ad') });
  return out.slice(0, 3);
}
function sceneSignalsHtml(p) {
  const s = sceneSignals(p); if (!s.length) return "";
  return `<div class="scene-signals">${s.map(x => `<span class="scene-sig">${ic(x.icon)} ${esc(x.text)}</span>`).join("")}</div>`;
}
// ---------- Fase 0: helper condivisi (Palco/Lezioni/Strumenti/Profilo/Chat) ----------
// Generi in comune fra due liste.
function genreOverlap(a, b) { return (a || []).filter(x => (b || []).includes(x)).length; }
// Chip "In risonanza" (lessico unico, identico al Feed).
function risonanzaChip(label) { return `<span class="in-ris">${ic('match')} ${esc(label || t('app.in_resonance'))}</span>`; }
// Componente stelle accessibile (sostituisce ic('star').repeat fragile). value e max sulla stessa scala.
function starsRating(value, max) {
  max = max || 5; const v = Math.max(0, Math.min(max, Math.round(value || 0)));
  let h = ""; for (let i = 1; i <= max; i++) h += `<span class="rs-star${i <= v ? " on" : ""}">${ic('star')}</span>`;
  return `<span class="rating-stars" role="img" aria-label="${esc(t('app.rating_value', { v, max }))}">${h}</span>`;
}
// Conferma brandizzata (sostituisce confirm()/prompt nativi). opts: {yes,no,danger}.
function openConfirm(title, message, opts, onYes) {
  opts = opts || {};
  openModal(`<h2 style="margin-top:0">${esc(title)}</h2>
    <p style="line-height:1.5;color:var(--muted);margin:6px 0 0">${esc(message)}</p>
    <div class="confirm-actions">
      <button class="btn secondary" id="cfNo" type="button">${esc(opts.no || t('app.cancel'))}</button>
      <button class="btn${opts.danger ? " danger" : ""}" id="cfYes" type="button">${esc(opts.yes || t('app.confirm'))}</button>
    </div>`);
  const no = $("#cfNo"), yes = $("#cfYes");
  if (no) no.onclick = () => closeModal();
  if (yes) { yes.onclick = () => { closeModal(); if (onYes) onYes(); }; setTimeout(() => { try { yes.focus(); } catch (_) {} }, 40); }
}
// Rende una card <div> azionabile da tastiera (role=button + Enter/Spazio).
function clickableCard(node, handler) {
  if (!node) return node;
  node.setAttribute("role", "button"); node.setAttribute("tabindex", "0");
  node.addEventListener("click", handler);
  node.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); } });
  return node;
}
// Validazione inline condivisa (stesso pattern dell'onboarding): messaggio sotto al campo + bordo
// rosso + focus, si pulisce alla prima modifica. Ritorna false per il guard del chiamante.
// Globale: usabile anche da social.js/gigs.js a runtime.
function markFieldError(input, msg) {
  const inp = typeof input === "string" ? $(input) : input;
  if (!inp) return false;
  inp.classList.add("input-error");
  let err = inp.nextElementSibling;
  if (!err || !err.classList || !err.classList.contains("field-err")) {
    err = document.createElement("div"); err.className = "field-err"; err.setAttribute("role", "alert");
    inp.insertAdjacentElement("afterend", err);
  }
  err.innerHTML = `${ic('alert-triangle')} ${esc(msg)}`; err.hidden = false;
  const clear = () => { inp.classList.remove("input-error"); err.hidden = true; err.textContent = ""; inp.removeEventListener("input", clear); inp.removeEventListener("change", clear); };
  inp.addEventListener("input", clear); inp.addEventListener("change", clear);
  try { inp.focus(); inp.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
  return false;
}
// --- Sintonia: localizza i descrittori {k, ...params} prodotti da affinity.js (lingua-neutro).
// I nomi-valore Schwartz e i livelli-obiettivo sono token canonici risolti qui via t(). ---
const AFF_GOAL_LEVELS = ["hobby", "hobbyplus", "balance", "semipro", "profession"];
function affValueName(key) {
  const slug = String(key || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return t("affinity.value_" + slug);
}
function affT(d) {
  if (!d || !d.k) return "";
  switch (d.k) {
    case "values_shared": return t("affinity.values_shared", { value: affValueName(d.value) });
    case "goal_same": return t("affinity.goal_same", { level: t("affinity.goal_" + (AFF_GOAL_LEVELS[d.level] || "balance")) });
    case "taste_songs": {
      const base = t(d.count > 1 ? "affinity.taste_songs_other" : "affinity.taste_songs_one", { count: d.count, songs: d.songs });
      return base + (d.keyShared ? t("affinity.taste_key", { n: d.keyShared }) : "");
    }
    case "taste_genres": return t("affinity.taste_genres", { genres: d.genres });
    case "insight_valore": return t("affinity.insight_valore", { value: affValueName(d.value) });
    case "insight_ruolo": return t("affinity.insight_ruolo", { leader: d.who === "you" ? t("affinity.role_you") : t("affinity.role_other", { name: d.name }) });
    case "insight_brano": return t("affinity.insight_brano", { song: d.song });
    case "insight_genere": return t("affinity.insight_genere", { genres: d.genres });
    default: return t("affinity." + d.k); // descrittori senza parametri (compatible/different/few/warn_*/…)
  }
}
function affHeaderHtml(aff) {
  return aff.mode === "sintonia"
    ? `<div class="aff-reveal"><div class="aff-score" style="margin-top:6px">${t('app.aff_sintonia', { pct: aff.res.score })}</div>
       <svg class="aff-wave" viewBox="0 0 140 30" aria-hidden="true"><path pathLength="240" d="M3 15 C 12 3, 23 3, 33 15 S 54 27, 64 15 S 85 3, 95 15 S 116 27, 126 15 S 134 11, 138 15"/></svg></div>`
    : `<div style="margin-top:6px;font-weight:800;color:var(--accent);display:inline-flex;align-items:center;gap:5px">${ic("resonance-profile")} ${t("affinity.base_affinity", { pct: aff.score })}</div>`;
}
function affDetailHtml(aff) {
  if (aff.mode !== "sintonia")
    return `<div class="aff-note">${ic("resonance-profile")} ${t("affinity.no_profile")}</div>`;
  const r = aff.res;
  const insight = r.insight ? `<div class="insight"><span class="insight-emoji">${ic('sparkles')}</span><div style="flex:1">
      <b>${t("affinity.insight_title")}</b><br>${esc(affT(r.insight))}
      <div class="resonate">${t("affinity.resonate_q")} <button data-resonate="1">${ic("thumbs-up")} ${t("affinity.yes")}</button><button data-resonate="0">${ic("face-neutral")} ${t("affinity.no")}</button></div>
    </div></div>` : "";
  const bars = r.parts.slice(0, 5).map(p => `
    <span class="lbl">${esc(t("affinity.part_" + p.key))}</span><span class="num">${p.pct}%</span>
    <div class="bar" style="grid-column:1/-1"><i style="width:${p.pct}%"></i></div>`).join("");
  const reasons = r.parts.slice(0, 3).map(p => `• ${esc(affT(p.t))}`).join("<br>");
  const warn = r.warn.map(w => `<div class="warn-chip">${ic('alert-triangle')} ${esc(affT(w))}</div>`).join("");
  return `${insight}
    <div class="section-label">${t("affinity.why_match", { depth: t("affinity.depth_" + r.depth) })}</div>
    <div class="endo">${bars}</div>
    <div class="aff-note">${reasons}</div>
    ${warn}
    <div class="aff-note">${t("affinity.disclaimer")}</div>`;
}
function jmResonate(v, btn) {
  const box = btn.parentElement;
  box.innerHTML = v ? t("affinity.resonate_yes") : t("affinity.resonate_no");
}

// ---------- Router ----------
let currentView = "discover";
const VIEW_NAMES = { discover: t('app.view_discover'), feed: "Feed", board: t('app.view_board'), palco: t('app.view_palco'), profile: t('app.view_profile'), lessons: t('app.view_lessons'), tools: t('app.view_tools'), messages: t('app.view_chat') };
const VIEW_PARENT = { palco: "profile", lessons: "profile", tools: "profile" }; // viste-hub → tab "genitore"
let viewScroll = {}; // scroll memorizzato per vista (ripristino al ritorno)
// --- Integrazione history/back-button (browser + gesto Android): vedi initBackButton() in fondo ---
let _histReady = false;    // base state impostato (dopo il primo navigate)
let _navFromPop = false;   // navigate guidato da popstate → non ri-pushare
let _modalPushed = false;  // un modale ha messo una entry in history
let _popClosing = false;   // popstate sta chiudendo un modale (closeModal non deve ri-back())
let _modalBackPop = false; // la history.back() di closeModal va ignorata dal popstate
function navigate(view) {
  if (currentView && currentView !== view) viewScroll[currentView] = window.scrollY || 0; // salva lo scroll uscente
  stopMetronome(); stopTuner();
  currentView = view;
  if (view === "messages") updateChatDot();
  const parent = VIEW_PARENT[view];
  document.querySelectorAll(".tab").forEach(t => {
    const active = t.dataset.view === view;
    t.classList.toggle("active", active);
    const isParent = !active && parent === t.dataset.view;
    t.classList.toggle("parent-active", isParent); // "sei qui" attenuato sulle viste-hub
    if (active) t.setAttribute("aria-current", "page");
    else if (isParent) t.setAttribute("aria-current", "location");
    else t.removeAttribute("aria-current");
  });
  const tb = document.getElementById("tabbar"); if (tb) tb.classList.remove("nav-shrink"); // barra piena al cambio vista
  const hd = document.querySelector(".app-header"); if (hd) hd.classList.remove("header-shrink", "header-hidden"); // header pieno e visibile al cambio vista
  render();
  const app = $("#app"); if (app) { app.classList.remove("view-enter"); void app.offsetWidth; app.classList.add("view-enter"); } // transizione d'ingresso
  requestAnimationFrame(() => { try { window.scrollTo(0, viewScroll[view] || 0); } catch (_) {} }); // ripristina lo scroll della vista
  // Annuncio cambio-vista: UNA sola fonte = focus sul titolo (ruolo heading), niente doppione live-region.
  setTimeout(() => { const t = document.querySelector("#app .view-title"); if (t) { try { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); } catch (_) {} } }, 30);
  // History: ogni navigazione utente diventa una entry (il tasto Indietro torna alla vista precedente).
  if (_histReady && !_navFromPop) {
    const s = history.state;
    if (!(s && s.kind === "view" && s.view === view)) { try { history.pushState({ jm: true, kind: "view", view }, ""); } catch (_) {} }
  }
}
function render() {
  const app = $("#app"); app.innerHTML = "";
  updateChatDot(); updateBell(); updateMeBtn();
  document.body.classList.toggle("onboarding", !state.onboarded); // nasconde la tabbar durante l'onboarding
  const ha = document.querySelector(".header-actions"); if (ha) ha.hidden = !state.onboarded;
  if (!state.onboarded) { renderOnboarding(app); applyToggleA11y(app); return; }
  ({ discover: renderDiscover, feed: window.renderFeed, board: renderBoard, palco: window.renderPalco, lessons: window.renderLessons, messages: renderMessages, tools: renderTools, profile: renderProfile }[currentView] || renderDiscover)(app);
  applyToggleA11y(app);
}
function updateChatDot() {
  const n = (typeof totalUnread === "function") ? totalUnread() : 0;
  const d = $("#chatDot"); if (d) { d.hidden = n === 0; d.setAttribute("aria-hidden", "true"); }
  const tab = document.querySelector('.tab[data-view="messages"]');
  if (tab) tab.setAttribute("aria-label", n > 0 ? t(n === 1 ? 'app.chat_unread_one' : 'app.chat_unread_other', { count: n }) : t('app.chat_label'));
}
function updateBell() {
  const d = $("#bellDot"); if (!d) return;
  const unread = (state.notifications || []).filter(n => !n.read).length;
  d.hidden = unread === 0; d.dataset.count = unread > 9 ? "9+" : String(unread); d.setAttribute("aria-hidden", "true");
  const b = $("#bellBtn"); if (b) b.setAttribute("aria-label", unread > 0 ? t(unread === 1 ? 'app.notif_unread_one' : 'app.notif_unread_other', { count: unread }) : t('app.notifications'));
}

// ---------- Onboarding ----------
// Bozza parziale: se l'utente esce a metà, ritrova i campi compilati al rientro.
const OB_DRAFT_KEY = "jammate_ob_draft";
function loadObDraft() { try { return JSON.parse(localStorage.getItem(OB_DRAFT_KEY)) || {}; } catch (_) { return {}; } }
function saveObDraft(d) { try { localStorage.setItem(OB_DRAFT_KEY, JSON.stringify(d)); } catch (_) {} }
function clearObDraft() { try { localStorage.removeItem(OB_DRAFT_KEY); } catch (_) {} }

function renderOnboarding(app) {
  const draft = loadObDraft();
  const selIns = Array.isArray(draft.ins) ? draft.ins.slice() : [];
  const selGen = Array.isArray(draft.gen) ? draft.gen.slice() : [];
  const selLevels = (draft.levels && typeof draft.levels === "object") ? Object.assign({}, draft.levels) : {};
  const caps = { plays: draft.caps ? !!draft.caps.plays : true, hires: draft.caps ? !!draft.caps.hires : false };
  app.appendChild(el(`
    <div>
      <div class="ob-hero">
        <svg class="ob-mark" viewBox="4 4 56 56" width="76" height="76" aria-hidden="true"><defs><linearGradient id="obLogoGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset="1" stop-color="#ff5c9d"/></linearGradient></defs><rect x="8" y="9" width="48" height="34" rx="14" fill="url(#obLogoGrad)"/><rect x="35.4" y="42" width="5.2" height="13" rx="2.6" fill="url(#obLogoGrad)"/><g fill="#0e0f1a"><rect x="16" y="29" width="4" height="7" rx="2"/><rect x="23" y="25" width="4" height="11" rx="2"/><rect x="30" y="20" width="4" height="16" rx="2"/><rect x="36" y="14" width="4" height="29" rx="2"/><rect x="44" y="23" width="4" height="13" rx="2"/></g></svg>
        <h1 class="ob-title">${t('app.ob_welcome')}</h1>
        <p class="view-sub">${t('app.ob_intro')}</p>
      </div>
      <div class="ob-steps">
        <div class="ob-step">${spot('trova')}<small>${t('app.ob_step_find')}</small></div>
        <div class="ob-step">${spot('sintonia')}<small>${t('app.ob_step_sintonia')}</small></div>
        <div class="ob-step">${spot('suonate')}<small>${t('app.ob_step_play')}</small></div>
      </div>
      <div class="card flat">
        <div class="ob-progress">
          <div class="ob-progress-head"><b>${t('app.ob_your_profile')}</b><span id="obProgPct">0%</span></div>
          <div class="ob-progress-bar" role="progressbar" aria-label="${esc(t('app.ob_profile_completion'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="obProgBar"><i id="obProgFill"></i></div>
        </div>
        <label class="field" for="obName">${t('app.ob_name_label')}</label>
        <input type="text" id="obName" placeholder="${esc(t('app.ob_name_ph'))}" value="${esc(draft.name || "")}" aria-describedby="obNameErr" />
        <div class="field-err" id="obNameErr" role="alert" hidden></div>
        <label class="field" style="margin-top:12px" for="obCity">${t('app.ob_city_label')}</label>
        <input type="text" id="obCity" value="${esc(draft.city || "Milano")}" placeholder="${esc(t('app.ob_city_ph'))}" />
        <label class="field" style="margin-top:12px">${t('app.ob_what_to_do')}</label>
        <div class="chips" id="obCaps">
          <span class="chip${caps.plays ? " on" : ""}" data-cap="plays" role="button" tabindex="0" aria-pressed="${caps.plays}">${t('app.ob_cap_plays')}</span>
          <span class="chip${caps.hires ? " on" : ""}" data-cap="hires" role="button" tabindex="0" aria-pressed="${caps.hires}">${t('app.ob_cap_hires')}</span>
        </div>
        <p class="view-sub" style="font-size:.78rem;margin:4px 0 0">${t('app.ob_listener_note')}</p>
        <div id="obMusicianFields"${caps.plays ? "" : " hidden"}>
          <label class="field" style="margin-top:12px">${t('app.ob_instruments_label')}</label>
          <div id="obInstruments"></div>
          <label class="field" style="margin-top:12px">${t('app.ob_level_label')}</label>
          <div id="obLevels"><p class="view-sub">${t('app.ob_pick_instrument_hint')}</p></div>
          <label class="field" style="margin-top:12px">${t('app.ob_genres_label')}</label>
          <div class="chips" id="obGenres">${chips(GENRES, selGen, genreLabel)}</div>
        </div>
        <button class="btn" id="obDone" style="margin-top:18px">${t('app.ob_create_profile')}</button>
      </div>
    </div>`));
  // Avanzamento: nome + almeno uno strumento + almeno un genere (pesi che sommano a 100).
  const updateProgress = () => {
    const hasName = !!$("#obName").value.trim();
    // Musicista: nome+strumenti+generi. Ascoltatore/booker: basta il nome (profilo leggero).
    const pct = caps.plays ? ((hasName ? 45 : 0) + (selIns.length ? 35 : 0) + (selGen.length ? 20 : 0)) : (hasName ? 100 : 0);
    $("#obProgFill").style.width = pct + "%";
    $("#obProgPct").textContent = pct + "%";
    const bar = $("#obProgBar"); if (bar) bar.setAttribute("aria-valuenow", String(pct));
  };
  // Salva la bozza ad ogni modifica + aggiorna l'avanzamento.
  const persist = () => {
    saveObDraft({ name: $("#obName").value, city: $("#obCity").value, ins: selIns, levels: selLevels, gen: selGen, caps });
    updateProgress();
  };
  // Capacità (multi-selezione): mostra i campi da musicista solo a chi "suona".
  const refreshCaps = () => {
    app.querySelectorAll("#obCaps .chip").forEach(c => { const on = !!caps[c.dataset.cap]; c.classList.toggle("on", on); c.setAttribute("aria-pressed", on ? "true" : "false"); });
    const mf = $("#obMusicianFields"); if (mf) mf.hidden = !caps.plays;
  };
  app.querySelectorAll("#obCaps .chip").forEach(c => {
    c.onclick = () => { caps[c.dataset.cap] = !caps[c.dataset.cap]; refreshCaps(); persist(); };
    c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); } };
  });
  const clearNameError = () => { const e = $("#obNameErr"); if (e) { e.hidden = true; e.textContent = ""; } $("#obName").classList.remove("input-error"); };
  // Una riga "strumento → livello" per ogni strumento scelto (default Intermedio).
  const paintObLevels = () => {
    const box = $("#obLevels");
    if (!selIns.length) { box.innerHTML = `<p class="view-sub">${t('app.ob_pick_instrument_hint')}</p>`; return; }
    box.innerHTML = "";
    selIns.forEach(inst => {
      if (!selLevels[inst]) selLevels[inst] = LEVELS[2];
      const row = el(`<div class="lvl-row"><span class="lvl-inst">${esc(vocabLabel(inst))}</span><select>${options(LEVELS, selLevels[inst], null, levelLabel)}</select></div>`);
      row.querySelector("select").onchange = e => { selLevels[inst] = e.target.value; persist(); };
      box.appendChild(row);
    });
  };
  // Città: si svuota al primo clic così non devi cancellare "Milano".
  const cityIn = $("#obCity");
  cityIn.addEventListener("focus", () => { if (cityIn.value === "Milano") cityIn.value = ""; });
  cityIn.addEventListener("input", persist);
  $("#obName").addEventListener("input", () => { clearNameError(); persist(); });
  // Strumenti: campo a ricerca con tag + "Altro" (al posto dei chip fissi). Pre-carica gli strumenti della bozza.
  instrumentPicker($("#obInstruments"), selIns, { onChange: () => { paintObLevels(); persist(); }, placeholder: t('app.ob_search_instrument_ph') });
  paintObLevels();
  app.querySelectorAll("#obGenres .chip").forEach(c => c.onclick = () => { toggleChip(c, selGen); persist(); });
  updateProgress();
  $("#obDone").onclick = () => {
    const name = $("#obName").value.trim();
    if (!name) { // validazione inline (non solo toast): messaggio sotto al campo + focus
      const e = $("#obNameErr"); e.innerHTML = `${ic('alert-triangle')} ${t('app.ob_name_required')}`; e.hidden = false;
      const inp = $("#obName"); inp.classList.add("input-error");
      try { inp.focus(); inp.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      return;
    }
    const levels = Object.fromEntries(selIns.map(i => [i, selLevels[i] || LEVELS[2]]));
    Object.assign(state.me, {
      name, city: $("#obCity").value.trim() || "Milano",
      avatar: ["🎸", "🎤", "🥁", "🎹", "🎻", "🎷"][Math.floor(Math.random() * 6)],
      color: GRADS[Math.floor(Math.random() * GRADS.length)],
      instruments: selIns, levels, genres: selGen,
      caps: { plays: caps.plays, hires: caps.hires }
    });
    state.me.level = topLevel(state.me);
    // Ha appena visto lo step "Cosa vuoi fare?" + il flusso: niente auto-guida (resta in Profilo › Aiuto).
    state.onboarded = true; state.guide.seen = true; state.guide.v = GUIDE_VERSION;
    save(); clearObDraft();
    toast(t('app.ob_profile_created'), ic('music-note'));
    navigate("profile");
  };
}

// ---------- Vista: Scopri ----------
function renderDiscover(app) {
  app.appendChild(el(`
    <div>
      <h1 class="view-title">${t('app.disc_title')}</h1>
      <p class="view-sub">${t('app.disc_sub')}</p>
      <div class="segmented">
        <button data-mode="match" class="${state.ui.discoverMode === "match" ? "on" : ""}">${ic("match")} ${t('app.disc_match')}</button>
        <button data-mode="search" class="${state.ui.discoverMode === "search" ? "on" : ""}">${ic('search')} ${t('app.disc_search_filters')}</button>
      </div>
      <div id="discBody"></div>
    </div>`));
  app.querySelectorAll(".segmented button").forEach(b => b.onclick = () => {
    state.ui.discoverMode = b.dataset.mode; save(); renderDiscover2();
  });
  // Il Match (Sintonia col TUO profilo) è per chi suona; "Cerca" resta utile a fan/chi ingaggia.
  if (state.ui.discoverMode === "match") {
    if (state.me.caps && state.me.caps.plays === false) renderPlaysPrompt($("#discBody"));
    else renderSwipe($("#discBody"));
  } else renderSearch($("#discBody"));
}
function renderPlaysPrompt(box) {
  box.appendChild(el(`<div class="card" style="text-align:center;padding:24px">
    <div class="name" style="justify-content:center">${ic('match')} ${t('app.disc_match_is_for_players')}</div>
    <p class="view-sub">${t('app.disc_match_explain')}</p>
    <div class="disc-empty-actions">
      <button class="btn small" id="ppPlays" type="button">${ic('music-note')} ${t('app.disc_enable_play')}</button>
      <button class="btn small secondary" id="ppSearch" type="button">${ic('search')} ${t('app.disc_search_filters')}</button>
    </div>
  </div>`));
  if ($("#ppPlays")) $("#ppPlays").onclick = () => { state.me.caps.plays = true; save(); renderDiscover2(); toast(t('app.disc_musician_active'), ic('check', 'ok')); };
  if ($("#ppSearch")) $("#ppSearch").onclick = () => { state.ui.discoverMode = "search"; save(); renderDiscover2(); };
}

// Mazzo "curato": esclude liked/passed/match, applica i filtri, ORDINA per affinità (la coda migliore in cima).
// Predicato filtri condiviso (strumento/livello/genere/distanza): unica fonte per Scopri e Cerca.
function matchesFilters(p, f) {
  return (!f.instrument || (p.instruments || []).includes(f.instrument)) &&
    (!f.level || levelRank(topLevel(p)) >= levelRank(f.level)) &&
    (!f.genre || (p.genres || []).includes(f.genre)) &&
    (p.distanceKm <= f.distance);
}
// Ordina una lista di profili per Sintonia/affinità decrescente (logica condivisa).
function rankByAffinity(list) {
  return list.map(p => ({ p, s: affinityPct(p) })).sort((a, b) => b.s - a.s).map(x => x.p);
}
function getDeck() {
  const f = state.filters;
  return rankByAffinity(state.profiles.filter(p =>
    !state.liked.includes(p.id) && !state.passed.includes(p.id) && !state.matches.includes(p.id) &&
    matchesFilters(p, f)
  ));
}

let decideLock = false;
// Re-render del solo corpo Scopri (niente più wipe dell'intera vista a ogni swipe).
function refreshSwipe() {
  const b = $("#discBody"); if (!b) return;
  b.innerHTML = ""; renderSwipe(b);
  if (typeof applyToggleA11y === "function") applyToggleA11y(b);
}

function renderSwipe(box) {
  decideLock = false;
  box.appendChild(discoverFilters());
  const deck = getDeck();
  if (!deck.length) {
    const f = state.filters;
    const activeFilters = [f.instrument, f.level, f.genre].filter(Boolean).length + (f.distance < DIST_MAX ? 1 : 0);
    const pendingLikes = (state.liked || []).filter(id => !state.matches.includes(id) && !state.passed.includes(id));
    const adCount = (state.events || []).filter(e => typeof evMatchesMe === "function" && evMatchesMe(e) && (typeof evIsExpired !== "function" || !evIsExpired(e))).length;
    box.appendChild(el(`<div class="empty disc-empty">${spot("suonate")}<div>${activeFilters ? t('app.disc_seen_all_filtered') : t('app.disc_seen_all')}</div></div>`));
    // 1 azione primaria + max 2 secondarie (niente muro di bottoni)
    const acts = [];
    if (activeFilters) acts.push({ label: `${ic('sliders')} ${t('app.disc_widen_filters')}`, on: () => { state.filters = { instrument: "", level: "", genre: "", distance: DIST_MAX }; save(); renderDiscover2(); } });
    acts.push({ label: `${ic('refresh')} ${t('app.disc_review_passed')}`, on: () => { state.passed = []; save(); renderDiscover2(); } });
    if (!(state.me.deep && state.me.deep.done)) acts.push({ label: `${ic('resonance-profile')} ${t('app.disc_unlock_sintonia')}`, on: () => navigate("profile") });
    if (adCount) acts.push({ label: `${ic('megaphone')} ${t('app.disc_ads_in_board', { count: adCount })}`, on: () => navigate("board") });
    if (pendingLikes.length) acts.push({ label: `${ic('heart')} ${t('app.disc_review_likes', { count: pendingLikes.length })}`, on: () => { state.liked = (state.liked || []).filter(id => !pendingLikes.includes(id)); save(); renderDiscover2(); } });
    const wrap = el(`<div class="disc-empty-actions"></div>`);
    acts.slice(0, 3).forEach((a, i) => { const b = el(`<button class="btn ${i === 0 ? "" : "secondary "}small" type="button">${a.label}</button>`); b.onclick = a.on; wrap.appendChild(b); });
    box.appendChild(wrap);
    return;
  }
  // Nudge cold-start: spinge al Profilo Accordato per sbloccare la Sintonia (asset-firma).
  if (!(state.me.deep && state.me.deep.done)) {
    const nudge = el(`<div class="disc-nudge">${ic('resonance-profile', 'accent')}<span>${t('app.disc_nudge')}</span><button class="btn small" id="discNudge" type="button">${ic('sparkles')} ${t('app.disc_activate')}</button></div>`);
    nudge.querySelector("#discNudge").onclick = () => navigate("profile");
    box.appendChild(nudge);
  }
  const wrap = el(`<div><div class="deck" id="deck"></div>
    <div class="deck-undo"><button class="btn secondary small" id="btnUndo" type="button"${state.ui.lastSwipe ? "" : " disabled"}>${ic('refresh')} ${t('app.disc_undo_last')}</button></div>
    <div class="deck-actions">
      <button class="round-btn pass" id="btnPass" aria-label="${esc(t('app.disc_pass'))}" title="${esc(t('app.disc_pass'))}">${ic('x')}</button>
      <button class="round-btn info" id="btnInfo" aria-label="${esc(t('app.disc_see_details'))}" title="${esc(t('app.disc_details'))}">${ic('info')}</button>
      <button class="round-btn like" id="btnLike" aria-label="${esc(t('app.disc_connect'))}" title="${esc(t('app.disc_connect'))}">${ic('heart')}</button>
    </div></div>`);
  box.appendChild(wrap);
  const deckEl = $("#deck");
  if (deck[1]) { const under = swipeCard(deck[1], false); under.classList.add("peek"); under.setAttribute("aria-hidden", "true"); deckEl.appendChild(under); }
  const top = deck[0];
  deckEl.appendChild(swipeCard(top, true));
  $("#btnPass").onclick = () => decide(top, "pass");
  $("#btnLike").onclick = () => decide(top, "like");
  $("#btnInfo").onclick = () => openProfileSheet(top);
  if ($("#btnUndo")) $("#btnUndo").onclick = () => undoLastSwipe();
}
function renderDiscover2() { const y = window.scrollY || 0; $("#app").innerHTML = ""; renderDiscover($("#app")); applyToggleA11y($("#app")); requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (_) {} }); }

// Filtri inline sulla pagina del Match: barra a comparsa che affina il mazzo restando sulla schermata.
function discoverFilters() {
  const f = state.filters;
  const active = [f.instrument, f.level, f.genre].filter(Boolean).length + (f.distance < DIST_MAX ? 1 : 0);
  const open = !!state.ui.discoverFiltersOpen;
  const wrap = el(`<div class="disc-filters">
    <button class="btn secondary small disc-filters-toggle" style="width:100%" aria-expanded="${open ? "true" : "false"}" aria-controls="discFiltersBody">${ic('sliders')} ${active ? t('app.disc_filters_active', { count: active }) : t('app.disc_filters')} <span class="df-chev" aria-hidden="true">${ic(open ? 'arrow-up' : 'arrow-down')}</span></button>
    <div class="disc-filters-body" id="discFiltersBody"${open ? "" : " hidden"}>
      <div class="filters">
        <div class="filter-row">
          <div><label class="field">${t('app.filter_instrument')}</label><select id="dfIns" aria-label="${esc(t('app.filter_instrument'))}">${options(INSTRUMENTS, f.instrument, t('app.filter_all'))}</select></div>
          <div><label class="field">${t('app.filter_level')}</label><select id="dfLvl" aria-label="${esc(t('app.filter_level'))}">${options(LEVELS, f.level, t('app.filter_all'), levelLabel)}</select></div>
        </div>
        <div class="filter-row">
          <div><label class="field">${t('app.filter_genre')}</label><select id="dfGen" aria-label="${esc(t('app.filter_genre'))}">${options(GENRES, f.genre, t('app.filter_all'), genreLabel)}</select></div>
          <div><label class="field">${t('app.filter_distance_label', { value: `<span class="range-val" id="dfDistVal">${distLabel(f.distance)}</span>` })}</label><input type="range" id="dfDist" min="0" max="${DIST_STEPS.length - 1}" step="1" value="${distIndex(f.distance)}" aria-label="${esc(t('app.filter_max_distance'))}" aria-valuetext="${esc(distLabel(f.distance))}"></div>
        </div>
      </div>
      <button class="btn secondary small" id="dfClear">${t('app.filter_clear')}</button>
    </div>
  </div>`);
  wrap.querySelector(".disc-filters-toggle").onclick = () => { state.ui.discoverFiltersOpen = !state.ui.discoverFiltersOpen; save(); renderDiscover2(); };
  if (open) {
    wrap.querySelector("#dfIns").onchange = e => { f.instrument = e.target.value; save(); renderDiscover2(); };
    wrap.querySelector("#dfLvl").onchange = e => { f.level = e.target.value; save(); renderDiscover2(); };
    wrap.querySelector("#dfGen").onchange = e => { f.genre = e.target.value; save(); renderDiscover2(); };
    const dist = wrap.querySelector("#dfDist");
    dist.oninput = e => { const lbl = distLabel(DIST_STEPS[+e.target.value]); wrap.querySelector("#dfDistVal").textContent = lbl; e.target.setAttribute("aria-valuetext", lbl); };
    dist.onchange = e => { f.distance = DIST_STEPS[+e.target.value]; save(); renderDiscover2(); };
    wrap.querySelector("#dfClear").onclick = () => { state.filters = { instrument: "", level: "", genre: "", distance: DIST_MAX }; save(); renderDiscover2(); };
  }
  return wrap;
}

function swipeCard(p, isTop) {
  const aff = getAffinity(p);
  const featured = isTop && (aff.mode === "sintonia" ? aff.res.score : aff.score) >= 75;
  const miniWave = aff.mode === "sintonia"
    ? `<svg class="aff-wave mini" viewBox="0 0 140 24" aria-hidden="true"><path pathLength="240" d="M3 12 C 12 3, 23 3, 33 12 S 54 21, 64 12 S 85 3, 95 12 S 116 21, 126 12 S 134 9, 138 12"/></svg>` : "";
  const card = el(`
    <div class="swipe-card" data-id="${p.id}">
      <div class="stamp like">${t('app.stamp_jam')}</div>
      <div class="stamp nope">${t('app.stamp_no')}</div>
      <div class="hero" style="background:${safeColor(p.color)}">
        ${featured ? `<div class="feat-badge">${ic('sparkles')} ${t('app.card_featured')}</div>` : ""}
        <div class="big-emoji">${esc(p.avatar)}</div>
        <div class="compat">${affLabel(aff)}${miniWave}</div>
      </div>
      <div class="body">
        <div class="name">${esc(p.name)} <span class="score">${ic('star')} ${avgScore(p.endo)}</span></div>
        ${standingFlair(p)}
        <div class="loc">${ic('map-pin')} ${esc(p.city)} · ${p.distanceKm} km · ${esc(levelLabel(topLevel(p)))}</div>
        <div class="tagline">“${esc(p.tagline || "")}”</div>
        ${sceneSignalsHtml(p)}
        <div class="tags">
          ${instrTags(p)}
          ${p.genres.map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}
        </div>
        <div class="common">${affCommonHtml(aff, p)}</div>
      </div>
    </div>`);
  attachDrag(card, p);
  return card;
}

// Drag swipe "scroll-safe": cattura il puntatore SOLO quando il gesto è orizzontale (niente blocco dello scroll verticale del body).
function attachDrag(card, p) {
  let startX = 0, startY = 0, dx = 0, dragging = false, captured = false;
  const like = card.querySelector(".stamp.like"), nope = card.querySelector(".stamp.nope");
  const down = (e) => { startX = e.clientX; startY = e.clientY; dx = 0; dragging = true; captured = false; card.style.transition = "none"; };
  const move = (e) => {
    if (!dragging) return;
    dx = e.clientX - startX; const dy = e.clientY - startY;
    if (!captured) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { dragging = false; return; } // scroll verticale: lascia stare
      if (Math.abs(dx) < 8) return;                                                       // ancora indeciso
      captured = true; card.setPointerCapture && card.setPointerCapture(e.pointerId);
    }
    card.style.transform = `translate(${dx}px, ${dy * 0.2}px) rotate(${dx / 18}deg)`;
    like.style.opacity = dx > 0 ? Math.min(1, dx / 90) : 0;
    nope.style.opacity = dx < 0 ? Math.min(1, -dx / 90) : 0;
  };
  const up = () => {
    if (!dragging) return; dragging = false; card.style.transition = "transform .3s ease";
    if (dx > 120) { haptic("Medium"); return flyOut(card, 1, () => decide(p, "like", true)); }
    if (dx < -120) { haptic("Medium"); return flyOut(card, -1, () => decide(p, "pass", true)); }
    card.style.transform = ""; like.style.opacity = 0; nope.style.opacity = 0; dx = 0;
  };
  card.addEventListener("pointerdown", down);
  card.addEventListener("pointermove", move);
  card.addEventListener("pointerup", up);
  card.addEventListener("pointercancel", up);
}
function flyOut(card, dir, done) {
  card.style.transition = "transform .35s ease, opacity .35s ease";
  card.style.transform = `translate(${dir * 700}px, -40px) rotate(${dir * 30}deg)`;
  card.style.opacity = "0";
  setTimeout(done, 340);
}

function decide(p, action, skipAnim) {
  if (decideLock) return; decideLock = true;
  if (isProductionRuntime()) {
    const decision = action === "like" ? "liked" : "passed";
    const list = decision === "liked" ? state.liked : state.passed;
    if (!list.includes(p.id)) list.push(p.id);
    state.ui.lastSwipe = { id: p.id, action };
    save();
    JM.Api.swipe(p.id, decision).then((result) => {
      if (result.matched && !state.matches.includes(p.id)) {
        state.matches.push(p.id);
        state.ui.lastSwipe = null;
        save();
        notify("match", t('app.new_match_notif', { name: p.name.split(" ")[0] }), { view: "messages" });
        showMatch(p);
      } else if (decision === "liked") {
        toast(t('app.interest_sent', { name: p.name.split(" ")[0] }), ic("heart", "accent"));
      }
    }).catch((error) => {
      state.liked = state.liked.filter((id) => id !== p.id);
      state.passed = state.passed.filter((id) => id !== p.id);
      save();
      toast(error.message || "Richiesta non riuscita", ic("alert-triangle"), { error: true });
    });
    if (!skipAnim) {
      const card = $(".swipe-card:not(.peek)");
      if (card) return flyOut(card, action === "like" ? 1 : -1, () => refreshSwipe());
    }
    refreshSwipe();
    return;
  }
  if (action === "like") {
    if (!state.liked.includes(p.id)) state.liked.push(p.id);
    const matched = Math.random() < (0.30 + affinityPct(p) / 160);
    if (matched && !state.matches.includes(p.id)) {
      state.matches.push(p.id);
      if (!state.messages[p.id] || !state.messages[p.id].length) { state.messages[p.id] = []; pushMsg(p.id, { from: "them", text: opener(p) }); }
      state.ui.unread = true; state.ui.lastSwipe = null; save();
      notify("match", t('app.new_match_notif', { name: p.name.split(" ")[0] }), { view: "messages" });
      if (!skipAnim) { const card = $(".swipe-card:not(.peek)"); if (card) { return flyOut(card, 1, () => showMatch(p)); } }
      showMatch(p); return;
    }
    if (!matched) toast(t('app.interest_sent', { name: p.name.split(" ")[0] }), ic("heart", "accent"));
    state.ui.lastSwipe = { id: p.id, action: "like" };
  } else {
    if (!state.passed.includes(p.id)) state.passed.push(p.id);
    state.ui.lastSwipe = { id: p.id, action: "pass" };
  }
  save();
  if (!skipAnim) {
    const card = $(".swipe-card:not(.peek)");
    if (card) return flyOut(card, action === "like" ? 1 : -1, () => refreshSwipe());
  }
  refreshSwipe();
}
// Annulla l'ultimo swipe (pass o like-senza-match): rimette il profilo in cima al mazzo.
function undoLastSwipe() {
  const ls = state.ui.lastSwipe; if (!ls) return;
  state.liked = (state.liked || []).filter(id => id !== ls.id);
  state.passed = (state.passed || []).filter(id => id !== ls.id);
  state.ui.lastSwipe = null; save(); haptic("Light"); refreshSwipe();
}
function opener(p) {
  const ins = (p.instruments && p.instruments[0]) ? p.instruments[0].toLowerCase() : t('app.opener_default_instrument');
  const lines = [
    t('app.opener_1', { instrument: ins }),
    t('app.opener_2'),
    t('app.opener_3')
  ];
  return lines[hash(p.id) % lines.length];
}

function showMatch(p) {
  const theirName = esc(p.name.split(" ")[0]);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ov = el(`
    <div class="match-overlay" role="dialog" aria-modal="true" aria-label="${esc(t('app.match_overlay_label'))}">
      <div class="match-stage">
        <canvas class="match-wave" aria-hidden="true"></canvas>
        <div class="match-ring" aria-hidden="true"></div>
        <div class="match-orbs">
          <div class="match-orb me">${avatarTag(state.me, true)}</div>
          <div class="match-orb them">${avatarTag(p, true)}</div>
        </div>
      </div>
      <div class="match-copy">
        <h2 class="match-title" role="status" aria-live="polite">${t('app.match_title')}</h2>
        <p class="match-sub">${t('app.match_sub', { name: theirName })}</p>
      </div>
      <div class="match-actions">
        <button class="btn" id="mChat">${ic('chat-bubble')} ${t('app.match_write_to', { name: theirName })}</button>
        <button class="btn secondary" id="mKeep">${t('app.match_keep_scrolling')}</button>
      </div>
    </div>`);
  document.body.appendChild(ov);

  const canvas = ov.querySelector(".match-wave");
  const ring = ov.querySelector(".match-ring");
  const ctx = canvas.getContext("2d");
  let raf = 0, t0 = 0, lockedAt = 0, locked = false, W = 0, H = 0, dpr = 1;

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; window.removeEventListener("resize", size);
  }
  function strokeWave(fn, color, width, alpha, glow) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) { const y = fn(x); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = alpha; ctx.strokeStyle = color;
    ctx.shadowBlur = glow || 0; ctx.shadowColor = glow ? color : "transparent";
    ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // ep: convergence 0→1. offset π (controfase: si annullano) → 0 (in fase: risonanza piena)
  function draw(time, ep) {
    ctx.clearRect(0, 0, W, H);
    const mid = H * 0.5, k = (Math.PI * 2) / (W * 0.5), travel = time * 2.2;
    const baseAmp = Math.min(H * 0.32, 46), offset = (1 - ep) * Math.PI;
    const compAmp = baseAmp * (0.55 + 0.45 * ep), compAlpha = 0.10 + (1 - ep) * 0.5;
    const resAmp = baseAmp * Math.cos(offset / 2);
    strokeWave(x => mid + compAmp * Math.sin(k * x + travel + offset / 2), "#8b6cff", 2, compAlpha);
    strokeWave(x => mid + compAmp * Math.sin(k * x + travel - offset / 2), "#ff5c9d", 2, compAlpha);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#8b6cff"); grad.addColorStop(1, "#ff5c9d");
    if (ep > 0.02) strokeWave(x => mid + resAmp * Math.sin(k * x + travel), grad, 3.4, Math.min(1, ep * 1.1), 14);
  }
  function lock() {
    locked = true;
    ov.classList.add("locked");
    ring.classList.add("go");
    haptic("Heavy");
    chord();
  }
  function frame(ts) {
    if (!ov.isConnected) { stop(); return; }            // overlay rimosso: niente loop orfani
    if (!t0) t0 = ts;
    const dt = ts - t0, p = Math.min(1, dt / 1500), ep = 1 - Math.pow(1 - p, 3);
    draw(dt / 1000, ep);
    if (p >= 1 && !locked) { lock(); lockedAt = ts; }
    if (lockedAt && ts - lockedAt > 2400) { stop(); return; }  // l'onda respira, poi si congela
    raf = requestAnimationFrame(frame);
  }

  const prevFocus = document.activeElement;
  const onEsc = (e) => { if (e.key === "Escape") close(() => renderDiscover2()); };
  const close = next => { stop(); document.removeEventListener("keydown", onEsc); ov.remove(); try { prevFocus && prevFocus.focus(); } catch (_) {} next(); };
  // Chiusura "pulita" per i percorsi back-button (Capacitor/popstate): rimuove il listener Esc
  // e ripristina il focus invece di un raw ov.remove() che lascerebbe onEsc orfano sul document.
  ov._jmClose = () => close(() => {});
  $("#mKeep").onclick = () => close(() => renderDiscover2());
  $("#mChat").onclick = () => close(() => { navigate("messages"); setTimeout(() => openChat(p), 50); });
  document.addEventListener("keydown", onEsc);
  setTimeout(() => { try { ov.querySelector("#mChat").focus(); } catch (_) {} }, 60);

  size();
  if (reduce) { ov.classList.add("locked"); draw(0, 1); haptic("Heavy"); chord(); return; }
  window.addEventListener("resize", size);
  raf = requestAnimationFrame(frame);
}

// Accordo di risonanza al match: quinta giusta (A4 + E5), discreto. Disattivabile rimuovendo la chiamata in lock().
function chord() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    if (ac.state === "suspended" && ac.resume) ac.resume();  // autoplay policy: sblocca il contesto
    const now = ac.currentTime, master = ac.createGain();
    master.gain.value = 0.0001; master.connect(ac.destination);
    master.gain.exponentialRampToValueAtTime(0.10, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    [[440, 1], [660, 0.6]].forEach(([f, v]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = v;
      o.connect(g); g.connect(master); o.start(now); o.stop(now + 1.15);
    });
    setTimeout(() => { try { ac.close(); } catch (_) {} }, 1400);
  } catch (_) {}
}

// ---------- Ricerca con filtri (lista) ----------
function renderSearch(box) {
  const f = state.filters;
  box.appendChild(el(`
    <div class="filters">
      <div class="filter-row">
        <div><label class="field">${t('app.filter_instrument')}</label><select id="fIns" aria-label="${esc(t('app.filter_instrument'))}">${options(INSTRUMENTS, f.instrument, t('app.filter_all'))}</select></div>
        <div><label class="field">${t('app.filter_level')}</label><select id="fLvl" aria-label="${esc(t('app.filter_level'))}">${options(LEVELS, f.level, t('app.filter_all'), levelLabel)}</select></div>
      </div>
      <div class="filter-row">
        <div><label class="field">${t('app.filter_genre')}</label><select id="fGen" aria-label="${esc(t('app.filter_genre'))}">${options(GENRES, f.genre, t('app.filter_all'), genreLabel)}</select></div>
        <div><label class="field">${t('app.filter_distance_label', { value: `<span class="range-val" id="fDistVal">${distLabel(f.distance)}</span>` })}</label>
          <input type="range" id="fDist" min="0" max="${DIST_STEPS.length - 1}" step="1" value="${distIndex(f.distance)}" aria-label="${esc(t('app.filter_max_distance'))}" aria-valuetext="${esc(distLabel(f.distance))}" /></div>
      </div>
    </div>
    <div id="results"></div>`));
  $("#fIns").onchange = e => { f.instrument = e.target.value; save(); paintResults(); };
  $("#fLvl").onchange = e => { f.level = e.target.value; save(); paintResults(); };
  $("#fGen").onchange = e => { f.genre = e.target.value; save(); paintResults(); };
  $("#fDist").oninput = e => { f.distance = DIST_STEPS[+e.target.value]; $("#fDistVal").textContent = distLabel(f.distance); e.target.setAttribute("aria-valuetext", distLabel(f.distance)); };
  $("#fDist").onchange = () => { save(); paintResults(); };
  paintResults();
}
function matchProfiles() {
  const f = state.filters;
  return rankByAffinity(state.profiles.filter(p => matchesFilters(p, f)));
}
// Stato del profilo rispetto a te (la lista "Cerca" lo mostra, così le due viste si parlano).
function profileState(p) {
  if (state.matches.includes(p.id)) return { cls: "ps-match", icon: "match", text: t('app.pstate_in_contact') };
  if ((state.liked || []).includes(p.id)) return { cls: "ps-like", icon: "heart", text: t('app.pstate_like_sent') };
  if ((state.passed || []).includes(p.id)) return { cls: "ps-pass", icon: "x", text: t('app.pstate_passed') };
  return null;
}
function paintResults() {
  const box = $("#results"); if (!box) return;
  const list = matchProfiles();
  if (!list.length) {
    box.innerHTML = `<div class="empty">${illus("radiant")}${t('app.search_no_results')}${state.filters.distance < DIST_MAX ? t('app.search_try_widen') : ""}</div>`;
    if (state.filters.distance < DIST_MAX) { const b = el(`<button class="btn secondary small" style="margin-top:8px">${ic('plus')} ${t('app.search_widen_anywhere')}</button>`); b.onclick = () => { state.filters.distance = DIST_MAX; save(); renderDiscover2(); }; box.appendChild(b); }
    return;
  }
  box.innerHTML = `<p class="view-sub">${t(list.length === 1 ? 'app.search_results_one' : 'app.search_results_other', { count: list.length })}</p>`;
  list.forEach(p => box.appendChild(profileCard(p)));
}
function profileCard(p) {
  const st = profileState(p), aff = getAffinity(p);
  const c = el(`
    <div class="card">
      <div class="card-head">
        ${avatarTag(p)}
        <div class="meta">
          <div class="name">${esc(p.name)} <span class="score">${ic('star')} ${avgScore(p.endo)}</span>${st ? ` <span class="pstate ${st.cls}">${ic(st.icon)} ${esc(st.text)}</span>` : ""}</div>
          ${standingFlair(p)}
          <div class="loc">${ic('map-pin')} ${esc(p.city)} · ${p.distanceKm} km · ${esc(levelLabel(topLevel(p)))}</div>
        </div>
        <div class="compat-mini" style="font-weight:800;color:var(--accent)">${affLabel(aff)}</div>
      </div>
      ${sceneSignalsHtml(p)}
      <div class="tags">
        ${instrTags(p)}
        ${p.genres.slice(0, 3).map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}
      </div>
      <div class="tags" style="margin-top:6px"><span class="dist">${ic('music-note')} ${t('app.songs_count', { count: (p.repertoire || []).length })}</span><span class="dist">${affCommonHtml(aff, p)}</span></div>
    </div>`);
  clickableCard(c, () => openProfileSheet(p));
  return c;
}

// ---------- Sheet: dettaglio profilo ----------
function openProfileSheet(p, opts) {
  opts = opts || {};
  const links = Object.entries(p.links).filter(([, v]) => v);
  const matched = state.matches.includes(p.id);
  const jammed = !opts.preview && typeof hasJammedWith === "function" && hasJammedWith(p);
  const aff = opts.preview ? null : getAffinity(p); // niente "Sintonia con sé stessi" in anteprima
  openModal(`
    ${opts.preview ? `<div class="aff-note" style="margin-top:0">${ic('info')} ${t('app.sheet_public_preview')}</div>` : ""}
    <div style="text-align:center">
      <div style="display:flex;justify-content:center">${avatarTag(p, true)}</div>
      <h2>${esc(p.name)} ${p.deep && p.deep.done ? `<span class="tag accent" style="vertical-align:middle">${ic("resonance-profile", "grad")}</span>` : ''}</h2>
      ${standingFlair(p, true)}
      <div class="loc">${ic('map-pin')} ${esc(p.city)} · ${p.distanceKm} km · ${esc(levelLabel(topLevel(p)))} · <span class="score">${ic('star')} ${avgScore(p.endo)}</span></div>
      ${aff ? affHeaderHtml(aff) : ""}
    </div>
    <div class="tags" style="justify-content:center;margin-top:10px">
      ${instrTags(p)}
      ${p.genres.map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}
    </div>
    ${p.bio ? `<div class="section-label">${t('app.sheet_bio')}</div><p style="margin:0;line-height:1.5">${esc(p.bio)}</p>` : ""}
    ${links.length ? `<div class="section-label">${t('app.sheet_listen')}</div><div class="linkrow">${links.map(([k, v]) => `<a href="${esc(safeUrl(v))}" target="_blank" rel="noopener noreferrer">${({ youtube: "▶ YouTube", spotify: "♫ Spotify", instagram: "◎ Instagram" })[k] || k}</a>`).join("")}</div>` : ""}
    <div class="section-label">${t('app.sheet_repertoire')}</div>
    ${p.repertoire.length ? p.repertoire.map(r => {
      const w = repWrittenKeys(r), cc = repConcertKeys(r);
      const showC = (r.transpose || 0) && cc.length && cc.join() !== w.join();
      return `<div class="rep-item"><div><div class="song">${esc(r.title)}</div><div class="artist">${esc(r.artist || "")}</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${w.length ? `<span class="key-badge">${esc(w.join(", "))}</span>` : ""}${showC ? `<span class="key-badge concert">🎹 ${esc(cc.join(", "))}</span>` : ""}</div></div>`;
    }).join("") : `<p class="view-sub">${t('app.sheet_no_songs')}</p>`}
    <div class="section-label">${t('app.sheet_reputation')}</div>
    ${endoBlock(p.endo)}
    ${jammateExtra(p.endo)}
    ${aff ? affDetailHtml(aff) : ""}
    ${opts.preview
      ? `<div style="margin-top:22px"><button class="btn" id="closePrev">${ic('check')} ${t('app.sheet_close_preview')}</button></div>`
      : `<div style="margin-top:22px"><button class="btn" id="contactBtn">${ic('chat-bubble')} ${matched ? t('app.sheet_write_to') : t('app.sheet_contact')} ${esc(p.name.split(" ")[0])}</button></div>
    <button class="btn secondary" id="inviteBandBtn" style="margin-top:10px">${ic('music-note')} ${t('app.sheet_invite_band')}</button>
    ${jammed ? `<button class="btn secondary" id="endorseBtn" style="margin-top:10px">${ic('star')} ${t('app.sheet_rate_after_jam')}</button>` : `<div class="aff-note" style="margin-top:10px">${ic('star')} ${t('app.sheet_feedback_locked')}</div>`}
    <button class="btn secondary small" id="reportUser" style="margin-top:14px">${ic('flag')} ${t('app.sheet_report')}</button>`}
  `);
  if (opts.preview) { const cp = $("#closePrev"); if (cp) cp.onclick = closeModal; }
  else {
    if ($("#reportUser")) $("#reportUser").onclick = () => openReportSheet(t('app.sheet_report_profile_of', { name: p.name }), "profile:" + p.id);
    $("#contactBtn").onclick = () => {
      const fresh = !state.matches.includes(p.id);
      if (fresh) { state.matches.push(p.id); if (!state.messages[p.id]) state.messages[p.id] = []; save(); }
      if (fresh) toast(t('app.sheet_conversation_started', { name: (p.name || "").split(" ")[0] }), ic('chat-bubble'));
      closeModal(); navigate("messages"); setTimeout(() => openChat(p), 50);
    };
    $("#inviteBandBtn").onclick = () => openInviteToBand(p);
    if (jammed) $("#endorseBtn").onclick = () => { const j = (typeof jamWith === "function") && jamWith(p); if (j) openJamFeedback(j, p); };
  }
  document.querySelectorAll("#modalRoot [data-resonate]").forEach(b => b.onclick = () => jmResonate(+b.dataset.resonate, b));
}

// Estratto reputazione "tra JamMates": % rigiocherebbe + top tag dai feedback verificati.
function jammateExtra(e) {
  if (!e) return "";
  const chips = [];
  if (e.rejamTotal) chips.push(`<span class="tag lvl">${ic('refresh')} ${t('app.jammate_extra_rejam', { pct: Math.round((e.rejamYes || 0) / e.rejamTotal * 100) })}</span>`);
  const tags = e.tags ? Object.entries(e.tags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t) : [];
  tags.forEach(t => chips.push(`<span class="tag">${esc(t)}</span>`));
  return chips.length ? `<div class="tags" style="margin-top:8px">${chips.join("")}</div>` : "";
}

// ---------- Vista: Bacheca ----------
const boardFilter = { instrument: "", genre: "", openOnly: false, forMe: false, saved: false };
function boardMatches(ev) {
  const m = state.me, slots = ev.slots || [];
  // Strumento + "solo slot liberi" devono incrociarsi: serve uno slot LIBERO
  // proprio di quello strumento (prima i due filtri non si intersecavano).
  const instOk = !boardFilter.instrument
    ? (!boardFilter.openOnly || slots.some(s => !s.filled))
    : slots.some(s => s.instrument === boardFilter.instrument && (!boardFilter.openOnly || !s.filled));
  const genreOk = !boardFilter.genre || ev.genres.includes(boardFilter.genre);
  const forMeOk = !boardFilter.forMe || slots.some(s => (m.instruments || []).includes(s.instrument)) || ev.genres.some(g => (m.genres || []).includes(g));
  const savedOk = !boardFilter.saved || (state.savedAds || []).includes(ev.id);
  return instOk && genreOk && forMeOk && savedOk;
}

// ---------- Bacheca: rilevanza, freschezza, scadenza, candidatura inline ----------
function todayISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function evOpenSlots(ev) { return (ev.slots || []).filter(s => !s.filled); }
function evIsExpired(ev) { return !!ev.date && ev.date < todayISO(); }
function evIsNew(ev) { return ev.createdAt && (Date.now() - ev.createdAt) < 48 * 3600e3; }
function evMatchesMe(ev) {
  const m = state.me;
  return evOpenSlots(ev).some(s => (m.instruments || []).includes(s.instrument))
    || (ev.genres || []).some(g => (m.genres || []).includes(g));
}
function evInterest(ev) { return (ev.slots || []).reduce((n, s) => n + (s.filled ? 1 : 0) + ((s.waitlist || []).length), 0); }
function myAdStatus(ev) {
  const me = state.me.name || "Tu"; let applied = false, wait = false;
  (ev.slots || []).forEach(s => { if (s.applicant === me) applied = true; if ((s.waitlist || []).includes(me)) wait = true; });
  return applied ? "applied" : wait ? "wait" : null;
}
function evRelevance(ev) {
  let r = 0;
  if (evIsExpired(ev)) r -= 1000;
  if (ev.featured) r += 100;
  if (evMatchesMe(ev)) r += 50;
  r += evOpenSlots(ev).length * 5;
  if (evIsNew(ev)) r += 8;
  r -= Math.min(40, ev.distanceKm || 0);
  return r;
}
function authorGrad(ev) { return GRADS[hash(ev.author || "") % GRADS.length]; }
function relDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00"), t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d - t) / 86400e3);
  if (diff < 0) return t('app.rel_expired');
  if (diff === 0) return t('app.rel_today');
  if (diff === 1) return t('app.rel_tomorrow');
  if (diff < 7) return t('app.rel_in_days', { count: diff });
  return formatDate(iso);
}
function normalizeEvents(evs) {
  const now = Date.now();
  (evs || []).forEach((ev, i) => {
    if (ev.createdAt == null) ev.createdAt = now - i * 22 * 3600e3; // i primi più "nuovi"
    if (ev.featured == null) ev.featured = (ev.id === "e1");
    (ev.slots || []).forEach(s => { if (!s.waitlist) s.waitlist = []; });
  });
  return evs;
}
function applyToSlot(ev, instrument) {
  const s = (ev.slots || []).find(x => !x.filled && x.instrument === instrument);
  if (!s) return;
  const me = state.me.name || "Tu";
  s.filled = true; s.applicant = me;
  haptic("Medium"); save();
  // Azione distruttiva (occupa lo slot, visibile agli altri): offri sempre un Annulla immediato.
  toast(t('app.board_application_sent', { instrument }), ic("celebration", "accent"), {
    actionLabel: t('app.cancel'),
    onAction: () => { if (s.applicant === me) { s.filled = false; s.applicant = null; save(); renderBoard2(); } }
  });
  renderBoard2();
}
function toggleSaveAd(ev) {
  state.savedAds = state.savedAds || [];
  const i = state.savedAds.indexOf(ev.id);
  if (i >= 0) { state.savedAds.splice(i, 1); toast(t('app.board_removed_saved')); }
  else { state.savedAds.push(ev.id); haptic("Light"); toast(t('app.board_ad_saved'), ic("star", "accent")); }
  save(); renderBoard2();
}
function checkBoardMatches() {
  if (!state.onboarded) return;
  const last = state.boardSeen || 0;
  const fresh = (state.events || []).filter(e => !evIsExpired(e) && evMatchesMe(e) && (e.createdAt || 0) > last);
  if (fresh.length && typeof notify === "function") {
    notify("megaphone", fresh.length === 1
      ? t('app.board_match_one')
      : t('app.board_match_other', { count: fresh.length }), { view: "board" });
  }
  state.boardSeen = Date.now(); save();
}
function renderBoard(app) {
  const mode = state.ui.boardMode || "list";
  app.appendChild(el(`
    <div>
      <div class="row-between"><h1 class="view-title">${t('app.board_title')}</h1>
      <div class="hdr-actions">
        <button class="btn small secondary" id="boardRefresh" type="button" aria-label="${esc(t('app.board_refresh_aria'))}">${ic('refresh')} ${t('app.board_refresh')}</button>
        <button class="btn small" id="newAd">${ic('plus')} ${t('app.board_new')}</button></div></div>
      <p class="view-sub">${t('app.board_sub')}</p>
      <div class="segmented">
        <button data-bm="list" class="${mode === "list" ? "on" : ""}">${ic('list')} ${t('app.board_ads')}</button>
        <button data-bm="map" class="${mode === "map" ? "on" : ""}">${ic('map')} ${t('app.board_jam_map')}</button>
      </div>
      <div id="boardBody"></div>
    </div>`));
  app.querySelectorAll(".segmented button").forEach(b => b.onclick = () => { state.ui.boardMode = b.dataset.bm; save(); renderBoard2(); });
  $("#newAd").onclick = () => (mode === "map" ? openCreateJam() : openCreateSheet());
  if ($("#boardRefresh")) $("#boardRefresh").onclick = () => runRefresh("board");
  if (mode === "map") return window.renderJamMap($("#boardBody"));
  renderBoardList($("#boardBody"));
}
function renderBoardList(box) {
  box.appendChild(el(`
    <div>
      <div class="filters">
        <div class="filter-row">
          <select id="bfIns">${options(INSTRUMENTS, boardFilter.instrument, t('app.board_all_instruments'))}</select>
          <select id="bfGen">${options(GENRES, boardFilter.genre, t('app.board_all_genres'), genreLabel)}</select>
        </div>
        <div class="filter-row">
          <button class="btn small ${boardFilter.forMe ? "" : "secondary"}" id="bfForMe">${ic('target')} ${t('app.board_for_me')}</button>
          <button class="btn small ${boardFilter.openOnly ? "" : "secondary"}" id="bfOpen">${ic('plus')} ${t('app.board_open_slots')}</button>
          <button class="btn small ${boardFilter.saved ? "" : "secondary"}" id="bfSaved">${ic('star')} ${t('app.board_saved')}</button>
        </div>
      </div>
      <div id="eventList"></div>
    </div>`));
  $("#bfIns").onchange = e => { boardFilter.instrument = e.target.value; paintEvents(); };
  $("#bfGen").onchange = e => { boardFilter.genre = e.target.value; paintEvents(); };
  $("#bfForMe").onclick = () => { boardFilter.forMe = !boardFilter.forMe; renderBoard2(); };
  $("#bfOpen").onclick = () => { boardFilter.openOnly = !boardFilter.openOnly; renderBoard2(); };
  $("#bfSaved").onclick = () => { boardFilter.saved = !boardFilter.saved; renderBoard2(); };
  paintEvents();
}
function paintEvents() {
  const box = $("#eventList"); if (!box) return;
  if (!state.events.length) return box.innerHTML = `<div class="empty">${illus("quiet")}${t('app.board_no_ads')}<br>${t('app.board_create_one_with')} ${ic('plus')} ${t('app.board_new')}.</div>`;
  const list = state.events.filter(boardMatches).slice().sort((a, b) => evRelevance(b) - evRelevance(a));
  if (!list.length) {
    const anyFilter = boardFilter.instrument || boardFilter.genre || boardFilter.openOnly || boardFilter.forMe || boardFilter.saved;
    box.innerHTML = `<div class="empty">${illus("radiant")}${t('app.board_no_ads_filters')}${anyFilter ? `<br><button class="btn small secondary" id="adClearF" type="button" style="margin-top:10px">${t('app.filter_clear')}</button>` : ""}</div>`;
    const cf = $("#adClearF"); if (cf) cf.onclick = () => { boardFilter.instrument = ""; boardFilter.genre = ""; boardFilter.openOnly = false; boardFilter.forMe = false; boardFilter.saved = false; renderBoard2(); };
    return;
  }
  box.innerHTML = "";
  const forMe = state.events.filter(e => !evIsExpired(e) && evMatchesMe(e)).length;
  if (forMe && !boardFilter.forMe && !boardFilter.saved) {
    const banner = el(`<div class="ad-foryou">${ic('target', 'accent')}<span>${t(forMe === 1 ? 'app.board_for_you_one' : 'app.board_for_you_other', { count: forMe })}</span><button class="btn small" id="adForYou" type="button">${t('app.show')}</button></div>`);
    banner.querySelector("#adForYou").onclick = () => { boardFilter.forMe = true; renderBoard2(); };
    box.appendChild(banner);
  }
  list.forEach(ev => box.appendChild(eventCard(ev)));
}
function eventCard(ev) {
  const open = evOpenSlots(ev), expired = evIsExpired(ev), status = myAdStatus(ev);
  const saved = (state.savedAds || []).includes(ev.id), interest = evInterest(ev);
  const badges = [];
  if (ev.featured && !expired) badges.push(`<span class="ad-badge feat">${ic('sparkles')} ${t('app.card_featured')}</span>`);
  if (evIsNew(ev) && !expired) badges.push(`<span class="ad-badge new">${t('app.ad_new')}</span>`);
  if (expired) badges.push(`<span class="ad-badge exp">${t('app.ad_closed')}</span>`);
  if (status === "applied") badges.push(`<span class="ad-badge mine">${ic('check')} ${t('app.ad_applied')}</span>`);
  else if (status === "wait") badges.push(`<span class="ad-badge mine">${ic('clock')} ${t('app.ad_waitlisted')}</span>`);
  const c = el(`
    <div class="card ad-card${ev.featured && !expired ? " featured" : ""}${expired ? " expired" : ""}">
      <div class="ad-top">
        <span class="ad-av" style="background:${safeColor(authorGrad(ev))}">${ev.authorAvatar ? esc(ev.authorAvatar) : ic('music-note')}</span>
        <div class="ad-head">
          <div class="ad-title">${esc(ev.title)}</div>
          <div class="ad-meta">${esc(ev.author)} · ${ic('map-pin')} ${esc(ev.city)} · ${ev.distanceKm} km</div>
        </div>
        <button class="ad-save${saved ? " on" : ""}" data-save type="button" aria-label="${esc(saved ? t('app.ad_remove_saved') : t('app.ad_save'))}">${ic('star')}</button>
      </div>
      ${badges.length ? `<div class="ad-badges">${badges.join("")}</div>` : ""}
      <div class="ad-when">${ic('calendar')} ${relDate(ev.date)}${interest ? ` · ${ic('thumbs-up')} ${t(interest === 1 ? 'app.ad_interested_one' : 'app.ad_interested_other', { count: interest })}` : ""}</div>
      ${open.length
      ? `<div class="ad-seek"><span class="ad-seek-lbl">${t('app.ad_seek')}</span>${open.map(s => `<button class="ad-slot" type="button" data-apply="${esc(s.instrument)}"${expired ? " disabled" : ""}>${ic('plus')} ${esc(vocabLabel(s.instrument))}</button>`).join("")}</div>`
      : `<div class="ad-full">${ic('check')} ${t('app.ad_full_lineup')}</div>`}
      <div class="tags">${ev.genres.map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}</div>
    </div>`);
  clickableCard(c, (e) => { if (e.target.closest("[data-apply],[data-save]")) return; openEventSheet(ev); });
  c.querySelectorAll("[data-apply]").forEach(b => b.onclick = (e) => { e.stopPropagation(); if (!b.disabled) applyToSlot(ev, b.dataset.apply); });
  const sv = c.querySelector("[data-save]"); if (sv) sv.onclick = (e) => { e.stopPropagation(); toggleSaveAd(ev); };
  return c;
}
function openEventSheet(ev) {
  openModal(`
    <span class="event-date">${ic('calendar')} ${formatDate(ev.date)}</span>
    <h2>${esc(ev.title)}</h2>
    <div class="loc">${ev.authorAvatar ? esc(ev.authorAvatar) : ""} ${esc(ev.author)} · ${ic('map-pin')} ${esc(ev.city)} · ${ev.distanceKm} km</div>
    <div class="tags" style="margin-top:8px">${ev.genres.map(g => `<span class="tag">${esc(genreLabel(g))}</span>`).join("")}</div>
    <div class="section-label">${t('app.ev_description')}</div><p style="margin:0;line-height:1.5">${esc(ev.description)}</p>
    <div class="section-label">${t('app.ev_instrument_slots')}</div><div id="slotList"></div>
    <button class="btn secondary" id="evMsg" style="margin-top:16px">${ic('send')} ${t('app.ev_write_to', { name: esc(ev.author) })}</button>
    <button class="btn secondary small" id="evReport" style="margin-top:10px">${ic('flag')} ${t('app.ev_report_ad')}</button>`);
  if ($("#evReport")) $("#evReport").onclick = () => openReportSheet(t('app.ev_report_label', { title: ev.title }), "ad:" + ev.id);
  const sl = $("#slotList");
  const myName = state.me.name || "Tu";
  ev.slots.forEach((s) => {
    s.waitlist = s.waitlist || [];
    const mine = s.applicant === myName;
    const iWait = s.waitlist.includes(myName);
    let right;
    if (!s.filled) right = `<button class="btn small" data-act="apply">${t('app.slot_apply')}</button>`;
    else if (mine) right = `<button class="btn small secondary" data-act="withdraw">${t('app.slot_withdraw')}</button>`;
    else if (iWait) right = `<span class="tag">${t('app.slot_in_waitlist', { pos: s.waitlist.indexOf(myName) + 1 })}</span>`;
    else right = `<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><span class="tag lvl">${s.waitlist.length ? t('app.slot_occupied_list', { count: s.waitlist.length }) : t('app.slot_occupied')}</span><button class="btn small secondary" data-act="wait">${t('app.slot_join_waitlist')}</button></span>`;
    const row = el(`<div class="rep-item"><span class="song">${s.filled ? ic('check') : ic('search')} ${esc(vocabLabel(s.instrument))}${s.applicant ? ` <span class="view-sub" style="font-size:.78rem">· ${esc(s.applicant)}</span>` : ""}</span>${right}</div>`);
    const btn = row.querySelector("[data-act]");
    if (btn) btn.onclick = () => {
      const act = btn.dataset.act;
      if (act === "apply") { s.filled = true; s.applicant = myName; toast(t('app.board_application_sent', { instrument: s.instrument }), ic('celebration', 'accent')); }
      else if (act === "wait") { s.waitlist.push(myName); toast(t('app.slot_waitlist_joined', { instrument: s.instrument })); }
      else if (act === "withdraw") {
        if (s.waitlist.length) { s.applicant = s.waitlist.shift(); toast(t('app.slot_withdrew_next', { name: s.applicant })); }
        else { s.filled = false; s.applicant = null; toast(t('app.slot_withdrew_free')); }
      }
      save(); openEventSheet(ev); renderBoard2();
    };
    sl.appendChild(row);
  });
  $("#evMsg").onclick = () => { closeModal(); dmContact({ id: "org:" + ev.id, name: ev.author, avatar: ev.authorAvatar, color: GRADS[hash(ev.author) % GRADS.length], city: ev.city, distanceKm: ev.distanceKm }); };
}
function renderBoard2() { if (currentView === "board") { const y = window.scrollY || 0; $("#app").innerHTML = ""; renderBoard($("#app")); applyToggleA11y($("#app")); requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (_) {} }); } }

function openCreateSheet() {
  openModal(`
    <h2>${t('app.create_new_ad_title')}</h2>
    <p class="view-sub">${t('app.create_sub')}</p>
    <label class="field">${t('app.create_title_label')}</label><input type="text" id="evTitle" placeholder="${esc(t('app.create_title_ph'))}">
    <label class="field" style="margin-top:10px">${t('app.create_author_label')}</label><input type="text" id="evAuthor" placeholder="${esc(t('app.create_author_ph'))}" value="${esc(state.me.name)}">
    <div class="filter-row" style="margin-top:10px">
      <div><label class="field">${t('app.create_city')}</label><input type="text" id="evCity" value="${esc(state.me.city)}"></div>
      <div><label class="field">${t('app.create_date')}</label><input type="date" id="evDate" aria-label="${esc(t('app.create_date'))}"></div>
    </div>
    <label class="field" style="margin-top:10px">${t('app.create_genres')}</label><div class="chips" id="evGenres">${chips(GENRES, [], genreLabel)}</div>
    <label class="field" style="margin-top:10px">${t('app.create_slots_label')}</label><div id="evSlots"></div>
    <label class="field" style="margin-top:10px">${t('app.ev_description')}</label><textarea id="evDesc" placeholder="${esc(t('app.create_desc_ph'))}"></textarea>
    <button class="btn" id="evCreate" style="margin-top:18px">${t('app.create_publish')}</button>`);
  const selGen = [], selSlots = [];
  document.querySelectorAll("#evGenres .chip").forEach(c => c.onclick = () => toggleChip(c, selGen));
  instrumentPicker($("#evSlots"), selSlots, { placeholder: t('app.create_slots_ph') });
  $("#evCreate").onclick = () => {
    const title = $("#evTitle").value.trim();
    if (!title) return markFieldError("#evTitle", t('app.create_title_required'));
    if (!selSlots.length) return toast(t('app.create_slot_required'));
    state.events.unshift({
      id: "e" + Date.now(), title, author: $("#evAuthor").value.trim() || state.me.name || t('app.create_anonymous'),
      authorAvatar: state.me.avatar, city: $("#evCity").value.trim() || "Milano", distanceKm: 0,
      date: $("#evDate").value || new Date().toISOString().slice(0, 10),
      genres: selGen, description: $("#evDesc").value.trim(),
      createdAt: Date.now(), featured: false,
      slots: selSlots.map(i => ({ instrument: i, filled: false, waitlist: [] }))
    });
    save(); closeModal(); toast(t('app.create_published'), ic('megaphone')); navigate("board");
  };
}

// ---------- Vista: Chat ----------
// Un "contatto" è un profilo (state.profiles) oppure un contatto sintetico
// (autore di bacheca/feed) salvato in state.contacts.
function findContact(id) { return state.profiles.find(p => p.id === id) || (state.contacts || []).find(p => p.id === id) || null; }
function dmContact(c) {
  state.contacts = state.contacts || [];
  if (!findContact(c.id)) state.contacts.push(c);
  if (!state.matches.includes(c.id)) state.matches.push(c.id);
  if (!state.messages[c.id]) state.messages[c.id] = [];
  save(); navigate("messages"); setTimeout(() => openChat(findContact(c.id) || c), 50);
}
// ---------- Chat: modello messaggi maturo + helper ----------
function pushMsg(id, msg) {
  state.messages[id] = state.messages[id] || [];
  const m = Object.assign({ kind: "text", ts: Date.now(), delivered: true, read: msg.from === "me" }, msg);
  state.messages[id].push(m); save();
  if (isProductionRuntime() && msg.from === "me" && msg.kind !== "image") {
    JM.Api.messages.send(id, msg.text || "").catch((error) =>
      toast(error.message || "Messaggio non inviato", ic("alert-triangle"), { error: true })
    );
  }
  return m;
}
function migrateMessages(out) {
  const base = Date.now() - 36 * 3600e3;
  Object.keys(out.messages || {}).forEach(id => (out.messages[id] || []).forEach((m, i) => {
    if (m.ts == null) m.ts = base + i * 6 * 60e3;
    if (m.delivered == null) m.delivered = true;
    if (m.read == null) m.read = (m.from === "me");
    if (!m.kind) m.kind = "text";
  }));
}
function unreadCount(id) { return (state.messages[id] || []).filter(m => m.from !== "me" && !m.read).length; }
function totalUnread() { return (state.matches || []).reduce((n, id) => n + unreadCount(id), 0); }
function markThreadRead(id) { let ch = false; (state.messages[id] || []).forEach(m => { if (m.from !== "me" && !m.read) { m.read = true; ch = true; } }); if (ch) save(); } // BACKEND HOOK: PATCH /threads/:id/read
function threadLast(id) { const t = state.messages[id] || []; return t[t.length - 1]; }
function dayLabel(ts) {
  const d = new Date(ts), t = new Date(), sd = (a, b) => a.toDateString() === b.toDateString();
  if (sd(d, t)) return window.t('app.day_today'); if (sd(d, new Date(t.getTime() - 86400e3))) return window.t('app.day_yesterday');
  return formatDate(d.toISOString().slice(0, 10));
}
function hhmm(ts) { const d = new Date(ts); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
// Risposta simulata CONTESTUALE (al posto della frase fissa).
function simReply(p) {
  const g = (typeof sharedGenres === "function") ? sharedGenres(p) : [];
  const so = (typeof sharedSongs === "function") ? sharedSongs(p) : [];
  const pool = [];
  if (so.length) pool.push(t('app.sim_reply_song', { song: so[0].title }));
  if (g.length) pool.push(t('app.sim_reply_genre', { genre: g[0].toLowerCase() }));
  if ((p.instruments || [])[0]) pool.push(t('app.sim_reply_instrument', { instrument: p.instruments[0].toLowerCase() }));
  pool.push(t('app.sim_reply_yes'), t('app.sim_reply_where_when'));
  return pool[hash(p.id + (state.messages[p.id] || []).length) % pool.length]; // BACKEND HOOK: messaggio reale dell'altro utente
}

function renderMessages(app) {
  app.appendChild(el(`<div><h1 class="view-title">${t('app.chat_title')}</h1>
    <p class="view-sub">${t('app.chat_sub')}</p>
    <input type="text" id="msgSearch" placeholder="${esc(t('app.chat_search_ph'))}" autocomplete="off" style="margin-bottom:10px">
    <div id="threads"></div></div>`));
  const search = $("#msgSearch");
  const paint = () => {
    const box = $("#threads"); if (!box) return;
    const q = (search.value || "").trim().toLowerCase();
    let ids = state.matches.filter(id => findContact(id));
    ids.sort((a, b) => ((threadLast(b) || {}).ts || 0) - ((threadLast(a) || {}).ts || 0)); // più recenti in cima
    if (q) ids = ids.filter(id => { const p = findContact(id), l = threadLast(id); return (p.name || "").toLowerCase().includes(q) || ((l && l.text) || "").toLowerCase().includes(q); });
    if (!ids.length) {
      box.innerHTML = q
        ? `<div class="empty">${t('app.chat_no_results', { query: esc(search.value) })}<div class="disc-empty-actions"><button class="btn small secondary" id="clrThreadSearch" type="button">${ic('x')} ${t('app.chat_clear_search')}</button></div></div>`
        : `<div class="empty">${spot("trova")}${t('app.chat_empty')}<div class="disc-empty-actions"><button class="btn small" id="emToDisc" type="button">${ic('match')} ${t('app.chat_go_discover')}</button></div></div>`;
      const b = $("#emToDisc"); if (b) b.onclick = () => navigate("discover");
      const clr = $("#clrThreadSearch"); if (clr) clr.onclick = () => { search.value = ""; paint(); };
      return;
    }
    box.innerHTML = "";
    ids.forEach(id => {
      const p = findContact(id), last = threadLast(id), uc = unreadCount(id);
      const prev = last ? (last.kind && last.kind !== "text" ? t('app.chat_attachment') : esc((last.from === "me" ? t('app.chat_you_prefix') : "") + last.text)) : t('app.chat_matched_say');
      const c = el(`<div class="card thread-row${uc ? " unread" : ""}"><div class="card-head">
        ${avatarTag(p)}
        <div class="meta" style="flex:1;min-width:0">
          <div class="row-between"><div class="name">${esc(p.name)}</div><span class="thread-time">${last ? timeAgo(last.ts) : ""}</span></div>
          <div class="row-between"><div class="loc ellipsis">${prev}</div>${uc ? `<span class="badge-new">${uc}</span>` : ""}</div>
        </div></div></div>`);
      clickableCard(c, () => openChat(p));
      box.appendChild(c);
    });
  };
  search.oninput = paint;
  paint();
}
function openChat(p) {
  if (!state.messages[p.id]) state.messages[p.id] = [];
  markThreadRead(p.id); updateChatDot();
  openModal(`
    <div class="card-head chat-head modal-head" style="margin-bottom:12px">
      ${avatarTag(p)}
      <div class="meta" style="flex:1"><div class="name">${esc(p.name)}</div><div class="loc">${ic('map-pin')} ${esc(p.city || "")}${p.distanceKm != null ? " · " + p.distanceKm + " km" : ""}</div></div>
      <button class="icon-btn" id="chatMenu" type="button" aria-label="${esc(t('app.chat_delete_conversation'))}" title="${esc(t('app.chat_delete_conversation'))}">${ic('trash')}</button>
    </div>
    <div class="msg-thread" id="thread" role="log" aria-live="polite" aria-label="${esc(t('app.chat_conversation_label'))}"></div>
    <div class="quick-bar" id="quickBar">
      <button class="quick-chip" type="button" data-q="${esc(t('app.chat_quick_when'))}">${t('app.chat_quick_when_short')}</button>
      <button class="quick-chip" type="button" data-q="jam">${ic('microphone')} ${t('app.chat_quick_propose')}</button>
      <button class="quick-chip" type="button" data-q="rep">${ic('music-note')} ${t('app.chat_quick_send_rep')}</button>
    </div>
    <div class="emoji-bar" id="chatEmojiBar" hidden>${POST_EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>
    <div class="composer"><button class="icon-btn" id="chatEmoji" type="button" aria-label="${esc(t('app.chat_emoji'))}" aria-expanded="false" title="${esc(t('app.chat_emoji'))}">${ic('face-neutral')}</button><button class="icon-btn" id="chatAttach" type="button" aria-label="${esc(t('app.chat_attach_image'))}" title="${esc(t('app.chat_attach_image'))}">${ic('camera')}</button><input type="text" id="msgInput" aria-label="${esc(t('app.chat_write_message'))}" placeholder="${esc(t('app.chat_write_message_ph'))}" /><button class="btn small" id="sendMsg" aria-label="${esc(t('app.chat_send'))}">${ic('send')}</button></div>`);
  paintThread(p);
  if (isProductionRuntime()) {
    JM.Api.messages.with(p.id).then((rows) => {
      state.messages[p.id] = rows.map((row) => ({
        from: row.mine ? "me" : "them",
        text: row.text || "",
        img: row.image || "",
        kind: row.image ? "image" : "text",
        ts: new Date(row.ts).getTime(),
        delivered: true,
        read: true
      }));
      save();
      if (document.querySelector("#thread")) paintThread(p);
    }).catch(() => {});
  }
  // Risposta simulata del contatto (riusata da testo e immagine).
  const botReply = () => {
    if (isProductionRuntime()) return;
    showTyping(p);
    setTimeout(() => {
      hideTyping(); pushMsg(p.id, { from: "them", text: simReply(p) });
      if (currentView === "messages" && document.querySelector("#thread")) { markThreadRead(p.id); paintThread(p); }
      else notify("chat-bubble", t('app.chat_replied', { name: p.name.split(" ")[0] }), { view: "messages" });
      updateChatDot();
    }, 1100 + (hash(p.id) % 700));
  };
  const send = (text) => {
    const v = (text != null ? text : $("#msgInput").value).trim(); if (!v) return;
    pushMsg(p.id, { from: "me", text: v }); $("#msgInput").value = ""; paintThread(p); botReply();
  };
  $("#sendMsg").onclick = () => send();
  $("#msgInput").addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  // Emoji nel composer (riusa il set dei post + insertAtCursor)
  $("#chatEmoji").onclick = () => { const b = $("#chatEmojiBar"); b.hidden = !b.hidden; $("#chatEmoji").setAttribute("aria-expanded", b.hidden ? "false" : "true"); };
  $("#chatEmojiBar").querySelectorAll("[data-e]").forEach(b => b.onclick = () => insertAtCursor($("#msgInput"), b.dataset.e));
  // Allega immagine: stessa compressione dei post (pickImage → max 1000px, JPEG 0.8) salvata come bolla-immagine
  $("#chatAttach").onclick = () => pickImage(async src => {
    if (isProductionRuntime()) {
      try {
        const blob = await (await fetch(src)).blob();
        const uploaded = await JM.Api.media.upload(blob);
        await JM.Api.messages.send(p.id, "", uploaded.key);
      } catch (error) {
        return toast(error.message || "Immagine non inviata", ic("alert-triangle"), { error: true });
      }
    }
    pushMsg(p.id, { from: "me", kind: "image", img: src });
    paintThread(p);
    botReply();
  }, 1000);
  $("#quickBar").querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
    const q = b.dataset.q;
    if (q === "jam") return proposeJam(p);
    if (q === "rep") return shareRepertoire(p);
    send(q);
  });
  $("#chatMenu").onclick = () => openConfirm(t('app.chat_delete_q'), t('app.chat_delete_body', { name: p.name.split(" ")[0] }), { yes: t('app.delete'), danger: true }, () => {
    state.matches = (state.matches || []).filter(id => id !== p.id); delete state.messages[p.id]; save(); closeModal(); navigate("messages"); toast(t('app.chat_deleted'));
  });
}
function showTyping(p) { const t = $("#thread"); if (!t || $("#typing")) return; const d = el(`<div class="bubble them typing" id="typing"><span></span><span></span><span></span></div>`); t.appendChild(d); t.scrollTop = t.scrollHeight; }
function hideTyping() { const d = $("#typing"); if (d) d.remove(); }
function proposeJam(p) {
  pushMsg(p.id, { from: "me", text: t('app.jam_proposal_msg'), kind: "jam-proposal", payload: { title: t('app.jam_proposal_title'), hint: t('app.jam_proposal_hint', { name: p.name.split(" ")[0] }) } });
  paintThread(p); // BACKEND HOOK: la proposta diventerà una vera jam condivisa
}
function shareRepertoire(p) {
  const songs = (state.me.repertoire || []).slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 5).map(r => r.title);
  if (!songs.length) return toast(t('app.rep_add_first'));
  pushMsg(p.id, { from: "me", text: t('app.rep_share_msg'), kind: "repertoire", payload: { songs } });
  paintThread(p);
}
function renderMsgCard(m) {
  if (m.kind === "image") { const src = safeImg(m.img); const tick = m.from === "me" ? `<span class="b-ticks">✓</span>` : ""; return `<div class="bubble ${m.from} msg-img">${src ? `<img src="${esc(src)}" alt="${esc(t('app.msg_image_alt'))}" loading="lazy" decoding="async">` : `<div class="mc-body">${ic('alert-triangle')} ${t('app.msg_image_invalid')}</div>`}<span class="b-time">${hhmm(m.ts)}${tick}</span></div>`; }
  if (m.kind === "jam-proposal") return `<div class="bubble ${m.from} msg-card"><div class="mc-head">${ic('microphone')} ${esc((m.payload && m.payload.title) || t('app.jam_proposal_title'))}</div><div class="mc-body">${esc((m.payload && m.payload.hint) || "")}</div><button class="btn small" type="button" data-jamcta="1">${ic('calendar')} ${t('app.msg_open_board')}</button><span class="b-time">${hhmm(m.ts)}</span></div>`;
  if (m.kind === "repertoire") { const songs = (m.payload && m.payload.songs) || []; return `<div class="bubble ${m.from} msg-card"><div class="mc-head">${ic('music-note')} ${t('app.msg_repertoire')}</div><div class="mc-body tags">${songs.map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div><span class="b-time">${hhmm(m.ts)}</span></div>`; }
  return `<div class="bubble ${m.from}">${esc(m.text || "")}</div>`;
}
function paintThread(p) {
  const t = $("#thread"); if (!t) return;
  const msgs = state.messages[p.id] || [];
  if (!msgs.length) { t.innerHTML = `<div class="thread-empty">${spot("sintonia")}<div>${window.t('app.thread_empty')}</div></div>`; return; }
  let html = "", lastDay = "";
  msgs.forEach(m => {
    const d = dayLabel(m.ts || Date.now());
    if (d !== lastDay) { html += `<div class="msg-day-sep"><span>${esc(d)}</span></div>`; lastDay = d; }
    if (m.kind && m.kind !== "text") { html += renderMsgCard(m); return; }
    // Onestà: senza backend non c'è una vera conferma di lettura → un solo ✓ ("inviato").
    // La spunta doppia tornerà quando JM.Api emetterà l'evento di lettura del destinatario.
    const tick = m.from === "me" ? `<span class="b-ticks">✓</span>` : "";
    html += `<div class="bubble ${m.from}"><span class="b-text">${esc(m.text)}</span><span class="b-time">${hhmm(m.ts || Date.now())}${tick}</span></div>`;
  });
  t.innerHTML = html;
  t.querySelectorAll("[data-jamcta]").forEach(b => b.onclick = () => { closeModal(); navigate("board"); });
  t.scrollTop = t.scrollHeight;
}

// ---------- Profilo: completezza, auto-save, export ----------
function profileCompleteness(m) {
  const steps = [
    { id: "photo", label: t('app.compl_photo'), done: !!m.photo, w: 15 },
    { id: "instr", label: t('app.compl_instr'), done: (m.instruments || []).length >= 1, w: 15 },
    { id: "genres", label: t('app.compl_genres'), done: (m.genres || []).length >= 3, w: 10 },
    { id: "bio", label: t('app.compl_bio'), done: (m.bio || "").trim().length >= 40, w: 15 },
    { id: "rep", label: t('app.compl_rep'), done: (m.repertoire || []).length >= 3, w: 20 },
    { id: "links", label: t('app.compl_links'), done: Object.values(m.links || {}).some(v => v), w: 10 },
    { id: "deep", label: t('app.compl_deep'), done: !!(m.deep && m.deep.done), w: 15 }
  ];
  const pct = steps.filter(s => s.done).reduce((a, s) => a + s.w, 0);
  return { pct, steps }; // BACKEND HOOK: stessa % come "profile strength" lato API
}
function completionCardHtml(m) {
  const c = profileCompleteness(m);
  if (c.pct >= 100) return `<div class="card flat completion-card"><b>${ic('check', 'ok')} ${t('app.compl_100')}</b><p class="view-sub" style="margin:6px 0 0">${t('app.compl_100_sub')}</p></div>`;
  const missing = c.steps.filter(s => !s.done);
  return `<div class="card flat completion-card">
    <div class="row-between"><b>${ic('sparkles')} ${t('app.compl_at', { pct: c.pct })}</b><span class="view-sub" style="font-size:.78rem">${t('app.compl_steps_left', { count: missing.length })}</span></div>
    <div class="cmp-bar"><i style="width:${c.pct}%"></i></div>
    <div class="cmp-steps">${missing.map(s => `<button class="cmp-step" type="button" data-step="${s.id}">${ic('plus')} ${esc(s.label)} <span class="cmp-w">+${s.w}%</span></button>`).join("")}</div>
  </div>`;
}
function saveMeFields() {
  const m = state.me, g = id => { const e = $(id); return e ? e.value.trim() : undefined; };
  const tag = g("#myTag"); if (tag !== undefined) m.tagline = tag;
  const bio = g("#myBio"); if (bio !== undefined) m.bio = bio;
  // Normalizza i link: sempre http(s):// o vuoto (mai schemi pericolosi né valori senza schema),
  // così il dato salvato è già valido per il backend e coerente col campo link-videolezione.
  const link = v => { if (v === undefined) return undefined; v = v.trim(); if (!v) return ""; return /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, ""); };
  const yt = link(g("#lkYt")), sp = link(g("#lkSp")), ig = link(g("#lkIg"));
  m.links = {
    youtube: yt !== undefined ? yt : m.links.youtube,
    spotify: sp !== undefined ? sp : m.links.spotify,
    instagram: ig !== undefined ? ig : m.links.instagram
  };
  save(); // BACKEND HOOK: PATCH /me (debounce)
}
// Esporta i dati del profilo (GDPR-style) come JSON scaricabile.
function exportMyData() {
  try {
    const data = JSON.stringify(state.me, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "jammate-profilo.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('app.data_exported'), ic('save')); // BACKEND HOOK: export GDPR completo lato server
  } catch (e) { toast(t('app.export_failed')); }
}

// ---------- Vista: Profilo ----------
function renderProfile(app) {
  const m = state.me;
  app.appendChild(el(`
    <div>
      <div style="text-align:center;margin-bottom:8px">
        <div class="avatar-wrap" id="meAvatar" title="${esc(t('app.profile_change_photo'))}">${avatarTag(m, true)}<span class="cam">${ic('camera')}</span></div>
        <h1 class="view-title" style="margin-bottom:0">${esc(m.name || t('app.profile_my_profile'))}${verifiedBadge(m)}</h1>
        <div class="loc">${ic('map-pin')} ${esc(m.city)} · ${esc(levelLabel(topLevel(m)))}</div>
        <div style="margin-top:8px"><span class="tag lvl">${jamBadge(m.jamCount).icon} ${t('app.profile_jams_played', { count: m.jamCount || 0 })}</span> <span class="view-sub" style="font-size:.78rem">${jamBadge(m.jamCount).tier}</span></div>
        <div style="margin-top:12px">${activitySummary(m)}</div>
        <div style="margin-top:8px"><button class="chip" id="roleChip" type="button" title="${esc(t('app.profile_manage_role'))}">${ic('resonance-profile')} ${esc(roleSummary(m))}</button></div>
        <button class="btn small secondary" id="previewProfile" style="margin-top:12px">${ic('search')} ${t('app.profile_preview')}</button>
      </div>
      <div id="completionCard">${completionCardHtml(m)}</div>
      ${hubGrid()}
      <div class="card flat">
        <div class="row-between"><b>${ic("resonance-profile")} Profilo Accordato</b> ${state.me.deep.done ? `<span class="tag lvl">${t('app.profile_pa_completed')}</span>` : `<span class="badge-new">${t('app.profile_new_badge')}</span>`}</div>
        <p class="view-sub" style="margin:8px 0 12px">${t('app.profile_pa_intro')}</p>
        ${state.me.deep.done
          ? `<div class="filter-row"><button class="btn small" id="reviewDeep">${ic('list')} ${t('app.profile_review_results')}</button><button class="btn small secondary" id="redoDeep">${ic('refresh')} ${t('app.profile_redo_survey')}</button></div>`
          : `<button class="btn" id="startDeep">${t('app.profile_start_pa')}</button>`}
      </div>
      <div class="hint">${ic('sparkles')} ${t('app.profile_rep_hint')}</div>
      <div class="section-label">${t('app.sheet_repertoire')}</div>
      <div class="card flat">
        <div class="add-rep">
          <div><label class="field">${t('app.rep_song_label')}</label><input type="text" id="repTitle" placeholder="${esc(t('app.rep_song_ph'))}"></div>
          <div><label class="field">${t('app.rep_artist_label')}</label><input type="text" id="repArtist" placeholder="${esc(t('app.rep_artist_ph'))}"></div>
        </div>
        <label class="field" style="margin-top:10px">${t('app.rep_keys_label')} <span class="view-sub" style="font-size:.76rem">${t('app.rep_keys_optional')}</span></label>
        <div class="chips" id="repKeys">${chips(KEYS, [])}</div>
        <div class="row-between" style="margin-top:10px">
          <label class="field" style="margin:0">${t('app.rep_your_instrument')}</label>
          <select id="repTrans" style="width:auto">${TRANSPOSERS.map((tr, i) => `<option value="${i}">${esc(transposerLabel(tr))}</option>`).join("")}</select>
        </div>
        <div class="rep-concert" id="repConcert" hidden></div>
        <button class="btn small" id="addRep" style="margin-top:12px">${ic('plus')} ${t('app.rep_add_song')}</button>
      </div>
      <div id="myRep"></div>
      <div class="section-label">${t('app.profile_tagline_label')}</div>
      <input type="text" id="myTag" placeholder="${esc(t('app.profile_tagline_ph'))}" value="${esc(m.tagline)}">
      <div class="section-label">${t('app.profile_instr_level')}</div>
      <div id="myIns"></div>
      <div id="myLevels" style="margin-top:10px"></div>
      <div class="section-label">${t('app.profile_genres')}</div><div class="chips" id="myGen">${chips(GENRES, m.genres, genreLabel)}</div>
      <div class="section-label">${t('app.profile_bio')}</div><textarea id="myBio" placeholder="${esc(t('app.profile_bio_ph'))}">${esc(m.bio)}</textarea>
      <div class="section-label">${t('app.profile_links_label')}</div>
      <input type="text" id="lkYt" placeholder="${esc(t('app.profile_link_yt'))}" value="${esc(m.links.youtube)}" style="margin-bottom:8px">
      <input type="text" id="lkSp" placeholder="${esc(t('app.profile_link_sp'))}" value="${esc(m.links.spotify)}" style="margin-bottom:8px">
      <input type="text" id="lkIg" placeholder="${esc(t('app.profile_link_ig'))}" value="${esc(m.links.instagram)}">
      <button class="btn" id="saveProfile" style="margin-top:20px">${t('app.profile_save')}</button>
      <div class="section-label">${t('app.profile_role_premium')}${(!state.guide || !state.guide.seen) ? ` <span class="badge-new">${t('app.profile_new_badge')}</span>` : ""}</div>
      <div class="card flat">
        <label class="set-row"><span>${t('app.profile_cap_plays')} <span class="view-sub" style="font-size:.74rem">${t('app.profile_cap_plays_sub')}</span></span><input type="checkbox" id="capPlays" ${m.caps && m.caps.plays ? "checked" : ""}></label>
        <label class="set-row"><span>${t('app.profile_cap_hires')} <span class="view-sub" style="font-size:.74rem">${t('app.profile_cap_hires_sub')}</span></span><input type="checkbox" id="capHires" ${m.caps && m.caps.hires ? "checked" : ""}></label>
        <p class="view-sub" style="font-size:.74rem;margin:6px 0 0">${t('app.profile_role_note')}</p>
      </div>
      ${menuRows('hub')}
      <p class="view-sub" style="text-align:center;margin-top:18px;opacity:.55">${t('app.profile_proto_version')}</p>
    </div>`));
  paintMyRep();
  $("#meAvatar").onclick = pickPhoto;
  if ($("#startDeep")) $("#startDeep").onclick = () => openDeepSurvey();
  if ($("#reviewDeep")) $("#reviewDeep").onclick = openDeepResults;
  if ($("#redoDeep")) $("#redoDeep").onclick = () => openDeepSurvey();
  // Repertorio: tonalità facoltativa/multipla + tonalità reale (concert) per traspositori.
  const repSelKeys = [];
  const repTrans = $("#repTrans");
  repTrans.value = transposeIdxForSemi(defaultTransposeFor(m.instruments));
  const updateConcert = () => {
    const semi = TRANSPOSERS[+repTrans.value].semi, box = $("#repConcert");
    if (!repSelKeys.length || !semi) { box.hidden = true; box.textContent = ""; return; }
    const concert = repSelKeys.map(k => concertKey(k, semi)).filter(Boolean);
    box.hidden = false; box.innerHTML = t('app.rep_real_key', { keys: esc(concert.join(", ")) });
  };
  app.querySelectorAll("#repKeys .chip").forEach(c => c.onclick = () => { toggleChip(c, repSelKeys); updateConcert(); });
  repTrans.onchange = updateConcert;
  $("#addRep").onclick = () => {
    const title = $("#repTitle").value.trim(); if (!title) return markFieldError("#repTitle", t('app.rep_title_required'));
    const artist = $("#repArtist").value.trim();
    if (m.repertoire.some(r => songKey(r) === songKey({ title, artist }))) return toast(t('app.rep_already_in'));
    const semi = TRANSPOSERS[+repTrans.value].semi;
    m.repertoire.push({ title, artist, keys: repSelKeys.slice(), transpose: semi });
    save(); $("#repTitle").value = ""; $("#repArtist").value = "";
    repSelKeys.length = 0; app.querySelectorAll("#repKeys .chip.on").forEach(c => c.classList.remove("on")); updateConcert();
    paintMyRep(); refreshCompletion(); toast(t('app.rep_song_added'), ic('music-note'));
  };
  // Strumenti: campo a ricerca con tag + "Altro" (al posto dei chip fissi).
  instrumentPicker($("#myIns"), m.instruments, { onChange: () => { syncLevels(); paintMyLevels(); m.level = topLevel(m); save(); }, placeholder: t('app.ob_search_instrument_ph') });
  app.querySelectorAll("#myGen .chip").forEach(c => c.onclick = () => { toggleChip(c, m.genres); save(); refreshCompletion(); });
  syncLevels(); paintMyLevels();
  $("#saveProfile").onclick = () => {
    saveMeFields(); m.level = topLevel(m); save(); refreshCompletion(); toast(t('app.profile_saved'), ic('check', 'ok'));
  };
  app.querySelectorAll(".hub-item").forEach(b => b.onclick = () => navigate(b.dataset.go));
  if ($("#capPlays")) $("#capPlays").onchange = (e) => { m.caps.plays = e.target.checked; save(); toast(e.target.checked ? t('app.disc_musician_active') : t('app.role_listener_mode'), ic("check", "ok")); };
  if ($("#capHires")) $("#capHires").onchange = (e) => { m.caps.hires = e.target.checked; save(); toast(e.target.checked ? t('app.role_can_hire') : t('app.updated'), ic("check", "ok")); };
  if ($("#roleChip")) $("#roleChip").onclick = () => { const t = $("#capPlays"); if (t) { (t.closest(".card") || t).scrollIntoView({ behavior: "smooth", block: "center" }); try { t.focus(); } catch (_) {} } };
  if ($("#hubPages")) $("#hubPages").onclick = () => { if (typeof openPages === "function") openPages(); };
  if ($("#hubPro")) $("#hubPro").onclick = openPro;
  if ($("#hubVerify")) $("#hubVerify").onclick = openVerify;
  if ($("#hubBoost")) $("#hubBoost").onclick = openBoost;
  $("#hubSettings").onclick = openSettings;
  $("#hubHelp").onclick = openHelp;
  $("#hubReport").onclick = openReportProblem;
  // Auto-save (niente più perdita dati): testo su blur, generi on-toggle (sopra).
  ["#myTag", "#myBio", "#lkYt", "#lkSp", "#lkIg"].forEach(sel => { const e = $(sel); if (e) e.addEventListener("blur", () => { saveMeFields(); refreshCompletion(); }); });
  function refreshCompletion() {
    const box = $("#completionCard"); if (!box) return;
    box.innerHTML = completionCardHtml(state.me);
    box.querySelectorAll(".cmp-step").forEach(b => b.onclick = () => goToStep(b.dataset.step));
  }
  function goToStep(id) {
    if (id === "deep") return openDeepSurvey();
    if (id === "photo") return pickPhoto();
    const map = { instr: "#myIns", genres: "#myGen", bio: "#myBio", rep: "#repTitle", links: "#lkYt" };
    const t = map[id] && app.querySelector(map[id]); if (t) { try { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.focus(); } catch (_) {} }
  }
  app.querySelectorAll("#completionCard .cmp-step").forEach(b => b.onclick = () => goToStep(b.dataset.step));
  if ($("#previewProfile")) $("#previewProfile").onclick = () => openProfileSheet(state.me, { preview: true });
}
// Mantiene allineata la mappa livelli agli strumenti selezionati.
function syncLevels() {
  const m = state.me;
  m.levels = m.levels || {};
  m.instruments.forEach(i => { if (!m.levels[i]) m.levels[i] = m.level || LEVELS[2]; });
  Object.keys(m.levels).forEach(i => { if (!m.instruments.includes(i)) delete m.levels[i]; });
}
// Una riga "strumento → livello" per ogni strumento selezionato.
function paintMyLevels() {
  const box = $("#myLevels"); if (!box) return;
  if (!state.me.instruments.length) { box.innerHTML = `<p class="view-sub">${t('app.ob_pick_instrument_hint')}</p>`; return; }
  box.innerHTML = "";
  state.me.instruments.forEach(inst => {
    const row = el(`<div class="lvl-row"><span class="lvl-inst">${esc(vocabLabel(inst))}</span><select>${options(LEVELS, state.me.levels[inst] || LEVELS[2], null, levelLabel)}</select></div>`);
    row.querySelector("select").onchange = e => { state.me.levels[inst] = e.target.value; state.me.level = topLevel(state.me); save(); };
    box.appendChild(row);
  });
}
function paintMyRep() {
  const box = $("#myRep"); if (!box) return;
  if (!state.me.repertoire.length) return box.innerHTML = `<p class="view-sub">${t('app.rep_none_yet')}</p>`;
  box.innerHTML = "";
  const featCount = state.me.repertoire.filter(r => r.featured).length;
  // I "cavalli di battaglia" (in evidenza) vanno in cima.
  const items = state.me.repertoire.map((r, i) => ({ r, i })).sort((a, b) => (b.r.featured ? 1 : 0) - (a.r.featured ? 1 : 0));
  items.forEach(({ r, i }) => {
    const written = repWrittenKeys(r), concert = repConcertKeys(r);
    const showC = (r.transpose || 0) && concert.length && concert.join() !== written.join();
    const keyHtml = written.length
      ? `<span class="key-badge">${esc(written.join(", "))}</span>${showC ? `<span class="key-badge concert" title="${esc(t('app.rep_real_key_title'))}">🎹 ${esc(concert.join(", "))}</span>` : ""}`
      : `<span class="key-badge muted">—</span>`;
    const row = el(`<div class="rep-item${r.featured ? " featured" : ""}"><div><div class="song">${esc(r.title)}</div><div class="artist">${esc(r.artist || "")}</div></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">${keyHtml}
        <button class="rep-star${r.featured ? " on" : ""}" data-feat="1" aria-label="${esc(r.featured ? t('app.rep_unstar') : t('app.rep_star'))}" title="${esc(t('app.rep_featured_title'))}">${ic('star')}</button>
        <button class="rep-del" data-del="1" aria-label="${esc(t('app.rep_remove_song'))}">${ic('x')}</button></div></div>`);
    row.querySelector("[data-del]").onclick = () => { state.me.repertoire.splice(i, 1); save(); paintMyRep(); };
    row.querySelector("[data-feat]").onclick = () => {
      if (!r.featured && featCount >= 3) return toast(t('app.rep_max_featured'));
      r.featured = !r.featured; save(); haptic("Light"); paintMyRep();
    };
    box.appendChild(row);
  });
}

// ======================================================================
// Cassetta degli Attrezzi: Metronomo + Accordatore
// ======================================================================
// Persistenza stato strumenti fra sessioni (#4) + ponte col repertorio (#1).
function persistMetro() {
  state.tools = state.tools || {};
  state.tools.metro = { bpm: metro.bpm, meterId: metro.meterId, sound: metro.sound, accentDownbeat: metro.accentDownbeat };
  save(); // BACKEND HOOK: PUT /me/preferences.tools
}
function hydrateTools() {
  state.tools = state.tools || {};
  const m = state.tools.metro;
  if (m) { if (m.bpm) metro.bpm = m.bpm; if (m.meterId) metro.meterId = m.meterId; if (m.sound) metro.sound = m.sound; if (m.accentDownbeat != null) metro.accentDownbeat = m.accentDownbeat; }
  const t = state.tools.tuner;
  if (t && t.a4) tuner.a4 = t.a4;
}
function persistTuner() { state.tools = state.tools || {}; state.tools.tuner = { a4: tuner.a4, tuningId: state.me.tuningId }; save(); }
// Etichetta agogica italiana dal BPM.
function tempoLabel(bpm) {
  if (bpm < 60) return t('app.tempo_largo'); if (bpm < 76) return t('app.tempo_adagio'); if (bpm < 108) return t('app.tempo_andante');
  if (bpm < 120) return t('app.tempo_moderato'); if (bpm < 156) return t('app.tempo_allegro'); if (bpm < 176) return t('app.tempo_vivace'); return t('app.tempo_presto');
}
// Brani del repertorio con un BPM impostato (ponte metronomo↔repertorio).
function songsWithBpm() { return (state.me.repertoire || []).map((r, i) => ({ r, i })).filter(x => x.r.bpm); }
function applyMetroFromSong(r) {
  if (r.bpm) metro.bpm = Math.max(40, Math.min(240, r.bpm));
  if (r.meterId) metro.meterId = r.meterId;
  persistMetro();
}

function renderTools(app) {
  hydrateTools();
  app.appendChild(el(`
    <div>
      <h1 class="view-title">${t('app.tools_title')} ${ic('sliders', 'accent')}</h1>
      <p class="view-sub">${t('app.tools_sub')}</p>
      <div class="segmented" id="toolTabs">
        <button id="tMetro" class="on">${ic('clock')} ${t('app.tools_metronome')}</button>
        <button id="tTuner">${ic('music-note')} ${t('app.tools_tuner')}</button>
      </div>
      <div id="toolBody"></div>
    </div>`));
  const setTab = (which) => {
    $("#tMetro").classList.toggle("on", which === "metro");
    $("#tTuner").classList.toggle("on", which === "tuner");
    if (typeof applyToggleA11y === "function") applyToggleA11y($("#toolTabs"));
  };
  $("#tMetro").onclick = () => { setTab("metro"); stopTuner(); renderMetronome($("#toolBody")); };
  $("#tTuner").onclick = () => { setTab("tuner"); stopMetronome(); renderTuner($("#toolBody")); };
  if (typeof applyToggleA11y === "function") applyToggleA11y($("#toolTabs"));
  renderMetronome($("#toolBody"));
}

// ----- Metronomo (Web Audio) -----
const metro = { ctx: null, playing: false, bpm: 100, meterId: "4/4", accentDownbeat: true, current: 0, nextTime: 0, timer: null, taps: [], sound: "beep" };
// Tempi: semplici (battito = 1/4) e composti (battito = 1/8, raggruppato per 3).
// accents = indici dei click accentati (inizio di ogni gruppo); il primo è il più forte.
const METERS = [
  { id: "2/4", clicks: 2, accents: [0], groups: [2] },
  { id: "3/4", clicks: 3, accents: [0], groups: [3] },
  { id: "4/4", clicks: 4, accents: [0], groups: [4] },
  { id: "5/4", clicks: 5, accents: [0], groups: [5] },
  { id: "6/4", clicks: 6, accents: [0], groups: [6] },
  { id: "3/8", clicks: 3, accents: [0], groups: [3], compound: true },
  { id: "6/8", clicks: 6, accents: [0, 3], groups: [3, 3], compound: true },
  { id: "9/8", clicks: 9, accents: [0, 3, 6], groups: [3, 3, 3], compound: true },
  { id: "12/8", clicks: 12, accents: [0, 3, 6, 9], groups: [3, 3, 3, 3], compound: true }
];
function curMeter() { return METERS.find(m => m.id === metro.meterId) || METERS[2]; }
// Timbri selezionabili del click (#8): forma d'onda + frequenze accento/normale.
const METRO_SOUNDS = {
  beep:    { name: "Beep",    type: "sine",     hi: 1500, lo: 900 },
  click:   { name: "Click",   type: "square",   hi: 2000, lo: 1200 },
  legno:   { name: "Legno",   type: "triangle", hi: 1200, lo: 760 },
  cowbell: { name: "Cowbell", type: "sawtooth", hi: 820,  lo: 540 }
};
function renderMetronome(box) {
  box.innerHTML = "";
  const songs = songsWithBpm();
  const presets = state.metroPresets || [];
  box.appendChild(el(`
    <div class="tool-card">
      <div class="bpm-display"><span id="bpmVal">${metro.bpm}</span><br><small>BPM · <span id="tempoLbl">${tempoLabel(metro.bpm)}</span></small></div>
      <div class="beat-dots" id="beatDots" aria-hidden="true"></div>
      <input type="range" id="bpmRange" min="40" max="240" value="${metro.bpm}" aria-label="${esc(t('app.metro_bpm_aria'))}">
      <div class="bpm-controls">
        <button id="bpmMinus" aria-label="${esc(t('app.metro_decrease_bpm'))}">−</button>
        <button class="btn" id="metroToggle">${metro.playing ? t('app.metro_stop') : t('app.metro_start')}</button>
        <button id="bpmPlus" aria-label="${esc(t('app.metro_increase_bpm'))}">+</button>
      </div>
      <div class="row-between" style="margin-top:6px">
        <button class="btn secondary small" id="tapTempo">${ic('clock')} ${t('app.metro_tap_tempo')}</button>
        <select id="beatsSel" style="width:auto" aria-label="${esc(t('app.metro_meter_aria'))}">
          <optgroup label="${esc(t('app.metro_simple'))}">${METERS.filter(m => !m.compound).map(m => `<option value="${m.id}"${m.id === metro.meterId ? " selected" : ""}>${m.id}</option>`).join("")}</optgroup>
          <optgroup label="${esc(t('app.metro_compound'))}">${METERS.filter(m => m.compound).map(m => `<option value="${m.id}"${m.id === metro.meterId ? " selected" : ""}>${m.id}</option>`).join("")}</optgroup>
        </select>
        <select id="soundSel" style="width:auto" aria-label="${esc(t('app.metro_click_timbre'))}">
          ${Object.entries(METRO_SOUNDS).map(([k, s]) => `<option value="${k}"${k === metro.sound ? " selected" : ""}>${esc(s.name)}</option>`).join("")}
        </select>
      </div>
      <label class="metro-accent"><input type="checkbox" id="accentTgl"${metro.accentDownbeat ? " checked" : ""}> ${t('app.metro_accent')} <span class="view-sub" style="font-size:.76rem">${t('app.metro_accent_sub')}</span></label>
      ${songs.length ? `<div class="section-label" style="margin-top:14px">${ic('music-note')} ${t('app.metro_from_repertoire')}</div>
        <div class="song-chips" id="songChips">${songs.map(x => `<button class="song-chip" type="button" data-song="${x.i}">${esc(x.r.title)} · ${x.r.bpm}</button>`).join("")}</div>` : ""}
      <div class="section-label" style="margin-top:14px">${t('app.metro_preset')}</div>
      ${presets.length ? `<div class="filter-row">
        <select id="presetSel" style="flex:1" aria-label="${esc(t('app.metro_your_presets_aria'))}">
          <option value="">${t('app.metro_your_presets_opt')}</option>
          ${presets.map((p, i) => `<option value="${i}">${esc(p.name)} · ${p.bpm} BPM · ${esc(p.meterId || (p.beats ? p.beats + "/4" : "4/4"))}</option>`).join("")}
        </select>
        <button class="btn small" id="savePreset">${ic('save')} ${t('app.metro_save')}</button>
      </div>` : `<div class="empty" style="padding:18px">${illus("quiet")}${t('app.metro_no_presets')}<button class="btn small" id="savePreset" style="margin-top:10px">${ic('save')} ${t('app.metro_save_first_preset')}</button></div>`}
      <div id="presetActions"></div>
    </div>`));
  drawBeatDots();
  const setBpm = (v) => { metro.bpm = Math.max(40, Math.min(240, v)); $("#bpmVal").textContent = metro.bpm; $("#bpmRange").value = metro.bpm; const tl = $("#tempoLbl"); if (tl) tl.textContent = tempoLabel(metro.bpm); persistMetro(); };
  $("#bpmRange").oninput = e => setBpm(+e.target.value);
  $("#bpmMinus").onclick = () => setBpm(metro.bpm - 1);
  $("#bpmPlus").onclick = () => setBpm(metro.bpm + 1);
  $("#beatsSel").onchange = e => { metro.meterId = e.target.value; metro.current = 0; drawBeatDots(); persistMetro(); };
  $("#soundSel").onchange = e => { metro.sound = e.target.value; persistMetro(); clickPreview(); };
  $("#accentTgl").onchange = e => { metro.accentDownbeat = e.target.checked; drawBeatDots(); persistMetro(); };
  $("#metroToggle").onclick = toggleMetronome;
  $("#tapTempo").onclick = tapTempo;
  if ($("#savePreset")) $("#savePreset").onclick = () => saveMetroPreset(box);
  const chips = $("#songChips");
  if (chips) chips.querySelectorAll("[data-song]").forEach(b => b.onclick = () => {
    const r = state.me.repertoire[+b.dataset.song]; if (!r) return;
    applyMetroFromSong(r); haptic("Light"); renderMetronome(box); toast(t('app.metro_on_song', { song: r.title }), ic('music-note', 'accent'));
  });
  const ps = $("#presetSel");
  if (ps) ps.onchange = e => {
    const i = e.target.value; const acts = $("#presetActions"); acts.innerHTML = "";
    if (i === "") return;
    const p = (state.metroPresets || [])[+i]; if (!p) return;
    const row = el(`<div class="filter-row" style="margin-top:8px">
      <button class="btn small" id="loadPreset">${t('app.metro_load_preset', { name: esc(p.name) })}</button>
      <button class="btn small secondary" id="delPreset">${ic('x')} ${t('app.metro_delete')}</button></div>`);
    acts.appendChild(row);
    $("#loadPreset").onclick = () => loadMetroPreset(+i, box);
    $("#delPreset").onclick = () => openConfirm(t('app.metro_delete_preset_q'), t('app.metro_delete_preset_body', { name: p.name }), { yes: t('app.metro_delete'), danger: true }, () => {
      state.metroPresets.splice(+i, 1); save(); toast(t('app.metro_preset_deleted')); renderMetronome(box);
    });
  };
}
// Salva BPM + metro + suono come preset (bottom-sheet, niente più prompt nativo).
function saveMetroPreset(box) {
  const songs = state.me.repertoire || [];
  openModal(`<h2 style="margin-top:0">${ic('save')} ${t('app.metro_save_preset_title')}</h2>
    <p class="view-sub">${t('app.metro_save_preset_summary', { bpm: metro.bpm, meter: esc(metro.meterId), sound: esc((METRO_SOUNDS[metro.sound] || {}).name || metro.sound) })}</p>
    <label class="field">${t('app.metro_name_label')}</label>
    <input type="text" id="presetName" value="${esc(t('app.metro_default_preset_name', { n: (state.metroPresets || []).length + 1 }))}" autocomplete="off">
    ${songs.length ? `<label class="field" style="margin-top:10px">${t('app.metro_link_song')}</label>
      <select id="presetSong"><option value="">${t('app.metro_link_none')}</option>${songs.map((r, i) => `<option value="${i}">${esc(r.title)}</option>`).join("")}</select>` : ""}
    <button class="btn" id="presetSave" style="margin-top:16px">${t('app.metro_save_preset_btn')}</button>`);
  const inp = $("#presetName");
  const doSave = () => {
    const name = (inp.value || "").trim(); if (!name) return markFieldError(inp, t('app.metro_name_required'));
    const songSel = $("#presetSong"); const li = (songSel && songSel.value !== "") ? +songSel.value : null;
    state.metroPresets = state.metroPresets || [];
    state.metroPresets.push({ name, bpm: metro.bpm, meterId: metro.meterId, accentDownbeat: metro.accentDownbeat, sound: metro.sound, linkSongIdx: li });
    if (li != null && state.me.repertoire[li]) { state.me.repertoire[li].bpm = metro.bpm; state.me.repertoire[li].meterId = metro.meterId; } // ponte: BPM sul brano
    save(); closeModal(); toast(t('app.metro_preset_saved'), ic('save')); renderMetronome(box);
  };
  $("#presetSave").onclick = doSave;
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
  setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 40);
}
function loadMetroPreset(i, box) {
  const p = (state.metroPresets || [])[i]; if (!p) return;
  const wasPlaying = metro.playing; if (wasPlaying) stopMetronome();
  metro.bpm = p.bpm;
  metro.meterId = p.meterId || (p.beats ? p.beats + "/4" : "4/4");
  metro.accentDownbeat = p.accentDownbeat !== false;
  metro.sound = p.sound || "beep"; metro.current = 0;
  renderMetronome(box); toast(t('app.metro_preset_loaded', { name: p.name }));
  if (wasPlaying) toggleMetronome();
}
// Breve anteprima udibile del timbro scelto.
function clickPreview() { try { ensureCtx(); clickAt(metro.ctx.currentTime + 0.02, true); } catch (e) {} }
function drawBeatDots() {
  const d = $("#beatDots"); if (!d) return;
  const M = curMeter(); d.innerHTML = "";
  for (let i = 0; i < M.clicks; i++) {
    const isAccent = metro.accentDownbeat && M.accents.includes(i);
    const dot = el(`<i class="${isAccent ? (i === 0 ? "accent" : "accent2") : ""}"></i>`);
    if (M.compound && i > 0 && M.accents.includes(i)) dot.style.marginLeft = "10px"; // stacco fra i gruppi
    d.appendChild(dot);
  }
}
function ensureCtx() { if (!metro.ctx) metro.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (metro.ctx.state === "suspended") metro.ctx.resume(); return metro.ctx; }
function toggleMetronome() {
  if (metro.playing) return stopMetronome(true);
  ensureCtx(); metro.playing = true; metro.current = 0; metro.nextTime = metro.ctx.currentTime + 0.05;
  metro.timer = setInterval(metroScheduler, 25);
  const b = $("#metroToggle"); if (b) b.textContent = t('app.metro_stop');
}
function stopMetronome(updateBtn) {
  metro.playing = false; if (metro.timer) clearInterval(metro.timer); metro.timer = null;
  document.querySelectorAll("#beatDots i").forEach(i => i.classList.remove("on"));
  if (updateBtn) { const b = $("#metroToggle"); if (b) b.textContent = t('app.metro_start'); }
}
function metroScheduler() {
  if (!metro.playing) return;
  const M = curMeter();
  while (metro.nextTime < metro.ctx.currentTime + 0.12) {
    const level = !metro.accentDownbeat ? 0 : (metro.current === 0 ? 2 : (M.accents.includes(metro.current) ? 1 : 0));
    clickAt(metro.nextTime, level);
    const beat = metro.current, when = metro.nextTime;
    setTimeout(() => flashBeat(beat), Math.max(0, (when - metro.ctx.currentTime) * 1000));
    metro.nextTime += 60 / metro.bpm;
    metro.current = (metro.current + 1) % M.clicks;
  }
}
function clickAt(time, accent) {
  const s = METRO_SOUNDS[metro.sound] || METRO_SOUNDS.beep;
  const lvl = accent === true ? 2 : (+accent || 0); // 0 normale · 1 gruppo · 2 primo movimento
  const o = metro.ctx.createOscillator(), g = metro.ctx.createGain();
  o.type = s.type;
  o.frequency.value = lvl >= 1 ? s.hi : s.lo;
  const peak = lvl === 2 ? 0.7 : lvl === 1 ? 0.52 : 0.4;
  g.gain.setValueAtTime(0.001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  o.connect(g).connect(metro.ctx.destination); o.start(time); o.stop(time + 0.06);
}
function flashBeat(beat) {
  const dots = document.querySelectorAll("#beatDots i"); if (!dots.length) return;
  dots.forEach(d => d.classList.remove("on")); if (dots[beat]) dots[beat].classList.add("on");
}
function tapTempo() {
  const now = performance.now(); metro.taps.push(now); metro.taps = metro.taps.filter(t => now - t < 2500);
  if (metro.taps.length >= 2) {
    let sum = 0; for (let i = 1; i < metro.taps.length; i++) sum += metro.taps[i] - metro.taps[i - 1];
    const bpm = Math.round(60000 / (sum / (metro.taps.length - 1)));
    metro.bpm = Math.max(40, Math.min(240, bpm)); $("#bpmVal").textContent = metro.bpm; $("#bpmRange").value = metro.bpm;
  }
}

// ----- Accordatore (microfono + toni di riferimento) -----
const tuner = { ctx: null, analyser: null, stream: null, raf: null, osc: null, a4: 440, transposeIdx: null, hist: [] };
const NOTE_IT = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const GUITAR = [["Mi", 82.41], ["La", 110.0], ["Re", 146.83], ["Sol", 196.0], ["Si", 246.94], ["Mi", 329.63]];
// Strumenti traspositori (#13): semitoni da aggiungere alla nota reale per ottenere
// la nota LETTA dallo strumentista (es. Si♭ legge un tono sopra il suono reale).
const TRANSPOSERS = [
  { name: "Do — non traspositore", key: "app.trans_c", semi: 0 },
  { name: "Si♭ — tromba, clarinetto, sax tenore", key: "app.trans_bb", semi: 2 },
  { name: "Mi♭ — sax contralto / baritono", key: "app.trans_eb", semi: 9 },
  { name: "Fa — corno francese", key: "app.trans_f", semi: 7 }
];
// Localized transposer label (the .name field is the Italian source; the catalog key drives the rest).
function transposerLabel(tr) { return (tr && tr.key) ? t(tr.key) : (tr ? tr.name : ""); }
function noteName(midi) { const n = ((midi % 12) + 12) % 12; return NOTE_IT[n] + (Math.floor(midi / 12) - 1); }
// Accordature di riferimento per famiglia di strumento (#2 multi-strumento).
const TUNINGS = {
  "Chitarra": { label: "Chitarra · Standard", key: "app.tuning_guitar", tones: [["Mi", 82.41, "6ª"], ["La", 110.0, "5ª"], ["Re", 146.83, "4ª"], ["Sol", 196.0, "3ª"], ["Si", 246.94, "2ª"], ["Mi", 329.63, "1ª"]] },
  "ChitarraDropD": { label: "Chitarra · Drop D", key: "app.tuning_guitar_dropd", tones: [["Re", 73.42, "6ª"], ["La", 110.0, "5ª"], ["Re", 146.83, "4ª"], ["Sol", 196.0, "3ª"], ["Si", 246.94, "2ª"], ["Mi", 329.63, "1ª"]] },
  "Basso": { label: "Basso · 4 corde", key: "app.tuning_bass", tones: [["Mi", 41.20, "4ª"], ["La", 55.0, "3ª"], ["Re", 73.42, "2ª"], ["Sol", 98.0, "1ª"]] },
  "Basso5": { label: "Basso · 5 corde", key: "app.tuning_bass5", tones: [["Si", 30.87, "5ª"], ["Mi", 41.20, "4ª"], ["La", 55.0, "3ª"], ["Re", 73.42, "2ª"], ["Sol", 98.0, "1ª"]] },
  "Violino": { label: "Violino", key: "app.tuning_violin", tones: [["Sol", 196.0, ""], ["Re", 293.66, ""], ["La", 440.0, ""], ["Mi", 659.26, ""]] },
  "Violoncello": { label: "Violoncello", key: "app.tuning_cello", tones: [["Do", 65.41, ""], ["Sol", 98.0, ""], ["Re", 146.83, ""], ["La", 220.0, ""]] },
  "Ukulele": { label: "Ukulele · GCEA", key: "app.tuning_ukulele", tones: [["Sol", 392.0, ""], ["Do", 261.63, ""], ["Mi", 329.63, ""], ["La", 440.0, ""]] }
};
// Localized tuning label (the .label field is the Italian source; the catalog key drives the rest).
function tuningLabel(tun) { return (tun && tun.key) ? t(tun.key) : (tun ? tun.label : ""); }
function guessTuningFor(instruments) {
  const ins = (instruments || []).join(" ").toLowerCase();
  if (ins.includes("basso")) return "Basso";
  if (ins.includes("violoncello")) return "Violoncello";
  if (ins.includes("violino") || ins.includes("viola")) return "Violino";
  if (ins.includes("ukulele")) return "Ukulele";
  return "Chitarra";
}
function curTuning() { return TUNINGS[state.me.tuningId] || TUNINGS[guessTuningFor(state.me.instruments)] || TUNINGS["Chitarra"]; }
function renderTuner(box) {
  box.innerHTML = "";
  if (tuner.transposeIdx == null) tuner.transposeIdx = transposeIdxForSemi(state.me.tunerTranspose != null ? state.me.tunerTranspose : defaultTransposeFor(state.me.instruments));
  if (!state.me.tuningId || !TUNINGS[state.me.tuningId]) state.me.tuningId = guessTuningFor(state.me.instruments);
  const tun = curTuning();
  box.appendChild(el(`
    <div class="tool-card">
      <div class="tuner-dual">
        <div class="tuner-side"><span class="tuner-cap">${ic('music-note')} ${t('app.tuner_real_piano')}</span><div class="tuner-note" id="tConcert">—</div></div>
        <div class="tuner-side played" id="tPlayedWrap" hidden><span class="tuner-cap">${ic('microphone')} ${t('app.tuner_read_instrument')}</span><div class="tuner-note alt" id="tPlayed">—</div></div>
      </div>
      <div class="tuner-cents" id="tFreq" aria-live="polite">${t('app.tuner_start_to_tune')}</div>
      <div class="tuner-meter" id="tMeter"><div class="center"></div><div class="needle" id="tNeedle"></div></div>
      <button class="btn" id="tStart" style="margin-top:14px">${ic('microphone')} ${t('app.tuner_start_btn')}</button>
      <p class="view-sub" id="tHint" style="margin-top:10px">${t('app.tuner_mic_note')}</p>
    </div>
    <div class="tool-card">
      <div class="section-label" style="margin-top:0">${t('app.tuner_your_instrument')}</div>
      <p class="view-sub">${t('app.tuner_real_vs_read')}</p>
      <select id="tTrans">${TRANSPOSERS.map((tr, i) => `<option value="${i}"${i === tuner.transposeIdx ? " selected" : ""}>${esc(transposerLabel(tr))}</option>`).join("")}</select>
      <div class="row-between" style="margin-top:14px">
        <label class="field" style="margin:0">${t('app.tuner_calibration')}</label>
        <span class="range-val" id="a4Val">${tuner.a4} Hz</span>
      </div>
      <input type="range" id="a4Range" min="430" max="446" step="1" value="${tuner.a4}" aria-label="${esc(t('app.tuner_calibration_aria'))}">
    </div>
    <div class="tool-card">
      <div class="section-label" style="margin-top:0">${ic('sliders')} ${t('app.tuner_ref_tuning')}</div>
      <select id="tuningSel" aria-label="${esc(t('app.tuner_tuning_aria'))}">${Object.entries(TUNINGS).map(([k, tun]) => `<option value="${k}"${k === state.me.tuningId ? " selected" : ""}>${esc(tuningLabel(tun))}</option>`).join("")}</select>
      <p class="view-sub" style="margin-top:8px">${t('app.tuner_tap_string')}</p>
      <div class="ref-tones" id="refTones">${tun.tones.map((g, i) => `<button data-freq="${g[1]}" data-i="${i}">${g[0]}<br><small style="font-weight:600;color:var(--muted)">${esc(g[2] || "")}</small></button>`).join("")}</div>
    </div>`));
  $("#tStart").onclick = startTuner;
  $("#tTrans").onchange = e => { tuner.transposeIdx = +e.target.value; state.me.tunerTranspose = TRANSPOSERS[tuner.transposeIdx].semi; save(); };
  $("#a4Range").oninput = e => { tuner.a4 = +e.target.value; $("#a4Val").textContent = tuner.a4 + " Hz"; };
  $("#a4Range").onchange = () => persistTuner();
  $("#tuningSel").onchange = e => { state.me.tuningId = e.target.value; persistTuner(); renderTuner(box); };
  $("#refTones").querySelectorAll("button").forEach(b => b.onclick = () => playRef(+b.dataset.freq, b));
}
async function startTuner() {
  const btn = $("#tStart");
  try {
    tuner.ctx = tuner.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (tuner.ctx.state === "suspended") await tuner.ctx.resume();
    if (!tuner.stream) tuner.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    // La vista accordatore potrebbe essere stata smontata mentre il permesso era in sospeso:
    // rilascia subito il microfono appena acquisito invece di avviare un loop fuori vista.
    if (!$("#tConcert")) { stopTuner(); return; }
    const src = tuner.ctx.createMediaStreamSource(tuner.stream);
    tuner.analyser = tuner.ctx.createAnalyser(); tuner.analyser.fftSize = 2048;
    src.connect(tuner.analyser);
    if (btn) { btn.textContent = t('app.tuner_stop'); btn.onclick = () => { stopTuner(); renderTuner($("#toolBody")); }; }
    $("#tHint").textContent = t('app.tuner_play_a_note');
    detectPitch();
  } catch (e) {
    const hint = $("#tHint");
    if (hint) hint.innerHTML = `${ic('alert-triangle')} ${t('app.tuner_mic_denied')} <button class="btn small secondary" id="tRetryMic" style="margin-top:8px">${ic('refresh')} ${t('app.tuner_retry_mic')}</button>`;
    const rb = $("#tRetryMic"); if (rb) rb.onclick = startTuner;
  }
}
function stopTuner() {
  if (tuner.raf) cancelAnimationFrame(tuner.raf); tuner.raf = null;
  if (tuner.stream) { tuner.stream.getTracks().forEach(t => t.stop()); tuner.stream = null; }
  if (tuner.osc) { try { tuner.osc.stop(); } catch (e) {} tuner.osc = null; }
}
function detectPitch() {
  if (tuner.raf) { cancelAnimationFrame(tuner.raf); tuner.raf = null; } // evita loop rAF doppi su re-start
  const buf = new Float32Array(tuner.analyser.fftSize);
  const loop = () => {
    // Se la vista accordatore è stata smontata (navigate/back), ferma il loop e rilascia il microfono.
    if (!$("#tConcert")) { stopTuner(); return; }
    // Analizza ~1 frame su 3: l'autocorrelazione è costosa e 20 letture/s bastano per un accordatore.
    tuner._fc = (tuner._fc || 0) + 1;
    if (tuner._fc % 3) { tuner.raf = requestAnimationFrame(loop); return; }
    tuner.analyser.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, tuner.ctx.sampleRate);
    const concertEl = $("#tConcert"), playedEl = $("#tPlayed"), playedWrap = $("#tPlayedWrap"), freqEl = $("#tFreq"), meter = $("#tMeter"), needle = $("#tNeedle");
    if (concertEl && freq > 0) {
      const a4 = tuner.a4 || 440;
      const midi = Math.round(12 * Math.log2(freq / a4) + 69);
      const ref = a4 * Math.pow(2, (midi - 69) / 12);
      const cents = Math.round(1200 * Math.log2(freq / ref));
      // Mediana delle ultime letture: smorza il jitter e migliora la precisione (#14).
      tuner.hist.push(cents); if (tuner.hist.length > 6) tuner.hist.shift();
      const cs = [...tuner.hist].sort((a, b) => a - b)[Math.floor(tuner.hist.length / 2)];
      concertEl.textContent = noteName(midi);
      const tr = TRANSPOSERS[tuner.transposeIdx || 0];
      if (tr && tr.semi) { playedWrap.hidden = false; playedEl.textContent = noteName(midi + tr.semi); }
      else { playedWrap.hidden = true; }
      const tuned = Math.abs(cs) <= 5;
      const status = tuned ? `${ic('resonance-profile')} ${t('app.tuner_in_resonance')}` : (cs < 0 ? t('app.tuner_flat') : t('app.tuner_sharp'));
      freqEl.innerHTML = t('app.tuner_status_line', { freq: freq.toFixed(1), cents: (cs > 0 ? "+" : "") + cs, status });
      needle.style.left = `${50 + Math.max(-50, Math.min(50, cs))}%`;
      meter.classList.toggle("in", tuned);
      meter.classList.toggle("resonant", tuned);
      if (tuned && !tuner.wasTuned) { haptic("Light"); tuner.wasTuned = true; }   // vibra una sola volta all'aggancio
      if (!tuned) tuner.wasTuned = false;
    } else if (freqEl) {
      // Silenzio: azzera tutto (niente nota "fantasma" dall'ultima lettura).
      freqEl.textContent = t('app.tuner_no_signal');
      tuner.hist.length = 0; tuner.wasTuned = false;
      if (concertEl) concertEl.textContent = "—";
      if (playedEl) playedEl.textContent = "—";
      if (playedWrap) playedWrap.hidden = true;
      if (needle) needle.style.left = "50%";
      if (meter) { meter.classList.remove("in"); meter.classList.remove("resonant"); }
    }
    tuner.raf = requestAnimationFrame(loop);
  };
  loop();
}
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length, rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // troppo silenzio
  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  buf = buf.slice(r1, r2); SIZE = buf.length;
  // Limita i lag alla banda musicale (~40–1300 Hz): dimezza il lavoro ed evita errori d'ottava sui sub-bassi.
  const minLag = Math.max(2, Math.floor(sampleRate / 1300));
  const maxLag = Math.min(SIZE - 1, Math.ceil(sampleRate / 40));
  const c = new Array(SIZE).fill(0);
  for (let i = 0; i <= maxLag; i++) for (let j = 0; j < SIZE - i; j++) c[i] += buf[j] * buf[j + i];
  let d = 0; while (d < maxLag && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = Math.max(d, minLag); i <= maxLag; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  let T0 = maxpos;
  const x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return T0 > 0 ? sampleRate / T0 : -1;
}
function playRef(freq, btn) {
  ensureTunerCtx();
  if (tuner.osc) { try { tuner.osc.stop(); } catch (e) {} tuner.osc = null; document.querySelectorAll("#refTones button").forEach(b => b.classList.remove("on")); if (btn.dataset.playing) { btn.dataset.playing = ""; return; } }
  document.querySelectorAll("#refTones button").forEach(b => { b.classList.remove("on"); b.dataset.playing = ""; });
  const o = tuner.ctx.createOscillator(), g = tuner.ctx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, tuner.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.25, tuner.ctx.currentTime + 0.02);
  o.connect(g).connect(tuner.ctx.destination); o.start();
  tuner.osc = o; btn.classList.add("on"); btn.dataset.playing = "1";
  setTimeout(() => { if (tuner.osc === o) { try { o.stop(); } catch (e) {} tuner.osc = null; btn.classList.remove("on"); btn.dataset.playing = ""; } }, 2000);
}
function ensureTunerCtx() { tuner.ctx = tuner.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (tuner.ctx.state === "suspended") tuner.ctx.resume(); }

// ---------- Riepilogo "Profilo Accordato" (Rivedi) ----------
function openDeepResults() {
  const d = state.me.deep;
  if (!d || !d.done) return openDeepSurvey();
  const bar = (label, frac, hint) => {
    const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    return `<div class="dp-row"><div class="dp-top"><span>${esc(label)}</span><span class="dp-pct">${pct}%</span></div>
      <div class="dp-bar"><i style="width:${pct}%"></i></div>${hint ? `<div class="dp-hint">${esc(hint)}</div>` : ""}</div>`;
  };
  const big5 = d.big5 || {};
  const personalita = [
    [t('app.dp_openness'), big5.O],
    [t('app.dp_conscientiousness'), big5.C],
    [t('app.dp_extraversion'), big5.E],
    [t('app.dp_agreeableness'), big5.A],
    [t('app.dp_emotional_stability'), big5.N != null ? 1 - big5.N : undefined]
  ].filter(([, v]) => v != null);
  // Top 3 valori (i più importanti per te)
  const topVals = Object.entries(d.values || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  // Ruolo (circumplex interpersonale)
  const ipc = d.ipc || { D: 0, W: 0 };
  const ruolo = t('app.dp_role_combined', {
    role: (ipc.D > 0.08 ? t('app.dp_role_lead') : ipc.D < -0.08 ? t('app.dp_role_support') : t('app.dp_role_balance')),
    style: (ipc.W > 0.08 ? t('app.dp_style_warm') : ipc.W < -0.08 ? t('app.dp_style_direct') : t('app.dp_style_balanced'))
  });

  openModal(`
    ${spot("sintonia")}
    <h2 style="text-align:center">${ic("resonance-profile")} ${t('app.dp_title')}</h2>
    <div class="aff-note">${t('app.dp_intro')}</div>
    <div class="section-label">${t('app.dp_personality')}</div>
    ${personalita.map(([l, v]) => bar(l, v)).join("")}
    ${topVals.length ? `<div class="section-label">${t('app.dp_what_matters')}</div><div class="tags">${topVals.map(v => `<span class="tag accent">${esc(v)}</span>`).join("")}</div>` : ""}
    <div class="section-label">${t('app.dp_band_style')}</div>
    <p style="margin:0;line-height:1.5">${esc(t('app.dp_role_sentence', { role: ruolo }))}</p>
    <button class="btn secondary" id="redoDeep2" style="margin-top:18px">${ic('refresh')} ${t('app.profile_redo_survey')}</button>
  `);
  $("#redoDeep2").onclick = () => openDeepSurvey();
}

// ---------- Sondaggio "Profilo Accordato" ----------
function openDeepSurvey() {
  const J = window.JamAffinity, I = J.IPIP_ITEMS, B = J.BUSSOLA, V = J.VALUE_ITEMS, P = J.IPC_ITEMS;
  const likert = (name, label, lo, hi) => `
    <div class="lk"><div class="lk-q">${esc(label)}</div>
      <div class="likert" data-name="${name}" role="radiogroup" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map(v => `<button type="button" data-v="${v}" role="radio" aria-checked="${v === 3 ? "true" : "false"}" aria-label="${esc(t('app.likert_aria', { v }))}" class="${v === 3 ? "on" : ""}">${v}</button>`).join("")}</div>
      ${lo ? `<div class="lk-ends"><span>${esc(lo)}</span><span>${esc(hi)}</span></div>` : ""}
    </div>`;
  const agreeLegend = `<div class="lk-ends" style="margin-bottom:6px"><span>${t('app.ds_legend_low')}</span><span>${t('app.ds_legend_high')}</span></div>`;
  openModal(`
    <h2>${ic("resonance-profile")} Profilo Accordato</h2>
    <div class="aff-note">${t('app.ds_intro')}</div>
    <div class="section-label">${t('app.ds_section_compass')}</div>
    ${B.map(b => likert(b.id, b.q, b.lo, b.hi)).join("")}
    <div class="section-label">${t('app.ds_section_values')}</div>${agreeLegend}
    ${V.map((it, i) => likert("val" + i, it.q)).join("")}
    <div class="section-label">${t('app.ds_section_personality')}</div>${agreeLegend}
    ${I.map((it, i) => likert("ipip" + i, it.q)).join("")}
    <div class="section-label">${t('app.ds_section_relational')}</div>${agreeLegend}
    ${P.map((it, i) => likert("ipc" + i, it.q)).join("")}
    <div class="section-label">${t('app.ds_consent')}</div>
    <label class="set-row"><span>${t('app.ds_consent_label')} <span class="view-sub" style="font-size:.74rem">${t('app.ds_consent_sub')}</span></span><input type="checkbox" id="deepConsent" ${state.consent && state.consent.deep ? "checked" : ""}></label>
    <div class="field-err" id="deepConsentErr" role="alert" hidden></div>
    <button class="btn" id="deepSave" style="margin-top:18px">${t('app.ds_save')}</button>
  `);
  const root = $("#modalRoot");
  root.querySelectorAll(".likert").forEach(row => row.querySelectorAll("button").forEach(btn => btn.onclick = () => {
    row.querySelectorAll("button").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); });
    btn.classList.add("on"); btn.setAttribute("aria-checked", "true");
  }));
  $("#deepSave").onclick = () => {
    // Consenso esplicito art. 9 obbligatorio prima di trattare i dati di personalità/valori.
    if (!$("#deepConsent").checked) {
      const e = $("#deepConsentErr"); if (e) { e.innerHTML = `${ic('alert-triangle')} ${t('app.ds_consent_required')}`; e.hidden = false; }
      try { $("#deepConsent").focus(); $("#deepConsent").scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      return;
    }
    const get = (name) => { const r = root.querySelector(`.likert[data-name="${name}"] button.on`); return r ? +r.dataset.v : 3; };
    const deep = {
      done: true, level: 4,
      big5: J.scoreBig5(I.map((_, i) => get("ipip" + i))),
      values: J.scoreValues(V.map((_, i) => get("val" + i))),
      ipc: J.scoreIPC(P.map((_, i) => get("ipc" + i)))
    };
    B.forEach(b => deep[b.id] = get(b.id));
    state.me.deep = deep;
    if (!state.consent) state.consent = { v: 1, ts: 0, noticeSeen: true, deep: false };
    state.consent.deep = true; state.consent.ts = Date.now(); // consenso art. 9 registrato (versionato + timestamp)
    save(); closeModal();
    toast(t('app.ds_saved'), ic("resonance-profile", "accent"));
    navigate("profile");
  };
}

// ---------- Modal helpers ----------
let modalPrevFocus = null;
function openModal(innerHTML) {
  const root = $("#modalRoot"); root.innerHTML = "";
  modalPrevFocus = document.activeElement;
  const back = el(`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="grip"></div><button type="button" class="modal-close" id="modalClose" aria-label="${esc(t('app.modal_close'))}" title="${esc(t('app.modal_close'))}">${ic('x')}</button>${innerHTML}</div></div>`);
  back.onclick = e => { if (e.target === back) closeModal(); };
  const x = back.querySelector("#modalClose"); if (x) x.onclick = closeModal;
  root.appendChild(back);
  const sheet = back.querySelector(".modal"), grip = back.querySelector(".grip");
  if (sheet && grip) attachSheetDismiss(sheet, grip);
  applyToggleA11y(back);
  if (x) setTimeout(() => { try { x.focus(); } catch (_) {} }, 0); // focus iniziale per tastiera/screen reader
  setBackgroundInert(true);
  document.addEventListener("keydown", modalKeyHandler);
  // History: il modale aggiunge UNA entry → il tasto Indietro lo chiude invece di uscire/cambiare vista.
  // Se un modale è già "in history" (openModal ne ha sostituito uno aperto) non impiliamo una seconda entry.
  if (_histReady && !_modalPushed) { try { history.pushState({ jm: true, kind: "modal" }, ""); _modalPushed = true; } catch (_) {} }
}
// Sfondo non interattivo/non annunciato + blocco scroll mentre il modale è aperto.
function setBackgroundInert(on) {
  ["#app", ".app-header", "#tabbar"].forEach(sel => { const e = document.querySelector(sel); if (e) { if (on) e.setAttribute("aria-hidden", "true"); else e.removeAttribute("aria-hidden"); } });
  document.body.classList.toggle("modal-open", on);
}
// Swipe-down sul grip per chiudere il bottom-sheet (gesture nativa).
function attachSheetDismiss(sheet, grip) {
  let y0 = 0, dy = 0, on = false;
  grip.style.touchAction = "none"; grip.style.cursor = "grab";
  const down = (e) => { on = true; y0 = e.clientY; sheet.style.transition = "none"; grip.setPointerCapture && grip.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!on) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; sheet.style.opacity = String(Math.max(.4, 1 - dy / 420)); };
  const up = () => {
    if (!on) return; on = false; sheet.style.transition = "transform .25s ease, opacity .25s ease";
    if (dy > 100) { haptic("Light"); sheet.style.transform = "translateY(110%)"; sheet.style.opacity = "0"; setTimeout(closeModal, 200); }
    else { sheet.style.transform = ""; sheet.style.opacity = ""; }
    dy = 0;
  };
  grip.addEventListener("pointerdown", down); grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
}
function modalKeyHandler(e) {
  if (e.key === "Escape") { closeModal(); return; }
  if (e.key !== "Tab") return;
  const modal = document.querySelector("#modalRoot .modal"); if (!modal) return;
  const f = [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null || el === document.activeElement);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function closeModal() {
  $("#modalRoot").innerHTML = ""; document.removeEventListener("keydown", modalKeyHandler);
  setBackgroundInert(false);
  if (modalPrevFocus && modalPrevFocus.focus) { try { modalPrevFocus.focus(); } catch (_) {} }
  modalPrevFocus = null;
  // History: se la chiusura è "utente" (X/backdrop/Esc) togliamo la entry del modale dallo stack
  // (la conseguente popstate va ignorata grazie a _modalBackPop); se invece chiudiamo SU popstate
  // (_popClosing) lo stack è già stato consumato dal browser, niente da fare.
  if (_modalPushed && !_popClosing) { _modalPushed = false; _modalBackPop = true; try { history.back(); } catch (_) { _modalBackPop = false; } }
  else { _modalPushed = false; }
}
// ---------- Drawer profilo (desktop): pannello laterale a scomparsa da destra ----------
// Sostituisce il vecchio rail invasivo: la nav principale resta nella top bar, mentre
// profilo, menù core (Palco/Lezioni/Strumenti, Pagine, Pro…) e impostazioni vivono qui.
let drawerPrevFocus = null;
function updateMeBtn() {
  const b = $("#meBtn"); if (!b) return;
  b.innerHTML = avatarTag(state.me);
  b.onclick = openProfileDrawer;
}
function drawerKeyHandler(e) {
  if (e.key === "Escape") { closeProfileDrawer(); return; }
  if (e.key !== "Tab") return;
  const d = document.querySelector(".drawer"); if (!d) return;
  const f = [...d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!d.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function openProfileDrawer() {
  if (document.querySelector(".drawer-backdrop")) return;
  const m = state.me;
  drawerPrevFocus = document.activeElement;
  const back = el(`
    <div class="drawer-backdrop">
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(t('app.drawer_label'))}">
        <div class="drawer-head">
          <b>${t('app.drawer_menu')}</b>
          <button type="button" class="modal-close" id="drwClose" aria-label="${esc(t('app.modal_close'))}" title="${esc(t('app.modal_close'))}">${ic('x')}</button>
        </div>
        <button type="button" class="drawer-id" id="drwProfile">
          ${avatarTag(m, false)}
          <div class="drawer-id-txt">
            <b>${esc(m.name || t('app.profile_my_profile'))}${verifiedBadge(m)}</b>
            <span class="loc">${esc(m.city)} · ${esc(levelLabel(topLevel(m)))}</span>
            <span class="loc">${jamBadge(m.jamCount).icon} ${esc(t('app.drawer_jams_tier', { count: m.jamCount || 0, tier: jamBadge(m.jamCount).tier }))}</span>
          </div>
          <span class="hub-chev">${ic('chevron')}</span>
        </button>
        ${hubGrid()}
        ${menuRows('drw')}
      </aside>
    </div>`);
  back.onclick = e => { if (e.target === back) closeProfileDrawer(); };
  $("#drawerRoot").appendChild(back);
  applyToggleA11y(back);
  setBackgroundInert(true);
  const mb = $("#meBtn"); if (mb) mb.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", drawerKeyHandler);
  // Ogni voce: chiude il drawer, poi esegue l'azione (navigate/openModal gestiscono la propria history).
  const go = fn => () => { closeProfileDrawer(); fn(); };
  back.querySelector("#drwClose").onclick = closeProfileDrawer;
  back.querySelector("#drwProfile").onclick = go(() => navigate("profile"));
  back.querySelectorAll(".hub-item").forEach(b => b.onclick = go(() => navigate(b.dataset.go)));
  back.querySelector("#drwPages").onclick = go(() => { if (typeof openPages === "function") openPages(); });
  back.querySelector("#drwPro").onclick = go(openPro);
  back.querySelector("#drwVerify").onclick = go(openVerify);
  back.querySelector("#drwBoost").onclick = go(openBoost);
  back.querySelector("#drwSettings").onclick = go(openSettings);
  back.querySelector("#drwHelp").onclick = go(openHelp);
  back.querySelector("#drwReport").onclick = go(openReportProblem);
  setTimeout(() => { try { back.querySelector("#drwClose").focus(); } catch (_) {} }, 0);
}
function closeProfileDrawer() {
  const back = document.querySelector(".drawer-backdrop"); if (!back) return;
  back.remove();
  document.removeEventListener("keydown", drawerKeyHandler);
  setBackgroundInert(false);
  const mb = $("#meBtn"); if (mb) mb.setAttribute("aria-expanded", "false");
  if (drawerPrevFocus && drawerPrevFocus.focus) { try { drawerPrevFocus.focus(); } catch (_) {} }
  drawerPrevFocus = null;
}

// Tasto Indietro Android (Capacitor): chiude overlay/drawer/modale, poi torna a Scopri, infine esce.
(function () {
  const C = window.Capacitor;
  if (!(C && C.Plugins && C.Plugins.App)) return;
  C.Plugins.App.addListener("backButton", () => {
    const ov = document.querySelector(".match-overlay");
    if (ov) { if (ov._jmClose) ov._jmClose(); else ov.remove(); return; }
    if (document.querySelector(".drawer-backdrop")) { closeProfileDrawer(); return; }
    if (document.querySelector("#modalRoot .modal-backdrop")) { closeModal(); return; }
    if (typeof currentView !== "undefined" && currentView !== "discover") { navigate("discover"); return; }
    C.Plugins.App.exitApp();
  });
})();

// ---------- Hub Profilo: Impostazioni / Aiuto / Segnalazioni ----------
function saveReport(data) {
  state.reports = state.reports || [];
  state.reports.unshift(Object.assign({ id: "rep" + Date.now(), ts: Date.now() }, data));
  save();
}
function openSettings() {
  state.settings = state.settings || {};
  const i18n = window.JM && JM.i18n;
  const langPref = i18n ? i18n.savedPreference : "auto";
  const langOpts = i18n
    ? `<option value="auto"${langPref === "auto" ? " selected" : ""}>${t('settings.language_auto')}</option>` +
      i18n.supported.map(code => `<option value="${code}"${langPref === code ? " selected" : ""}>${i18n.names[code]}</option>`).join("")
    : "";
  openModal(`
    <h2>${ic('gear')} ${t('settings.title')}</h2>
    <div class="section-label">${t('settings.language')}</div>
    <label class="set-row"><span>${t('settings.language')}</span><select id="setLang" aria-label="${t('settings.language')}">${langOpts}</select></label>
    <div class="section-label">${t('settings.account')}</div>
    <div class="aff-note">${t('settings.account_note')}</div>
    <button class="btn secondary" id="setPro" style="margin-top:10px">${ic('resonance-profile', 'grad')} ${state.me.plan === "pro" ? t('settings.pro_active') : t('settings.pro_upsell')}</button>
    <div class="section-label">${t('settings.notifications')}</div>
    <label class="set-row"><span>${t('settings.notif_simulated')}</span><input type="checkbox" id="setNotif" ${state.settings.notif === false ? "" : "checked"}></label>
    <div class="section-label">${t('settings.privacy')}</div>
    <label class="set-row"><span>${t('settings.show_status')}</span><input type="checkbox" id="setStatus" ${state.settings.hideStatus ? "" : "checked"}></label>
    <label class="set-row"><span>${t('settings.show_exact_distance')} <span class="view-sub" style="font-size:.74rem">${t('settings.show_exact_distance_sub')}</span></span><input type="checkbox" id="setDist" ${state.settings.approxDist ? "" : "checked"}></label>
    <label class="set-row"><span>${t('settings.links_after_match')}</span><input type="checkbox" id="setLinks" ${state.settings.linksAfterMatch ? "checked" : ""}></label>
    <label class="set-row"><span>${t('settings.appear_discover')}</span><input type="checkbox" id="setDisc" ${state.settings.discoverHidden ? "" : "checked"}></label>
    <p class="view-sub" style="font-size:.74rem;margin:2px 0 0">${t('settings.backend_note')}</p>
    <button class="btn secondary" id="setPrivacy" style="margin-top:10px">${ic('resonance-profile')} ${t('settings.privacy_policy')}</button>
    <button class="btn secondary" id="setConsent" style="margin-top:10px">${ic('gear')} ${t('settings.manage_consents')}</button>
    <div class="section-label">${t('settings.your_data')}</div>
    <button class="btn secondary" id="setExport">${ic('save')} ${t('settings.export_data')}</button>
    <button class="btn secondary danger" id="setReset" style="margin-top:10px">${ic('refresh')} ${t('settings.reset_demo')}</button>
    <p class="view-sub" style="text-align:center;margin-top:18px;opacity:.6">${t('settings.proto_version')}</p>
  `);
  if (i18n && $("#setLang")) $("#setLang").onchange = e => { i18n.setLocale(e.target.value); openSettings(); };
  $("#setNotif").onchange = e => { state.settings.notif = e.target.checked; save(); };
  $("#setStatus").onchange = e => { state.settings.hideStatus = !e.target.checked; save(); };
  // BACKEND HOOK: enforcement privacy lato server (chi-vede-cosa); qui solo persistenza della scelta.
  $("#setDist").onchange = e => { state.settings.approxDist = !e.target.checked; save(); };
  $("#setLinks").onchange = e => { state.settings.linksAfterMatch = e.target.checked; save(); };
  $("#setDisc").onchange = e => { state.settings.discoverHidden = !e.target.checked; save(); };
  $("#setExport").onclick = exportMyData;
  $("#setReset").onclick = () => openConfirm(t('settings.reset_confirm_title'), t('settings.reset_confirm_body'), { yes: t('settings.reset_confirm_yes'), danger: true }, () => { JM.Storage.remove(STORE_KEY); state = loadState(); closeModal(); navigate("discover"); });
  if ($("#setPrivacy")) $("#setPrivacy").onclick = openPrivacyPolicy;
  if ($("#setConsent")) $("#setConsent").onclick = openConsentManager;
  if ($("#setPro")) $("#setPro").onclick = openPro;
}

// --- Privacy & consensi (GDPR) ---
// Informativa sintetica in-app (la versione completa vive in PRIVACY.md, da pubblicare col backend).
function openPrivacyPolicy() {
  openModal(`
    <h2>${ic('resonance-profile')} ${t('app.privacy_title')}</h2>
    <div class="aff-note">${t('app.privacy_intro')}</div>
    <div class="section-label">${t('app.privacy_what_we_save')}</div>
    <p class="view-sub" style="margin:0">${t('app.privacy_what_we_save_body')}</p>
    <div class="section-label">${t('app.privacy_third_parties')}</div>
    <p class="view-sub" style="margin:0">${t('app.privacy_third_parties_body')}</p>
    <div class="section-label">${t('app.privacy_art9')}</div>
    <p class="view-sub" style="margin:0">${t('app.privacy_art9_body')}</p>
    <div class="section-label">${t('app.privacy_rights')}</div>
    <p class="view-sub" style="margin:0">${t('app.privacy_rights_body')}</p>
    <button class="btn" id="ppClose" style="margin-top:16px">${t('app.got_it')}</button>`);
  if ($("#ppClose")) $("#ppClose").onclick = closeModal;
}
// Gestione/revoca dei consensi (diritto di revoca, art. 7 GDPR).
function openConsentManager() {
  const c = state.consent || (state.consent = { v: 1, ts: 0, noticeSeen: false, deep: false });
  openModal(`
    <h2>${ic('gear')} ${t('app.consent_title')}</h2>
    <div class="aff-note">${t('app.consent_intro')}</div>
    <label class="set-row"><span>${t('app.consent_pa_label')} <span class="view-sub" style="font-size:.74rem">${t('app.consent_pa_sub')}</span></span><input type="checkbox" id="csDeep" ${c.deep ? "checked" : ""}></label>
    <p class="view-sub" style="font-size:.74rem;margin:6px 0 0">${t('app.consent_pa_note')}</p>
    <button class="btn secondary" id="csPolicy" style="margin-top:16px">${ic('resonance-profile')} ${t('app.consent_read_policy')}</button>`);
  if ($("#csPolicy")) $("#csPolicy").onclick = openPrivacyPolicy;
  if ($("#csDeep")) $("#csDeep").onchange = (e) => {
    if (e.target.checked) { c.deep = true; c.ts = Date.now(); save(); }
    else {
      // Revoca art. 9: spegni il Profilo Accordato ed elimina i dati sensibili dal dispositivo.
      c.deep = false; if (state.me.deep) state.me.deep = { done: false };
      save(); toast(t('app.consent_revoked'), ic('check', 'ok'));
    }
  };
}
// Notice di primo avvio: disclosure trasparente (NON un cookie-wall: non ci sono cookie di tracciamento).
function maybeShowPrivacyNotice() {
  if (!state.consent) state.consent = { v: 1, ts: 0, noticeSeen: false, deep: false };
  if (state.consent.noticeSeen) return;
  openModal(`
    <h2>${ic('resonance-profile')} ${t('app.notice_title')}</h2>
    <div class="aff-note">${t('app.notice_body')}</div>
    <p class="view-sub" style="margin:8px 0 0">${t('app.notice_pa_note')}</p>
    <button class="btn" id="pnOk" style="margin-top:16px">${t('app.got_it')}</button>
    <button class="btn secondary small" id="pnMore" style="margin-top:10px">${t('app.notice_read_details')}</button>`);
  const ack = () => { state.consent.noticeSeen = true; state.consent.ts = Date.now(); save(); };
  if ($("#pnOk")) $("#pnOk").onclick = () => { ack(); closeModal(); setTimeout(maybeShowGuide, 350); /* dopo che il sheet si è chiuso */ };
  if ($("#pnMore")) $("#pnMore").onclick = () => { ack(); openPrivacyPolicy(); };
}

// --- JamMate Pro (tier ad-free) ---
// Toglie gli spazi promossi e aggiunge valore. Pagamento reale = Stripe col backend; qui anteprima.
function openPro() {
  const isPro = state.me.plan === "pro";
  const perk = (t) => `<p class="view-sub" style="display:flex;gap:8px;align-items:center;margin:7px 0">${ic('check', 'ok')} <span>${t}</span></p>`;
  openModal(`
    <h2>${ic('resonance-profile', 'grad')} ${t('app.pro_title')}</h2>
    <div class="aff-note">${t('app.pro_intro')}</div>
    <div class="section-label">${t('app.pro_includes')}</div>
    ${perk(t('app.pro_perk_no_ads'))}
    ${perk(t('app.pro_perk_visibility'))}
    ${perk(t('app.pro_perk_sintonia'))}
    ${perk(t('app.pro_perk_badge'))}
    <p class="view-sub" style="font-size:.78rem;margin-top:12px">${t('app.pro_payments_note')}</p>
    <label class="set-row" style="margin-top:10px"><span>${t('app.pro_demo_label')} <span class="view-sub" style="font-size:.74rem">${t('app.pro_demo_sub')}</span></span><input type="checkbox" id="proDemo" ${isPro ? "checked" : ""}></label>`);
  if ($("#proDemo")) $("#proDemo").onchange = (e) => {
    state.me.plan = e.target.checked ? "pro" : "free"; save();
    toast(e.target.checked ? t('app.pro_active_toast') : t('app.pro_back_to_free'), ic(e.target.checked ? "resonance-profile" : "info"));
    if (typeof renderFeedBody === "function" && currentView === "feed") renderFeedBody();
  };
}

// Badge "verificato" (fiducia). Verifica reale (documento/Stripe Identity) col backend.
function verifiedBadge(o) {
  return (o && o.verifyStatus === "verified") ? ` <span class="verified-badge" title="${esc(t('app.verify_profile_verified'))}" aria-label="${esc(t('app.verify_profile_verified'))}">${ic('check')}</span>` : "";
}
function openVerify() {
  const s = state.me.verifyStatus;
  openModal(`
    <h2>${ic('check', 'ok')} ${t('app.verify_title')}</h2>
    <div class="aff-note">${t('app.verify_intro')}</div>
    <p class="view-sub" style="margin:8px 0 0">${t('app.verify_current_status', { status: s === "verified" ? t('app.verify_status_verified') : s === "pending" ? t('app.verify_status_pending') : t('app.verify_status_none') })}</p>
    ${s === "verified" ? "" : `<button class="btn" id="vReq" style="margin-top:14px">${ic('check')} ${t('app.verify_request')}</button>`}
    <label class="set-row" style="margin-top:14px"><span>${t('app.verify_demo_label')}</span><input type="checkbox" id="vDemo" ${s === "verified" ? "checked" : ""}></label>`);
  if ($("#vReq")) $("#vReq").onclick = () => { state.me.verifyStatus = "pending"; save(); closeModal(); toast(t('app.verify_requested'), ic('clock')); };
  if ($("#vDemo")) $("#vDemo").onchange = (e) => { state.me.verifyStatus = e.target.checked ? "verified" : "none"; save(); toast(e.target.checked ? t('app.verify_badge_on') : t('app.verify_badge_off'), ic(e.target.checked ? "check" : "info")); if (currentView === "profile") { closeModal(); navigate("profile"); } };
}
// "Metti in evidenza" (boost à la carte): promozione contestuale della PROPRIA attività, niente art. 9.
function openBoost() {
  const isPro = state.me.plan === "pro";
  openModal(`
    <h2>${ic('sparkles')} ${t('app.boost_title')}</h2>
    <div class="aff-note">${t('app.boost_intro')}</div>
    <div class="section-label">${t('app.boost_how')}</div>
    <p class="view-sub" style="margin:0">${isPro ? t('app.boost_how_pro') : t('app.boost_how_free')}</p>
    <p class="view-sub" style="font-size:.78rem;margin-top:12px">${t('app.boost_payments_note')}</p>
    ${isPro ? "" : `<button class="btn" id="boostPro" style="margin-top:14px">${ic('resonance-profile', 'grad')} ${t('app.boost_discover_pro')}</button>`}`);
  if ($("#boostPro")) $("#boostPro").onclick = openPro;
}

// --- Guida interattiva una-tantum ("come usare l'app/il profilo") ---
// Stepped-modal sul pipeline openModal/closeModal (focus-trap, inert, 1 sola entry history, Esc/back).
// I passi cambiano SOLO il contenuto interno di #guideBody (come renderDiscover2 con #discBody):
// niente N modali, niente ancoraggi a nodi #app (immune ai re-render distruttivi della SPA).
function markGuideSeen() {
  state.guide = state.guide || { v: 1, seen: false, ts: 0 };
  state.guide.seen = true; state.guide.v = GUIDE_VERSION; state.guide.ts = Date.now(); save();
}
let _guideOpenedThisSession = false;
const GUIDE_STEPS = [
  { art: () => spot('trova'), title: t('app.guide_s1_title'), body: t('app.guide_s1_body') },
  { art: () => `<span class="guide-icon">${ic('match')}</span>`, title: t('app.guide_s2_title'), body: t('app.guide_s2_body'), go: "discover", goLabel: t('app.guide_s2_go') },
  { art: () => spot('sintonia'), title: t('app.guide_s3_title'), body: t('app.guide_s3_body'), go: "profile", goLabel: t('app.guide_s3_go') },
  { art: () => `<span class="guide-icon">${ic('chat-bubble')}</span><span class="guide-icon">${ic('map')}</span>`, title: t('app.guide_s4_title'), body: t('app.guide_s4_body') },
  { art: () => `<span class="guide-icon">${ic('microphone')}</span><span class="guide-icon">${ic('building')}</span>`, title: t('app.guide_s5_title'), body: t('app.guide_s5_body'), go: "palco", goLabel: t('app.guide_s5_go') },
  { art: () => `<span class="guide-icon grad">${ic('resonance-profile', 'grad')}</span>`, title: t('app.guide_s6_title'), body: t('app.guide_s6_body'), role: true }
];
function openGuide(opts) {
  opts = opts || {};
  const N = GUIDE_STEPS.length;
  let i = Math.max(0, Math.min(N - 1, opts.start || 0));
  openModal(`<div class="guide">
    <div id="guideBody"></div>
    <div class="guide-foot">
      <button class="btn small secondary" id="gBack" type="button">${t('app.back')}</button>
      <div class="guide-dots" id="gDots" aria-hidden="true">${GUIDE_STEPS.map(() => "<i></i>").join("")}</div>
      <button class="btn small" id="gNext" type="button">${t('app.next')}</button>
    </div>
  </div>`);
  const body = $("#guideBody"), dots = $("#gDots").children, back = $("#gBack"), next = $("#gNext");
  const finish = () => { markGuideSeen(); closeModal(); };
  function paint() {
    const s = GUIDE_STEPS[i], lastStep = (i === N - 1);
    body.innerHTML = `<div class="guide-step">
      <div class="guide-art">${s.art()}</div>
      <span class="sr-only">${esc(t('app.guide_step_of', { n: i + 1, total: N }))}</span>
      <h2 id="guideTitle" tabindex="-1">${s.title}</h2>
      <p class="guide-copy">${s.body}</p>
      ${s.role ? `<div class="card flat" style="margin-top:10px;text-align:left">
        <label class="set-row"><span>${t('app.profile_cap_plays')} <span class="view-sub" style="font-size:.74rem">${t('app.guide_cap_plays_sub')}</span></span><input type="checkbox" id="gCapPlays" ${state.me.caps && state.me.caps.plays ? "checked" : ""}></label>
        <label class="set-row"><span>${t('app.profile_cap_hires')} <span class="view-sub" style="font-size:.74rem">${t('app.guide_cap_hires_sub')}</span></span><input type="checkbox" id="gCapHires" ${state.me.caps && state.me.caps.hires ? "checked" : ""}></label>
        <p class="view-sub" style="font-size:.74rem;margin:6px 0 0">${t('app.guide_role_note')}</p>
      </div>` : ""}
      ${s.go ? `<button class="btn small secondary" id="gGo" type="button" style="margin-top:12px">${ic('arrow-up')} ${esc(s.goLabel || t('app.guide_go_default'))}</button>` : ""}
    </div>`;
    for (let k = 0; k < dots.length; k++) dots[k].className = (k === i ? "on" : "");
    back.style.visibility = i === 0 ? "hidden" : "visible";
    next.className = "btn small" + (lastStep ? "" : " secondary");
    next.textContent = lastStep ? t('app.guide_done') : t('app.next');
    try { $("#guideTitle").focus({ preventScroll: true }); } catch (_) {}
    if ($("#gGo")) $("#gGo").onclick = () => { markGuideSeen(); closeModal(); navigate(s.go); };
    if ($("#gCapPlays")) $("#gCapPlays").onchange = (e) => { state.me.caps.plays = e.target.checked; save(); toast(e.target.checked ? t('app.disc_musician_active') : t('app.role_listener_mode'), ic("check", "ok")); };
    if ($("#gCapHires")) $("#gCapHires").onchange = (e) => { state.me.caps.hires = e.target.checked; save(); toast(e.target.checked ? t('app.role_can_hire') : t('app.updated'), ic("check", "ok")); };
  }
  back.onclick = () => { if (i > 0) { i--; paint(); } };
  next.onclick = () => { if (i < N - 1) { i++; paint(); } else finish(); };
  paint();
}
// Auto-trigger una-tantum: solo a onboarding fatto, mai sopra un altro overlay, dopo che _histReady è true.
function maybeShowGuide() {
  if (_guideOpenedThisSession) return;
  if (!state.onboarded) return;
  if (state.guide && state.guide.seen && state.guide.v >= GUIDE_VERSION) return;
  if (document.querySelector("#modalRoot .modal-backdrop, .match-overlay")) return;
  _guideOpenedThisSession = true;
  markGuideSeen(); // mostrata = vista: non rinviare il nag comunque la si chiuda
  openGuide({ start: 0 });
}
const FAQ = [
  [t('app.faq_q1'), t('app.faq_a1')],
  [t('app.faq_q2'), t('app.faq_a2')],
  [t('app.faq_q3'), t('app.faq_a3')],
  [t('app.faq_q4'), t('app.faq_a4')]
];
function openHelp() {
  openModal(`
    <h2>${ic('info')} ${t('app.help_title')}</h2>
    <button class="btn secondary" id="helpGuide" style="margin-bottom:12px">${ic('sparkles')} ${t('app.help_review_guide')}</button>
    <input type="text" id="faqSearch" placeholder="${esc(t('app.help_search_ph'))}" autocomplete="off" style="margin-bottom:10px">
    <div class="section-label">${t('app.help_faq')}</div>
    <div id="faqList">${FAQ.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join("")}</div>
    <div class="section-label">${t('app.help_no_answer')}</div>
    <button class="btn" id="helpReport">${ic('flag')} ${t('app.report_problem_title')}</button>
  `);
  const fs = $("#faqSearch");
  if (fs) fs.oninput = () => {
    const q = fs.value.trim().toLowerCase();
    const list = FAQ.filter(([qq, aa]) => !q || (qq + " " + aa).toLowerCase().includes(q));
    $("#faqList").innerHTML = list.length
      ? list.map(([qq, aa]) => `<details class="faq"${q ? " open" : ""}><summary>${esc(qq)}</summary><div class="faq-a">${aa}</div></details>`).join("")
      : `<p class="view-sub">${t('app.help_no_results', { query: esc(fs.value) })}</p>`;
  };
  if ($("#helpGuide")) $("#helpGuide").onclick = () => { closeModal(); setTimeout(() => openGuide({ replay: true }), 250); };
  $("#helpReport").onclick = () => openReportProblem();
}
function openReportProblem() {
  const TYPES = [t('app.report_type_bug'), t('app.report_type_inappropriate'), t('app.report_type_scam'), t('app.report_type_account'), t('app.report_type_other')];
  openModal(`
    <h2>${ic('flag')} ${t('app.report_problem_title')}</h2>
    <p class="view-sub">${t('app.report_problem_sub')}</p>
    <label class="field">${t('app.report_type_label')}</label><select id="rpType">${options(TYPES, TYPES[0])}</select>
    <label class="field" style="margin-top:10px">${t('app.report_desc_label')}</label><textarea id="rpText" placeholder="${esc(t('app.report_desc_ph'))}"></textarea>
    <button class="btn" id="rpSend" style="margin-top:14px">${t('app.report_send')}</button>
  `);
  $("#rpSend").onclick = () => {
    const text = $("#rpText").value.trim(); if (!text) return markFieldError("#rpText", t('app.report_desc_required'));
    saveReport({ kind: "problem", type: $("#rpType").value, text });
    closeModal(); toast(t('app.report_sent_thanks'));
  };
}
// Segnalazione contestuale di contenuto/utente (motivo → salvato in locale).
const REPORT_REASONS = [
  ["spam", "app.report_reason_spam"], ["harassment", "app.report_reason_harassment"],
  ["inappropriate", "app.report_type_inappropriate"], ["scam", "app.report_type_scam"],
  ["fake", "app.report_reason_fake"], ["other", "app.report_type_other"]
];
function openReportSheet(label, ctx) {
  openModal(`
    <h2>${ic('flag')} ${t('app.report_label_title')}</h2>
    <div class="aff-note">${esc(label)}</div>
    <div class="section-label">${t('app.report_reason')}</div>
    <div class="chips" id="repReasons">${REPORT_REASONS.map(([, key]) => `<button type="button" class="chip rep-reason" data-r="${esc(t(key))}">${esc(t(key))}</button>`).join("")}</div>
  `);
  document.querySelectorAll("#repReasons .rep-reason").forEach(b => b.onclick = () => {
    saveReport({ kind: "content", target: label, ctx: ctx || "", reason: b.dataset.r });
    closeModal(); toast(t('app.report_content_sent'));
  });
}

// ---------- City switch ----------
const CITY_QUICK = ["Milano", "Roma", "Torino", "Napoli", "Bologna", "Firenze", "Genova", "Verona", "Bergamo", "Brescia", "Padova", "Bari", "Palermo"];
function openCityPicker() {
  openModal(`
    <h2>${ic('map-pin')} ${t('app.city_title')}</h2>
    <div class="aff-note">${t('app.city_intro')}</div>
    <label class="field" style="margin-top:12px">${t('app.city_input_label')}</label>
    <input type="text" id="cityInput" value="${esc(state.me.city || "")}" placeholder="${esc(t('app.city_input_ph'))}" autocomplete="off" />
    <div class="section-label">${t('app.city_popular')}</div>
    <div class="chips" id="cityQuick">${CITY_QUICK.map(c => `<span class="chip${c === state.me.city ? " on" : ""}" data-chip="${esc(c)}">${esc(c)}</span>`).join("")}</div>
    <button class="btn" id="citySave" style="margin-top:16px">${t('app.city_confirm')}</button>`);
  const input = $("#cityInput");
  const apply = () => {
    const v = (input.value || "").trim(); if (!v) return;
    state.me.city = v; const lbl = $("#cityLabel"); if (lbl) lbl.textContent = v;
    save(); closeModal(); toast(t('app.city_set', { city: v }), ic('map-pin')); render();
  };
  $("#cityQuick").querySelectorAll(".chip").forEach(c => c.onclick = () => { input.value = c.dataset.chip; apply(); });
  $("#citySave").onclick = apply;
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 30);
}
$("#cityBtn").onclick = openCityPicker;
// ---------- Notifiche ----------
$("#bellBtn").onclick = () => openNotifications();

// ---------- Init ----------
document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
  const v = t.dataset.view;
  // Re-tap della tab attiva = torna su (scroll-to-top), niente rebuild distruttivo della vista.
  if (v === currentView) { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { window.scrollTo(0, 0); } }
  else navigate(v);
});
// Auto-hide premium dell'header (SOLO mobile). Pattern IG/Threads: scrollando giù
// l'header esce tutto fuori schermo, ricompare appena scorri su. Slide intero (CSS
// translateY) — niente stati intermedi/etichette che lampeggiano. La barra in basso
// (navigazione primaria) resta SEMPRE visibile, come nelle app premium.
// Su desktop l'header È la top bar: non si nasconde mai (gating innerWidth>=760 + CSS).
(function headerAutoHide() {
  const header = document.querySelector(".app-header");
  if (!header) return;
  const REVEAL_AT_TOP = 8;   // a inizio pagina l'header è sempre visibile
  const HIDE_AFTER = 80;     // scroll giù minimo (cumulato) prima di nascondere
  const SHOW_AFTER = 8;      // ritorno immediato appena scorri su
  let lastY = window.scrollY || 0, hidden = false, ticking = false, downAcc = 0, upAcc = 0;
  const setHidden = (on) => { if (on === hidden) return; hidden = on; header.classList.toggle("header-hidden", on); };
  const update = () => {
    ticking = false;
    const y = window.scrollY || 0, dy = y - lastY;
    // Desktop = top bar di navigazione: sempre visibile. Mai auto-hide dietro overlay/modale/drawer.
    if (window.innerWidth >= 760 || document.querySelector(".modal-backdrop, .match-overlay, .drawer-backdrop")) {
      setHidden(false); downAcc = upAcc = 0; lastY = y; return;
    }
    if (y <= REVEAL_AT_TOP) { setHidden(false); downAcc = upAcc = 0; }
    else if (dy > 0) { downAcc += dy; upAcc = 0; if (downAcc > HIDE_AFTER) setHidden(true); }       // giù → nascondi
    else if (dy < 0) { upAcc -= dy; downAcc = 0; if (upAcc > SHOW_AFTER) setHidden(false); }         // su → mostra
    lastY = y;
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", () => { if (window.innerWidth >= 760) setHidden(false); }, { passive: true });
})();
// ---------- "Aggiorna" / pull-to-refresh (Feed & Bacheca) ----------
// HOOK BACKEND: oggi ridisegna il corpo della vista dopo una breve latenza simulata.
// Domani sostituire il setTimeout con la fetch reale (es. await api.feed.list() / api.board.list()).
function runRefresh(kind) {
  if (runRefresh._busy) return;
  if (document.body.classList.contains("offline")) { toast(t('app.refresh_offline'), ic("alert-triangle")); return; }
  runRefresh._busy = true;
  const btn = document.getElementById(kind === "feed" ? "feedRefresh" : "boardRefresh");
  if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
  setTimeout(() => {
    runRefresh._busy = false;
    try {
      if (kind === "feed" && typeof renderFeedBody === "function") renderFeedBody();
      else if (kind === "board" && typeof renderBoard2 === "function") renderBoard2(); // ricrea l'header (e il bottone)
    } finally {
      const b = document.getElementById(kind === "feed" ? "feedRefresh" : "boardRefresh"); if (b) { b.classList.remove("is-loading"); b.disabled = false; }
      toast(t('app.refreshed'), ic("refresh", "accent"));
      if (typeof haptic === "function") haptic("Light");
    }
  }, 550);
}
// Gesto pull-to-refresh: passivo (non blocca mai lo scroll), attivo solo a inizio pagina in Feed/Bacheca.
(function pullToRefresh() {
  const ind = el(`<div class="ptr-indicator" aria-hidden="true">${ic("refresh")}</div>`);
  document.body.appendChild(ind);
  let startY = 0, active = false, pulled = 0;
  const READY = 64;
  const canPTR = () => (currentView === "feed" || currentView === "board")
    && (window.scrollY || 0) <= 0
    && !document.querySelector(".modal-backdrop, .match-overlay");
  const reset = (snap) => {
    active = false; pulled = 0;
    if (snap) { ind.classList.add("ptr-snap"); setTimeout(() => ind.classList.remove("ptr-snap"), 240); }
    ind.style.transform = ""; ind.classList.remove("ptr-visible", "ptr-ready");
  };
  document.addEventListener("touchstart", (e) => {
    if (!canPTR() || e.touches.length !== 1) { active = false; return; }
    startY = e.touches[0].clientY; active = true; pulled = 0;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!active) return;
    pulled = e.touches[0].clientY - startY;
    if (pulled <= 0 || (window.scrollY || 0) > 0) { reset(false); return; }
    const d = Math.min(pulled * 0.5, 88); // resistenza
    ind.style.transform = `translateX(-50%) translateY(${d}px)`;
    ind.classList.add("ptr-visible");
    ind.classList.toggle("ptr-ready", d >= READY);
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (!active) return;
    const fire = (pulled * 0.5) >= READY;
    if (fire) { ind.classList.add("ptr-spin", "ptr-visible"); ind.style.transform = "translateX(-50%) translateY(14px)"; runRefresh(currentView); setTimeout(() => { ind.classList.remove("ptr-spin"); reset(true); }, 700); }
    else reset(true);
  }, { passive: true });
})();
// Tastiera mobile: quando un campo è a fuoco, nascondi la tabbar (niente "barra che galleggia sopra la keyboard").
// Apre la tastiera software solo per campi di testo: slider/checkbox/radio NON devono nascondere la barra.
function isTypingField(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
  if (el.tagName === "INPUT") return !/^(range|checkbox|radio|file|button|submit|reset|color|image|hidden)$/.test((el.type || "text").toLowerCase());
  return false;
}
document.addEventListener("focusin", (e) => { if (isTypingField(e.target)) document.body.classList.add("kb-open"); });
document.addEventListener("focusout", (e) => { if (isTypingField(e.target)) setTimeout(() => { if (!isTypingField(document.activeElement)) document.body.classList.remove("kb-open"); }, 60); });
// visualViewport: espone --kb = px coperti dalla tastiera software, così modali/composer/toast
// si sollevano sopra la keyboard (CSS usa var(--kb)). Degrada a no-op dove non supportato.
(function keyboardInset() {
  const vv = window.visualViewport; if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const covered = window.innerHeight - vv.height - vv.offsetTop;
    root.style.setProperty("--kb", (covered > 80 ? Math.round(covered) : 0) + "px"); // soglia anti-rumore (barra URL ≠ tastiera)
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  apply();
})();
// Stato offline globale: banner in cima + classe body.offline (fonte di verità per le azioni di rete).
// Oggi tutto gira in locale; conta per SW/mappa/geocoding e fa da base per il passaggio a JM.Api.
(function offlineIndicator() {
  const banner = el(`<div class="net-banner" role="status" aria-live="polite">${ic('alert-triangle')}<span>${t('app.offline_banner')}</span></div>`);
  document.body.appendChild(banner);
  let wasOffline = false;
  const setOnline = (on) => {
    document.body.classList.toggle("offline", !on);
    if (on && wasOffline && typeof toast === "function") toast(t('app.online_again'), ic("check", "ok"));
    wasOffline = !on;
  };
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("online", () => setOnline(true));
  setOnline(navigator.onLine !== false);
})();
$("#cityLabel").textContent = state.me.city;
navigate("discover");
// i18n: localizza la shell statica (header/tabbar/titolo) e ri-applica al cambio lingua.
// La lingua di default è già stata risolta da i18n.js (preferenza salvata → dispositivo → Inglese).
if (window.JM && JM.i18n) {
  try { document.title = JM.i18n.t("app.title"); } catch (_) {}
  JM.i18n.applyStatic();
  JM.i18n.onChange(() => {
    try { document.title = JM.i18n.t("app.title"); } catch (_) {}
    JM.i18n.applyStatic();
    render();
  });
}
maybeShowPrivacyNotice(); // disclosure trasparente al primo avvio (GDPR/ePrivacy)
// Tasto Indietro del browser + gesto Indietro Android (PWA): chiude overlay/modale, poi torna
// alla vista precedente, infine esce. Mirror della logica nativa (Capacitor) via history/popstate.
(function initBackButton() {
  try { history.replaceState({ jm: true, kind: "view", view: currentView }, ""); } catch (_) {}
  _histReady = true;
  window.addEventListener("popstate", (e) => {
    if (_modalBackPop) { _modalBackPop = false; return; } // back() interno di closeModal: solo pop, niente azione
    // 1) Overlay "match": chiudi e resta sulla vista (ri-traccia una entry per non perdere profondità)
    const ov = document.querySelector(".match-overlay");
    if (ov) { if (ov._jmClose) ov._jmClose(); else ov.remove(); try { history.pushState({ jm: true, kind: "view", view: currentView }, ""); } catch (_) {} return; }
    // 1bis) Drawer profilo aperto: chiudilo e ri-traccia la vista corrente (come il match-overlay)
    if (document.querySelector(".drawer-backdrop")) { closeProfileDrawer(); try { history.pushState({ jm: true, kind: "view", view: currentView }, ""); } catch (_) {} return; }
    // 2) Modale aperto: chiudilo (la sua entry è già stata tolta dal browser)
    if (document.querySelector("#modalRoot .modal-backdrop")) { _popClosing = true; closeModal(); _popClosing = false; return; }
    // 3) Altrimenti naviga alla vista dell'entry tornata (o lascia uscire se non è roba nostra)
    const st = e.state;
    if (st && st.kind === "view" && st.view) { _navFromPop = true; navigate(st.view); _navFromPop = false; }
  });
})();
checkBoardMatches(); // notifica una tantum se ci sono annunci nuovi per i tuoi strumenti
// Guida una-tantum per utenti già onboardati che non l'hanno mai vista (qui _histReady è true,
// così la guida possiede una entry chiudibile col tasto Indietro). Brand-new users la vedono via
// il chaining post-consenso; chi è appena passato dall'onboarding ha già guide.seen = true.
maybeShowGuide();
// Scopri da tastiera: ← passa, → connetti (oltre ai bottoni). Niente quando c'è un modale/overlay.
document.addEventListener("keydown", (e) => {
  if (currentView !== "discover" || !state.ui || state.ui.discoverMode !== "match") return;
  const t = e.target; if (t && ((t.matches && t.matches("input,select,textarea")) || t.isContentEditable)) return; // non rubare le frecce ai filtri
  if (document.querySelector(".modal-backdrop, .match-overlay")) return;
  if (!$(".swipe-card")) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); const b = $("#btnPass"); if (b) b.click(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); const b = $("#btnLike"); if (b) b.click(); }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
