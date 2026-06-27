/* JamMate — modulo "social & community" (prototipo, dati locali).
 * Contiene: Feed sociale (#11), Notifiche (#10), Mappa jam geolocalizzate (#9),
 * Lezioni con calendario + pagamento (#12).
 * Usa gli helper globali definiti in app.js/gigs.js ($,el,esc,openModal,closeModal,
 * toast,avatarTag,save,state,navigate,formatDate,options,chips,toggleChip,currentView,
 * renderBoard2,rerenderPalco) e i dati/costanti di data.js (LEVELS,GENRES,INSTRUMENTS,
 * GRADS,SEED_PROFILES,levelsOf,levelRank).
 * Reso modulare apposta: al deploy del backend, ogni sezione aggancia le sue API. */

// ------------------------------------------------------------- Helper comuni
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "ora";
  const m = Math.floor(s / 60); if (m < 60) return m + " min fa";
  const h = Math.floor(m / 60); if (h < 24) return h + " h fa";
  const d = Math.floor(h / 24); if (d < 7) return d + " g fa";
  try { return new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "short" }); } catch (e) { return ""; }
}
// Selettore immagine generico → dataURL. Le GIF vengono mantenute così come sono
// (per preservare l'animazione); le altre immagini sono ridimensionate in JPEG.
function pickImage(cb, maxDim) {
  maxDim = maxDim || 1000;
  const inp = el(`<input type="file" accept="image/*,image/gif" style="display:none">`);
  document.body.appendChild(inp);
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) { inp.remove(); return; }
    const rd = new FileReader();
    rd.onload = () => {
      if (f.type === "image/gif") { // GIF: niente canvas, mantieni l'animazione
        if (rd.result.length > 6000000) { toast("GIF troppo pesante (max ~4MB)"); inp.remove(); return; }
        cb(rd.result); inp.remove(); return;
      }
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * r), h = Math.round(img.height * r);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        try { cb(c.toDataURL("image/jpeg", 0.8)); } catch (e) { console.warn("JamMate: immagine non elaborabile", e); toast("Immagine non valida", ic('alert-triangle'), { error: true }); }
        inp.remove();
      };
      img.onerror = () => { console.warn("JamMate: immagine non caricabile"); toast("Immagine non valida", ic('alert-triangle'), { error: true }); inp.remove(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  inp.click();
}
// Inserisce testo (emoji) nella textarea alla posizione del cursore.
function insertAtCursor(ta, text) {
  if (!ta) return;
  const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
  const e = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.focus(); const pos = s + text.length; try { ta.setSelectionRange(pos, pos); } catch (er) {}
}
// Reazioni: normalizza il vecchio formato (likes/likedByMe) e calcola il riepilogo.
function normReactions(p) {
  if (!p.reactions) { p.reactions = {}; if (p.likes) p.reactions["👍"] = p.likes; p.myReaction = p.likedByMe ? "👍" : (p.myReaction || null); }
  if (p.myReaction === undefined) p.myReaction = null;
  return p;
}
function reactionSummary(p) {
  normReactions(p);
  const counts = Object.assign({}, p.reactions);
  if (p.myReaction) counts[p.myReaction] = (counts[p.myReaction] || 0) + 1;
  const emojis = Object.keys(counts).filter(e => counts[e] > 0).sort((a, b) => counts[b] - counts[a]);
  return { emojis: emojis.slice(0, 3), total: emojis.reduce((s, e) => s + counts[e], 0) };
}
function setReaction(p, emoji) { normReactions(p); p.myReaction = p.myReaction === emoji ? null : emoji; save(); }

// ------------------------------------------------------------- Notifiche (#10)
function notify(icon, text, opts) {
  state.notifications = state.notifications || [];
  state.notifications.unshift({ id: "n" + Date.now() + Math.random().toString(36).slice(2, 6), icon, text, ts: Date.now(), read: false, view: opts && opts.view });
  if (state.notifications.length > 50) state.notifications.length = 50;
  save(); if (typeof updateBell === "function") updateBell();
}
// Risolve l'icona notifica: un NOME del set icons.js → SVG; altrimenti emoji/stringa raw; default campana.
function notifIcon(v) {
  if (v && typeof ICONS !== "undefined" && ICONS[v]) return ic(v);
  return v || (typeof ic === "function" ? ic("bell") : "🔔");
}
function notifRow(n) {
  return `<div class="notif-row${n.view ? " tap" : ""}${n.read ? "" : " unread"}"${n.view ? ` data-view="${esc(n.view)}"` : ""}>
    <span class="notif-icon">${notifIcon(n.icon)}</span>
    <div>${n.read ? "" : `<span class="sr-only">Non letta. </span>`}<div>${esc(n.text)}</div><div class="notif-time">${timeAgo(n.ts)}</div></div></div>`;
}
function openNotifications() {
  const list = state.notifications || [];
  openModal(`<div class="row-between modal-head"><h2 style="margin:0">${ic("bell")} Notifiche</h2>${list.length ? `<button class="btn small secondary" id="clearNotif">Pulisci</button>` : ""}</div>
    <div id="notifList" style="margin-top:12px">${list.length ? list.map(notifRow).join("") : `<div class="empty">${illus("quiet")}Nessuna notifica per ora.</div>`}</div>`);
  document.querySelectorAll("#notifList [data-view]").forEach(r => r.onclick = () => { closeModal(); navigate(r.dataset.view); });
  if ($("#clearNotif")) $("#clearNotif").onclick = () => { state.notifications = []; save(); updateBell(); closeModal(); };
  // segna tutte come lette all'apertura
  list.forEach(n => n.read = true); save(); updateBell();
}

// ------------------------------------------------------------- Feed sociale (#11)
// Reazioni disponibili ed emoji per il composer.
const REACTIONS = ["👍", "❤️", "🔥", "😂", "🎸", "👏", "😮"];
const POST_EMOJIS = ["🎸", "🎹", "🥁", "🎤", "🎷", "🎺", "🎻", "🎶", "🎵", "🔥", "❤️", "😂", "😍", "🤘", "👏", "🙌", "✨", "🍺", "📅", "📍", "🎉", "😎", "💯", "🚀"];
// Tipi di post "della scena": danno al feed un taglio musicale riconoscibile.
const POST_TYPES = [
  { k: "", label: "Generale", icon: "music-note" },
  { k: "jam", label: "Jam", icon: "suonate" },
  { k: "live", label: "Live", icon: "megaphone" },
  { k: "traguardo", label: "Traguardo", icon: "star" },
  { k: "cerco", label: "Cerco", icon: "search" }
];
function postTypeMeta(k) { return POST_TYPES.find(t => t.k === (k || "")) || POST_TYPES[0]; }
const FEED_TABS = [{ k: "perte", label: "Per te" }, { k: "recenti", label: "Recenti" }, { k: "vicino", label: "Vicino a te" }];

const SEED_POSTS = [
  { id: "sp1", authorId: "u2", type: "live", name: "Giulia Ferri", avatar: "🎤", color: GRADS[4], text: "Ieri sera prima serata con la nuova cover band 🎶 pubblico fantastico, grazie a tutti! Prossima data tra due settimane. #live #coverband", image: "", ts: Date.now() - 3 * 3600e3, reactions: { "🔥": 9, "❤️": 4, "👏": 3 }, myReaction: null, comments: [{ name: "Luca Greco", text: "Grandi! 🔥", ts: Date.now() - 2 * 3600e3 }] },
  { id: "sp2", authorId: "u7", type: "jam", name: "Tommaso Riva", avatar: "🎷", color: GRADS[5], text: "Cerco gente per una jam jazz domenica al parco. Si improvvisa, si chiacchiera, si beve qualcosa 🍺 Chi c'è? #jam #jazz", image: "", ts: Date.now() - 9 * 3600e3, reactions: { "👍": 6, "🎸": 2 }, myReaction: null, comments: [] },
  { id: "sp3", authorId: "u1", type: "", name: "Marco Bassani", avatar: "🎸", color: GRADS[0], text: "Nuovo ampli, nuovo suono. Provato stamattina in sala, che goduria 🤘 #gear", image: "", ts: Date.now() - 28 * 3600e3, reactions: { "🔥": 14, "😮": 5, "🎸": 3 }, myReaction: null, comments: [{ name: "Davide Conti", text: "Quale hai preso?", ts: Date.now() - 26 * 3600e3 }] }
];

// Profilo autore di un post (per header "musicale" e chip in-risonanza).
function postAuthor(p) { return (p.authorId && p.authorId !== "me") ? (state.profiles || []).find(x => x.id === p.authorId) : null; }

// Promuove un post seed in state.posts così reazioni/commenti vengono PERSISTITI (fix bug stato).
function adoptPost(p) {
  state.posts = state.posts || [];
  let live = state.posts.find(x => x.id === p.id);
  if (!live) { live = JSON.parse(JSON.stringify(p)); state.posts.unshift(live); }
  return live;
}

// Card-evento sintetiche dalle jam in arrivo: il feed diventa "della scena" (aggregatore). Non persistite.
function jamEventPosts() {
  const today = todayISO();
  return allJams()
    .filter(j => j.date >= today && j.hostId !== "me")
    .map(j => ({
      synthetic: true, id: "jev_" + j.id, type: "jam-event", jamId: j.id,
      authorId: j.hostId, name: j.host, avatar: j.avatar, color: j.color,
      text: "", ts: Date.now() - 2 * 3600e3,
      reactions: {}, myReaction: null, comments: []
    }));
}

// Lista del feed per il tab attivo + filtro hashtag. Dedup per id (i post utente sovrascrivono i seed).
function feedPosts(tab) {
  tab = tab || (state.ui && state.ui.feedTab) || "perte";
  const live = state.posts || [];
  const liveIds = new Set(live.map(p => p.id));
  let list = [...live, ...SEED_POSTS.filter(s => !liveIds.has(s.id))];
  list = list.concat(jamEventPosts().filter(j => !liveIds.has(j.id)));
  const hf = state.ui && state.ui.feedTag;
  if (hf) list = list.filter(p => (p.text || "").toLowerCase().includes("#" + hf.toLowerCase()));
  if (tab === "vicino") {
    list = list.filter(p => { const a = postAuthor(p); return p.authorId === "me" || p.synthetic || (a && a.distanceKm != null && a.distanceKm <= 15); });
  }
  if (tab === "perte") list.sort((a, b) => feedRelevance(b) - feedRelevance(a));
  else list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return list;
}

// Rilevanza "in risonanza": match/seguiti, strumenti/generi in comune, vicinanza, freschezza, engagement.
function feedRelevance(p) {
  let r = 0; const me = state.me, a = postAuthor(p);
  if (state.matches && p.authorId && state.matches.includes(p.authorId)) r += 60;
  if (a) {
    if ((a.instruments || []).some(i => (me.instruments || []).includes(i))) r += 25;
    if ((a.genres || []).some(g => (me.genres || []).includes(g))) r += 20;
    if (a.distanceKm != null) r -= Math.min(20, a.distanceKm);
  }
  if (p.synthetic) r += 15;
  if (p.authorId === "me") r += 10;
  const ageH = Math.max(0, (Date.now() - (p.ts || 0)) / 3600e3); // niente boost per ts futura
  r += Math.max(0, 24 - ageH) * 0.5;
  r += (reactionSummary(p).total || 0) * 0.5;
  return r;
}

function setFeedTab(k) {
  state.ui.feedTab = k; save();
  const tabs = document.getElementById("feedTabs");
  if (tabs) tabs.querySelectorAll("button").forEach(b => { const on = b.dataset.ft === k; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  renderFeedBody();
}

function renderFeed(app) {
  state.ui = state.ui || {};
  state.ui.feedTab = state.ui.feedTab || "perte";
  app.appendChild(el(`<div>
    <div class="row-between"><h1 class="view-title">Feed ${ic('chat-bubble', 'accent')}</h1>
      <button class="btn small secondary" id="feedRefresh" type="button" aria-label="Aggiorna il feed">${ic('refresh')} Aggiorna</button></div>
    <p class="view-sub">Cosa succede nella tua scena musicale: jam, prove, serate, traguardi.</p>
    <div class="card flat" id="composer">
      <div class="card-head">${avatarTag(state.me)}<div class="meta"><div class="name">${esc(state.me.name || "Tu")}</div></div></div>
      <div class="chips composer-types" id="postTypes">${POST_TYPES.map(t => `<span class="chip${t.k === "" ? " on" : ""}" data-chip="${t.k}" data-ptype="${t.k}">${ic(t.icon)} ${t.label}</span>`).join("")}</div>
      <textarea id="postText" placeholder="Condividi qualcosa con la community… usa #hashtag"></textarea>
      <div class="emoji-bar" id="emojiBar" hidden>${POST_EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>
      <div id="postPreview"></div>
      <div id="jamAttach"></div>
      <div class="composer-actions">
        <div class="composer-tools">
          <button class="btn small secondary composer-tool" id="postEmoji" type="button" aria-expanded="false">${ic('face-neutral')} Emoji</button>
          <button class="btn small secondary composer-tool" id="postPhoto" type="button">${ic('camera')} Foto</button>
          <button class="btn small secondary composer-tool" id="postJam" type="button">${ic('microphone')} Allega jam</button>
        </div>
        <button class="btn small composer-send" id="postSend" type="button">${ic('send')} Pubblica</button>
      </div>
    </div>
    <div class="segmented" id="feedTabs">${FEED_TABS.map(t => `<button data-ft="${t.k}" class="${state.ui.feedTab === t.k ? "on" : ""}">${esc(t.label)}</button>`).join("")}</div>
    <div id="feedFilterBar"></div>
    <div id="feedList"></div>
  </div>`));
  let pendingImgs = [], pendingType = "", pendingJam = null;
  const paintComposerImgs = () => {
    const box = $("#postPreview");
    box.innerHTML = pendingImgs.length ? `<div class="composer-thumbs">${pendingImgs.map((d, i) => `<div class="composer-thumb"><img src="${esc(safeImg(d))}" alt="anteprima"><button type="button" data-rm="${i}" aria-label="Rimuovi">${ic('x')}</button></div>`).join("")}</div>` : "";
    box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { pendingImgs.splice(+b.dataset.rm, 1); paintComposerImgs(); });
  };
  const paintJamAttach = () => {
    const box = $("#jamAttach");
    if (!pendingJam) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="jam-embed"><span class="je-ic">${ic('microphone')}</span><div class="je-meta"><b>${esc(pendingJam.title)}</b><span>${ic('calendar')} ${formatDate(pendingJam.date)} · ${esc(pendingJam.place || "")}</span></div><button type="button" data-rmjam aria-label="Togli jam">${ic('x')}</button></div>`;
    box.querySelector("[data-rmjam]").onclick = () => { pendingJam = null; paintJamAttach(); };
  };
  $("#postTypes").querySelectorAll("[data-ptype]").forEach(c => c.onclick = () => {
    pendingType = c.dataset.ptype;
    $("#postTypes").querySelectorAll(".chip").forEach(x => { const on = x.dataset.ptype === pendingType; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
  });
  $("#postEmoji").onclick = () => { const b = $("#emojiBar"); b.hidden = !b.hidden; $("#postEmoji").setAttribute("aria-expanded", b.hidden ? "false" : "true"); };
  $("#emojiBar").querySelectorAll("[data-e]").forEach(b => b.onclick = () => insertAtCursor($("#postText"), b.dataset.e));
  $("#postPhoto").onclick = () => { if (pendingImgs.length >= 4) return toast("Massimo 4 immagini per post"); pickImage(d => { pendingImgs.push(d); paintComposerImgs(); }); };
  $("#postJam").onclick = () => openJamPicker(j => { pendingJam = j; paintJamAttach(); });
  $("#postSend").onclick = () => {
    const text = $("#postText").value.trim();
    if (!text && !pendingImgs.length && !pendingJam) return toast("Scrivi qualcosa, aggiungi una foto o allega una jam");
    const me = state.me;
    state.posts = state.posts || [];
    const post = { id: "p" + Date.now(), authorId: "me", type: pendingType, name: me.name || "Tu", avatar: me.avatar, color: me.color, photo: me.photo || "", text, images: pendingImgs.slice(), jamId: pendingJam ? pendingJam.id : null, ts: Date.now(), reactions: {}, myReaction: null, comments: [] };
    state.posts.unshift(post);
    const durable = save(); // se non durevole save() ha già avvisato: il post resta in sessione, non lo scartiamo
    $("#postText").value = ""; pendingImgs = []; pendingJam = null; pendingType = ""; paintComposerImgs(); paintJamAttach();
    $("#postTypes").querySelectorAll(".chip").forEach((x, i) => { x.classList.toggle("on", i === 0); x.setAttribute("aria-pressed", i === 0 ? "true" : "false"); });
    if (durable) toast("Pubblicato", ic('celebration', 'accent')); // altrimenti resta visibile l'avviso "spazio esaurito"
    haptic("Light");
    setFeedTab("recenti");
    simulateEngagement(post.id);
  };
  $("#feedTabs").querySelectorAll("[data-ft]").forEach(b => b.onclick = () => setFeedTab(b.dataset.ft));
  if ($("#feedRefresh")) $("#feedRefresh").onclick = () => { if (typeof runRefresh === "function") runRefresh("feed"); };
  renderFeedFilterBar();
  renderFeedBody();
}

// Scelta di una jam da allegare al post.
function openJamPicker(cb) {
  const today = todayISO();
  const jams = allJams().filter(j => j.date >= today);
  openModal(`<h2>${ic('microphone')} Allega una jam</h2><p class="view-sub">Mostra una jam dentro il tuo post.</p>
    <div id="jpList">${jams.length ? jams.map(j => `<button class="jam-pick" type="button" data-j="${esc(j.id)}"><b>${esc(j.title)}</b><span>${ic('calendar')} ${formatDate(j.date)} · ${esc(j.place || "")}</span></button>`).join("") : `<div class="empty">${illus("quiet")}Nessuna jam in programma.</div>`}</div>`);
  $("#jpList").querySelectorAll("[data-j]").forEach(b => b.onclick = () => { const j = allJams().find(x => x.id === b.dataset.j); closeModal(); if (j) cb(j); });
}

function renderFeedFilterBar() {
  const box = $("#feedFilterBar"); if (!box) return;
  const hf = state.ui && state.ui.feedTag;
  box.innerHTML = hf ? `<div class="ad-foryou" style="margin-top:10px">${ic('search', 'accent')}<span>Filtro: <b>#${esc(hf)}</b></span><button class="btn small" id="clrTag" type="button">Tutti</button></div>` : "";
  if (hf) $("#clrTag").onclick = () => { state.ui.feedTag = null; save(); renderFeedFilterBar(); renderFeedBody(); };
}

// Spazi "Promossi" nativi nel Feed: contenuti di PRIMA PARTE (house ads), CONTESTUALI — niente
// profilazione né dati art. 9. Bassa frequenza, mai nel deck Scopri, soppressi per gli utenti Pro.
// Lo slot è pronto a ospitare campagne vendute col backend (stesso formato/etichetta/cap).
const HOUSE_PROMOS = [
  { id: "pro", icon: "resonance-profile", title: "JamMate Pro", body: "Niente pubblicità, più visibilità in Scopri e Sintonia avanzata. Sostieni un'app indipendente.", cta: "Passa a Pro", go: () => { if (typeof openPro === "function") openPro(); } },
  { id: "venue", icon: "building", title: "Hai un locale o una sala prova?", body: "Diventa Founding Venue: pubblica le tue serate e trova band, zero commissione all'inizio.", cta: "Scopri", go: () => navigate("palco") },
  { id: "lessons", icon: "graduation-cap", title: "Vuoi fare un salto di livello?", body: "Trova un insegnante vicino a te e prenota la prima lezione.", cta: "Vedi lezioni", go: () => navigate("lessons") }
];
const _promoDismissed = {}; // per-sessione: id promo che l'utente ha nascosto
function houseAdCard(promo) {
  const c = el(`<div class="card post promo-card" data-promo="${esc(promo.id)}">
    <div class="promo-head"><span class="promo-tag">Promosso</span><button type="button" class="promo-info" aria-label="Perché vedo questo contenuto?">${ic('info')}</button></div>
    <div class="card-head"><span class="avatar promo-av">${ic(promo.icon)}</span><div class="meta">
      <div class="name">${esc(promo.title)}</div><div class="loc">JamMate</div></div></div>
    <div class="post-text">${esc(promo.body)}</div>
    <div class="post-actions"><button class="btn small" data-cta type="button">${esc(promo.cta)}</button><button class="post-act" data-hide type="button">${ic('x')} Nascondi</button></div>
  </div>`);
  c.querySelector("[data-cta]").onclick = () => { if (typeof promo.go === "function") promo.go(); };
  c.querySelector(".promo-info").onclick = () => toast("Contenuto promozionale di JamMate. Pubblicità contestuale: nessun dato personale o di personalità è usato per mostrartelo.", ic('info'));
  c.querySelector("[data-hide]").onclick = () => { _promoDismissed[promo.id] = true; renderFeedBody(); };
  return c;
}
function renderFeedBody() {
  const box = $("#feedList"); if (!box) return;
  box.innerHTML = "";
  const list = feedPosts();
  if (!list.length) {
    box.innerHTML = `<div class="empty">${illus("quiet")}${state.ui && state.ui.feedTag ? "Nessun post con #" + esc(state.ui.feedTag) + "." : (state.ui && state.ui.feedTab === "vicino" ? "Nessun post vicino a te per ora." : "Ancora niente qui. Pubblica il primo post!")}</div>`;
    return;
  }
  const isPro = state.me && state.me.plan === "pro";
  const promos = HOUSE_PROMOS.filter(p => !_promoDismissed[p.id]);
  let promoIdx = 0, sincePromo = 0;
  list.forEach((p, i) => {
    box.appendChild(postCard(p));
    sincePromo++;
    // Free + feed abbastanza lungo: 1 spazio promosso ogni ~5 post, mai tra i primi 3, mai per ultimo,
    // mai due di fila. Su feed corti non compare nulla (il free resta naturale).
    if (!isPro && promos.length && i >= 2 && i < list.length - 1 && sincePromo >= 5) {
      box.appendChild(houseAdCard(promos[promoIdx % promos.length]));
      promoIdx++; sincePromo = 0;
    }
  });
}

// Foto del post: array `images` (nuovo) con fallback al vecchio singolo `image`.
function postImages(p) { return (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []); }
// Apri il profilo dell'autore (avatar/nome cliccabili nel feed).
function openAuthorProfile(p) {
  if (!p.authorId || p.authorId === "me") { navigate("profile"); return; }
  const prof = (state.profiles || []).find(x => x.id === p.authorId);
  if (prof && typeof openProfileSheet === "function") return openProfileSheet(prof);
  toast("Profilo non disponibile.");
}
// Carosello foto in stile Instagram: frecce, pallini, conteggio e swipe.
function wirePostCarousel(root, count) {
  if (!root) return;
  const track = root.querySelector(".pc-track");
  const dots = root.querySelectorAll(".pc-dots i");
  const countEl = root.querySelector(".pc-count");
  const go = (idx) => {
    idx = Math.max(0, Math.min(count - 1, idx));
    root.dataset.i = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("on", i === idx));
    if (countEl) countEl.textContent = `${idx + 1}/${count}`;
  };
  const prev = root.querySelector(".pc-prev"), next = root.querySelector(".pc-next");
  if (prev) prev.onclick = (e) => { e.stopPropagation(); go(+root.dataset.i - 1); };
  if (next) next.onclick = (e) => { e.stopPropagation(); go(+root.dataset.i + 1); };
  let startX = null;
  root.addEventListener("pointerdown", e => { startX = e.clientX; });
  root.addEventListener("pointerup", e => { if (startX == null) return; const dx = e.clientX - startX; startX = null; if (Math.abs(dx) > 40) go(+root.dataset.i + (dx < 0 ? 1 : -1)); });
}
// #hashtag e @menzioni resi cliccabili (su testo già sanificato con esc()).
function linkifyPost(text) {
  return esc(text || "")
    .replace(/(^|\s)#([\p{L}0-9_]{2,})/gu, (m, sp, t) => `${sp}<a class="htag" data-tag="${esc(t)}">#${esc(t)}</a>`)
    .replace(/(^|\s)@([\p{L}0-9_]{2,})/gu, (m, sp, n) => `${sp}<span class="mention">@${esc(n)}</span>`);
}
function reactionFace(s) { return (s.emojis.length ? s.emojis.join("") : ic('heart')) + ` <span>${s.total}</span>`; }
// Mini-card jam dentro un post (allegato).
function jamEmbedHtml(j) {
  return `<button class="jam-embed tap" type="button" data-jamopen="${esc(j.id)}"><span class="je-ic">${ic('microphone')}</span><div class="je-meta"><b>${esc(j.title)}</b><span>${ic('calendar')} ${formatDate(j.date)} · ${esc(j.place || "")}</span></div><span class="je-go">${ic('arrow-up')}</span></button>`;
}
function findPostById(id) { return (state.posts || []).find(p => p.id === id) || SEED_POSTS.find(p => p.id === id) || jamEventPosts().find(p => p.id === id) || null; }
// Aggiorna UNA sola card. Se c'è un'interazione in corso (commento in scrittura, picker reazioni
// aperto, o focus dentro la card) aggiorna in modo CHIRURGICO invece di ricostruire, così un timer
// di engagement simulato non cancella testo a metà / stato aperto.
function updateOnePost(pid) {
  const old = document.querySelector(`#feedList [data-pid="${pid}"]`); if (!old) return;
  const p = findPostById(pid); if (!p) { old.remove(); return; }
  const pickerOpen = old.querySelector(".react-picker:not([hidden])");
  const cmtInput = old.querySelector(".post-comments:not([hidden]) input, .post-comments:not([hidden]) textarea");
  const typing = cmtInput && cmtInput.value.trim();
  if (pickerOpen || typing || old.contains(document.activeElement)) {
    normReactions(p);
    const reactBtn = old.querySelector("[data-react]");
    if (reactBtn) { reactBtn.classList.toggle("reacted", !!p.myReaction); reactBtn.innerHTML = reactionFace(reactionSummary(p)); }
    const cmtCount = old.querySelector("[data-cmt] span");
    if (cmtCount) cmtCount.textContent = (p.comments || []).length;
    return;
  }
  old.replaceWith(postCard(p));
}

function postCard(p) {
  if (p.type === "jam-event") return jamEventCard(p);
  const s = reactionSummary(p);
  const canDm = p.authorId && p.authorId !== "me";
  const isMine = p.authorId === "me";
  const matched = !!(state.matches && p.authorId && state.matches.includes(p.authorId));
  const a = postAuthor(p);
  const sub = a ? [(a.instruments || [])[0], (a.genres || [])[0]].filter(Boolean).map(esc).join(" · ") : "";
  const tm = postTypeMeta(p.type);
  const imgs = postImages(p).map(safeImg).filter(Boolean); // valida le sorgenti (count/dots si ricalcolano)
  const jam = p.jamId ? allJams().find(j => j.id === p.jamId) : null;
  const carousel = imgs.length ? `<div class="post-carousel" data-i="0">
      <div class="pc-track">${imgs.map(src => `<img class="post-img" src="${esc(src)}" alt="contenuto del post" loading="lazy" decoding="async">`).join("")}</div>
      ${imgs.length > 1 ? `<button type="button" class="pc-arrow pc-prev" aria-label="Precedente">‹</button><button type="button" class="pc-arrow pc-next" aria-label="Successiva">›</button><div class="pc-count">1/${imgs.length}</div><div class="pc-dots">${imgs.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>` : ""}
    </div>` : "";
  const c = el(`<div class="card post" data-pid="${esc(p.id)}">
    ${p.type ? `<div class="post-type-badge t-${esc(p.type)}">${ic(tm.icon)} ${esc(tm.label)}</div>` : ""}
    <div class="card-head author-clickable">${avatarTag(p)}<div class="meta">
      <div class="name">${esc(p.name)}${matched ? ` <span class="in-ris">${ic('match')} In risonanza</span>` : ""}</div>
      <div class="loc">${timeAgo(p.ts)}${sub ? " · " + sub : ""}</div></div></div>
    ${p.text ? `<div class="post-text">${linkifyPost(p.text)}</div>` : ""}
    ${jam ? jamEmbedHtml(jam) : ""}
    ${carousel}
    <div class="react-picker" hidden>${REACTIONS.map(r => `<button data-r="${r}">${r}</button>`).join("")}</div>
    <div class="post-actions">
      <button class="post-act${p.myReaction ? " reacted" : ""}" data-react aria-label="Reagisci" aria-expanded="false">${reactionFace(s)}</button>
      <button class="post-act" data-cmt aria-label="Commenti">${ic('chat-bubble')} <span>${(p.comments || []).length}</span></button>
      ${canDm ? `<button class="post-act" data-dm>${ic('send')} Scrivi</button>` : ""}
      ${isMine ? `<button class="post-act post-more" data-menu aria-label="Opzioni del post" title="Opzioni">${ic('sliders')}</button>` : (canDm ? `<button class="post-act post-more" data-report aria-label="Segnala" title="Segnala">${ic('flag')}</button>` : "")}
    </div>
    <div class="post-comments" hidden></div>
  </div>`);
  c.querySelector(".author-clickable").onclick = () => openAuthorProfile(p);
  c.querySelectorAll(".htag").forEach(h => h.onclick = (e) => { e.stopPropagation(); state.ui.feedTag = h.dataset.tag; save(); renderFeedFilterBar(); renderFeedBody(); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {} });
  c.querySelectorAll("[data-jamopen]").forEach(b => b.onclick = (e) => { e.stopPropagation(); const j = allJams().find(x => x.id === b.dataset.jamopen); if (j && typeof openJamSheet === "function") openJamSheet(j); });
  if (imgs.length > 1) wirePostCarousel(c.querySelector(".post-carousel"), imgs.length);
  const picker = c.querySelector(".react-picker"), reactBtn = c.querySelector("[data-react]");
  reactBtn.onclick = () => { picker.hidden = !picker.hidden; reactBtn.setAttribute("aria-expanded", picker.hidden ? "false" : "true"); };
  picker.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
    const target = adoptPost(p); setReaction(target, b.dataset.r); haptic("Light");
    picker.hidden = true; reactBtn.setAttribute("aria-expanded", "false");
    const ss = reactionSummary(target);
    reactBtn.classList.toggle("reacted", !!target.myReaction);
    reactBtn.innerHTML = reactionFace(ss);
  });
  const cmtBox = c.querySelector(".post-comments");
  c.querySelector("[data-cmt]").onclick = () => { cmtBox.hidden = !cmtBox.hidden; if (!cmtBox.hidden) paintComments(adoptPost(p), cmtBox, c); };
  if (canDm) c.querySelector("[data-dm]").onclick = () => dmAuthor(p.authorId, p.name);
  if (isMine) { const mb = c.querySelector("[data-menu]"); if (mb) mb.onclick = () => openPostMenu(p); }
  else if (canDm) { const rb = c.querySelector("[data-report]"); if (rb) rb.onclick = () => { if (typeof openReportSheet === "function") openReportSheet("Post di " + p.name, "post:" + (p.id || "")); }; }
  return c;
}

// Card-evento "Jam in arrivo" nel feed, con CTA diretta verso la scheda jam.
function jamEventCard(p) {
  const j = allJams().find(x => x.id === p.jamId);
  if (!j) return el(`<div data-pid="${esc(p.id)}" hidden></div>`);
  const elig = typeof jamEligible === "function" ? jamEligible(j) : true;
  const c = el(`<div class="card post type-jam-event" data-pid="${esc(p.id)}">
    <div class="post-type-badge t-jam">${ic('microphone')} Jam in arrivo</div>
    <div class="card-head author-clickable">${avatarTag(p)}<div class="meta">
      <div class="name">${esc(p.name)} <span class="view-sub" style="font-weight:500">organizza</span></div>
      <div class="loc">${ic('calendar')} ${formatDate(j.date)} · ${esc(j.time || "")} · ${ic('map-pin')} ${esc(j.place || "")}</div></div></div>
    <div class="post-text"><b>${esc(j.title)}</b>${(j.genres || []).length ? " · " + (j.genres || []).map(esc).join(", ") : ""}</div>
    ${(j.instruments || []).length ? `<div class="ad-seek"><span class="ad-seek-lbl">Cercano</span>${(j.instruments || []).map(i => `<span class="tag">${esc(i)}</span>`).join("")}</div>` : ""}
    <div class="post-actions"><button class="btn small" type="button" data-jamopen="${esc(j.id)}">${elig ? "Partecipa" : "Dettagli"}</button></div>
  </div>`);
  c.querySelector(".author-clickable").onclick = () => openAuthorProfile(p);
  c.querySelector("[data-jamopen]").onclick = () => { if (typeof openJamSheet === "function") openJamSheet(j); };
  return c;
}

// Menu di un proprio post: elimina.
function openPostMenu(p) {
  openModal(`<h2>Il tuo post</h2><p class="view-sub">Pubblicato ${timeAgo(p.ts)}.</p>
    <button class="btn secondary" id="delPost" type="button" style="margin-top:10px">${ic('x')} Elimina post</button>`);
  $("#delPost").onclick = () => {
    const idx = (state.posts || []).findIndex(x => x.id === p.id);
    const removed = idx >= 0 ? state.posts[idx] : null;
    state.posts = (state.posts || []).filter(x => x.id !== p.id); save();
    closeModal(); renderFeedBody();
    toast("Post eliminato", ic('x'), { actionLabel: "Annulla", onAction: () => { if (removed) { state.posts.splice(Math.min(idx, state.posts.length), 0, removed); save(); renderFeedBody(); } } });
  };
}

// Messaggio privato a un autore di feed/bacheca.
function startDM(p) {
  const fresh = !state.matches.includes(p.id);
  if (fresh) state.matches.push(p.id);
  if (!state.messages[p.id]) state.messages[p.id] = [];
  save();
  if (fresh) toast("Conversazione avviata con " + (p.name || "").split(" ")[0], ic('chat-bubble'));
  navigate("messages"); setTimeout(() => openChat(p), 50);
}
function dmAuthor(profileId, fallbackName) {
  const p = (state.profiles || []).find(x => x.id === profileId);
  if (p) return startDM(p);
  toast("Profilo non disponibile per il messaggio");
}
function paintComments(p, box, card) {
  p.comments = p.comments || [];
  box.innerHTML = p.comments.map(cm => `<div class="comment"><b>${esc(cm.name)}</b> ${esc(cm.text)} <span class="notif-time">· ${timeAgo(cm.ts)}</span></div>`).join("")
    + `<div class="add-comment"><input type="text" aria-label="Scrivi un commento" placeholder="Scrivi un commento…"><button class="btn small" type="button">Invia</button></div>`;
  const inp = box.querySelector("input"), btn = box.querySelector("button");
  const send = () => {
    const t = inp.value.trim(); if (!t) return;
    p.comments.push({ name: state.me.name || "Tu", text: t, ts: Date.now() }); save();
    paintComments(p, box, card);
    const span = card.querySelector("[data-cmt] span"); if (span) span.textContent = p.comments.length;
  };
  btn.onclick = send;
  inp.onkeydown = e => { if (e.key === "Enter") send(); };
}
// Profili da cui simulare l'engagement: prima i tuoi match reali, poi fallback ai seed.
function engagementProfiles() {
  const m = (state.matches || []).map(id => (state.profiles || []).find(p => p.id === id)).filter(Boolean);
  return m.length ? m : SEED_PROFILES;
}
// Engagement simulato sui post dell'utente (con backend: like/commenti reali + push).
function simulateEngagement(postId) {
  setTimeout(() => {
    const p = (state.posts || []).find(x => x.id === postId); if (!p) return;
    normReactions(p);
    const r = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    p.reactions[r] = (p.reactions[r] || 0) + 1 + Math.floor(Math.random() * 3);
    const pool = engagementProfiles(); const who = pool[Math.floor(Math.random() * pool.length)];
    save(); notify(r, `${who.name.split(" ")[0]} ha reagito ${r} al tuo post.`, { view: "feed" });
    if (currentView === "feed") updateOnePost(postId);
  }, 2200);
  setTimeout(() => {
    const p = (state.posts || []).find(x => x.id === postId); if (!p) return;
    const pool = engagementProfiles(); const who = pool[Math.floor(Math.random() * pool.length)];
    const lines = ["Grande! 🔥", "Anch'io ci sono 🙌", "Bellissimo, fatemi sapere!", "Che invidia 😍", "Spacca 🤘"];
    p.comments = p.comments || []; p.comments.push({ name: who.name, text: lines[Math.floor(Math.random() * lines.length)], ts: Date.now() });
    save(); notify("chat-bubble", `${who.name.split(" ")[0]} ha commentato il tuo post.`, { view: "feed" });
    if (currentView === "feed") updateOnePost(postId);
  }, 5200);
}
// Chiude emoji-bar e react-picker al click esterno (polish UX).
document.addEventListener("click", (e) => {
  if (typeof currentView === "undefined" || currentView !== "feed") return;
  if (!e.target.closest("#emojiBar, #postEmoji")) {
    const b = document.getElementById("emojiBar");
    if (b && !b.hidden) { b.hidden = true; const pe = document.getElementById("postEmoji"); if (pe) pe.setAttribute("aria-expanded", "false"); }
  }
  if (!e.target.closest(".react-picker, [data-react]")) {
    document.querySelectorAll("#feedList .react-picker").forEach(pk => { if (!pk.hidden) { pk.hidden = true; const rb = pk.parentElement && pk.parentElement.querySelector("[data-react]"); if (rb) rb.setAttribute("aria-expanded", "false"); } });
  }
});

// ------------------------------------------------------------- Mappa jam (#9)
// Accesso ibrido (deciso): l'autore sceglie 'open' (idonei entrano subito) o
// 'approval' (richiesta → conferma dell'host).
const SEED_JAMS = [
  { id: "j1", hostId: "u7", host: "Tommaso Riva", avatar: "🎷", color: GRADS[5], title: "Jam jazz al parco", date: "2026-06-22", time: "18:30", place: "Parco Sempione", lat: 45.4736, lng: 9.1742, x: 38, y: 40, genres: ["Jazz", "Funk"], instruments: ["Sax", "Pianoforte", "Basso", "Batteria"], minLevel: 2, accessMode: "open", participants: [{ name: "Tommaso", status: "joined" }, { name: "Sara", status: "joined" }] },
  { id: "j2", hostId: "u1", host: "Marco Bassani", avatar: "🎸", color: GRADS[0], title: "Prove rock aperte", date: "2026-06-25", time: "21:00", place: "Sala Lambrate", lat: 45.4847, lng: 9.2400, x: 66, y: 28, genres: ["Rock", "Blues"], instruments: ["Basso", "Batteria", "Voce"], minLevel: 1, accessMode: "approval", participants: [{ name: "Marco", status: "joined" }] },
  { id: "j3", hostId: "u4", host: "Sara Lombardi", avatar: "🎹", color: GRADS[1], title: "Aperitivo in acustico", date: "2026-06-28", time: "19:00", place: "Navigli", lat: 45.4515, lng: 9.1740, x: 28, y: 72, genres: ["Pop", "Cantautorato"], instruments: ["Chitarra", "Voce", "Violino"], minLevel: 0, accessMode: "open", participants: [{ name: "Sara", status: "joined" }] },
  { id: "j4", hostId: "u11", host: "Paolo De Santis", avatar: "🎺", color: GRADS[2], title: "Sezione fiati funk", date: "2026-07-02", time: "20:30", place: "Isola", lat: 45.4870, lng: 9.1890, x: 74, y: 60, genres: ["Funk", "Soul"], instruments: ["Sax", "Tromba", "Tastiere"], minLevel: 3, accessMode: "approval", participants: [{ name: "Paolo", status: "joined" }] }
];
function allJams() {
  const own = state.jams || [];
  const ownIds = new Set(own.map(j => j.id));
  // La copia "adottata" in state oscura il gemello seed con lo stesso id (niente duplicati).
  return [...own, ...SEED_JAMS.filter(j => !ownIds.has(j.id))];
}
// Clona un seed jam in state.jams prima di mutarlo (stesso pattern di adoptPost): evita di mutare
// la costante SEED_JAMS (perdita al reload + jamCount disallineato).
function adoptJam(j) {
  state.jams = state.jams || [];
  let live = state.jams.find(x => x.id === j.id);
  if (!live) { live = JSON.parse(JSON.stringify(j)); state.jams.unshift(live); }
  return live;
}
function jamEligible(j) {
  const me = state.me, lv = levelsOf(me), wants = j.instruments || [];
  if (!wants.length) return true;
  return wants.some(i => (me.instruments || []).includes(i) && levelRank(lv[i] || me.level) >= (j.minLevel || 0));
}
function myJamStatus(j) { const p = (j.participants || []).find(x => x.me); return p ? p.status : null; }
function rerenderBoardMap() { if (currentView === "board") renderBoard2(); }

// --- Feedback verificato tra JamMates (solo dopo una jam completata) ---
// todayISO() è definita in app.js (versione fuso-locale): unica fonte, evita divergenze UTC/locale.
function iJoinedJam(j) { return j.hostId === "me" || myJamStatus(j) === "joined"; }
// Una jam è "completata" se vi ho partecipato e l'ho segnata fatta o la data è passata.
function jamDone(j) { return iJoinedJam(j) && (!!(state.jamsDone && state.jamsDone[j.id]) || j.date < todayISO()); }
// JamMates valutabili: profili (diversi da me) della jam, risolti per id host o per nome.
function jamMates(j) {
  const out = [], seen = new Set();
  const add = (prof) => { if (prof && prof.id !== "me" && !seen.has(prof.id)) { seen.add(prof.id); out.push(prof); } };
  if (j.hostId && j.hostId !== "me") add((state.profiles || []).find(p => p.id === j.hostId));
  (j.participants || []).forEach(part => { if (part.me) return; add((state.profiles || []).find(p => p.name === part.name || p.name.split(" ")[0] === part.name)); });
  return out;
}
function jamFbKey(jId, pId) { return jId + "|" + pId; }
function jamFbDone(jId, pId) { return !!(state.jamFeedback && state.jamFeedback[jamFbKey(jId, pId)]); }
// Esiste almeno una jam completata in comune con questo profilo? (gate anti "ad cazzum")
function hasJammedWith(p) { return allJams().some(j => jamDone(j) && jamMates(j).some(m => m.id === p.id)); }
function jamWith(p) { return allJams().find(j => jamDone(j) && jamMates(j).some(m => m.id === p.id)); }

const JAMMATE_TAGS = ["Groove solido", "Sa ascoltare", "Sempre puntuale", "Tecnica top", "Bella energia", "Affidabile", "Versatile", "Trascina il gruppo"];
function openJamFeedback(j, p) {
  const likert = (name, label, emo) => `<div class="lk"><div class="lk-q" id="jfb-${name}">${emo} ${esc(label)}</div>
    <div class="likert" data-name="${name}" role="radiogroup" aria-labelledby="jfb-${name}">${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" data-v="${v}" aria-label="${v} su 5" aria-checked="${v === 4 ? "true" : "false"}" class="${v === 4 ? "on" : ""}">${v}</button>`).join("")}</div></div>`;
  openModal(`
    <h2>${ic('star')} Valuta ${esc(p.name.split(" ")[0])}</h2>
    <div class="aff-note">Feedback <b>verificato tra JamMates</b>: sbloccato perché avete suonato insieme a "<b>${esc(j.title)}</b>". Costruisce la reputazione reale (non auto-dichiarata).</div>
    ${likert("tec", "Tecnica / musicalità", "🎸")}
    ${likert("punt", "Puntualità", ic('clock'))}
    ${likert("comp", "Comportamento", "🤝")}
    ${likert("int", "Intesa musicale", "🎶")}
    <div class="section-label">Tag rapidi</div>
    <div class="chips" id="jfTags">${JAMMATE_TAGS.map(t => `<span class="chip" data-chip="${esc(t)}">${esc(t)}</span>`).join("")}</div>
    <label class="field" style="margin-top:12px;display:flex;align-items:center;gap:8px"><input type="checkbox" id="jfRejam" checked> Rigiocherei con ${esc(p.name.split(" ")[0])}</label>
    <button class="btn" id="jfSave" style="margin-top:16px">Invia feedback</button>
  `);
  const root = $("#modalRoot");
  root.querySelectorAll(".likert").forEach(rw => rw.querySelectorAll("button").forEach(b => b.onclick = () => { rw.querySelectorAll("button").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); }); b.classList.add("on"); b.setAttribute("aria-checked", "true"); }));
  const selTags = [];
  root.querySelectorAll("#jfTags .chip").forEach(c => c.onclick = () => toggleChip(c, selTags));
  $("#jfSave").onclick = () => {
    const g = (n) => { const r = root.querySelector(`.likert[data-name="${n}"] button.on`); return r ? +r.dataset.v : 4; };
    const map = { puntualita: g("punt"), tecnica: g("tec"), attitudine: g("comp") };
    p.endo = p.endo || { puntualita: 0, tecnica: 0, attitudine: 0, endorsements: 0 };
    const n = p.endo.endorsements || 0;
    ["puntualita", "tecnica", "attitudine"].forEach(k => { p.endo[k] = Math.round((p.endo[k] * n + map[k] * 20) / (n + 1)); });
    p.endo.intesa = Math.round((((p.endo.intesa || 0) * n) + g("int") * 20) / (n + 1));
    p.endo.endorsements = n + 1;
    p.endo.rejamTotal = (p.endo.rejamTotal || 0) + 1;
    if ($("#jfRejam").checked) p.endo.rejamYes = (p.endo.rejamYes || 0) + 1;
    p.endo.tags = p.endo.tags || {}; selTags.forEach(t => p.endo.tags[t] = (p.endo.tags[t] || 0) + 1);
    state.jamFeedback = state.jamFeedback || {}; state.jamFeedback[jamFbKey(j.id, p.id)] = true;
    save(); closeModal(); toast(`Feedback inviato a ${p.name.split(" ")[0]}`, ic('celebration', 'accent')); openJamSheet(j); rerenderBoardMap();
  };
}
function jamFeedbackHtml(j) {
  if (!iJoinedJam(j)) return "";
  if (!jamDone(j)) {
    return `<div class="section-label">Dopo la jam</div>
      <div class="aff-note">Quando avete suonato, segna la jam come completata: potrai <b>valutare i tuoi JamMates</b> (solo chi ha davvero jammato con te).</div>
      <button class="btn secondary" id="jamComplete" style="margin-top:10px">${ic('check', 'ok')} Segna come completata</button>`;
  }
  const mates = jamMates(j);
  if (!mates.length) return `<div class="section-label">JamMates</div><div class="aff-note">Nessun JamMate collegato a un profilo da valutare.</div>`;
  return `<div class="section-label">Valuta i tuoi JamMates</div>
    <p class="view-sub">Avete suonato insieme: lascia un feedback verificato.</p>
    ${mates.map(m => `<div class="rep-item"><span class="song">${esc(m.avatar || "🎵")} ${esc(m.name)}</span>${jamFbDone(j.id, m.id) ? `<span class="tag lvl">${ic('check')} Valutato</span>` : `<button class="btn small" data-rate="${esc(m.id)}">${ic('star')} Valuta</button>`}</div>`).join("")}`;
}

// Coordinate (lat,lng) delle città per centrare la mappa reale. La città scelta
// non in elenco → default Milano. I jam finti vengono sparsi attorno al centro.
const CITY_COORDS = {
  "milano": [45.4642, 9.19], "monza": [45.5845, 9.2744], "sesto s.g.": [45.5333, 9.2333],
  "cinisello": [45.5556, 9.2186], "bergamo": [45.6983, 9.6773], "brescia": [45.5416, 10.2118],
  "roma": [41.9028, 12.4964], "torino": [45.0703, 7.6869], "napoli": [40.8518, 14.2681],
  "bologna": [44.4949, 11.3426], "firenze": [43.7696, 11.2558], "verona": [45.4384, 10.9916],
  "genova": [44.4056, 8.9463], "padova": [45.4064, 11.8768], "palermo": [38.1157, 13.3615], "bari": [41.1171, 16.8719]
};
function cityCenter(city) { return CITY_COORDS[(city || "").trim().toLowerCase()] || CITY_COORDS["milano"]; }
function jamLatLng(j, c) { if (j.lat != null && j.lng != null) return [j.lat, j.lng]; return [c[0] + (50 - (j.y || 50)) / 100 * 0.06, c[1] + ((j.x || 50) - 50) / 100 * 0.10]; }
let jamMapInstance = null;
function renderJamMap(box) {
  const jams = allJams();
  const elig = jams.filter(jamEligible).length;
  box.appendChild(el(`<div>
    <p class="view-sub">Jam vicino a te su mappa. In <span style="color:var(--ok);font-weight:800">verde</span> quelle adatte a te. Tocca un segnaposto, o tira su la <b>linguetta</b> per la lista.</p>
    <div class="map-search">
      <input type="text" id="mapSearch" placeholder="Cerca città o indirizzo…" autocomplete="off">
      <button class="btn small" id="mapSearchBtn">${ic('search')} Vai</button>
    </div>
    <div class="jam-map-wrap">
      <div class="jam-map" id="jamMap"></div>
      <button class="map-locate" id="mapLocate" title="La mia posizione" aria-label="Centra sulla mia posizione">${ic('map-pin')}</button>
      <div class="jam-sheet" id="jamSheet">
        <div class="jam-sheet-grip" id="jamGrip"><span class="grip-bar"></span></div>
        <div class="jam-sheet-head">🎶 ${jams.length} jam${elig ? ` · <span style="color:var(--ok)">${elig} per te</span>` : ""}</div>
        <div class="jam-sheet-list" id="jamList"></div>
      </div>
    </div>
  </div>`));
  const list = $("#jamList");
  jams.forEach(j => list.appendChild(jamCard(j)));
  // Linguetta (bottom-sheet): tap o trascina la maniglia per espandere/comprimere la lista.
  const sheet = $("#jamSheet"), grip = $("#jamGrip");
  let startY = null, dragged = false;
  grip.addEventListener("pointerdown", e => { startY = e.clientY; dragged = false; });
  grip.addEventListener("pointermove", e => { if (startY != null && Math.abs(e.clientY - startY) > 22) { dragged = true; if (e.clientY < startY) sheet.classList.add("open"); else sheet.classList.remove("open"); } });
  grip.addEventListener("pointerup", () => { startY = null; setTimeout(() => { dragged = false; }, 60); });
  grip.onclick = () => { if (!dragged) sheet.classList.toggle("open"); };
  // Mappa reale (Leaflet) a tema scuro, centrata sulla città scelta.
  if (typeof L === "undefined") { $("#jamMap").innerHTML = `<div class="empty" style="padding:24px">Mappa non disponibile.</div>`; return; }
  if (jamMapInstance) { try { jamMapInstance.remove(); } catch (e) {} jamMapInstance = null; }
  const center = cityCenter(state.me.city);
  const map = L.map($("#jamMap"), { zoomControl: true, attributionControl: true }).setView(center, 12);
  jamMapInstance = map;
  let locateMarker = null, searchMarker = null; // riusa un solo pin per sorgente (niente accumulo)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap, &copy; CARTO" }).addTo(map);
  jams.forEach(j => {
    const icon = L.divIcon({ className: "jam-divicon", html: `<div class="jam-pin${jamEligible(j) ? " ok" : ""}"><span>${esc(j.avatar)}</span></div>`, iconSize: [38, 47], iconAnchor: [19, 45] });
    L.marker(jamLatLng(j, center), { icon }).addTo(map).on("click", () => openJamSheet(j));
  });
  setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 60);
  $("#mapLocate").onclick = () => {
    if (!navigator.geolocation) return toast("Geolocalizzazione non disponibile");
    toast("Cerco la tua posizione…");
    navigator.geolocation.getCurrentPosition(
      pos => { const ll = [pos.coords.latitude, pos.coords.longitude]; map.setView(ll, 13); if (locateMarker) { locateMarker.setLatLng(ll); } else { locateMarker = L.circleMarker(ll, { radius: 8, color: "#8b6cff", fillColor: "#8b6cff", fillOpacity: .9, weight: 2 }).addTo(map).bindTooltip("Sei qui"); } },
      () => toast("Posizione non disponibile — cerca la città qui sopra"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
  // Ricerca per indirizzo/città (geocoder Nominatim/OSM): centra la mappa sul risultato.
  const doSearch = () => {
    const q = ($("#mapSearch").value || "").trim(); if (!q) return;
    const btn = $("#mapSearchBtn"), inp = $("#mapSearch");
    if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
    if (inp) inp.setAttribute("aria-busy", "true");
    const done = () => { if (btn) { btn.classList.remove("is-loading"); btn.disabled = false; } if (inp) inp.removeAttribute("aria-busy"); };
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q), { headers: { "Accept": "application/json" }, signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (!d || !d.length) return toast("Nessun risultato per «" + q + "»");
        const ll = [parseFloat(d[0].lat), parseFloat(d[0].lon)];
        map.setView(ll, 14);
        if (searchMarker) { searchMarker.setLatLng(ll); searchMarker.setTooltipContent(esc(d[0].display_name)); searchMarker.openTooltip(); }
        else searchMarker = L.circleMarker(ll, { radius: 8, color: "#ff5c9d", fillColor: "#ff5c9d", fillOpacity: .9, weight: 2 }).addTo(map).bindTooltip(esc(d[0].display_name)).openTooltip();
      })
      .catch(() => toast(ctrl.signal.aborted ? "Ricerca troppo lenta — riprova" : "Ricerca non disponibile", ic('alert-triangle'), { error: true }))
      .finally(() => { clearTimeout(to); done(); });
  };
  $("#mapSearchBtn").onclick = doSearch;
  $("#mapSearch").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
}
function jamCard(j) {
  const elig = jamEligible(j), my = myJamStatus(j);
  const c = el(`<div class="card">
    <div class="card-head">${avatarTag({ avatar: j.avatar, color: j.color })}<div class="meta">
      <div class="name">${esc(j.title)} ${elig ? '<span class="tag lvl">adatta a te</span>' : ""}</div>
      <div class="loc">${ic('calendar')} ${formatDate(j.date)} · ${esc(j.time)} · ${ic('map-pin')} ${esc(j.place)}</div></div>
      ${j.accessMode === "approval" ? '<span class="tag">🔒 su richiesta</span>' : '<span class="tag accent">aperta</span>'}</div>
    <div class="tags" style="margin-top:8px">${(j.instruments || []).map(i => `<span class="tag">${esc(i)}</span>`).join("")}</div>
    ${my ? `<div class="aff-note" style="margin-top:8px">${my === "joined" ? `${ic('check')} Partecipi a questa jam` : `${ic('clock')} Richiesta inviata`}</div>` : ""}
  </div>`);
  c.onclick = () => openJamSheet(j);
  return c;
}
function jamActionHtml(j, elig, my) {
  if (j.hostId === "me") return `<div class="aff-note" style="margin-top:14px">Sei l'host di questa jam.</div>`;
  if (my === "joined") return `<button class="btn secondary" id="jamCancel" style="margin-top:14px">Annulla partecipazione</button>`;
  if (my === "requested") return `<button class="btn secondary" id="jamCancel" style="margin-top:14px">Annulla richiesta</button>`;
  if (!elig) return `<div class="aff-note" style="margin-top:14px">${ic('alert-triangle')} Non risulti idoneo: servono <b>${(j.instruments || []).join(", ")}</b> a livello <b>${esc(LEVELS[j.minLevel || 0])}+</b>. Aggiorna i tuoi strumenti nel profilo.</div>`;
  return `<button class="btn" id="jamAct" style="margin-top:14px">${j.accessMode === "approval" ? `${ic('send')} Richiedi di partecipare` : "🎶 Partecipa"}</button>`;
}
function openJamSheet(j) {
  const elig = jamEligible(j), my = myJamStatus(j), isHost = j.hostId === "me";
  const reqs = (j.participants || []).filter(p => p.status === "requested" && !p.me);
  openModal(`
    <div style="text-align:center"><div style="display:flex;justify-content:center">${avatarTag({ avatar: j.avatar, color: j.color }, true)}</div>
      <h2>${esc(j.title)}</h2>
      <div class="loc">${ic('calendar')} ${formatDate(j.date)} · ${esc(j.time)} · ${ic('map-pin')} ${esc(j.place)}</div>
      <div class="loc" style="margin-top:4px">Host: ${esc(j.host)}</div>
    </div>
    <div class="tags" style="justify-content:center;margin-top:10px">${(j.genres || []).map(g => `<span class="tag accent">${esc(g)}</span>`).join("")}</div>
    <div class="section-label">Strumenti cercati · livello min. ${esc(LEVELS[j.minLevel || 0])}</div>
    <div class="tags">${(j.instruments || []).map(i => `<span class="tag">${esc(i)}</span>`).join("")}</div>
    <div class="section-label">Partecipanti (${(j.participants || []).length})</div>
    <div class="tags">${(j.participants || []).map(p => `<span class="tag${p.status === "joined" ? " lvl" : ""}">${esc(p.name)}${p.status === "requested" ? ` ${ic('clock')}` : ""}</span>`).join("")}</div>
    <div class="aff-note" style="margin-top:12px">${j.accessMode === "approval" ? "🔒 Jam <b>su approvazione</b>: l'host conferma le richieste." : "✅ Jam <b>aperta</b>: gli idonei entrano subito."}</div>
    ${isHost && reqs.length ? `<div class="section-label">Richieste</div><div id="jamReqs">${reqs.map((p, i) => `<div class="lvl-row"><span class="lvl-inst">${esc(p.name)}</span><span><button class="btn small" data-ok="${i}">${ic('check')} Accetta</button> <button class="btn small secondary" data-no="${i}">${ic('x')}</button></span></div>`).join("")}</div>` : ""}
    ${jamActionHtml(j, elig, my)}
    ${!isHost && j.hostId ? `<button class="btn secondary" id="jamDm" style="margin-top:10px">${ic('send')} Scrivi a ${esc(j.host.split(" ")[0])}</button>` : ""}
    ${jamFeedbackHtml(j)}
  `);
  if ($("#jamDm")) $("#jamDm").onclick = () => { closeModal(); dmAuthor(j.hostId, j.host); };
  if ($("#jamAct")) $("#jamAct").onclick = () => jamJoin(j);
  if ($("#jamComplete")) $("#jamComplete").onclick = () => {
    state.jamsDone = state.jamsDone || {}; state.jamsDone[j.id] = true;
    state.me.jamCount = (state.me.jamCount || 0) + 1;
    save(); toast("Jam completata — valuta i tuoi JamMates", ic('celebration','accent'));
    if (typeof notify === "function") notify("celebration", `Jam "${j.title}" completata: valuta i tuoi JamMates!`, { view: "board" });
    openJamSheet(j); rerenderBoardMap();
  };
  document.querySelectorAll("#modalRoot [data-rate]").forEach(b => b.onclick = () => { const p = (state.profiles || []).find(x => x.id === b.dataset.rate); if (p) openJamFeedback(j, p); });
  if ($("#jamCancel")) $("#jamCancel").onclick = () => { const t = adoptJam(j); t.participants = (t.participants || []).filter(x => !x.me); save(); closeModal(); toast("Annullato"); rerenderBoardMap(); };
  if (isHost && reqs.length) {
    document.querySelectorAll("#jamReqs [data-ok]").forEach(b => b.onclick = () => { reqs[+b.dataset.ok].status = "joined"; save(); toast("Richiesta accettata", ic('check','ok')); openJamSheet(j); rerenderBoardMap(); });
    document.querySelectorAll("#jamReqs [data-no]").forEach(b => b.onclick = () => { const p = reqs[+b.dataset.no]; j.participants = j.participants.filter(x => x !== p); save(); toast("Richiesta rifiutata"); openJamSheet(j); rerenderBoardMap(); });
  }
}
function jamJoin(j) {
  j = adoptJam(j); // muta la copia in state, non il seed
  const status = j.accessMode === "approval" ? "requested" : "joined";
  j.participants = j.participants || [];
  j.participants.push({ name: state.me.name || "Tu", status, me: true });
  save(); closeModal();
  if (status === "joined") { toast("Partecipi alla jam! 🎶"); notify("music-note", `Partecipi a "${j.title}" il ${formatDate(j.date)}.`, { view: "board" }); }
  else {
    toast("Richiesta inviata", ic('send')); notify("clock", `Richiesta inviata per "${j.title}".`, { view: "board" });
    setTimeout(() => {
      const me = (j.participants || []).find(x => x.me);
      if (me && me.status === "requested") { me.status = "joined"; save(); notify("check", `${j.host.split(" ")[0]} ha accettato la tua richiesta per "${j.title}"!`, { view: "board" }); rerenderBoardMap(); }
    }, 3200);
  }
  rerenderBoardMap();
}
function openCreateJam() {
  openModal(`
    <h2>Crea una jam 🎶</h2>
    <label class="field">Titolo</label><input type="text" id="jTitle" placeholder="Es. Jam blues al parco">
    <label class="field" style="margin-top:10px">Luogo</label><input type="text" id="jPlace" value="${esc(state.me.city)}" placeholder="Es. Parco Sempione">
    <div class="filter-row" style="margin-top:10px">
      <div style="flex:1"><label class="field">Data</label><input type="date" id="jDate"></div>
      <div style="flex:1"><label class="field">Ora</label><input type="time" id="jTime" value="19:00"></div>
    </div>
    <label class="field" style="margin-top:10px">Generi</label><div class="chips" id="jGen">${chips(GENRES, [])}</div>
    <label class="field" style="margin-top:10px">Strumenti cercati</label><div id="jIns"></div>
    <label class="field" style="margin-top:10px">Livello minimo</label><select id="jLvl">${options(LEVELS, LEVELS[0])}</select>
    <label class="field" style="margin-top:10px">Accesso</label>
    <select id="jAccess"><option value="open">Aperta — gli idonei entrano subito</option><option value="approval">Su approvazione — confermi tu</option></select>
    <button class="btn" id="jSave" style="margin-top:16px">Pubblica jam</button>
  `);
  const selG = [], selI = [];
  document.querySelectorAll("#jGen .chip").forEach(c => c.onclick = () => toggleChip(c, selG));
  instrumentPicker($("#jIns"), selI, { placeholder: "Strumento cercato…" });
  $("#jSave").onclick = () => {
    const title = $("#jTitle").value.trim(); if (!title) return markFieldError("#jTitle", "Dai un titolo alla jam.");
    if (!selI.length) return toast("Indica almeno uno strumento cercato");
    const j = {
      id: "mj" + Date.now(), hostId: "me", host: state.me.name || "Tu", avatar: state.me.avatar, color: state.me.color,
      title, place: $("#jPlace").value.trim() || state.me.city, date: $("#jDate").value || new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
      time: $("#jTime").value || "19:00", genres: selG, instruments: selI, minLevel: LEVELS.indexOf($("#jLvl").value),
      accessMode: $("#jAccess").value, x: 30 + Math.floor(Math.random() * 40), y: 28 + Math.floor(Math.random() * 44),
      lat: cityCenter(state.me.city)[0] + (Math.random() - 0.5) * 0.05, lng: cityCenter(state.me.city)[1] + (Math.random() - 0.5) * 0.07,
      participants: [{ name: state.me.name || "Tu", status: "joined", me: true }]
    };
    state.jams = state.jams || []; state.jams.unshift(j); save(); closeModal(); toast("Jam pubblicata 🎶");
    state.ui.boardMode = "map"; if (currentView === "board") renderBoard2(); else navigate("board");
    setTimeout(() => {
      const jj = (state.jams || []).find(x => x.id === j.id); if (!jj) return;
      const who = SEED_PROFILES[Math.floor(Math.random() * SEED_PROFILES.length)];
      jj.participants.push({ name: who.name, status: j.accessMode === "approval" ? "requested" : "joined" }); save();
      notify(j.accessMode === "approval" ? "🙋" : "🎶", `${who.name.split(" ")[0]} ${j.accessMode === "approval" ? "ha chiesto di partecipare a" : "si è unito a"} "${j.title}".`, { view: "board" });
      rerenderBoardMap();
    }, 3500);
  };
}

