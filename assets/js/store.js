/* =====================================================================
   MineStackerBot — local persistence (localStorage only, never network)
   Settings, profile and analysis history live on the user's device.
   All access is guarded: private modes / file:// restrictions must not
   break the app, they just make persistence a no-op for the session.
   ===================================================================== */
window.MSBStore = (function () {
  "use strict";

  var K = {
    settings: "msb.settings.v2",
    history: "msb.history.v2",
    profile: "msb.profile.v2"
  };
  var HISTORY_MAX = 100;

  var DEFAULT_SETTINGS = {
    speed: "normal",        // fast | normal | cinematic
    animations: true,
    sound: false,           // sound is OFF by default, on purpose
    haptics: false,
    theme: "neon-purple",
    language: "en",
    notifications: true
  };

  var DEFAULT_PROFILE = {
    name: "Operator",
    plan: "FREE",           // only a confirmed payment provider may change this
    createdAt: null
  };

  var available = (function () {
    try {
      var t = "__msb_probe__";
      window.localStorage.setItem(t, "1");
      window.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  })();

  var memory = {}; // session fallback when storage is unavailable

  function readRaw(key) {
    try { return available ? window.localStorage.getItem(key) : (memory[key] || null); }
    catch (e) { return null; }
  }
  function writeRaw(key, value) {
    try {
      if (available) window.localStorage.setItem(key, value);
      else memory[key] = value;
    } catch (e) { memory[key] = value; }
  }
  function readJSON(key, fallback) {
    var raw = readRaw(key);
    if (!raw) return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (e) { return fallback; }
  }

  function assign(target, source) {
    var out = {}, k;
    for (k in target) if (Object.prototype.hasOwnProperty.call(target, k)) out[k] = target[k];
    for (k in source) {
      if (Object.prototype.hasOwnProperty.call(source, k) &&
          Object.prototype.hasOwnProperty.call(target, k)) out[k] = source[k];
    }
    return out;
  }

  /* -------- settings -------- */
  function getSettings() {
    return assign(DEFAULT_SETTINGS, readJSON(K.settings, {}));
  }
  function setSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return getSettings();
    var s = getSettings();
    s[key] = value;
    writeRaw(K.settings, JSON.stringify(s));
    return s;
  }

  /* -------- profile -------- */
  function getProfile() {
    var p = assign(DEFAULT_PROFILE, readJSON(K.profile, {}));
    if (!p.createdAt) {
      p.createdAt = Date.now();
      writeRaw(K.profile, JSON.stringify(p));
    }
    // Plan can only ever be FREE in this build: no payment provider is wired,
    // so the app must never claim an active paid subscription.
    p.plan = "FREE";
    return p;
  }
  function setProfile(patch) {
    var p = assign(DEFAULT_PROFILE, readJSON(K.profile, {}));
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k) &&
          Object.prototype.hasOwnProperty.call(DEFAULT_PROFILE, k)) p[k] = patch[k];
    }
    p.plan = "FREE";
    writeRaw(K.profile, JSON.stringify(p));
    return p;
  }

  /* -------- history: only real analyses the user runs -------- */
  function getHistory() {
    var list = readJSON(K.history, []);
    if (!Object.prototype.toString.call(list).match(/Array/)) return [];
    return list.filter(function (e) {
      return e && typeof e.id === "string" && typeof e.mines === "number";
    });
  }
  function addHistory(entry) {
    var list = getHistory();
    list.unshift(entry);
    if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
    writeRaw(K.history, JSON.stringify(list));
    return list;
  }
  function findHistory(id) {
    var list = getHistory();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function clearHistory() {
    writeRaw(K.history, JSON.stringify([]));
    return [];
  }

  function newId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  return {
    available: available,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getSettings: getSettings,
    setSetting: setSetting,
    getProfile: getProfile,
    setProfile: setProfile,
    getHistory: getHistory,
    addHistory: addHistory,
    findHistory: findHistory,
    clearHistory: clearHistory,
    newId: newId
  };
})();
