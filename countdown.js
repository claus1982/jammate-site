/* JamMate — pagina "stiamo per andare live".
   Niente dipendenze, niente inline (CSP script-src 'self'). */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // ── Le due onde (viola/rosa) che entrano in fase ──────────────────────────
  // Onde identiche; la rosa parte in controfase (½ λ) e l'animazione CSS la
  // riporta a Δφ = 0. Generiamo i path campionando una sinusoide reale.
  function buildWaves() {
    var host = document.getElementById("wave");
    if (!host) return;
    var W = 240, H = 60, base = H / 2, amp = 13, lambda = 60;
    var path = "M";
    for (var x = -60; x <= 300; x += 2) {
      var y = base - amp * Math.sin((2 * Math.PI * x) / lambda);
      path += (x === -60 ? " " : " L") + x.toFixed(1) + " " + y.toFixed(2);
    }

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H });
    var defs = el("defs", {});
    var clip = el("clipPath", { id: "waveClip" });
    clip.appendChild(el("rect", { x: 0, y: -8, width: W, height: H + 16 }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    var g = el("g", { "clip-path": "url(#waveClip)" });
    g.appendChild(el("path", { class: "w w-v", d: path }));
    g.appendChild(el("path", { class: "w w-r", d: path }));
    svg.appendChild(g);
    // nodo di risonanza (lampeggia al lock di fase)
    svg.appendChild(el("circle", { class: "node", cx: 120, cy: base, r: 4 }));
    host.appendChild(svg);
  }

  // ── Scala di tick del fondale (tavola scientifica) ────────────────────────
  function buildLadder() {
    var g = document.getElementById("ladder");
    if (!g) return;
    for (var i = 0, y = 160; y <= 750; y += 30, i++) {
      var long = i % 4 === 0;
      g.appendChild(el("line", {
        class: "tick", x1: 0, y1: y, x2: long ? 16 : 9, y2: y,
        "stroke-opacity": long ? ".55" : ".3"
      }));
      if (long) {
        var t = el("text", { class: "lbl", x: 24, y: y + 3 });
        t.textContent = (440 - (i / 4) * 110); // pseudo-valori Hz, decrescenti
        g.appendChild(t);
      }
    }
  }

  var $ = function (id) { return document.getElementById(id); };

  // ── Waitlist "avvisami al lancio" ─────────────────────────────────────────
  function initNotify() {
    var form = $("notify");
    if (!form) return;
    var email = $("wl-email"), consent = $("wl-consent"),
        btn = $("notifyBtn"), msg = $("notifyMsg");
    var API = "https://api.jammate.it/v1/waitlist";
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var done = false;
    function setMsg(t, cls) { msg.textContent = t; msg.className = "notify-msg" + (cls ? " " + cls : ""); }

    // Mostra il form SOLO se l'endpoint è attivo (ping GET). Prima del deploy del backend
    // resta nascosto → niente form rotto; comparirà da solo appena l'API è online.
    fetch(API, { method: "GET" })
      .then(function (r) { if (r.ok) form.classList.add("live"); })
      .catch(function () { /* endpoint non attivo: form resta nascosto */ });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (done) return;
      var val = (email.value || "").trim();
      if (!EMAIL_RE.test(val) || val.length > 254) { setMsg("Controlla l'indirizzo email.", "warn"); email.focus(); return; }
      if (!consent.checked) { setMsg("Spunta il consenso per ricevere l'avviso.", "warn"); return; }

      btn.disabled = true; setMsg("Invio…", "");
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: val, consent: true, source: "coming-soon", locale: (navigator.language || "it").slice(0, 12) })
      }).then(function (res) {
        if (res.ok) {
          done = true; form.classList.add("ok");
          setMsg("Ci sei: sei un Early Adopter. Ti scriviamo appena andiamo in fase. ✦", "ok");
        } else if (res.status === 400) {
          setMsg("Email non valida o consenso mancante.", "warn"); btn.disabled = false;
        } else if (res.status === 429) {
          setMsg("Troppi tentativi, riprova tra poco.", "warn"); btn.disabled = false;
        } else {
          // Endpoint non ancora attivo (pre-deploy) o errore lato server.
          setMsg("Le iscrizioni aprono a breve — riprova tra poco.", "warn"); btn.disabled = false;
        }
      }).catch(function () {
        setMsg("Connessione assente — riprova tra poco.", "warn"); btn.disabled = false;
      });
    });
  }

  // ── Segnale: trasmissioni che variano "in base al momento" ────────────────
  // Niente loop fisso: a ogni caricamento l'ordine è rimescolato (no ripetizioni
  // immediate) e 3 frammenti leggono ora/giorno reali → non è mai uguale.
  var ICONS = {
    wave:
      '<svg viewBox="0 0 80 40" aria-hidden="true">' +
      '<path d="M4 26 Q14 10 24 26 Q30 34 40 20" fill="none" stroke="var(--accent)" stroke-width="2.3" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M76 14 Q66 30 56 14 Q50 6 40 20" fill="none" stroke="var(--accent-2)" stroke-width="2.3" stroke-linecap="round" opacity=".9"/>' +
      '<circle cx="40" cy="20" r="3.6" fill="url(#jmGrad)"/></svg>',
    pin:
      '<svg viewBox="0 0 80 40" aria-hidden="true">' +
      '<circle cx="13" cy="12" r="1.5" fill="var(--faint)"/><circle cx="67" cy="10" r="1.5" fill="var(--faint)"/>' +
      '<circle cx="18" cy="31" r="1.4" fill="var(--faint)"/><circle cx="62" cy="32" r="1.4" fill="var(--faint)"/>' +
      '<path d="M13 12 L40 18 M67 10 L40 18 M18 31 L40 18 M62 32 L40 18" stroke="var(--line)" stroke-width="1" opacity=".6"/>' +
      '<path d="M40 6 C33 6 28 11 28 18 C28 27 40 35 40 35 C40 35 52 27 52 18 C52 11 47 6 40 6 Z" fill="url(#jmGrad)"/>' +
      '<circle cx="40" cy="18" r="3.2" fill="#0b0c14"/></svg>',
    bars:
      '<svg viewBox="0 0 80 40" aria-hidden="true">' +
      '<rect x="22" y="22" width="5" height="10" rx="2.5" fill="url(#jmGrad)"/>' +
      '<rect x="32" y="14" width="5" height="18" rx="2.5" fill="url(#jmGrad)"/>' +
      '<rect x="42" y="6" width="5" height="26" rx="2.5" fill="url(#jmGrad)"/>' +
      '<rect x="52" y="16" width="5" height="16" rx="2.5" fill="url(#jmGrad)"/>' +
      '<rect x="62" y="20" width="5" height="12" rx="2.5" fill="url(#jmGrad)"/></svg>',
    rings:
      '<svg viewBox="0 0 80 40" aria-hidden="true">' +
      '<circle cx="40" cy="20" r="14" fill="none" stroke="var(--accent-2)" stroke-width="1.2" opacity=".3"/>' +
      '<circle cx="40" cy="20" r="8.5" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity=".55"/>' +
      '<circle cx="40" cy="20" r="3.2" fill="url(#jmGrad)"/></svg>'
  };

  var GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function momentText() {
    var d = new Date(), h = d.getHours();
    if (h >= 5 && h < 12)  return "una mattina a Milano · qualcosa si accorda";
    if (h >= 12 && h < 18) return "pomeriggio a Milano · le frequenze si cercano";
    if (h >= 18)           return "stasera a Milano · due voci si trovano";
    return "le " + p2(h) + ":" + p2(d.getMinutes()) + " · e c'è ancora chi suona";
  }
  function clockText() {
    var d = new Date();
    return "ore " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + " · il segnale cresce";
  }
  function dayText() {
    return "è " + GIORNI[new Date().getDay()] + " · la sala prove ti aspetta";
  }

  var POOL = [
    { i: "wave",  t: "due voci · una frequenza" },
    { i: "pin",   t: "chi suona come te, qui vicino" },
    { i: "bars",  t: "il primo accordo non si scorda" },
    { i: "rings", t: "presto — e non come te l'aspetti" },
    { i: "wave",  t: "due frequenze, una sola fase" },
    { i: "bars",  t: "la tua prossima jam comincia da qui" },
    { i: "pin",   t: "la scena di Milano, in un posto solo" },
    { i: "rings", t: "non l'hai mai sentito così" },
    { i: "pin",   t: momentText },
    { i: "rings", t: clockText },
    { i: "bars",  t: dayText }
  ];

  function initSignal() {
    var box = $("glimpse");
    if (!box) return;
    var ico = $("gIco"), txt = $("gTxt");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var queue = [], last = -1;

    function reshuffle() {
      var a = POOL.map(function (_, i) { return i; });
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      if (a[0] === last && a.length > 1) { var s = a[0]; a[0] = a[1]; a[1] = s; } // no ripetizione a cavallo
      queue = a;
    }
    function nextItem() {
      if (!queue.length) reshuffle();
      var idx = queue.shift(); last = idx;
      return POOL[idx];
    }
    function render(it) {
      ico.innerHTML = ICONS[it.i] || "";
      txt.textContent = (typeof it.t === "function") ? it.t() : it.t;
    }

    if (reduce) { render(nextItem()); box.classList.add("in"); return; } // statico: solo un frammento casuale

    var HOLD = 3200, OUT = 560;
    function show() {
      render(nextItem());
      box.classList.remove("out");
      void box.offsetWidth;           // forza il restart della transition
      box.classList.add("in");
      setTimeout(function () {
        box.classList.remove("in");
        box.classList.add("out");
        setTimeout(show, OUT);
      }, HOLD);
    }
    show();
  }

  function start() {
    buildWaves();
    buildLadder();
    initNotify();
    initSignal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
