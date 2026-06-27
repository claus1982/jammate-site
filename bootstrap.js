/* Avvio controllato: in produzione autentica e idrata lo stato prima di caricare app.js. */
(function () {
  "use strict";
  window.JM = window.JM || {};
  const runtime = JM.Runtime;
  let token = null;
  try { token = sessionStorage.getItem(runtime.tokenKey); } catch (_) {}

  JM.Api.configure({ baseUrl: runtime.apiBaseUrl, getToken: async () => token });
  JM.Session = {
    authenticated: false,
    user: null,
    logout() {
      token = null;
      try { sessionStorage.removeItem(runtime.tokenKey); } catch (_) {}
      location.reload();
    }
  };

  function loadApp() {
    if (document.querySelector('script[data-jammate-app]')) return;
    const script = document.createElement("script");
    script.src = "app.js";
    script.dataset.jammateApp = "true";
    document.body.appendChild(script);
  }

  function authScreen() {
    const root = document.getElementById("app");
    document.body.classList.add("auth-pending");
    root.innerHTML = `
      <section class="auth-screen" aria-labelledby="authTitle">
        <div class="auth-brand">JamMate</div>
        <h1 id="authTitle">Accedi alla tua scena</h1>
        <p class="muted">Il profilo e le attivita vengono salvati in modo sicuro sul server JamMate.</p>
        <form id="authForm" class="auth-form">
          <label>Nome d'arte<input id="authName" name="displayName" autocomplete="name" maxlength="100"></label>
          <label>Email<input id="authEmail" name="email" type="email" autocomplete="email" required></label>
          <label>Password<input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="12" required></label>
          <p id="authError" class="auth-error" role="alert"></p>
          <button class="btn primary" type="submit">Accedi</button>
          <button class="btn ghost" id="authMode" type="button">Crea un account</button>
        </form>
        <a class="auth-demo" href="?mode=demo">Apri la demo separata</a>
      </section>`;
    let registering = false;
    const form = document.getElementById("authForm");
    const name = document.getElementById("authName");
    const modeButton = document.getElementById("authMode");
    const submit = form.querySelector('button[type="submit"]');
    name.closest("label").hidden = true;
    modeButton.onclick = () => {
      registering = !registering;
      name.closest("label").hidden = !registering;
      name.required = registering;
      submit.textContent = registering ? "Crea account" : "Accedi";
      modeButton.textContent = registering ? "Ho gia un account" : "Crea un account";
    };
    form.onsubmit = async (event) => {
      event.preventDefault();
      const error = document.getElementById("authError");
      error.textContent = "";
      submit.disabled = true;
      try {
        const data = new FormData(form);
        const result = registering
          ? await JM.Api.auth.register(data.get("email"), data.get("password"), data.get("displayName"))
          : await JM.Api.auth.login(data.get("email"), data.get("password"));
        token = result.token;
        sessionStorage.setItem(runtime.tokenKey, token);
        await startProduction();
      } catch (e) {
        error.textContent = e.message || "Accesso non riuscito";
      } finally {
        submit.disabled = false;
      }
    };
  }

  async function startProduction() {
    const session = await JM.Api.auth.session();
    JM.Session.authenticated = true;
    JM.Session.user = session.user;
    const calls = await Promise.allSettled([
      JM.Api.state.get(), JM.Api.me.get(), JM.Api.discover({}), JM.Api.matches(),
      JM.Api.posts.list(), JM.Api.jams.list(), JM.Api.bands.list(), JM.Api.bands.mine(),
      JM.Api.venues.list(), JM.Api.bookings.list(), JM.Api.lessons.teachers(),
      JM.Api.lessons.myBookings(), JM.Api.notifications.list()
    ]);
    const value = (index, fallback) => calls[index].status === "fulfilled" ? calls[index].value : fallback;
    const snapshot = value(0, { state: null });
    JM.InitialState = snapshot.state || null;
    JM.RemoteData = {
      session: session.user,
      me: value(1, null),
      profiles: value(2, []),
      matches: value(3, []),
      posts: value(4, []),
      jams: value(5, []),
      publicBands: value(6, []),
      bands: value(7, []),
      venues: value(8, []),
      bookings: value(9, []),
      teachers: value(10, []),
      lessonBookings: value(11, []),
      notifications: value(12, [])
    };
    document.body.classList.remove("auth-pending");
    document.getElementById("app").innerHTML = "";
    loadApp();
  }

  if (runtime.demo) {
    document.documentElement.dataset.runtime = "demo";
    loadApp();
  } else if (!token) {
    authScreen();
  } else {
    startProduction().catch(() => {
      try { sessionStorage.removeItem(runtime.tokenKey); } catch (_) {}
      token = null;
      authScreen();
    });
  }
})();
