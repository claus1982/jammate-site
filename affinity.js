/* JamMate — Affinity Engine v2 ("Sintonia")
 * ===========================================================================
 * Modulo ISOLATO e riusabile (estraibile come servizio Axiovra).
 * Fondamento scientifico (vedi MATCHING_AVANZATO.md / MATCHING_V2.md):
 *  - Valori di Schwartz: congruenza = correlazione di profilo CENTRATA (MRAT)
 *    -> segnale di similarità più forte (Boer 2011; Leikas 2018)
 *  - Personalità Big Five (Mini-IPIP, dominio pubblico): peso BASSO, conta più
 *    la "positività" (bassa N, alta A/C) che il matching (Malouff 2010; PMC6034067)
 *  - Circumplex interpersonale (IPIP-IPC): complementarità sulla DOMINANZA,
 *    similarità sul CALORE (Sadler/Woody) -> evidenza moderata, segnale soft
 *  - Bussola del musicista: obiettivi/impegno (person-group fit, Kristof-Brown)
 *  - Aggregazione: MEDIA GEOMETRICA pesata (non compensatoria, come l'HDI) +
 *    veto sui dealbreaker (Edwards: niente difference-score grezzi)
 *  - Pesi a FASCE su effect-size (i pesi unitari sono difficili da battere:
 *    Bobko 2007) -> niente falsa precisione
 *  - Insight: serendipity spiegabile e falsificabile, anti-effetto-Barnum
 *  - CAVEAT (Joel/Finkel): la chimica è quasi impredicibile -> punteggio SOFT
 * =========================================================================== */

// ---- Mini-IPIP (20 item, dominio pubblico) — Big Five ----
const IPIP_ITEMS = [
  { t: "E", rev: false, q: "Sono l'anima della festa." },
  { t: "A", rev: false, q: "Provo empatia per i sentimenti degli altri." },
  { t: "C", rev: false, q: "Sbrigo subito i compiti da fare." },
  { t: "N", rev: false, q: "Ho frequenti sbalzi d'umore." },
  { t: "O", rev: false, q: "Ho una fantasia vivace." },
  { t: "E", rev: true,  q: "Non parlo molto." },
  { t: "A", rev: true,  q: "Non mi interessano i problemi degli altri." },
  { t: "C", rev: true,  q: "Spesso dimentico di rimettere le cose al loro posto." },
  { t: "N", rev: true,  q: "Sono rilassato/a per la maggior parte del tempo." },
  { t: "O", rev: true,  q: "Non mi interessano le idee astratte." },
  { t: "E", rev: false, q: "Alle feste parlo con tante persone diverse." },
  { t: "A", rev: false, q: "Percepisco le emozioni degli altri." },
  { t: "C", rev: false, q: "Amo l'ordine." },
  { t: "N", rev: false, q: "Mi turbo facilmente." },
  { t: "O", rev: true,  q: "Faccio fatica a capire concetti astratti." },
  { t: "E", rev: true,  q: "Tendo a restare in disparte." },
  { t: "A", rev: true,  q: "Non mi interessano davvero gli altri." },
  { t: "C", rev: true,  q: "Combino pasticci." },
  { t: "N", rev: true,  q: "Raramente mi sento giù." },
  { t: "O", rev: true,  q: "Non ho molta immaginazione." }
];

// ---- Valori (modello di Schwartz, 10 valori — item in stile "ritratto") ----
const VALUE_KEYS = ["Autodirezione", "Stimolazione", "Edonismo", "Successo", "Potere",
                    "Sicurezza", "Conformità", "Tradizione", "Benevolenza", "Universalismo"];
const VALUE_ITEMS = [
  { v: "Autodirezione", q: "Per me conta decidere da solo/a e avere idee originali." },
  { v: "Stimolazione",  q: "Cerco emozioni forti, novità e avventura." },
  { v: "Edonismo",      q: "Voglio godermi la vita e i suoi piaceri." },
  { v: "Successo",      q: "Voglio eccellere e che riconoscano le mie capacità." },
  { v: "Potere",        q: "Mi piace avere influenza e guidare gli altri." },
  { v: "Sicurezza",     q: "Ho bisogno di stabilità, ordine e sicurezza." },
  { v: "Conformità",    q: "Per me conta rispettare le regole e non disturbare." },
  { v: "Tradizione",    q: "Tengo alle tradizioni e ai valori di sempre." },
  { v: "Benevolenza",   q: "Mi dedico al benessere delle persone a cui voglio bene." },
  { v: "Universalismo", q: "Mi sta a cuore la giustizia, l'uguaglianza e l'ambiente." }
];

