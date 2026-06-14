

(function (global) {
  'use strict';

  const ERROR_MESSAGES = {
    PERMISSION_DENIED:
      'Permissão de localização negada. Para ativar: no celular (Chrome/Android) toque no cadeado da barra de endereço → Localização → Permitir; no iPhone (Safari) use Ajustes → Safari → Localização → Permitir; no computador clique no ícone de cadeado ou “i” ao lado do endereço e permita a localização. Depois recarregue a página.',
    INSECURE_CONTEXT:
      'A geolocalização só funciona em conexão segura (HTTPS) ou em localhost. Abra o site com https:// ou teste em http://localhost/.',
    POSITION_UNAVAILABLE:
      'Não foi possível obter sua posição. Verifique se o GPS está ligado e se há sinal.',
    TIMEOUT: 'Tempo esgotado ao buscar localização. Tente novamente em área aberta.',
    NOT_SUPPORTED: 'Geolocalização não é suportada neste navegador.',
    LOW_ACCURACY:
      'Localização imprecisa demais para traçar a rota. Use o celular com GPS ligado, ao ar livre, e toque em “Atualizar minha localização”.',
    FORTALEZA_GUESS:
      'O navegador enviou uma posição aproximada na região de Fortaleza (comum no computador). Não usamos isso como sua localização real. Ative o GPS no celular ou tente “Atualizar minha localização”.',
    UNKNOWN: 'Erro desconhecido ao obter localização.',
  };

  const FORTALEZA_METRO = {
    latMin: -4.15,
    latMax: -3.5,
    lngMin: -38.82,
    lngMax: -38.28,
  };

  const CARIRI_REGION = {
    latMin: -7.72,
    latMax: -6.86,
    lngMin: -39.82,
    lngMax: -38.82,
  };

  const MAX_ACCURACY_METERS = 2200;
  const MAX_ACCURACY_DESKTOP = 2500;

  function haversineMeters(aLat, aLng, bLat, bLng) {
    const R = 6371000;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const lat1 = (aLat * Math.PI) / 180;
    const lat2 = (bLat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function isInCaririRegion(lat, lng) {
    return (
      lat >= CARIRI_REGION.latMin &&
      lat <= CARIRI_REGION.latMax &&
      lng >= CARIRI_REGION.lngMin &&
      lng <= CARIRI_REGION.lngMax
    );
  }

  function geoError(message, reason) {
    const err = new Error(message || ERROR_MESSAGES.UNKNOWN);
    if (reason) err.reason = reason;
    return err;
  }

  function mapGeolocationError(error) {
    if (!error) return ERROR_MESSAGES.UNKNOWN;
    switch (error.code) {
      case 1:
        return ERROR_MESSAGES.PERMISSION_DENIED;
      case 2:
        return ERROR_MESSAGES.POSITION_UNAVAILABLE;
      case 3:
        return ERROR_MESSAGES.TIMEOUT;
      default:
        return error.message || ERROR_MESSAGES.UNKNOWN;
    }
  }

  function geolocationErrorFromCode(error) {
    if (!error) return geoError(ERROR_MESSAGES.UNKNOWN, 'unknown');
    switch (error.code) {
      case 1:
        return geoError(ERROR_MESSAGES.PERMISSION_DENIED, 'permission_denied');
      case 2:
        return geoError(ERROR_MESSAGES.POSITION_UNAVAILABLE, 'position_unavailable');
      case 3:
        return geoError(ERROR_MESSAGES.TIMEOUT, 'timeout');
      default:
        return geoError(error.message || ERROR_MESSAGES.UNKNOWN, 'unknown');
    }
  }

  function isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }

  function isSecureContextForGeo() {
    if (typeof window === 'undefined') return true;
    if (window.isSecureContext) return true;
    const host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function getInsecureContextMessage() {
    return ERROR_MESSAGES.INSECURE_CONTEXT;
  }

  function isMobileLike() {
    if (typeof navigator === 'undefined') return false;
    return (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && typeof window !== 'undefined' && window.innerWidth < 1024)
    );
  }

  function isInFortalezaMetro(lat, lng) {
    return (
      lat >= FORTALEZA_METRO.latMin &&
      lat <= FORTALEZA_METRO.latMax &&
      lng >= FORTALEZA_METRO.lngMin &&
      lng <= FORTALEZA_METRO.lngMax
    );
  }

  function validatePosition(pos, options) {
    if (
      !pos ||
      typeof pos.lat !== 'number' ||
      typeof pos.lng !== 'number' ||
      !Number.isFinite(pos.lat) ||
      !Number.isFinite(pos.lng) ||
      Math.abs(pos.lat) > 90 ||
      Math.abs(pos.lng) > 180
    ) {
      return { ok: false, reason: 'invalid', message: ERROR_MESSAGES.POSITION_UNAVAILABLE };
    }

    const acc = pos.accuracy;

    if (!Number.isFinite(acc) || acc <= 0) {
      return { ok: true, approximate: !isMobileLike() };
    }

    const approximate =
      !!options?.allowApproximate || acc > (isMobileLike() ? 450 : 900);
    return { ok: true, approximate };
  }

  function normalizePosition(position) {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading:
        typeof position.coords.heading === 'number' && !Number.isNaN(position.coords.heading)
          ? position.coords.heading
          : null,
      speed:
        typeof position.coords.speed === 'number' && !Number.isNaN(position.coords.speed)
          ? position.coords.speed
          : null,
      timestamp: position.timestamp || Date.now(),
    };
  }

  function getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      if (!isSupported()) {
        reject(geoError(ERROR_MESSAGES.NOT_SUPPORTED, 'not_supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(normalizePosition(pos)),
        (err) => reject(geolocationErrorFromCode(err)),
        Object.assign(
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
          options || {}
        )
      );
    });
  }

  function watchPosition(onUpdate, onError, options) {
    if (!isSupported()) {
      if (onError) onError(new Error(ERROR_MESSAGES.NOT_SUPPORTED));
      return null;
    }
    return navigator.geolocation.watchPosition(
      (pos) => onUpdate(normalizePosition(pos)),
      (err) => {
        if (onError) onError(new Error(mapGeolocationError(err)));
      },
      Object.assign(
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
        options || {}
      )
    );
  }

  function clearWatch(watchId) {
    if (watchId != null && isSupported()) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  function getBestCurrentPosition(options) {
    const opts = Object.assign(
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
      options || {}
    );
    const maxWaitMs = typeof options?.maxWaitMs === 'number' ? options.maxWaitMs : 28000;
    const targetAccuracy =
      typeof options?.targetAccuracy === 'number' ? options.targetAccuracy : 100;
    const mustValidate = options?.mustValidate !== false;
    const stableMaxDeltaM =
      typeof options?.stableMaxDeltaM === 'number' ? options.stableMaxDeltaM : 350;
    const requireStableFix =
      typeof options?.requireStableFix === 'boolean'
        ? options.requireStableFix
        : isMobileLike();

    return new Promise((resolve, reject) => {
      if (!isSupported()) {
        reject(geoError(ERROR_MESSAGES.NOT_SUPPORTED, 'not_supported'));
        return;
      }

      let best = null;
      let watchId = null;
      let settled = false;
      let graceTimer = null;

      const graceWindowMs = isMobileLike() ? 3500 : 1200;

      function finish() {
        if (settled) return;
        settled = true;
        clearWatch(watchId);
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);

        if (best) {
          const check = validatePosition(best, { allowApproximate: true });
          if (!check.ok) {
            reject(geoError(check.message || ERROR_MESSAGES.POSITION_UNAVAILABLE, check.reason));
            return;
          }
          resolve(best);
          return;
        }

        reject(geoError(ERROR_MESSAGES.TIMEOUT, 'timeout'));
      }

      function consider(pos) {
        const check = validatePosition(pos, { allowApproximate: true });
        if (!check.ok) return;

        const accNew = Number.isFinite(pos.accuracy) ? pos.accuracy : Infinity;
        const accBest = best && Number.isFinite(best.accuracy) ? best.accuracy : Infinity;
        if (!best || accNew < accBest) {
          best = pos;
        }

        const acc = best && Number.isFinite(best.accuracy) ? best.accuracy : Infinity;

        if (acc <= targetAccuracy) {
          finish();
          return;
        }

        if (!graceTimer) {
          graceTimer = setTimeout(() => finish(), graceWindowMs);
        }
      }

      const timer = setTimeout(() => finish(), maxWaitMs);

      watchId = watchPosition(
        (pos) => consider(pos),
        () => {},
        opts
      );

      getCurrentPosition(opts)
        .then(consider)
        .catch((err) => {

          if (!best && err && err.reason === 'permission_denied') {
            if (settled) return;
            settled = true;
            clearWatch(watchId);
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }

  global.EcoColetaGeo = {
    ERROR_MESSAGES,
    isSupported,
    isSecureContextForGeo,
    getInsecureContextMessage,
    isMobileLike,
    isInFortalezaMetro,
    isInCaririRegion,
    haversineMeters,
    validatePosition,
    getCurrentPosition,
    getBestCurrentPosition,
    watchPosition,
    clearWatch,
    mapGeolocationError,
  };
})(typeof window !== 'undefined' ? window : this);
