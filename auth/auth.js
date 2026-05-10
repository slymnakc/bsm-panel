(function () {
  "use strict";

  // BSM Auth Module — Supabase Auth ile giriş/çıkış yönetimi.
  // Supabase yoksa (local/offline) auth bypass uygulanır.
  // Role: Supabase user metadata'da { role: 'admin' | 'coach' } alanı beklenir.

  var BYPASS_KEY = "bsm_auth_bypass";

  function getClient() {
    return window.supabaseClient || window.BSMSupabaseClient || null;
  }

  // ── Session ────────────────────────────────────────────────

  function checkSession() {
    var client = getClient();
    if (!client || !client.auth) return Promise.resolve(null);
    return client.auth.getSession().then(function (result) {
      return (result && result.data && result.data.session) || null;
    });
  }

  function getCurrentUser() {
    var client = getClient();
    if (!client || !client.auth) return Promise.resolve(null);
    return client.auth.getUser().then(function (result) {
      if (result && result.error) {
        throw result.error;
      }
      return (result && result.data && result.data.user) || null;
    });
  }

  function getRole(user) {
    if (!user) return null;
    return (user.user_metadata && user.user_metadata.role) || "coach";
  }

  // ── Auth Actions ───────────────────────────────────────────

  function signIn(email, password) {
    var client = getClient();
    if (!client || !client.auth) return Promise.reject(new Error("Supabase bağlantısı kurulamadı."));
    return client.auth.signInWithPassword({ email: email, password: password }).then(function (result) {
      if (result.error) throw result.error;
      return result.data;
    });
  }

  function signOut() {
    var client = getClient();
    if (!client || !client.auth) return Promise.resolve();
    return client.auth
      .signOut()
      .then(function () {
        if (window.BSMState) window.BSMState.set("auth", null);
        if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
      })
      .then(function () {
        showAuthGate("Oturumunuz kapatıldı. Tekrar giriş yapın.");
      });
  }

  // ── UI ─────────────────────────────────────────────────────

  function showAuthGate(message) {
    var gate = document.getElementById("authGate");
    if (gate) gate.classList.remove("is-hidden");
    document.body.classList.add("auth-required");

    if (message) {
      var notice = document.getElementById("authNotice");
      if (notice) {
        notice.textContent = message;
        notice.style.display = "block";
      }
    }

    var emailInput = document.getElementById("authEmail");
    if (emailInput) {
      setTimeout(function () {
        emailInput.focus();
      }, 100);
    }
  }

  function hideAuthGate() {
    var gate = document.getElementById("authGate");
    if (gate) gate.classList.add("is-hidden");
    document.body.classList.remove("auth-required");
  }

  function setAuthLoading(loading) {
    var submitBtn = document.getElementById("authSubmit");
    var form = document.getElementById("authForm");
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? "Giriş yapılıyor..." : "Giriş Yap";
    }
    if (form) form.dataset.loading = loading ? "true" : "";
  }

  function setAuthError(message) {
    var errorEl = document.getElementById("authError");
    if (!errorEl) return;
    errorEl.textContent = message || "";
    errorEl.style.display = message ? "block" : "none";
  }

  function clearAuthError() {
    setAuthError("");
  }

  // ── Auth Success ───────────────────────────────────────────

  function onAuthSuccess(session, user) {
    var role = getRole(user);

    if (window.BSMState) {
      window.BSMState.set("auth", { session: session, user: user, role: role });
      window.BSMState.set("authStatus", "authenticated");
    }

    hideAuthGate();
    renderUserBadge(user, role);
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { user: user, role: role } }));
  }

  function renderUserBadge(user, role) {
    var badge = document.getElementById("authUserBadge");
    if (!badge) return;
    var email = (user && user.email) || "";
    var roleLabel = role === "admin" ? "Admin" : "Koç";
    badge.innerHTML =
      '<span class="auth-badge__email">' +
      escapeHtml(email) +
      "</span>" +
      '<span class="auth-badge__role">' +
      escapeHtml(roleLabel) +
      "</span>" +
      '<button type="button" id="authSignOutButton" class="auth-badge__signout">Çıkış</button>';

    var signOutBtn = document.getElementById("authSignOutButton");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", function () {
        signOut();
      });
    }

    badge.style.display = "flex";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ── Form Binding ───────────────────────────────────────────

  function bindAuthForm() {
    var form = document.getElementById("authForm");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailInput = document.getElementById("authEmail");
      var passwordInput = document.getElementById("authPassword");
      var email = (emailInput && emailInput.value) ? emailInput.value.trim() : "";
      var password = (passwordInput && passwordInput.value) ? passwordInput.value : "";

      if (!email || !password) {
        setAuthError("E-posta ve şifre alanları boş bırakılamaz.");
        return;
      }

      clearAuthError();
      setAuthLoading(true);

      signIn(email, password)
        .then(function (data) {
          setAuthLoading(false);
          var session = data && data.session;
          var user = data && data.user;
          onAuthSuccess(session, user);
        })
        .catch(function (err) {
          setAuthLoading(false);
          var msg = err && err.message ? err.message : "Giriş başarısız.";
          if (msg === "Invalid login credentials") {
            msg = "E-posta veya şifre hatalı. Lütfen tekrar deneyin.";
          } else if (msg.includes("Email not confirmed")) {
            msg = "E-posta adresinizi doğrulayın, ardından tekrar deneyin.";
          } else if (msg.includes("Too many requests")) {
            msg = "Çok fazla başarısız deneme. Lütfen birkaç dakika bekleyin.";
          }
          setAuthError(msg);
        });
    });

    // Input değişiminde hata mesajını temizle
    ["authEmail", "authPassword"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", clearAuthError);
    });
  }

  // ── Init ───────────────────────────────────────────────────

  function init() {
    bindAuthForm();

    var client = getClient();

    // Supabase yoksa: auth bypass (local/offline geliştirme)
    if (!client || !client.auth) {
      console.warn("BSMAuth: Supabase client bulunamadı, auth bypass aktif.");
      hideAuthGate();
      if (window.BSMState) window.BSMState.set("authStatus", "authenticated");
      window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { bypass: true } }));
      return;
    }

    // Mevcut session kontrol
    checkSession()
      .then(function (session) {
        if (session) {
          return getCurrentUser().then(function (user) {
            if (!user) {
              if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
              showAuthGate("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
              return;
            }
            onAuthSuccess(session, user);
          });
        } else {
          if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
          showAuthGate();
        }
      })
      .catch(function (err) {
        console.error("BSMAuth: Session kontrol hatası", err);
        if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
        showAuthGate("Bağlantı sorunu oluştu. Giriş yapın.");
      });

    // Auth state değişikliklerini izle
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" && session) {
        getCurrentUser()
          .then(function (user) {
            if (!user) {
              if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
              showAuthGate("Oturum yenilenemedi. Tekrar giriş yapın.");
              return;
            }
            onAuthSuccess(session, user);
          })
          .catch(function (err) {
            console.error("BSMAuth: onAuthStateChange kullanıcı hatası", err);
            if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
            showAuthGate("Kimlik doğrulama hatası. Tekrar giriş yapın.");
          });
      } else if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_OUT") {
          if (window.BSMState) window.BSMState.set("auth", null);
          if (window.BSMState) window.BSMState.set("authStatus", "unauthenticated");
          showAuthGate("Oturumunuz sona erdi. Tekrar giriş yapın.");
        }
      }
    });
  }

  window.BSMAuth = {
    init: init,
    signIn: signIn,
    signOut: signOut,
    checkSession: checkSession,
    getCurrentUser: getCurrentUser,
    getRole: getRole,
  };
})();
