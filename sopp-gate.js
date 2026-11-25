/*!
 * SOPP Access Gate v1
 * Verrou d'accès : l'application n'est utilisable que lorsqu'elle est ouverte
 * depuis SOPP Agents (https://sopp24.github.io/SOPP-agents/) après
 * déverrouillage biométrique.
 *
 * Fonctionnement
 *  - SOPP Agents ouvre l'application avec un jeton d'accès dans le fragment
 *    d'URL (#sopp-access=…). Le fragment n'est jamais envoyé au serveur ; ce
 *    script le lit, le range dans le stockage du navigateur puis l'efface de
 *    l'adresse avant que l'application ne démarre.
 *  - Sans jeton valide, l'interface est masquée et remplacée par un écran
 *    « Ouvrir SOPP Agents ».
 *  - L'accès expire après 30 minutes d'inactivité (renouvelé à l'usage) et au
 *    plus tard à l'échéance du jeton.
 *  - AUTH_URL vide : mode local (le jeton est émis par SOPP Agents dans ce
 *    navigateur). AUTH_URL renseigné (Worker `sopp-agents-auth`) : le jeton est
 *    vérifié côté serveur à chaque ouverture puis toutes les 5 minutes.
 *
 * Important : une page statique publique ne peut pas se protéger elle-même.
 * Ce verrou empêche l'usage normal en dehors de SOPP Agents ; seule une
 * distribution derrière un serveur authentifié (dépôt privé + Worker) empêche
 * réellement la lecture du code. Voir SECURITY.md.
 */
