(function () {
  "use strict";

  // Reactive state manager — pub/sub pattern.
  // Mevcut app.js state object'ine dokunmaz; paralel çalışır.
  // Auth state ve gelecekteki feature state'leri buraya taşınır.

  const _store = {};
  const _listeners = {};

  function get(key) {
    if (key === undefined) return Object.assign({}, _store);
    return _store[key];
  }

  function set(key, value) {
    if (typeof key !== "string" || !key) return;
    const prev = _store[key];
    _store[key] = value;
    if (prev !== value) {
      _emit(key, value, prev);
      _emit("*", { key, value, prev });
    }
  }

  function on(key, callback) {
    if (typeof callback !== "function") return function () {};
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(callback);
    return function () {
      _listeners[key] = (_listeners[key] || []).filter(function (cb) {
        return cb !== callback;
      });
    };
  }

  function once(key, callback) {
    if (typeof callback !== "function") return;
    const unsub = on(key, function (value, prev) {
      unsub();
      callback(value, prev);
    });
  }

  function _emit(key, value, prev) {
    const listeners = _listeners[key];
    if (!listeners) return;
    listeners.slice().forEach(function (cb) {
      try {
        cb(value, prev);
      } catch (e) {
        console.error("BSMState listener error [" + key + "]", e);
      }
    });
  }

  // ── Auth State ─────────────────────────────────────────────
  // Değerler: null | { user, session, role }
  set("auth", null);
  // Değerler: 'pending' | 'authenticated' | 'unauthenticated'
  set("authStatus", "pending");

  window.BSMState = { get: get, set: set, on: on, once: once };
})();
