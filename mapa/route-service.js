

(function (global) {
  'use strict';

  const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

  const MODES = {
    car: { profile: 'driving', label: 'Carro', aliases: ['driving', 'car'] },
    walk: { profile: 'foot', label: 'Caminhada', aliases: ['walking', 'foot'] },
    bike: { profile: 'cycling', label: 'Bicicleta', aliases: ['cycling', 'bike'] },
    transit: { profile: 'driving', label: 'Transporte público', transitEstimate: true },
  };

  function coordsPair(lat, lng) {
    return `${lng},${lat}`;
  }

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }

  function formatDistance(meters) {
    const m = Math.max(0, meters);
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
  }

  function urbanDelaySeconds(distanceKm, mode) {
    const km = Math.max(0, distanceKm);
    switch (mode) {
      case 'walk':
        return km * 42;
      case 'car':
        return km * 52;
      case 'bike':
        return km * 28;
      case 'transit':
        return km * 48;
      default:
        return 0;
    }
  }

  function estimateTransitSeconds(carDistanceMeters, carDurationSeconds) {
    const km = carDistanceMeters / 1000;
    const effectiveKmh = 14;
    const moving = (km / effectiveKmh) * 3600;
    const boardingWait = 240;
    return moving + urbanDelaySeconds(km, 'transit') + boardingWait * 0.35 + carDurationSeconds * 0.08;
  }

  function geometryToLatLngs(geometry) {
    if (!geometry || !geometry.coordinates) return [];
    return geometry.coordinates.map((c) => [c[1], c[0]]);
  }

  function translateManeuver(type, modifier) {
    const mod = {
      left: 'à esquerda',
      right: 'à direita',
      'sharp left': 'fechado à esquerda',
      'sharp right': 'fechado à direita',
      'slight left': 'leve à esquerda',
      'slight right': 'leve à direita',
      straight: 'em frente',
      uturn: 'retorno',
    };
    const t = {
      depart: 'Inicie',
      arrive: 'Chegada',
      turn: 'Vire',
      continue: 'Continue',
      merge: 'Entre na via',
      roundabout: 'Na rotatória',
      'roundabout turn': 'Na rotatória',
      fork: 'No cruzamento',
      'end of road': 'No fim da via',
      'new name': 'Continue',
    };
    const base = t[type] || 'Siga';
    if (modifier && mod[modifier]) return `${base} ${mod[modifier]}`;
    return base;
  }

  function parseSteps(route) {
    const steps = [];
    if (!route || !route.legs) return steps;
    route.legs.forEach((leg) => {
      (leg.steps || []).forEach((step) => {
        const m = step.maneuver || {};
        const loc = m.location || [];
        steps.push({
          instruction: translateManeuver(m.type, m.modifier),
          name: step.name || '',
          distance: step.distance || 0,
          duration: step.duration || 0,
          lat: loc[1],
          lng: loc[0],
          type: m.type,
          modifier: m.modifier,
        });
      });
    });
    return steps;
  }

  async function fetchRoute(modeKey, from, to, options) {
    const mode = MODES[modeKey] || MODES.car;
    const withSteps = !(options && options.steps === false);
    const coords = `${coordsPair(from.lat, from.lng)};${coordsPair(to.lat, to.lng)}`;
    const aliases = mode.aliases || [mode.profile];
    let lastErr = null;

    for (let i = 0; i < aliases.length; i++) {
      const profile = aliases[i];
      const params = new URLSearchParams({
        overview: 'full',
        geometries: 'geojson',
        steps: withSteps ? 'true' : 'false',
        annotations: 'true',
      });
      const url = `${OSRM_BASE}/${profile}/${coords}?${params.toString()}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          lastErr = new Error('Falha na rede de rotas.');
          continue;
        }
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
          lastErr = new Error('Não foi possível traçar a rota para estes pontos.');
          continue;
        }
        const r = data.routes[0];
        let duration = r.duration;
        let distance = r.distance;

        if (mode.transitEstimate) {
          duration = estimateTransitSeconds(distance, duration);
        } else if (modeKey === 'car') {
          duration += urbanDelaySeconds(distance / 1000, 'car');
        } else if (modeKey === 'walk') {
          duration += urbanDelaySeconds(distance / 1000, 'walk');
        } else if (modeKey === 'bike') {
          duration += urbanDelaySeconds(distance / 1000, 'bike');
        }

        return {
          mode: modeKey,
          duration,
          distance,
          geometry: r.geometry,
          latlngs: geometryToLatLngs(r.geometry),
          steps: withSteps ? parseSteps(r) : [],
          raw: r,
          transitEstimated: !!mode.transitEstimate,
        };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Serviço de rotas indisponível.');
  }

  global.EcoColetaRoute = {
    MODES,
    fetchRoute,
    formatDuration,
    formatDistance,
    geometryToLatLngs,
    estimateTransitSeconds,
  };
})(typeof window !== 'undefined' ? window : this);
