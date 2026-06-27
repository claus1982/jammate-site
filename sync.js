/* Sincronizzazione production: cache locale resiliente + snapshot autorevole su PostgreSQL. */
(function () {
  "use strict";
  window.JM = window.JM || {};
  let timer = 0;
  let pending = null;
  let saving = false;
  let lastProfile = "";
  let lastDeep = "";

  async function flush() {
    if (saving || !pending || !JM.Session || !JM.Session.authenticated) return;
    const state = pending;
    pending = null;
    saving = true;
    try {
      const profile = state.me || {};
      const profilePayload = {
        avatar: profile.avatar, photoUrl: profile.photo || profile.photoUrl || null,
        color: profile.color, city: profile.city, level: profile.level,
        bio: profile.bio, tagline: profile.tagline,
        instruments: profile.instruments || [], genres: profile.genres || [],
        links: profile.links || {}
      };
      const profileHash = JSON.stringify(profilePayload);
      if (profileHash !== lastProfile) {
        await JM.Api.me.update(profilePayload);
        lastProfile = profileHash;
      }
      const deep = profile.deep || {};
      const deepHash = JSON.stringify({ deep, consent: !!(state.consent && state.consent.deep) });
      if (deepHash !== lastDeep) {
        if (deep.done && state.consent && state.consent.deep) {
          await JM.Api.me.saveDeep({ ...deep, consent: true, consentVersion: String(state.consent.v || 1) });
        } else if (!deep.done && lastDeep) {
          await JM.Api.me.revokeDeep();
        }
        lastDeep = deepHash;
      }
      await JM.Api.state.save(state);
      window.dispatchEvent(new CustomEvent("jm:sync", { detail: { status: "saved" } }));
    } catch (error) {
      pending = state;
      window.dispatchEvent(new CustomEvent("jm:sync", { detail: { status: "error", error } }));
    } finally {
      saving = false;
      if (pending) timer = setTimeout(flush, 2000);
    }
  }

  JM.Sync = {
    prime(state) {
      if (!state || !state.me) return;
      const p = state.me;
      lastProfile = JSON.stringify({
        avatar: p.avatar, photoUrl: p.photo || p.photoUrl || null,
        color: p.color, city: p.city, level: p.level, bio: p.bio, tagline: p.tagline,
        instruments: p.instruments || [], genres: p.genres || [], links: p.links || {}
      });
      lastDeep = JSON.stringify({ deep: p.deep || {}, consent: !!(state.consent && state.consent.deep) });
    },
    schedule(state) {
      if (JM.Runtime.demo) return;
      pending = structuredClone(state);
      clearTimeout(timer);
      timer = setTimeout(flush, 500);
    },
    flush
  };
  window.addEventListener("pagehide", () => { if (pending) flush(); });
})();
