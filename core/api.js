(function () {
  "use strict";

  // Güvenli fetch wrapper.
  // – X-Requested-With header otomatik eklenir (CSRF mitigation).
  // – Standart hata yönetimi: HTTP hata kodlarında Error fırlatır.
  // – Tüm POST çağrıları bu modül üzerinden yapılmalı.

  var DEFAULT_TIMEOUT_MS = 30000;

  function post(endpoint, data, options) {
    options = options || {};
    var timeout = options.timeout || DEFAULT_TIMEOUT_MS;

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, timeout)
      : null;

    var headers = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (options.headers) {
      Object.keys(options.headers).forEach(function (k) {
        headers[k] = options.headers[k];
      });
    }

    var fetchOptions = {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    };

    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    return fetch(endpoint, fetchOptions)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              var message = body && body.message ? body.message : "Sunucu hatası (HTTP " + res.status + ")";
              var err = new Error(message);
              err.status = res.status;
              err.body = body;
              throw err;
            });
        }
        return res.json();
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err.name === "AbortError") {
          throw new Error("İstek zaman aşımına uğradı. Bağlantınızı kontrol edin.");
        }
        throw err;
      });
  }

  function get(endpoint, options) {
    options = options || {};
    var timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, timeout)
      : null;

    return fetch(endpoint, {
      method: "GET",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err.name === "AbortError") throw new Error("İstek zaman aşımına uğradı.");
        throw err;
      });
  }

  // Sunucudan Supabase config'ini alır.
  // Başarısız olursa null döner (graceful degradation).
  function fetchConfig() {
    return get("/api/config").catch(function () {
      return null;
    });
  }

  window.BSMApi = { post: post, get: get, fetchConfig: fetchConfig };
})();