// ------------------------------------------------------------- Lezioni (#12)
// Deciso: prenotazione + pagamento online da subito (qui simulato).
const SEED_TEACHERS = [
  { id: "t1", name: "Sara Lombardi", avatar: "🎹", color: GRADS[1], peerId: "u4", genres: ["Jazz", "Pop", "Cantautorato"], instruments: ["Pianoforte", "Tastiere"], city: "Milano", online: true, hourly: 35, bio: "Pianista jazz/pop, 10 anni di insegnamento. Metodo su misura, dai principianti agli avanzati.", rating: 49, ratings: 23, slots: [{ id: "s1", date: "2026-06-23", time: "17:00" }, { id: "s2", date: "2026-06-23", time: "18:00" }, { id: "s3", date: "2026-06-25", time: "16:00" }] },
  { id: "t2", name: "Marco Bassani", avatar: "🎸", color: GRADS[0], peerId: "u1", genres: ["Rock", "Blues", "Funk"], instruments: ["Chitarra elettrica", "Chitarra"], city: "Milano", online: false, hourly: 30, bio: "Chitarra rock/blues: dai primi accordi al primo assolo.", rating: 47, ratings: 15, slots: [{ id: "s4", date: "2026-06-24", time: "19:00" }, { id: "s5", date: "2026-06-26", time: "18:30" }] },
  { id: "t3", name: "Elena Marchi", avatar: "🎻", color: GRADS[2], peerId: "u6", genres: ["Classica", "Folk", "Pop"], instruments: ["Violino"], city: "Milano", online: true, hourly: 40, bio: "Violino classico e moderno, formazione di conservatorio.", rating: 50, ratings: 31, slots: [{ id: "s6", date: "2026-06-23", time: "15:00" }, { id: "s7", date: "2026-06-27", time: "11:00" }] },
  { id: "t4", name: "Tommaso Riva", avatar: "🎷", color: GRADS[5], peerId: "u7", genres: ["Jazz", "Funk", "Blues"], instruments: ["Sax"], city: "Milano", online: false, hourly: 32, bio: "Sax jazz e funk: improvvisazione, teoria e tanto groove.", rating: 46, ratings: 9, slots: [{ id: "s8", date: "2026-06-25", time: "20:00" }] }
];
// Profili (state.profiles) marcati come insegnanti: derivano un oggetto-insegnante dal blocco
// profile.teaching (flag-insegnante esplicito sul seed musicista). // backend hook: GET /teachers/in-network
function profileTeachers() {
  return (state.profiles || []).filter(p => p && p.teaching).map(p => {
    const te = p.teaching;
    return {
      id: "pt-" + p.id, peerId: p.id, name: p.name, avatar: p.avatar, color: p.color, photo: p.photo || "",
      instruments: te.instruments || p.instruments || [], genres: te.genres || p.genres || [],
      city: p.city, online: !!te.online, hourly: te.hourly || 30, bio: te.bio || p.bio || "",
      rating: te.rating || 0, ratings: te.ratings || 0, reviewTags: te.reviewTags || {}, slots: te.slots || []
    };
  });
}
function allTeachers() {
  // Le recensioni dei non-'me' sono persistite in state.teacherStats (i teacher seed/derivati sono
  // ricreati a ogni render): le fondiamo qui, unica fonte letta da teacherCard/openTeacherProfile.
  const stats = state.teacherStats || {};
  const apply = (t) => { const s = stats[t.id]; return s ? Object.assign({}, t, { rating: s.rating, ratings: s.ratings, reviewTags: s.reviewTags || t.reviewTags || {} }) : t; };
  const mine = state.teacher ? [Object.assign({ id: "me", name: state.me.name || "Tu", avatar: state.me.avatar, color: state.me.color, photo: state.me.photo || "", mine: true, rating: 0, ratings: 0 }, state.teacher)] : [];
  // Fonde seed insegnanti + profili-insegnante, collassando i doppioni per nome (es. t2/u1, t4/u7):
  // se un SEED_PROFILE insegna ed esiste un seed-teacher con lo stesso nome, vince il profilo collegato.
  const peers = profileTeachers().map(apply);
  const peerNames = new Set(peers.map(p => (p.name || "").toLowerCase()));
  const seed = SEED_TEACHERS.filter(t => !peerNames.has((t.name || "").toLowerCase())).map(apply);
  return [...mine, ...peers, ...seed];
}
// Profilo (state.profiles) collegato a un insegnante: per peerId esplicito o, in fallback, per nome.
function teacherPeer(t) {
  if (!t || t.mine) return null;
  const profs = state.profiles || [];
  if (t.peerId) { const byId = profs.find(p => p.id === t.peerId); if (byId) return byId; }
  const nm = (t.name || "").toLowerCase();
  return profs.find(p => (p.name || "").toLowerCase() === nm) || null;
}
// Single source of truth disponibilità: uno slot è occupato se esiste una booking confirmed persistita
// per quell'insegnante a quella data/ora. NON si muta più s.booked sul seed volatile.
function isSlotBooked(t, s) {
  return (state.lessonBookings || []).some(b => b.status === "confirmed" && b.teacherId === t.id && b.date === s.date && b.time === s.time);
}
// Slot liberi e filtrati per la vista (deriva dallo stato, non dal flag seed).
function freeSlots(t) { return (t.slots || []).filter(s => !isSlotBooked(t, s)); }
// Stato effettivo derivato: una confirmed con data passata è "completata" (gate recensione/disdetta).
function bookingState(b) {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "confirmed" && b.date < todayISO()) return "completata";
  return "confirmed";
}
function rerenderLessons() { if (currentView === "lessons") { const app = document.getElementById("app"); app.innerHTML = ""; renderLessons(app); } }

