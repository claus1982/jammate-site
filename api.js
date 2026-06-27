/* JamMate — Client API (data layer "api").
 *
 * Collega la PWA al backend Node definito in backend/openapi.yaml.
 *
 * Uso (dopo il deploy):
 *   JM.Api.configure({
 *     baseUrl: "https://api.jammate.it/v1",
 *     getToken: async () => token
 *   });
 *   const me = await JM.Api.me.get();
 *
 * Nessuna dipendenza esterna: solo fetch. Stile coerente col resto dell'app.
 */
(function () {
  "use strict";
  window.JM = window.JM || {};

  const cfg = {
    baseUrl: "",
    // Fornitore del token Bearer (Entra). Sovrascritto da configure().
    getToken: async () => null
  };

  class ApiError extends Error {
    constructor(status, message, body) {
      super(message || `Errore API ${status}`);
      this.status = status;
      this.body = body;
    }
  }

  /* Richiesta generica. Aggiunge il token, gestisce JSON ed errori in modo uniforme. */
  async function request(method, path, { body, query, isForm, rawBody } = {}) {
    if (!cfg.baseUrl) throw new ApiError(0, "JM.Api non configurato (manca baseUrl)");

    let url = cfg.baseUrl.replace(/\/$/, "") + path;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v != null && v !== "")
      ).toString();
      if (qs) url += "?" + qs;
    }

    const headers = {};
    const token = await cfg.getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const init = { method, headers };
    if (rawBody != null) {
      init.body = rawBody;
    } else if (body != null) {
      if (isForm) { init.body = body; }            // FormData (es. upload foto): niente Content-Type manuale
      else { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    }

    const res = await fetch(url, init);
    if (res.status === 204) return null;

    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) { try { data = await res.json(); } catch (_) { /* ignore */ } }

    if (!res.ok) throw new ApiError(res.status, data && data.error, data);
    return data;
  }

  // Codifica ogni id interpolato nel path: un id con / ? # spazio o ".." non deve dirottare la richiesta.
  const seg = (v) => encodeURIComponent(String(v));
  const get  = (p, opts)        => request("GET", p, opts);
  const post = (p, body, opts)  => request("POST", p, { ...opts, body });
  const put  = (p, body)        => request("PUT", p, { body });
  const patch = (p, body)       => request("PATCH", p, { body });
  const del  = (p, opts)        => request("DELETE", p, opts);

  JM.Api = {
    ApiError,
    configure(options) { Object.assign(cfg, options); },
    get baseUrl() { return cfg.baseUrl; },

    // --- Profilo ---
    me: {
      get:      () => get("/me"),
      update:   (profile) => put("/me", profile),
      remove:   () => del("/me"),               // GDPR: cancella account
      saveDeep: (deep) => put("/deep", deep),   // richiede deep.consent === true (art. 9)
      revokeDeep: () => del("/deep")            // GDPR: revoca consenso art. 9 (cancella personalità)
    },
    // --- Repertorio ---
    repertoire: {
      list:   () => get("/repertoire"),
      add:    (song) => post("/repertoire", song),
      remove: (id) => del(`/repertoire/${seg(id)}`)
    },
    // --- Reputazione ---
    endorsements: {
      add:     (targetUserId, scores) => post("/endorsements", { targetUserId, ...scores }),
      summary: (userId) => get(`/endorsements/${seg(userId)}/summary`)
    },

    // --- Scoperta / match / messaggi ---
    // Non inoltrare la sentinella interna "Ovunque" (99999) come filtro reale sul wire.
    discover: (filters) => { const q = Object.assign({}, filters); if (q.distance >= 99999) delete q.distance; return get("/discover", { query: q }); },
    swipe:    (targetUserId, decision) => post("/swipes", { targetUserId, decision }),
    matches:  () => get("/matches"),
    messages: {
      with: (userId) => get(`/messages/${seg(userId)}`),
      send: (userId, text, image) => post(`/messages/${seg(userId)}`, { text, image })
    },

    // --- Band + inviti ---
    bands: {
      list:    () => get("/bands"),
      mine:    () => get("/bands/mine"),
      create:  (band) => post("/bands", band),
      update:  (id, band) => put(`/bands/${seg(id)}`, band),
      invite:  (id, inviteeId, role, message) => post(`/bands/${seg(id)}/invites`, { inviteeId, role, message }),
      myInvites: () => get("/invites"),
      respondInvite: (inviteId, action) => patch(`/invites/${seg(inviteId)}`, { action }),
      // EPK audio/video showcase (AUDIO_SHOWCASE.md): il backend risolve l'oEmbed e il poster first-party.
      media: {
        list:   (bandId) => get(`/bands/${seg(bandId)}/media`),
        add:    (bandId, url, title, rights) => post(`/bands/${seg(bandId)}/media`, { url, title, rights }),
        remove: (bandId, mediaId) => del(`/bands/${seg(bandId)}/media/${seg(mediaId)}`)
      }
    },

    // --- Locali + serate ---
    venues: {
      list:     (city) => get("/venues", { query: { city } }),
      mine:     () => get("/venues/mine"),
      create:   (venue) => post("/venues", venue),
      update:   (id, venue) => put(`/venues/${seg(id)}`, venue),
      addNight: (id, night) => post(`/venues/${seg(id)}/nights`, night)
    },

    // --- Prenotazioni serate ---
    bookings: {
      list:      () => get("/bookings"),
      create:    (booking) => post("/bookings", booking),
      setStatus: (id, status, quote) => patch(`/bookings/${seg(id)}/status`, { status, quote })
    },

    // --- Mappa jam ---
    jams: {
      list:     () => get("/jams"),
      create:   (jam) => post("/jams", jam),
      join:     (id) => post(`/jams/${seg(id)}/join`),
      leave:    (id) => del(`/jams/${seg(id)}/join`),
      requests: (id) => get(`/jams/${seg(id)}/requests`),
      decide:   (id, userId, action) => patch(`/jams/${seg(id)}/participants/${seg(userId)}`, { action })
    },

    // --- Feed ---
    posts: {
      list:    () => get("/posts"),
      create:  (p) => post("/posts", p),
      react:   (id, emoji) => put(`/posts/${seg(id)}/reaction`, { emoji }),
      comments: (id) => get(`/posts/${seg(id)}/comments`),
      comment: (id, text) => post(`/posts/${seg(id)}/comments`, { text })
    },

    // --- Lezioni ---
    lessons: {
      teachers:    () => get("/teachers"),
      teacherSlots: (id) => get(`/teachers/${seg(id)}/slots`),
      saveTeacher: (teacher) => put("/teacher", teacher),
      addSlot:     (slot) => post("/teacher/slots", slot),
      myBookings:  () => get("/lesson-bookings"),
      book:        (slotId) => post("/lesson-bookings", { slotId })
    },

    // --- Notifiche ---
    notifications: {
      list:     () => get("/notifications"),
      markRead: () => patch("/notifications/read", {}),
      clear:    () => del("/notifications")
    },

    auth: {
      register: (email, password, displayName) => post("/auth/register", { email, password, displayName }),
      login: (email, password) => post("/auth/login", { email, password }),
      session: () => get("/auth/session")
    },

    state: {
      get: () => get("/state"),
      save: (state) => put("/state", { state })
    },

    media: {
      upload: (blob) => request("POST", "/media", { rawBody: blob })
    },

    // --- Diagnostica ---
    health: () => get("/health")
  };
})();
