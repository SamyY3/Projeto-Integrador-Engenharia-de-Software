

(function (global) {
  'use strict';

  const CONSENT_SESSION = 'ecocoleta_geo_consent';
  const ONCE_KEY = 'ecocoleta_geo_ask_once';

  let bound = false;
  let pending = null;

  function getStoredConsent() {
    try {
      return sessionStorage.getItem(CONSENT_SESSION) || localStorage.getItem(CONSENT_SESSION) || null;
    } catch (e) {
      return null;
    }
  }

  function setStoredConsent(value, persistChoice) {
    try {
      sessionStorage.setItem(CONSENT_SESSION, value);
      if (persistChoice) {
        localStorage.setItem(ONCE_KEY, '1');
        localStorage.setItem(CONSENT_SESSION, value);
      }
    } catch (e) {

    }
  }

  function isAskOnceActive() {
    try {
      return localStorage.getItem(ONCE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function saveAskOnce() {
    try {
      localStorage.setItem(ONCE_KEY, '1');
    } catch (e) {

    }
  }

  async function getBrowserPermissionState() {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      return 'unknown';
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch (e) {
      return 'unknown';
    }
  }

  function getElements() {
    const overlay =
      document.getElementById('eco-geo-overlay') || document.getElementById('home-geo-overlay');
    if (!overlay) return null;
    return {
      overlay,
      allowBtn:
        overlay.querySelector('[data-geo-allow]') ||
        document.getElementById('eco-geo-allow') ||
        document.getElementById('home-geo-allow'),
      denyBtn:
        overlay.querySelector('[data-geo-deny]') ||
        document.getElementById('eco-geo-deny') ||
        document.getElementById('home-geo-deny'),
      onceCheckbox:
        overlay.querySelector('[data-geo-once]') ||
        document.getElementById('eco-geo-once') ||
        document.getElementById('home-geo-once'),
      titleEl:
        overlay.querySelector('[data-geo-title]') ||
        document.getElementById('eco-geo-title') ||
        document.getElementById('home-geo-title'),
      descEl:
        overlay.querySelector('[data-geo-desc]') ||
        document.getElementById('eco-geo-desc') ||
        document.getElementById('home-geo-desc'),
    };
  }

  function injectOverlay() {
    if (getElements()) return getElements();

    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="eco-geo-overlay" class="home-geo-overlay hidden geo-overlay--closed" role="dialog" aria-modal="true" aria-labelledby="eco-geo-title" aria-describedby="eco-geo-desc" aria-hidden="true">' +
      '  <div class="home-geo-backdrop" data-geo-backdrop aria-hidden="true"></div>' +
      '  <div class="home-geo-dialog">' +
      '    <div class="home-geo-icon" aria-hidden="true">' +
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '        <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/>' +
      '        <circle cx="12" cy="11" r="2.2"/>' +
      '      </svg>' +
      '    </div>' +
      '    <h2 id="eco-geo-title" data-geo-title>Disponibilizar sua localização?</h2>' +
      '    <p id="eco-geo-desc" data-geo-desc>Usamos sua posição atual para mostrar onde você está no mapa e traçar a rota até o ecoponto escolhido, com distância e tempo estimados.</p>' +
      '    <label class="home-geo-once" for="eco-geo-once">' +
      '      <input type="checkbox" id="eco-geo-once" data-geo-once name="eco-geo-once">' +
      '      <span>Lembrar minha escolha neste dispositivo</span>' +
      '    </label>' +
      '    <div class="home-geo-actions">' +
      '      <button type="button" id="eco-geo-allow" data-geo-allow class="home-geo-btn home-geo-btn--primary">Sim, permitir localização</button>' +
      '      <button type="button" id="eco-geo-deny" data-geo-deny class="home-geo-btn home-geo-btn--ghost">Agora não</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(wrap.firstElementChild);
    return getElements();
  }

  function showPopup(els) {
    els.overlay.classList.remove('hidden');
    els.overlay.classList.remove('geo-overlay--closed');
    els.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('home-geo-open');
    if (els.allowBtn) els.allowBtn.focus();
  }

  function hidePopup(els) {
    els.overlay.classList.add('hidden');
    els.overlay.classList.add('geo-overlay--closed');
    els.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('home-geo-open');
    window.dispatchEvent(new CustomEvent('ecocoleta:geo-consent-closed'));
    window.dispatchEvent(new CustomEvent('ecocoleta:home-geo-closed'));
    if (global.EcoColetaHomeMap && typeof global.EcoColetaHomeMap.invalidateSize === 'function') {
      global.EcoColetaHomeMap.invalidateSize();
      [200, 500, 900].forEach(function (ms) {
        window.setTimeout(function () {
          global.EcoColetaHomeMap.invalidateSize();
        }, ms);
      });
    }
  }

  function bindOnce(els) {
    if (bound || !els) return;
    bound = true;

    function isOnceChecked() {
      return !!(els.onceCheckbox && els.onceCheckbox.checked);
    }

    function finishAllow() {
      const persist = isOnceChecked();
      if (persist) saveAskOnce();
      setStoredConsent('granted', persist);
      hidePopup(els);
      if (pending && pending.opts && typeof pending.opts.onAllow === 'function') {
        pending.opts.onAllow();
      }
      if (pending) pending.resolve('granted');
      pending = null;
    }

    function finishDeny() {
      const persist = isOnceChecked();
      if (persist) saveAskOnce();
      setStoredConsent('denied', persist);
      hidePopup(els);
      if (pending && pending.opts && typeof pending.opts.onDeny === 'function') {
        pending.opts.onDeny();
      }
      if (pending) pending.resolve('denied');
      pending = null;
    }

    els.allowBtn.addEventListener('click', finishAllow);
    els.denyBtn.addEventListener('click', finishDeny);

    els.overlay.addEventListener('click', function (event) {
      if (
        event.target.classList.contains('home-geo-backdrop') ||
        event.target.hasAttribute('data-geo-backdrop')
      ) {
        finishDeny();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (
        els.overlay.classList.contains('hidden') ||
        els.overlay.classList.contains('geo-overlay--closed')
      ) {
        return;
      }
      if (event.key === 'Escape' || event.key === 'Esc') finishDeny();
    });
  }

  function isOverlayOpen() {
    const els = getElements();
    if (!els) return false;
    return (
      !els.overlay.classList.contains('hidden') &&
      !els.overlay.classList.contains('geo-overlay--closed')
    );
  }

  function openDialog(opts) {
    const els = injectOverlay();
    bindOnce(els);
    if (opts && opts.title && els.titleEl) els.titleEl.textContent = opts.title;
    if (opts && opts.message && els.descEl) els.descEl.textContent = opts.message;
    showPopup(els);
    return new Promise(function (resolve) {
      pending = { opts: opts || {}, resolve: resolve };
    });
  }

  function requestPermission(opts) {
    opts = opts || {};

    const stored = getStoredConsent();
    if (stored === 'granted' && !opts.force) {
      if (typeof opts.onAllow === 'function') opts.onAllow();
      return Promise.resolve('granted');
    }
    if (stored === 'denied' && !opts.force) {
      if (typeof opts.onDeny === 'function') opts.onDeny();
      return Promise.resolve('denied');
    }

    if (isAskOnceActive()) {
      return getBrowserPermissionState().then(function (perm) {
        if (perm === 'granted') {
          setStoredConsent('granted', false);
          if (typeof opts.onAllow === 'function') opts.onAllow();
          return 'granted';
        }
        if (perm === 'denied') {
          setStoredConsent('denied', false);
          if (typeof opts.onDeny === 'function') opts.onDeny();
          return 'denied';
        }
        return openDialog(opts);
      });
    }

    return openDialog(opts);
  }

  function init(options) {
    const els = injectOverlay();
    bindOnce(els);
    if (options && options.autoShow) {
      void requestPermission(options);
    }
  }

  global.EcoColetaGeoConsent = {
    init,
    requestPermission,
    isOverlayOpen,
    getStoredConsent,
    showDialog: openDialog,
  };
})(typeof window !== 'undefined' ? window : this);