// Ranking insegnanti per rilevanza (overlap strumenti/generi col profilo, città, scena, online, rating).
// Tie-breaker stabile su id (come AUDIT.md). // backend hook: GET /teachers?rankFor=me (ranking lato server)
function cmpId(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }
function teacherGenres(t) { const peer = teacherPeer(t); return t.genres && t.genres.length ? t.genres : (peer ? (peer.genres || []) : []); }
function lessonRelevance(t) {
  if (t.mine) return -1; // il proprio profilo non entra nel ranking allievo
  let s = 0;
  const myIns = state.me.instruments || [];
  const tIns = t.instruments || [];
  if (tIns.some(i => myIns.includes(i))) s += 30;                                   // insegna ciò che suono
  if (lessonFilter.instrument && tIns.some(i => i === lessonFilter.instrument || i.includes(lessonFilter.instrument))) s += 12;
  if (t.city && state.me.city && t.city === state.me.city) s += 10;                 // stessa città
  s += genreOverlap(teacherGenres(t), state.me.genres) * 6;                         // generi in comune
  const peer = teacherPeer(t);
  if (peer) {
    if (typeof hasJammedWith === "function" && hasJammedWith(peer)) s += 24;        // avete già jammato
    else if (typeof affinityPct === "function") s += Math.round(affinityPct(peer) / 8); // alta affinità
  }
  if (lessonFilter.mode === "online" && t.online) s += 8;
  s += (t.rating || 0) / 10;                                                        // rating come tie-breaker fine
  if (freeSlots(t).length) s += 2;                                                  // freschezza/disponibilità slot
  return s;
}
// Chip "in sintonia" sulla scheda insegnante (continuità col "In risonanza" del Feed). Null se nessun segnale.
function lessonRelevanceLabel(t) {
  if (t.mine) return null;
  const peer = teacherPeer(t);
  if (peer && typeof hasJammedWith === "function" && hasJammedWith(peer)) return "Avete già jammato";
  const myIns = state.me.instruments || [];
  if ((t.instruments || []).some(i => myIns.includes(i))) return "Insegna ciò che suoni";
  if (genreOverlap(teacherGenres(t), state.me.genres) > 0) return "Nella tua scena";
  if (t.city && state.me.city && t.city === state.me.city) return "In sintonia";
  return null;
}

