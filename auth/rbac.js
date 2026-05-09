(function () {
  "use strict";

  // Role-based access control — DOM seviyesinde.
  // HTML elementlerine data-requires-role="admin" ekleyerek admin-only içerik işaretlenir.
  // bsm:auth:ready event'i tetiklendiğinde roller uygulanır.
  //
  // Roller: admin > coach (varsayılan)
  // Kaynak: Supabase user_metadata.role

  var ROLE_LEVELS = { admin: 2, coach: 1 };

  function levelOf(role) {
    return ROLE_LEVELS[String(role || "").toLowerCase()] || 0;
  }

  function hasPermission(userRole, requiredRole) {
    return levelOf(userRole) >= levelOf(requiredRole);
  }

  function enforce(role) {
    var elements = document.querySelectorAll("[data-requires-role]");

    elements.forEach(function (el) {
      var required = (el.dataset.requiresRole || "admin").toLowerCase();
      var allowed = hasPermission(role, required);

      if (allowed) {
        el.style.display = "";
        el.removeAttribute("aria-hidden");
        el.removeAttribute("tabindex");
        el.removeAttribute("disabled");
      } else {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
        // Disabled yerine display:none — event listener leak'i önler
      }
    });
  }

  // bsm:auth:ready (window CustomEvent) dinle
  window.addEventListener("bsm:auth:ready", function (e) {
    var detail = (e && e.detail) || {};

    if (detail.bypass) {
      // Auth bypass modunda tüm roller açık
      enforce("admin");
      return;
    }

    var role = String(detail.role || "coach").toLowerCase();
    enforce(role);
  });

  window.BSMRbac = { enforce: enforce, hasPermission: hasPermission, levelOf: levelOf };
})();
