(function () {
  "use strict";

  // Hafif uygulama event bus.
  // Modüller arası iletişim için window.dispatchEvent yerine kullanın.
  // Native CustomEvent ile uyumlu: emit ayrıca window'a "bsm:<event>" olarak iletir.

  var _handlers = {};

  function on(event, handler) {
    if (typeof handler !== "function") return function () {};
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(handler);
    return function () { off(event, handler); };
  }

  function off(event, handler) {
    if (_handlers[event]) {
      _handlers[event] = _handlers[event].filter(function (h) { return h !== handler; });
    }
  }

  function once(event, handler) {
    if (typeof handler !== "function") return;
    var unsub = on(event, function (data) {
      unsub();
      handler(data);
    });
  }

  function emit(event, data) {
    (_handlers[event] || []).slice().forEach(function (h) {
      try { h(data); } catch (e) {
        console.error("BSMEvents error [" + event + "]", e);
      }
    });
    try {
      window.dispatchEvent(new CustomEvent("bsm:" + event, { detail: data }));
    } catch (_) {}
  }

  window.BSMEvents = { on: on, off: off, once: once, emit: emit };
})();