// ---- Stile interpersonale (IPIP-IPC ridotto): Dominanza & Calore ----
const IPC_ITEMS = [
  { ax: "D", rev: false, q: "Tendo a prendere il comando nei gruppi." },
  { ax: "D", rev: false, q: "Mi viene naturale dire agli altri cosa fare." },
  { ax: "D", rev: true,  q: "Preferisco che siano gli altri a decidere." },
  { ax: "D", rev: true,  q: "Faccio fatica a impormi." },
  { ax: "W", rev: false, q: "Sono caloroso/a e affettuoso/a con gli altri." },
  { ax: "W", rev: false, q: "Mi fido facilmente delle persone." },
  { ax: "W", rev: true,  q: "Tendo a tenermi a distanza dagli altri." },
  { ax: "W", rev: true,  q: "Faccio fatica a interessarmi ai problemi altrui." }
];

// ---- Bussola del musicista (custom, band-specifica) ----
const BUSSOLA = [
  { id: "goal",    q: "Qual è il tuo obiettivo con la musica?", lo: "Solo divertirmi",     hi: "Farne una professione" },
  { id: "orig",    q: "Cosa ti accende di più?",                lo: "Suonare cover",       hi: "Creare brani originali" },
  { id: "improv",  q: "Sul palco preferisci…",                 lo: "Seguire la scaletta", hi: "Improvvisare e rischiare" },
  { id: "rehear",  q: "Con che ritmo vuoi provare?",           lo: "Quando capita",       hi: "Più volte a settimana" },
  { id: "energy",  q: "Il tuo sound ideale è…",                lo: "Intimo e acustico",   hi: "Potente ed energico" },
  { id: "reliab",  q: "Quanto sei affidabile con prove e impegni?", lo: "Molto flessibile", hi: "Sempre puntuale" },
  { id: "reliabW", q: "Quanto ti pesa chi è inaffidabile?",    lo: "Per niente",          hi: "Moltissimo" }
];

// Pesi a fasce su effect-size (3=alto, 2=medio, 1=basso). Normalizzati a runtime.
const TIERS = {
  values: 3,        // congruenza di valori: predittore più forte
  goal: 3,          // obiettivi/impegno
  taste: 2.5,       // gusti + repertorio
  reliability: 2,   // affidabilità (anello debole)
  style: 1.5,       // modo di suonare
  role: 1.5,        // complementarità di ruolo (IPC)
  personality: 1    // Big Five (positività)
};

// ============================ CORE GENERICO ================================
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sim5 = (a, b) => 1 - Math.abs(a - b) / 4;
const norm5 = (x) => (x - 1) / 4;
const mean = (arr) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

// Affidabilità "reale": media degli endorsement di puntualità (1..5) se presenti,
// altrimenti il valore auto-dichiarato nella Bussola.
function hasEndo(X) { return X.endo && X.endo.endorsements > 0 && X.endo.puntualita > 0; }
function relOf(X) {
  // Arrotonda alla scala intera 1..5 come il ramo auto-dichiarato (e come la derivazione in data.js):
  // altrimenti la soglia dealbreaker (<=2) e il punteggio si comportano diversamente a seconda della fonte.
  if (hasEndo(X)) return Math.max(1, Math.min(5, Math.round(X.endo.puntualita / 20)));
  return (X.deep && X.deep.reliab) != null ? X.deep.reliab : 3;
}

