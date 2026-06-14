

(function (global) {
  "use strict";

  var loadPromise = null;
  var ASSETS = {
    modalCss: "ecocheck-dist/ecocheck.css?v=6",
    bridge: "assets/js/ecocheck-bridge.js?v=14",
    iife: "ecocheck-dist/ecocheck.iife.js?v=5",
  };

  function absUrl(rel) {
    if (global.ecocoletaAssetUrl) {
      return global.ecocoletaAssetUrl(rel);
    }
    var base = document.querySelector("base[data-app-base]");
    return new URL(rel, base ? base.href : global.location.href).href;
  }

  function loadStylesheet(href, id) {
    if (document.getElementById(id)) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      link.onload = function () {
        resolve();
      };
      link.onerror = function () {
        reject(new Error("CSS: " + href));
      };
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    if (global.ecoLoadScript) {
      return global.ecoLoadScript(src);
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error("JS: " + src));
      };
      (document.body || document.head).appendChild(s);
    });
  }

  function loadEcoCheck() {
    if (global.EcoCheck && typeof global.EcoCheck.open === "function") {
      return Promise.resolve(global.EcoCheck);
    }
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = loadStylesheet(absUrl(ASSETS.modalCss), "ecocheck-dist-css")
      .then(function () {
        return loadScript(absUrl(ASSETS.iife));
      })
      .then(function () {
        return loadScript(absUrl(ASSETS.bridge));
      })
      .then(function () {
        document.dispatchEvent(new CustomEvent("ecocheck:ready"));
        return global.EcoCheck;
      })
      .catch(function (err) {
        loadPromise = null;
        throw err;
      });

    return loadPromise;
  }

  global.ecocoletaLoadEcoCheck = loadEcoCheck;

  function schedulePreload() {
    var widget = document.querySelector(".ecocheck-widget, [data-ecocheck-open]");
    if (!widget) {
      return;
    }

    if (global.ecoWhenVisible) {
      global.ecoWhenVisible(widget, function () {
        loadEcoCheck().catch(function () {});
      }, { rootMargin: "240px" });
    } else if ("IntersectionObserver" in global) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) {
          return entry.isIntersecting;
        })) {
          observer.disconnect();
          loadEcoCheck().catch(function () {});
        }
      }, { rootMargin: "240px" });
      observer.observe(widget);
    }

    document.querySelectorAll("[data-ecocheck-open]").forEach(function (btn) {
      btn.addEventListener(
        "pointerenter",
        function () {
          loadEcoCheck().catch(function () {});
        },
        { once: true, passive: true }
      );
    });
  }

  document.addEventListener(
    "click",
    function (ev) {
      var btn = ev.target && ev.target.closest("[data-ecocheck-open]");
      if (!btn || (global.EcoCheck && typeof global.EcoCheck.open === "function")) {
        return;
      }
      if (loadPromise) {
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      btn.disabled = true;
      loadEcoCheck()
        .then(function () {
          btn.disabled = false;
          btn.click();
        })
        .catch(function () {
          btn.disabled = false;
          alert("EcoCheck não carregou. Verifique a conexão e recarregue a página.");
        });
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedulePreload);
  } else {
    schedulePreload();
  }
})(window);