// Lezioni online: link videolezione automatico (Jitsi, gratuito, senza account) +
// evento calendario .ics. Entrambi modificabili / non vincolanti.
function jitsiUrl(id) { return "https://meet.jit.si/JamMate-" + String(id).replace(/[^a-zA-Z0-9]/g, ""); }
// URL Jitsi "brandizzato": oggetto "Lezione JamMate con X" + nome allievo pre-compilato
// (solo per le stanze Jitsi; i link custom dell'insegnante si aprono così come sono).
function brandedMeetingUrl(b) {
  const base = b.meetingUrl || "";
  if (!/^https:\/\/meet\.jit\.si\//i.test(base)) return base;
  const enc = (v) => encodeURIComponent(JSON.stringify(v));
  const name = (state.me.name || "Allievo");
  const subject = "Lezione JamMate con " + (b.teacherName || "").split(" ")[0];
  return base + "#userInfo.displayName=" + enc(name) + "&config.subject=" + enc(subject);
}
// Schermata pre-lezione brandizzata JamMate (il "wrapper" è nostro, la call è Jitsi).
function openVideoLesson(b) {
  const url = brandedMeetingUrl(b);
  openModal(`
    <div style="text-align:center">
      <div class="vl-brand"><span class="vl-logo">${ic('music-note')}</span><span class="vl-name">JamMate</span></div>
      <div class="vl-badge">Videolezione</div>
      <h2 style="margin-top:8px">Lezione con ${esc(b.teacherName.split(" ")[0])}</h2>
      <div class="loc">${ic('calendar')} ${formatDate(b.date)} · ${esc(b.time)} · <span class="badge-online">${ic('video')} online</span></div>
    </div>
    <div class="aff-note" style="margin-top:14px">Quando sei pronto entra nella stanza: si apre in una nuova scheda e il tuo nome è già impostato.</div>
    <button class="btn" id="vlEnter" style="margin-top:14px">${ic('video')} Entra nella videolezione →</button>
    <div class="filter-row" style="margin-top:10px">
      <button class="btn small secondary" id="vlIcs">${ic('calendar')} Aggiungi al calendario</button>
      <button class="btn small secondary" id="vlCopy">${ic('send')} Copia link</button>
    </div>
  `);
  $("#vlEnter").onclick = () => { window.open(safeUrl(url), "_blank", "noopener,noreferrer"); };
  $("#vlIcs").onclick = () => downloadICS(b);
  $("#vlCopy").onclick = () => {
    const raw = b.meetingUrl || "";
    if (!raw) return toast("Nessun link");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw).then(() => toast("Link copiato", ic('check', 'ok')), () => toast(raw, ic('send')));
    else toast(raw, ic('send')); // fallback brandizzato: niente dialog nativi
  };
}
function downloadICS(b) {
  const dt = b.date.replace(/-/g, "") + "T" + b.time.replace(":", "") + "00";
  // DTSTAMP deve essere un istante UTC reale (…Z); DTSTART è ora locale ancorata a Europe/Rome
  // (con VTIMEZONE) così l'evento non "fluttua" nei calendari di altri fusi.
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const e2 = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JamMate//Lezioni//IT", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE", "TZID:Europe/Rome",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT", "UID:" + b.id + "@jammate", "DTSTAMP:" + stamp, "DTSTART;TZID=Europe/Rome:" + dt, "DURATION:PT1H",
    "SUMMARY:" + e2("Lezione con " + b.teacherName),
    b.meetingUrl ? "LOCATION:" + e2(b.meetingUrl) : "",
    b.meetingUrl ? "DESCRIPTION:" + e2("Videolezione JamMate: " + b.meetingUrl) : "",
    "END:VEVENT", "END:VCALENDAR"
  ].filter(Boolean);
  try {
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lezione-jammate.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Evento calendario scaricato", ic('calendar'));
  } catch (e) { toast("Calendario non disponibile"); }
}

