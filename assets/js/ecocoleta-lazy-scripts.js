

(function (global) {
  "use strict";

  var inflight = Object.create(null);
  var loaded = Object.create(null);

  function loadScript(src) {
    var url = String(src || "");
    if (!url) return Promise.reject(new Error("URL vazia"));
    if (loaded[url]) return Promise.resolve();
    if (inflight[url]) return inflight[url];

    inflight[url] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () {
        loaded[url] = true;
        delete inflight[url];
        resolve();
      };
      s.onerror = function () {
        delete inflight[url];
        reject(new Error("Falha ao carregar: " + url));
      };
      (document.body || document.head).appendChild(s);
    });

    return inflight[url];
  }

  function loadScripts(urls) {
    var chain = Promise.resolve();
    urls.forEach(function (url) {
      chain = chain.then(function () {
        return loadScript(url);
      });
    });
    return chain;
  }

  function whenVisible(target, callback, options) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) {
      callback();
      return function () {};
    }
    if (!("IntersectionObserver" in global)) {
      callback();
      return function () {};
    }
    var opts = options || {};
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) {
        return entry.isIntersecting;
      })) {
        observer.disconnect();
        callback();
      }
    }, {
      root: opts.root || null,
      rootMargin: opts.rootMargin || "320px",
      threshold: opts.threshold || 0,
    });
    observer.observe(el);
    return function () {
      observer.disconnect();
    };
  }

  global.ecoLoadScript = loadScript;
  global.ecoLoadScripts = loadScripts;
  global.ecoWhenVisible = whenVisible;
})(window);