function pearson(a, b) {
  const n = a.length; if (!n) return 0;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

// --- Scoring dei blocchi (dalle risposte 1..5) ---
function scoreBig5(answers) {
  const acc = { O: [], C: [], E: [], A: [], N: [] };
  IPIP_ITEMS.forEach((it, i) => acc[it.t].push(it.rev ? 6 - (answers[i] || 3) : (answers[i] || 3)));
  const out = {}; for (const t in acc) out[t] = norm5(mean(acc[t])); return out; // 0..1
}
function scoreValues(answers) {
  const raw = VALUE_ITEMS.map((_, i) => answers[i] || 3);
  const m = mean(raw);                       // MRAT (centratura within-person)
  const out = {}; VALUE_ITEMS.forEach((it, i) => out[it.v] = raw[i] - m); return out;
}
function scoreIPC(answers) {
  const d = [], w = [];
  IPC_ITEMS.forEach((it, i) => { const v = it.rev ? 6 - (answers[i] || 3) : (answers[i] || 3); (it.ax === "D" ? d : w).push(v); });
  return { D: (mean(d) - 3) / 2, W: (mean(w) - 3) / 2 }; // ~ -1..1
}

// --- Overlap gusti/repertorio ---
function tasteOverlap(a, b) {
  const ga = a.genres || [], gb = b.genres || [];
  const gShared = ga.filter(g => gb.includes(g));
  const gScore = ga.length && gb.length ? gShared.length / Math.min(ga.length, gb.length) : 0;
  const rb = (b.repertoire || []);
  const rbTitles = rb.map(r => (r.title || "").toLowerCase()).filter(Boolean);
  const songs = (a.repertoire || []).filter(r => r.title && rbTitles.includes(r.title.toLowerCase()));
  // Bonus "stessa tonalità reale": il confronto avviene sulla tonalità CONCERTISTICA
  // (piano), così strumenti traspositori diversi non vengono penalizzati. Se uno dei
  // due non indica la tonalità, resta comunque un match di titolo (nessuna perdita).
  const concertOf = (typeof repConcertKeys === "function") ? repConcertKeys : null;
  let keyShared = [];
  if (concertOf) {
    keyShared = songs.filter(r => {
      const other = rb.find(x => (x.title || "").toLowerCase() === r.title.toLowerCase());
      if (!other) return false;
      const ca = concertOf(r), cb = concertOf(other);
      if (!ca.length || !cb.length) return false;
      return ca.some(k => cb.includes(k));
    }).map(r => r.title);
  }
  const songScore = clamp01((songs.length + keyShared.length * 0.5) / 3);
  return { score: clamp01(0.55 * gScore + 0.45 * songScore), genres: gShared, songs: songs.map(s => s.title), keyShared };
}

/* computeAffinity(A, B): profili completi (.genres .repertoire .instruments .deep)
 * Usa SOLO i blocchi presenti in entrambi (degradazione elegante), ripesando.
 * Ritorna { score, parts[], warn[], insight{}, depth } */
function computeAffinity(A, B) {
  const a = A.deep || {}, b = B.deep || {};
  const comps = [];  // {key, s, t}  — t = descriptor {k, ...params}; the UI localizes it (no prose here).
  const warn = [];   // [{k, ...params}]

  // Valori (similarità: correlazione di profilo già centrata)
  if (a.values && b.values) {
    const va = VALUE_KEYS.map(k => a.values[k] ?? 0), vb = VALUE_KEYS.map(k => b.values[k] ?? 0);
    const r = pearson(va, vb);
    comps.push({ key: "values", s: clamp01((r + 1) / 2), t: valuesText(a.values, b.values, r) });
  }
  // Obiettivi/impegno (similarità) + veto
  if (a.goal != null && b.goal != null) {
    const s = (sim5(a.goal, b.goal) + sim5(a.rehear ?? 3, b.rehear ?? 3)) / 2;
    comps.push({ key: "goal", s, t: goalText(a.goal, b.goal) });
    if (Math.abs(a.goal - b.goal) >= 3) warn.push({ k: "warn_goal_diff" });
  }
  // Gusti + repertorio
  const taste = tasteOverlap(A, B);
  comps.push({ key: "taste", s: taste.score, t: tasteText(taste) });
  // Affidabilità (anello debole). Usa gli endorsement reali quando presenti,
  // altrimenti l'auto-dichiarazione (Bussola).
  if (a.reliab != null && b.reliab != null) {
    const ra = relOf(A), rb = relOf(B), endorsed = hasEndo(A) || hasEndo(B);
    comps.push({ key: "reliability", s: norm5(Math.min(ra, rb)), t: { k: endorsed ? "reliability_endorsed" : "reliability_declared" } });
    if ((a.reliabW >= 4 && rb <= 2) || (b.reliabW >= 4 && ra <= 2)) warn.push({ k: "warn_reliability" });
  }
  // Stile (modo di suonare)
  if (a.orig != null && b.orig != null) {
    const s = (sim5(a.orig, b.orig) + sim5(a.improv ?? 3, b.improv ?? 3) + sim5(a.energy ?? 3, b.energy ?? 3)) / 3;
    comps.push({ key: "style", s, t: { k: "style_compatible" } });
  }
  // Ruoli (complementarità dominanza, similarità calore)
  if (a.ipc && b.ipc) {
    const domComp = clamp01(0.5 - (a.ipc.D * b.ipc.D) / 2); // opposti = bene
    const warmSim = 1 - Math.abs(a.ipc.W - b.ipc.W) / 2;    // simili = bene
    comps.push({ key: "role", s: clamp01(0.5 * domComp + 0.5 * warmSim), t: roleText(a.ipc, b.ipc) });
  }
  // Personalità (positività + leggera similarità)
  if (a.big5 && b.big5) {
    const pos = (mean([a.big5.A, b.big5.A]) + mean([a.big5.C, b.big5.C]) + (1 - mean([a.big5.N, b.big5.N]))) / 3;
    const sim = 1 - (["O", "C", "E", "A", "N"].reduce((s, t) => s + Math.abs(a.big5[t] - b.big5[t]), 0) / 5);
    comps.push({ key: "personality", s: clamp01(0.7 * pos + 0.3 * sim), t: { k: "personality_collab" } });
  }

  // --- Aggregazione: media geometrica pesata (a fasce su effect-size) ---
  let wsum = 0, lnsum = 0;
  comps.forEach(c => { const w = TIERS[c.key] || 1; const s = Math.max(0.05, Math.min(1, c.s)); wsum += w; lnsum += w * Math.log(s); });
  let geo = wsum ? Math.exp(lnsum / wsum) : 0.5;
  // Veto dealbreaker: obiettivi opposti abbassano (non azzerano)
  if (warn.some(w => w.k === "warn_goal_diff")) geo *= 0.72;

  const score = Math.max(40, Math.min(98, Math.round(40 + 58 * geo)));
  const parts = comps.map(c => ({ key: c.key, pct: Math.round(c.s * 100), t: c.t })).sort((x, y) => y.pct - x.pct);

  // Profondità del profilo (quanti blocchi psicometrici condivisi)
  const blocks = ["values", "goal", "reliability", "role", "personality"].filter(k => parts.some(p => p.key === k)).length;
  const depth = blocks >= 5 ? "complete" : blocks >= 3 ? "deep" : blocks >= 1 ? "good" : "basic";

  return { score, parts, warn, insight: buildInsight(A, B, comps, taste), depth };
}

// --- Descrittori delle componenti (lingua-neutri: {k, ...params}); la UI li localizza via t().
// Specifici e falsificabili (anti-Barnum). I nomi-valore Schwartz restano token canonici nei params. ---
function topSharedValue(av, bv) {
  let best = null, bestScore = -Infinity;
  VALUE_KEYS.forEach(k => { const both = Math.min(av[k], bv[k]); if (av[k] > 0.3 && bv[k] > 0.3 && both > bestScore) { bestScore = both; best = k; } });
  return best;
}
function valuesText(av, bv, r) {
  const k = topSharedValue(av, bv);
  if (k) return { k: "values_shared", value: k };
  return r >= 0 ? { k: "values_compatible" } : { k: "values_different" };
}
function goalText(g1, g2) {
  return Math.abs(g1 - g2) <= 1
    ? { k: "goal_same", level: Math.max(0, Math.min(4, Math.round((g1 + g2) / 2) - 1)) }
    : { k: "goal_diff" };
}
function tasteText(t) {
  if (t.songs.length) return { k: "taste_songs", count: t.songs.length, songs: t.songs.join(", "), keyShared: (t.keyShared && t.keyShared.length) || 0 };
  if (t.genres.length) return { k: "taste_genres", genres: t.genres.join(", ") };
  return { k: "taste_few" };
}
function roleText(ia, ib) {
  if (ia.D * ib.D < -0.04) return { k: "role_complement" };
  if (ia.D > 0.2 && ib.D > 0.2) return { k: "role_both_lead" };
  return { k: "role_balanced" };
}

// --- Insight "sorprendente" (serendipity), specifico e falsificabile — descrittore lingua-neutro. ---
function buildInsight(A, B, comps, taste) {
  const a = A.deep || {}, b = B.deep || {}, name = (B.name || "").split(" ")[0] || "";
  // 1) valore condiviso NON ovvio (inferito dal test, non dichiarato)
  if (a.values && b.values) {
    const k = topSharedValue(a.values, b.values);
    if (k) return { kind: "valore", k: "insight_valore", value: k };
  }
  // 2) complementarità di ruolo (differenza vista come risorsa)
  if (a.ipc && b.ipc && a.ipc.D * b.ipc.D < -0.06) {
    return { kind: "ruolo", k: "insight_ruolo", who: a.ipc.D > b.ipc.D ? "you" : "name", name };
  }
  // 3) brano in comune (relevance concreta)
  if (taste.songs.length) return { kind: "brano", k: "insight_brano", song: taste.songs[0] };
  // 4) stessa ambizione
  if (a.goal != null && b.goal != null && Math.abs(a.goal - b.goal) <= 1)
    return { kind: "obiettivo", k: "insight_obiettivo" };
  if (taste.genres.length) return { kind: "genere", k: "insight_genere", genres: taste.genres.join(", ") };
  return null;
}

const JamAffinity = { IPIP_ITEMS, VALUE_ITEMS, VALUE_KEYS, IPC_ITEMS, BUSSOLA, scoreBig5, scoreValues, scoreIPC, computeAffinity };
// Dual-export: stesso motore nel browser (window) e nel backend Node (require) — ADR 0013.
if (typeof module !== "undefined" && module.exports) module.exports = JamAffinity;
if (typeof window !== "undefined") window.JamAffinity = JamAffinity;