(function () {
  "use strict";

  var HUB_URL = "https://sopp24.github.io/SOPP-agents/";
  var AUTH_URL = ""; // ex. "https://sopp-agents-auth.<compte>.workers.dev"
  var KEY = "soppAgentsAccess.v1";
  var IDLE_MS = 30 * 60 * 1000;
  var RECHECK_MS = 5 * 60 * 1000;
  var root = document.documentElement;

  // Développement local et tests : pas de verrou, sauf demande explicite.
  var host = location.hostname;
  var isLocal = location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (isLocal && !/[?&]soppgate=force\b/.test(location.search)) return;

  function now() { return Date.now(); }

  function b64urlToText(value) {
    var s = value.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function validRecord(r) {
    return !!r && r.v === 1 && typeof r.t === "string" && r.t.length >= 16 && r.t.length <= 2048 &&
      typeof r.e === "number" && r.e > now() && typeof r.a === "number" && now() - r.a < IDLE_MS;
  }

  function load() {
    var raw = null, r = null, k, stores = [];
    try { stores.push(window.sessionStorage); } catch (e) {}
    try { stores.push(window.localStorage); } catch (e) {}
    for (k = 0; k < stores.length && !raw; k += 1) {
      try { raw = stores[k].getItem(KEY); } catch (e) {}
    }
    try { r = raw ? JSON.parse(raw) : null; } catch (e) { r = null; }
    return validRecord(r) ? r : null;
  }

  function save(r) {
    var text = JSON.stringify(r);
    try { window.sessionStorage.setItem(KEY, text); } catch (e) {}
    try { window.localStorage.setItem(KEY, text); } catch (e) {}
  }

  function clear() {
    try { window.sessionStorage.removeItem(KEY); } catch (e) {}
    try { window.localStorage.removeItem(KEY); } catch (e) {}
  }

  // 1. Jeton transmis par SOPP Agents dans le fragment d'URL.
  var incoming = null;
  var match = /(?:^#|&)sopp-access=([A-Za-z0-9_-]{16,4096})/.exec(location.hash);
  if (match) {
    try {
      var payload = JSON.parse(b64urlToText(match[1]));
      if (payload && payload.v === 1 && typeof payload.t === "string" && typeof payload.e === "number") {
        incoming = { v: 1, t: payload.t, e: payload.e, a: now() };
      }
    } catch (e) { incoming = null; }
    try {
      var rest = location.hash.replace(/(^#|&)sopp-access=[A-Za-z0-9_-]+/, "$1").replace(/^#&/, "#").replace(/^#$/, "");
      history.replaceState(history.state, "", location.pathname + location.search + rest);
    } catch (e) {}
    if (incoming && validRecord(incoming)) save(incoming); else incoming = null;
  }

  var record = incoming || load();
  var serverMode = !!AUTH_URL;
  // En mode serveur, un jeton « local » n'est plus accepté.
  if (record && serverMode && /^local\./.test(record.t)) record = null;

  var style = document.createElement("style");
  style.id = "sopp-gate-style";
  style.textContent =
    "html.sopp-locked,html.sopp-locked body{overflow:hidden!important;background:#08090b!important}" +
    "html.sopp-locked body>*:not(#sopp-gate){display:none!important}" +
    "#sopp-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;" +
    "background:#08090b;color:#f4f5f7;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;text-align:center}" +
    "#sopp-gate .sg-card{max-width:360px}" +
    "#sopp-gate .sg-eyebrow{margin:0 0 10px;font-size:12px;letter-spacing:.18em;color:#8b909a}" +
    "#sopp-gate h1{margin:0 0 10px;font-size:24px;font-weight:650;letter-spacing:-.01em}" +
    "#sopp-gate p.sg-msg{margin:0 0 22px;color:#b7bbc4}" +
    "#sopp-gate a.sg-btn{display:inline-block;padding:13px 22px;border-radius:999px;background:#f4f5f7;color:#08090b;font-weight:600;text-decoration:none}" +
    "#sopp-gate a.sg-btn:focus-visible{outline:2px solid #fff;outline-offset:3px}";
  (document.head || root).appendChild(style);

  function mountLock() {
    if (document.getElementById("sopp-gate")) return;
    var box = document.createElement("div");
    box.id = "sopp-gate";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "sopp-gate-title");
    box.innerHTML =
      '<div class="sg-card"><p class="sg-eyebrow">ACCÈS VERROUILLÉ</p>' +
      '<h1 id="sopp-gate-title">Application protégée</h1>' +
      '<p class="sg-msg">Cette application s’ouvre uniquement depuis SOPP Agents, après déverrouillage.</p>' +
      '<a class="sg-btn" href="' + HUB_URL + '">Ouvrir SOPP Agents</a></div>';
    (document.body || root).appendChild(box);
  }

  function lock() {
    root.classList.add("sopp-locked");
    if (document.body) mountLock();
    else document.addEventListener("DOMContentLoaded", mountLock, { once: true });
  }

  window.SoppGate = { locked: !record };

  if (!record) { clear(); lock(); return; }
  window.SoppGate.locked = false;

  // 2. Maintien de l'accès tant que l'application est utilisée.
  var lastTouch = 0;
  function touch() {
    var t = now();
    if (t - lastTouch < 30000) return;
    lastTouch = t;
    var r = load();
    if (!r) { window.SoppGate.locked = true; lock(); return; }
    r.a = t; save(r);
  }
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(function (name) {
    window.addEventListener(name, touch, { passive: true, capture: true });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (!load()) { window.SoppGate.locked = true; lock(); } else touch();
    }
  });

  // 3. Vérification côté serveur (mode Worker).
  function verify() {
    if (!serverMode || !window.fetch) return;
    var r = load();
    if (!r) return;
    fetch(AUTH_URL.replace(/\/+$/, "") + "/session", {
      method: "GET",
      headers: { Authorization: "Bearer " + r.t },
      cache: "no-store"
    }).then(function (res) {
      if (res.status === 401 || res.status === 403) { clear(); window.SoppGate.locked = true; lock(); }
    }).catch(function () { /* hors ligne : on conserve l'accès local déjà accordé */ });
  }
  if (serverMode) {
    verify();
    setInterval(verify, RECHECK_MS);
  }
})();