// --- Filtri Lezioni: strumento, modalità, giorni, fascia oraria, prezzo ---
const lessonFilter = { instrument: "", mode: "", days: [], bands: [], maxPrice: 0 };
const LESSON_DOW = [["Lun", 1], ["Mar", 2], ["Mer", 3], ["Gio", 4], ["Ven", 5], ["Sab", 6], ["Dom", 0]];
const LESSON_BANDS = [["Mattina", 6, 12], ["Pomeriggio", 12, 18], ["Sera", 18, 24]];
function teacherInstruments() { const set = new Set(); allTeachers().forEach(t => (t.instruments || []).forEach(i => set.add(i))); return [...set].sort(); }
function slotMatchesAvail(s) {
  if (lessonFilter.days.length) { const d = new Date(s.date + "T00:00:00").getDay(); if (!lessonFilter.days.includes(d)) return false; }
  if (lessonFilter.bands.length) { const h = parseInt((s.time || "0").split(":")[0], 10); const band = LESSON_BANDS.find(b => h >= b[1] && h < b[2]); if (!band || !lessonFilter.bands.includes(band[0])) return false; }
  return true;
}
function teacherMatchesLessonFilter(t) {
  if (lessonFilter.instrument && !(t.instruments || []).some(i => i === lessonFilter.instrument || i.includes(lessonFilter.instrument))) return false;
  if (lessonFilter.mode === "online" && !t.online) return false;
  if (lessonFilter.mode === "presenza" && t.online) return false;
  if (lessonFilter.maxPrice && t.hourly > lessonFilter.maxPrice) return false;
  if (lessonFilter.days.length || lessonFilter.bands.length) {
    if (!(t.slots || []).some(s => !isSlotBooked(t, s) && slotMatchesAvail(s))) return false;
  }
  return true;
}
function renderLessons(box) {
  const myBk = state.lessonBookings || [];
  const insOpts = teacherInstruments();
  // Insegnanti "nella mia scena": collegati a un peer con cui ho jammato o ad alta affinità.
  const sceneTeachers = allTeachers().filter(t => {
    if (t.mine) return false;
    const peer = teacherPeer(t); if (!peer) return false;
    const jammed = typeof hasJammedWith === "function" && hasJammedWith(peer);
    const aff = typeof affinityPct === "function" ? affinityPct(peer) : 0;
    return jammed || aff >= 75;
  }).sort((a, b) => lessonRelevance(b) - lessonRelevance(a) || cmpId(a.id, b.id)).slice(0, 3);
  box.appendChild(el(`<div>
    <h1 class="view-title">${ic('graduation-cap')} Lezioni</h1>
    <p class="view-sub">Trova un insegnante, prenoti e <b>paghi online</b> (pagamento simulato in questo prototipo).</p>
    <div class="card flat">
      <div class="row-between"><b>${ic('graduation-cap')} Insegni uno strumento?</b>${state.teacher ? '<span class="tag lvl">attivo</span>' : '<span class="badge-new">novità</span>'}</div>
      <p class="view-sub" style="margin:8px 0 10px">Pubblica le tue disponibilità a calendario e ricevi prenotazioni pagate.</p>
      <button class="btn small" id="beTeacher">${state.teacher ? "Gestisci le mie disponibilità" : "Diventa insegnante"}</button>
    </div>
    ${myBk.length ? `<div class="section-label">Le mie lezioni prenotate</div><div id="myLessons"></div>` : ""}
    ${sceneTeachers.length ? `<div class="section-label">${ic('match')} Insegnanti nella tua scena</div><div id="sceneTeachers"></div>` : ""}
    <div class="section-label">Trova un insegnante</div>
    <div class="filters">
      <div class="filter-row">
        <select id="lfIns" aria-label="Strumento"><option value="">Tutti gli strumenti</option>${insOpts.map(i => `<option value="${esc(i)}"${i === lessonFilter.instrument ? " selected" : ""}>${esc(i)}</option>`).join("")}</select>
        <select id="lfMode" aria-label="Modalità"><option value=""${lessonFilter.mode === "" ? " selected" : ""}>Online + presenza</option><option value="presenza"${lessonFilter.mode === "presenza" ? " selected" : ""}>Solo in presenza</option><option value="online"${lessonFilter.mode === "online" ? " selected" : ""}>Solo online</option></select>
      </div>
      <label class="field" style="margin-top:6px" id="lfDaysLbl">Giorni</label>
      <div class="chips" id="lfDays" role="group" aria-labelledby="lfDaysLbl">${LESSON_DOW.map(([lbl, d]) => `<button type="button" class="chip${lessonFilter.days.includes(d) ? " on" : ""}" data-chip="${d}" aria-pressed="${lessonFilter.days.includes(d)}">${lbl}</button>`).join("")}</div>
      <label class="field" style="margin-top:8px" id="lfBandsLbl">Fascia oraria</label>
      <div class="chips" id="lfBands" role="group" aria-labelledby="lfBandsLbl">${LESSON_BANDS.map(([lbl]) => `<button type="button" class="chip${lessonFilter.bands.includes(lbl) ? " on" : ""}" data-chip="${esc(lbl)}" aria-pressed="${lessonFilter.bands.includes(lbl)}">${lbl}</button>`).join("")}</div>
      <label class="field" style="margin-top:8px" for="lfPrice">Prezzo max: <span class="range-val" id="lfPriceVal">${lessonFilter.maxPrice ? lessonFilter.maxPrice + "€/ora" : "qualsiasi"}</span></label>
      <input type="range" id="lfPrice" min="0" max="80" step="5" value="${lessonFilter.maxPrice}" aria-label="Prezzo massimo per ora">
    </div>
    <div id="teacherList"></div>
  </div>`));
  $("#beTeacher").onclick = () => openTeacherSheet();
  if (myBk.length) {
    const ml = $("#myLessons");
    // Prossime (confirmed future) in alto, completate/disdette sotto; stable per data+ora.
    const rank = (b) => bookingState(b) === "confirmed" ? 0 : bookingState(b) === "completata" ? 1 : 2;
    [...myBk].sort((a, b) => rank(a) - rank(b) || (a.date + a.time).localeCompare(b.date + b.time)).forEach(b => ml.appendChild(lessonBookingRow(b)));
  }
  if (sceneTeachers.length) { const st = $("#sceneTeachers"); sceneTeachers.forEach(t => st.appendChild(teacherCard(t))); }
  // backend hook: GET /teachers?rankFor=me — il ranking lato server arriverà già ordinato; lessonRelevance è il fallback client.
  const paintTeachers = () => {
    const tl = $("#teacherList"); tl.innerHTML = "";
    const list = allTeachers().filter(teacherMatchesLessonFilter)
      .map(t => ({ t, score: lessonRelevance(t) }))
      .sort((a, b) => b.score - a.score || cmpId(a.t.id, b.t.id));
    if (!list.length) { tl.innerHTML = `<div class="empty">Nessun insegnante con questi filtri. Allarga i criteri. ${ic('search')}</div>`; return; }
    list.forEach(({ t }) => tl.appendChild(teacherCard(t)));
  };
  $("#lfIns").onchange = e => { lessonFilter.instrument = e.target.value; paintTeachers(); };
  $("#lfMode").onchange = e => { lessonFilter.mode = e.target.value; paintTeachers(); };
  // Giorni: l'array resta numerico (usato da slotMatchesAvail come Date.getDay()); aria-pressed gestito a mano.
  box.querySelectorAll("#lfDays .chip").forEach(c => c.onclick = () => {
    const d = +c.dataset.chip, i = lessonFilter.days.indexOf(d);
    if (i >= 0) lessonFilter.days.splice(i, 1); else lessonFilter.days.push(d);
    c.classList.toggle("on"); c.setAttribute("aria-pressed", c.classList.contains("on")); paintTeachers();
  });
  // Fasce: chiavi stringa → toggleChip (app.js) gestisce array + aria-pressed.
  box.querySelectorAll("#lfBands .chip").forEach(c => c.onclick = () => { toggleChip(c, lessonFilter.bands); paintTeachers(); });
  $("#lfPrice").oninput = e => { lessonFilter.maxPrice = +e.target.value; $("#lfPriceVal").textContent = lessonFilter.maxPrice ? lessonFilter.maxPrice + "€/ora" : "qualsiasi"; };
  $("#lfPrice").onchange = paintTeachers;
  applyToggleA11y(box);
  paintTeachers();
}
function lessonBookingRow(b) {
  const st = bookingState(b);
  const cancelled = st === "cancelled";
  const done = st === "completata";
  const live = st === "confirmed"; // confermata e futura: ancora disdicibile / videolezione attiva
  const actions = [];
  if (done && !b.reviewed) actions.push(`<button class="btn small" data-review>${ic('star')} Valuta insegnante</button>`);
  if (live) actions.push(`<button class="btn small secondary" data-cancel>Disdici</button>`);
  const reviewedBadge = b.reviewed ? `<span class="tag lvl" style="margin-top:10px;display:inline-block">${ic('check')} Insegnante valutato</span>` : "";
  // Videolezione/cambio link solo su lezioni vive (non passate, non disdette).
  const meetingRow = (b.online && b.meetingUrl && live) ? `<div class="filter-row" style="margin-top:10px">
      <button class="btn small" data-video>${ic('video')} Videolezione</button>
      <button class="btn small secondary" data-editlink>${ic('send')} Cambia link</button>
    </div>` : (b.online && live ? `<div class="filter-row" style="margin-top:10px"><button class="btn small secondary" data-editlink>${ic('send')} Aggiungi link videolezione</button></div>` : "");
  const tagCls = cancelled ? "" : done ? "lvl done" : "lvl";
  const tagTxt = cancelled ? "disdetta" : done ? `${ic('check')} completata` : "confermata";
  // Stato pagamento letto in modo difensivo (retro-compat bookings legacy senza payment).
  const payStatus = (b.payment && b.payment.status) || (cancelled ? "refunded" : "paid");
  const payLabel = payStatus === "refunded" ? `${ic('refresh')} rimborsato` : `${ic('check')} pagato`;
  const row = el(`<div class="card flat" style="margin-bottom:8px${cancelled ? ";opacity:.6" : ""}">
    <div class="card-head">${avatarTag(b)}<div class="meta">
      <div class="name">${esc(b.teacherName)} <span class="tag ${tagCls}">${tagTxt}</span> ${b.online && !cancelled ? `<span class="badge-online">${ic('video')} online</span>` : ""}</div>
      <div class="loc">${ic('calendar')} ${formatDate(b.date)} · ${esc(b.time)} · ${b.amount}€ · ${payLabel} <span class="loc" style="opacity:.7">· simulato</span></div></div></div>
    ${meetingRow}
    ${actions.length ? `<div class="filter-row" style="margin-top:10px">${actions.join("")}</div>` : ""}
    ${reviewedBadge}
  </div>`);
  const videoBtn = row.querySelector("[data-video]");
  if (videoBtn) videoBtn.onclick = () => openVideoLesson(b);
  const editLinkBtn = row.querySelector("[data-editlink]");
  if (editLinkBtn) editLinkBtn.onclick = () => openEditMeetingLink(b);
  const cancelBtn = row.querySelector("[data-cancel]");
  if (cancelBtn) cancelBtn.onclick = () => openCancelLesson(b);
  const reviewBtn = row.querySelector("[data-review]");
  if (reviewBtn) reviewBtn.onclick = () => openTeacherReview(b);
  return row;
}
// Modale conferma disdetta (sostituisce confirm() nativo). // backend hook: POST /bookings/:id/cancel (politica rimborso)
function openCancelLesson(b) {
  openModal(`
    <h2 style="margin-top:0">${ic('alert-triangle')} Disdire la lezione?</h2>
    <div class="aff-note">Con <b>${esc(b.teacherName.split(" ")[0])}</b> · ${formatDate(b.date)} · ${esc(b.time)}.</div>
    <p style="line-height:1.5;color:var(--muted);margin:10px 0 0">L'orario tornerà <b>libero</b> per altri allievi e il pagamento sarà <b>rimborsato</b> (simulato in questo prototipo).</p>
    <div class="confirm-actions">
      <button class="btn secondary" id="clNo" type="button">Annulla</button>
      <button class="btn danger" id="clYes" type="button">Disdici</button>
    </div>
  `);
  $("#clNo").onclick = () => closeModal();
  $("#clYes").onclick = () => {
    b.status = "cancelled";
    b.refund = true;
    b.payment = Object.assign({ method: "card", amount: b.amount }, b.payment || {}, { status: "refunded", refundedAt: Date.now() }); // backend hook: refund (conserva l'ora del pagamento, traccia refundedAt)
    save(); closeModal(); toast("Lezione disdetta — orario di nuovo libero", ic('refresh'));
    if (typeof notify === "function") notify("graduation-cap", `Hai disdetto la lezione con ${b.teacherName.split(" ")[0]}.`, { view: "lessons" });
    // BACKEND HOOK: alla disdetta, notifica l'INSEGNANTE (lato server, instradata al destinatario — non al feed dell'allievo).
    rerenderLessons();
  };
}
// Modale cambio/aggiunta link videolezione (sostituisce prompt() nativo). // backend hook: PATCH /bookings/:id {meetingUrl}
function openEditMeetingLink(b) {
  openModal(`
    <h2 style="margin-top:0">${ic('video')} Link videolezione</h2>
    <div class="aff-note">Incolla un link Zoom, Meet o Jitsi. Lascialo vuoto per rimuoverlo.</div>
    <label class="field" style="margin-top:12px" for="emlUrl">Link videolezione</label>
    <input type="url" id="emlUrl" placeholder="https://…" value="${esc(b.meetingUrl || "")}">
    <div class="confirm-actions">
      <button class="btn secondary" id="emlNo" type="button">Annulla</button>
      <button class="btn" id="emlYes" type="button">${ic('save')} Salva</button>
    </div>
  `);
  $("#emlNo").onclick = () => closeModal();
  $("#emlYes").onclick = () => {
    const u = ($("#emlUrl").value || "").trim();
    if (u && !/^https?:\/\//i.test(u)) return markFieldError("#emlUrl", "Inserisci un link valido (http/https).");
    b.meetingUrl = u; save(); closeModal(); toast(u ? "Link aggiornato" : "Link rimosso", ic('check', 'ok')); rerenderLessons();
  };
}
const TEACHER_TAGS = ["Spiega chiaro", "Paziente", "Preparato", "Puntuale", "Motivante", "Materiale utile"];
function openTeacherReview(b) {
  const likert = (name, label, icoMarkup) => `<div class="lk"><div class="lk-q" id="lk-${name}">${icoMarkup} ${esc(label)}</div>
    <div class="likert" data-name="${name}" role="radiogroup" aria-labelledby="lk-${name}">${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" data-v="${v}" aria-label="${v} su 5" aria-checked="${v === 4 ? "true" : "false"}" class="${v === 4 ? "on" : ""}">${v}</button>`).join("")}</div></div>`;
  openModal(`
    <h2>${ic('star')} Valuta ${esc(b.teacherName.split(" ")[0])}</h2>
    <div class="aff-note">Feedback <b>verificato</b>: sbloccato dopo la lezione del ${formatDate(b.date)}. Aiuta gli altri allievi a scegliere.</div>
    ${likert("did", "Didattica / chiarezza", ic('graduation-cap'))}
    ${likert("prep", "Preparazione", ic('sparkles'))}
    ${likert("punt", "Puntualità", ic('clock'))}
    ${likert("disp", "Disponibilità", ic('thumbs-up'))}
    <div class="section-label">Tag rapidi</div>
    <div class="chips" id="trTags" role="group" aria-label="Tag rapidi">${TEACHER_TAGS.map(t => `<button type="button" class="chip" data-chip="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
    <label class="field" style="margin-top:10px" for="trText">Commento (opzionale)</label><textarea id="trText" placeholder="Com'è andata la lezione?"></textarea>
    <button class="btn" id="trSave" style="margin-top:14px">Invia valutazione</button>
  `);
  const root = $("#modalRoot");
  root.querySelectorAll(".likert").forEach(rw => rw.querySelectorAll("button").forEach(bn => bn.onclick = () => { rw.querySelectorAll("button").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); }); bn.classList.add("on"); bn.setAttribute("aria-checked", "true"); }));
  const selTags = [];
  root.querySelectorAll("#trTags .chip").forEach(c => c.onclick = () => toggleChip(c, selTags));
  $("#trSave").onclick = () => {
    const g = (n) => { const r = root.querySelector(`.likert[data-name="${n}"] button.on`); return r ? +r.dataset.v : 4; };
    const overall = (g("did") + g("prep") + g("punt") + g("disp")) / 4;
    if (b.teacherId === "me") {
      const persist = state.teacher;
      if (persist) {
        const n = persist.ratings || 0;
        persist.rating = Math.round(((persist.rating || 0) * n + overall * 10) / (n + 1));
        persist.ratings = n + 1;
        persist.reviewTags = persist.reviewTags || {}; selTags.forEach(tg => persist.reviewTags[tg] = (persist.reviewTags[tg] || 0) + 1);
      }
    } else {
      // Insegnante non-'me': i suoi dati di rating vivono solo in memoria, quindi persistili a parte.
      state.teacherStats = state.teacherStats || {};
      let st = state.teacherStats[b.teacherId];
      if (!st) { const base = allTeachers().find(x => x.id === b.teacherId) || {}; st = { rating: base.rating || 0, ratings: base.ratings || 0, reviewTags: Object.assign({}, base.reviewTags || {}) }; }
      const n = st.ratings || 0;
      st.rating = Math.round(((st.rating || 0) * n + overall * 10) / (n + 1));
      st.ratings = n + 1;
      st.reviewTags = st.reviewTags || {}; selTags.forEach(tg => st.reviewTags[tg] = (st.reviewTags[tg] || 0) + 1);
      state.teacherStats[b.teacherId] = st;
    }
    b.reviewed = true; b.reviewRating = Math.round(overall * 10); b.reviewText = $("#trText").value.trim();
    save(); closeModal(); toast("Valutazione inviata", ic('star')); rerenderLessons();
  };
}
function teacherCard(t) {
  const free = freeSlots(t).length;
  const relLabel = lessonRelevanceLabel(t);
  const peer = teacherPeer(t);
  const jammed = peer && typeof hasJammedWith === "function" && hasJammedWith(peer);
  const ratingMarkup = t.mine ? '<span class="tag">tu</span>'
    : (t.ratings ? `<span class="score">${starsRating(t.rating / 10, 5)} ${(t.rating / 10).toFixed(1)}</span>` : `<span class="loc" style="font-size:.72rem">nuovo</span>`);
  const c = el(`<div class="card teacher-card">
    <div class="card-head">${avatarTag(t)}<div class="meta">
      <div class="name">${esc(t.name)} ${ratingMarkup} ${relLabel ? risonanzaChip(relLabel) : ""}</div>
      <div class="loc">${esc((t.instruments || []).join(", "))} · ${ic('map-pin')} ${esc(t.city)}${t.online ? ` · <span class="badge-online">${ic('video')} online</span>` : ""}</div>
      ${jammed ? `<div class="loc" style="margin-top:3px">${ic('match')} Avete già jammato${peer && typeof affLabel === "function" ? ` · ${affLabel(getAffinity(peer))}` : ""}</div>` : ""}</div>
      <div style="text-align:right;font-weight:800;color:var(--accent)">${t.hourly}€<br><small style="color:var(--muted);font-weight:600">/ ora</small></div></div>
    <div class="loc" style="margin-top:8px">${ic('calendar')} ${free} slot liber${free === 1 ? "o" : "i"}</div>
  </div>`);
  clickableCard(c, () => openTeacherProfile(t));
  return c;
}
function openTeacherProfile(t) {
  const free = freeSlots(t);
  const peer = teacherPeer(t);
  const jammed = peer && typeof hasJammedWith === "function" && hasJammedWith(peer);
  const sceneRow = (!t.mine && peer && typeof affLabel === "function")
    ? `<div class="aff-note" style="margin-top:10px">${jammed ? `${ic('match')} Avete già jammato · ` : ""}${affLabel(getAffinity(peer))}</div>` : "";
  openModal(`
    <div style="text-align:center"><div style="display:flex;justify-content:center">${avatarTag(t, true)}</div>
      <h2>${esc(t.name)}</h2>
      <div class="loc">${esc((t.instruments || []).join(", "))} · ${ic('map-pin')} ${esc(t.city)}${t.online ? ` · <span class="badge-online">${ic('video')} online</span>` : ""}</div>
      <div style="margin-top:6px;font-weight:800;color:var(--accent)">${t.hourly}€ / ora</div>
    </div>
    ${sceneRow}
    ${t.bio ? `<div class="section-label">Su di me</div><p style="margin:0;line-height:1.5">${esc(t.bio)}</p>` : ""}
    <div class="section-label">Valutazioni degli allievi</div>
    <div class="aff-note">${t.ratings ? `${starsRating(t.rating / 10, 5)} <b>${(t.rating / 10).toFixed(1)}</b> su ${t.ratings} valutazion${t.ratings === 1 ? "e" : "i"} verificate${t.reviewTags && Object.keys(t.reviewTags).length ? ` · ${esc(Object.entries(t.reviewTags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([x]) => x).join(", "))}` : ""}` : "Ancora nessuna valutazione — solo chi ha fatto lezione può recensire."}</div>
    <div class="section-label">Disponibilità</div>
    ${free.length ? `<div id="slotPick" class="slot-grid" role="group" aria-label="Slot disponibili">${free.map(s => `<button class="slot-btn" data-slot="${esc(s.id)}">${ic('calendar')} ${formatDate(s.date)}<br>${esc(s.time)}</button>`).join("")}</div>` : `<div class="aff-note">Nessuno slot libero al momento.</div>`}
    ${t.mine ? `<div class="aff-note" style="margin-top:12px">Questo è il tuo profilo insegnante.</div>` : ""}
  `);
  if (!t.mine) document.querySelectorAll("#slotPick .slot-btn").forEach(b => b.onclick = () => { const s = (t.slots || []).find(x => x.id === b.dataset.slot); if (s) openBookLesson(t, s); });
}
// Minuti dall'inizio del giorno per "HH:MM" (per clash-check su intervalli).
function timeToMin(hhmm) { const m = String(hhmm || "0:0").split(":"); return (+m[0] || 0) * 60 + (+m[1] || 0); }
// Sovrapposizione [start, start+60min) tra due slot nella stessa data (DURATION PT1H, come .ics).
function slotsOverlap(d1, t1, d2, t2) {
  if (d1 !== d2) return false;
  const a = timeToMin(t1), b = timeToMin(t2);
  return a < b + 60 && b < a + 60;
}
function openBookLesson(t, s) {
  const fee = t.hourly, comm = Math.round(fee * 0.1);
  openModal(`
    <h2>${ic('graduation-cap')} Prenota lezione</h2>
    <div class="aff-note">${esc(t.name)} · ${ic('calendar')} ${formatDate(s.date)} · ${esc(s.time)}</div>
    <div class="card flat" style="margin-top:12px">
      <div class="row-between"><span>Lezione (1 ora)</span><b>${fee}€</b></div>
      <div class="row-between"><span class="loc">di cui commissione JamMate (10%)</span><span class="loc">${comm}€</span></div>
    </div>
    ${t.online ? `<div class="aff-note" style="margin-top:10px"><span class="badge-online">${ic('video')} online</span> Lezione <b>online</b>: alla conferma generiamo un <b>link videolezione</b> (Jitsi, gratuito) — modificabile col tuo Zoom/Meet — e potrai aggiungerla al calendario.</div>` : ""}
    <div class="aff-note" style="margin-top:10px">Pagamento <b>simulato</b> in questo prototipo (in produzione: carta via Stripe, importo in escrow fino alla lezione).</div>
    <button class="btn" id="payLesson" style="margin-top:14px">${ic('check')} Paga ${fee}€ e prenota</button>
  `);
  $("#payLesson").onclick = () => {
    // clash-check su intervalli [time, time+60min] (sovrapposizioni parziali, non solo data+ora esatte).
    const clash = (state.lessonBookings || []).some(b => b.status === "confirmed" && slotsOverlap(b.date, b.time, s.date, s.time));
    if (clash) { toast("Hai già una lezione in quell'orario", ic('alert-triangle')); return; }
    // Anti doppia-vendita dello slot: se un altro allievo l'ha già preso (deriva dalle bookings).
    if (isSlotBooked(t, s)) { toast("Slot appena prenotato da un altro allievo", ic('alert-triangle')); rerenderLessons(); return; }
    const id = "lb" + Date.now();
    // backend hook: createPaymentIntent — qui pagamento simulato; lo schema payment è pronto per il PSP/escrow.
    const payment = { status: "paid", method: "card", txnId: "sim_" + id, amount: fee, fee: comm, at: Date.now() };
    const bk = { id, teacherId: t.id, teacherName: t.name, avatar: t.avatar, color: t.color, date: s.date, time: s.time, amount: fee, status: "confirmed", online: !!t.online, meetingUrl: t.online ? jitsiUrl(id) : "", payment, refund: false };
    state.lessonBookings = state.lessonBookings || []; state.lessonBookings.unshift(bk); save();
    notify("graduation-cap", `Lezione con ${t.name.split(" ")[0]} confermata: ${formatDate(s.date)} alle ${s.time}.`, { view: "lessons" });
    // BACKEND HOOK: alla prenotazione, notifica l'INSEGNANTE (lato server, instradata al destinatario — non al feed dell'allievo).
    // Mini-ricevuta post-pagamento (txnId, importo, commissione).
    openModal(`
      <div style="text-align:center">
        <div class="vl-badge">${ic('check')} Lezione prenotata</div>
        <h2 style="margin-top:8px">Pagamento confermato</h2>
        <div class="loc">${ic('calendar')} ${formatDate(s.date)} · ${esc(s.time)} · con ${esc(t.name.split(" ")[0])}</div>
      </div>
      <div class="card flat" style="margin-top:14px">
        <div class="row-between"><span>Importo</span><b>${fee}€</b></div>
        <div class="row-between"><span class="loc">Commissione JamMate (10%)</span><span class="loc">${comm}€</span></div>
        <div class="row-between"><span class="loc">Transazione</span><span class="loc">${esc(payment.txnId)}</span></div>
        <div class="row-between"><span class="loc">Stato</span><span class="loc">${ic('check')} pagato (simulato)</span></div>
      </div>
      ${t.online ? `<button class="btn" id="rcVideo" style="margin-top:14px">${ic('video')} Apri videolezione</button>` : ""}
      <button class="btn secondary" id="rcClose" style="margin-top:10px">Chiudi</button>
    `);
    haptic("Light");
    const rcv = $("#rcVideo"); if (rcv) rcv.onclick = () => openVideoLesson(bk);
    $("#rcClose").onclick = () => closeModal();
    rerenderLessons();
  };
}
function openTeacherSheet() {
  const t = state.teacher;
  openModal(`
    <h2>${ic('graduation-cap')} ${t ? "Le mie disponibilità" : "Diventa insegnante"}</h2>
    <label class="field">Strumenti che insegni <span class="view-sub" style="font-size:.76rem">· presi dal tuo profilo, modificabili</span></label><div id="teIns"></div>
    <label class="field" style="margin-top:10px">Tariffa oraria (€)</label><input type="number" id="teFee" value="${t ? t.hourly : 30}" min="5">
    <label class="field" style="margin-top:10px">Presentazione</label><textarea id="teBio" placeholder="Esperienza, metodo, livelli che segui…">${t ? esc(t.bio) : ""}</textarea>
    <label class="field" style="margin-top:10px;display:flex;align-items:center;gap:8px"><input type="checkbox" id="teOnline" ${t && t.online ? "checked" : ""}> Disponibile anche online</label>
    <div class="section-label">Aggiungi uno slot a calendario</div>
    <div class="filter-row">
      <input type="date" id="teDate"><input type="time" id="teTime" value="18:00">
      <button class="btn small" id="teAddSlot">${ic('plus')}</button>
    </div>
    <div id="teSlots" style="margin-top:8px"></div>
    <button class="btn" id="teSave" style="margin-top:16px">${t ? "Salva" : "Pubblica profilo insegnante"}</button>
  `);
  const selI = t ? t.instruments.slice() : (state.me.instruments || []).slice();
  const slots = t ? (t.slots || []).map(s => Object.assign({}, s)) : [];
  instrumentPicker($("#teIns"), selI, { placeholder: "Strumento che insegni…" });
  // "prenotato" derivato dalle bookings persistite verso il proprio profilo insegnante (id "me"), non da un flag seed.
  const meTeacher = { id: "me", slots };
  const paintSlots = () => {
    const box = $("#teSlots");
    box.innerHTML = slots.length ? slots.map((s, i) => { const bk = isSlotBooked(meTeacher, s); return `<div class="lvl-row"><span class="lvl-inst">${ic('calendar')} ${formatDate(s.date)} · ${esc(s.time)}${bk ? " · prenotato" : ""}</span>${bk ? "" : `<button class="rep-del" data-i="${i}">${ic('x')}</button>`}</div>`; }).join("") : `<p class="view-sub">Nessuno slot. Aggiungine almeno uno.</p>`;
    box.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { slots.splice(+b.dataset.i, 1); paintSlots(); });
  };
  paintSlots();
  $("#teAddSlot").onclick = () => { const d = $("#teDate").value, tm = $("#teTime").value; if (!d) return markFieldError("#teDate", "Scegli una data."); slots.push({ id: "ms" + Date.now() + Math.random().toString(36).slice(2, 5), date: d, time: tm || "18:00" }); paintSlots(); };
  $("#teSave").onclick = () => {
    if (!selI.length) return toast("Indica almeno uno strumento");
    state.teacher = { instruments: selI, hourly: +$("#teFee").value || 30, bio: $("#teBio").value.trim(), online: $("#teOnline").checked, slots };
    save(); closeModal(); toast(t ? "Disponibilità salvate" : "Sei un insegnante su JamMate!", ic('graduation-cap')); rerenderLessons();
  };
}

// ------------------------------------------------------------- Export globali
window.renderFeed = renderFeed;
window.renderJamMap = renderJamMap;
window.renderLessons = renderLessons;
window.openCreateJam = openCreateJam;
window.openNotifications = openNotifications;
window.notify = notify;
