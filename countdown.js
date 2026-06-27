/* JamMate — pagina "stiamo per andare live".
   Niente dipendenze, niente inline (CSP script-src 'self'). */
(function () {
  "use strict";

  // ── Momento del go-live: domani sera, 29.06.2026 ore 21:00 (CEST = UTC+2) ──
  var TARGET = new Date("2026-06-29T21:00:00+02:00").getTime();

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

  // ── Countdown ─────────────────────────────────────────────────────────────
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var $ = function (id) { return document.getElementById(id); };
  var dd = $("dd"), hh = $("hh"), mm = $("mm"), ss = $("ss"),
      sr = $("sr"), stage = $("stage"), enter = $("enter");
  var lastMin = -1, live = false, reloadTimer = null;

  function plural(n, s, p) { return n + " " + (n === 1 ? s : p); }

  function goLive() {
    if (live) return;
    live = true;
    if (stage) {
      stage.classList.add("is-live");
      var lede = stage.querySelector(".lede");
      if (lede) lede.textContent = "Siamo in fase. JamMate è online.";
    }
    if (sr) sr.textContent = "JamMate è online. Entra nel sito.";
    // Quando il sito definitivo verrà ripubblicato, chi ha la pagina aperta
    // entra da solo al primo refresh utile (cadenza calma, niente "reload storm").
    if (!reloadTimer) reloadTimer = setInterval(function () { location.reload(); }, 30000);
  }

  function tick() {
    var diff = TARGET - Date.now();
    if (diff <= 0) { dd.textContent = hh.textContent = mm.textContent = ss.textContent = "00"; goLive(); return; }
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    dd.textContent = pad(d); hh.textContent = pad(h); mm.textContent = pad(m); ss.textContent = pad(s);
    if (m !== lastMin) {
      lastMin = m;
      var parts = [];
      if (d) parts.push(plural(d, "giorno", "giorni"));
      parts.push(plural(h, "ora", "ore"));
      parts.push(plural(m, "minuto", "minuti"));
      if (sr) sr.textContent = "JamMate va live tra " + parts.join(", ") + ".";
    }
  }

  function start() {
    buildWaves();
    buildLadder();
    tick();
    setInterval(tick, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
