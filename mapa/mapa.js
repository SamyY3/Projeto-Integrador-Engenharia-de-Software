
(function () {
  'use strict';

  function projectRootUrl(relativePath) {
    const prefix = /\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? '../' : '';
    return new URL(prefix + relativePath, window.location.href).href;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function mapCatalogToMapPoints(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(function (p) {
        return p && typeof p.lat === 'number' && typeof p.lng === 'number';
      })
      .map(function (p) {
        return {
          id: p.id,
          name: p.name,
          address: p.address,
          city: p.city,
          lat: p.lat,
          lng: p.lng,
        };
      });
  }

  const FALLBACK_ECOPONTOS = mapCatalogToMapPoints(window.EcoColetaEcopontosCatalog) || [
    {
      id: 'juazeiro-centro',
      name: 'EcoPonto Verde',
      address: 'Centro, Juazeiro do Norte',
      city: 'Juazeiro do Norte',
      lat: -7.2127,
      lng: -39.3155,
    },
  ];

  let ECOPONTOS = FALLBACK_ECOPONTOS.slice();

  const DEFAULT_ORIGIN = { lat: -7.2325, lng: -39.312 };
  const CARIRI_MAP_CENTER = { lat: -7.22, lng: -39.35 };

  
  const DEFAULT_CARIRI_ECOPONTO = { lat: DEFAULT_ORIGIN.lat, lng: DEFAULT_ORIGIN.lng };

  const OSRM_BASES = [
    'https://router.project-osrm.org/route/v1',
    'https://routing.openstreetmap.de/routed-car/route/v1',
  ];

  const PROFILE_ALIASES = {
    foot: ['walking', 'foot'],
    car: ['driving', 'car'],
    bike: ['cycling', 'bike'],
  };

  const TRANSPORT_MODE_KEYS = ['car', 'moto', 'transit', 'walk'];
  const TRANSPORT_MODE_LABELS = {
    car: 'de carro',
    moto: 'de moto',
    transit: 'de transporte público',
    walk: 'a pé',
    bike: 'de bicicleta',
  };
  const TRANSPORT_MODE_TITLES = {
    car: 'Carro',
    moto: 'Moto',
    transit: 'Ônibus',
    walk: 'A pé',
    bike: 'Bicicleta',
  };

  function closestOnRoutePolyline(lat, lng, latlngs) {
    if (!latlngs || latlngs.length === 0) {
      return { traveledMeters: 0, distance: Infinity };
    }
    if (latlngs.length === 1) {
      const d = haversineKm(lat, lng, latlngs[0][0], latlngs[0][1]) * 1000;
      return { traveledMeters: 0, distance: d };
    }
    let bestDist = Infinity;
    let traveled = 0;
    let cum = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i + 1];
      const segLen = haversineKm(a[0], a[1], b[0], b[1]) * 1000;
      const ax = a[1];
      const ay = a[0];
      const bx = b[1];
      const by = b[0];
      const px = lng;
      const py = lat;
      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const abLen2 = abx * abx + aby * aby;
      let t = abLen2 > 0 ? (apx * abx + apy * aby) / abLen2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * abx;
      const cy = ay + t * aby;
      const d = haversineKm(py, px, cy, cx) * 1000;
      if (d < bestDist) {
        bestDist = d;
        traveled = cum + t * segLen;
      }
      cum += segLen;
    }
    return { traveledMeters: traveled, distance: bestDist };
  }

  function polylineLengthMeters(latlngs) {
    if (!latlngs || latlngs.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < latlngs.length; i++) {
      total += haversineKm(latlngs[i - 1][0], latlngs[i - 1][1], latlngs[i][0], latlngs[i][1]) * 1000;
    }
    return total;
  }

  function estimateRemainingOnRoute(userPos, routeLatlngs, totalDistanceM, totalDurationS) {
    const totalM = totalDistanceM > 0 ? totalDistanceM : polylineLengthMeters(routeLatlngs);
    const totalS = totalDurationS > 0 ? totalDurationS : 0;
    if (!routeLatlngs || routeLatlngs.length < 2 || totalM <= 0) {
      return { distanceM: totalM, durationS: totalS };
    }
    const snap = closestOnRoutePolyline(userPos.lat, userPos.lng, routeLatlngs);
    const remainingM = Math.max(0, totalM - snap.traveledMeters);
    const remainingS = totalS > 0 ? totalS * (remainingM / totalM) : 0;
    return { distanceM: remainingM, durationS: remainingS };
  }

  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const ECOPONTOS_CACHE_KEY = 'ecocoleta:ecopontos-map:v2';
  const ECOPONTOS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
  const CARIRI_BBOX = {
    south: -7.72,
    west: -39.82,
    north: -6.86,
    east: -38.82,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatDuration(totalSeconds) {
    const m = Math.round(totalSeconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }

  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
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
      case 'moto':
        return km * 38;
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

  function buildRouteTimesByMode(footRoute, carRoute, bikeRoute) {
    const walkKm = footRoute.distance / 1000;
    const carKm = carRoute.distance / 1000;
    const bikeKm = bikeRoute.distance / 1000;
    const walkSec = footRoute.duration + urbanDelaySeconds(walkKm, 'walk');
    const carSec = carRoute.duration + urbanDelaySeconds(carKm, 'car');
    const bikeSec = bikeRoute.duration + urbanDelaySeconds(bikeKm, 'bike');
    const motoSec = carRoute.duration * 0.88 + urbanDelaySeconds(carKm, 'moto');
    const transitSec = estimateTransitSeconds(carRoute.distance, carRoute.duration);
    return {
      walk: { distanceM: footRoute.distance, durationS: walkSec },
      car: { distanceM: carRoute.distance, durationS: carSec },
      bike: { distanceM: bikeRoute.distance, durationS: bikeSec },
      moto: { distanceM: carRoute.distance, durationS: motoSec },
      transit: { distanceM: carRoute.distance, durationS: transitSec },
    };
  }

  function routeTimesEventFromBundle(bundle) {
    return {
      walk: {
        time: formatDuration(bundle.walk.durationS),
        detail: formatDistance(bundle.walk.distanceM),
      },
      car: {
        time: formatDuration(bundle.car.durationS),
        detail: formatDistance(bundle.car.distanceM),
      },
      bike: {
        time: formatDuration(bundle.bike.durationS),
        detail: formatDistance(bundle.bike.distanceM),
      },
      moto: {
        time: formatDuration(bundle.moto.durationS),
        detail: formatDistance(bundle.moto.distanceM),
      },
      transit: {
        time: formatDuration(bundle.transit.durationS),
        detail: formatDistance(bundle.transit.distanceM),
      },
    };
  }

  function coordsPair(lat, lng) {
    return `${lng},${lat}`;
  }

  function haversineKm(aLat, aLng, bLat, bLng) {
    if (window.EcoColetaGeo && typeof window.EcoColetaGeo.haversineMeters === 'function') {
      return window.EcoColetaGeo.haversineMeters(aLat, aLng, bLat, bLng) / 1000;
    }
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const lat1 = (aLat * Math.PI) / 180;
    const lat2 = (bLat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function normalizeId(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  function inferCity(tags) {
    const raw =
      tags['addr:city'] ||
      tags['is_in:city'] ||
      tags['addr:municipality'] ||
      tags.city ||
      '';
    return String(raw || '').trim();
  }

  function addressFromTags(tags, cityFallback) {
    const street = tags['addr:street'] || tags.street || '';
    const number = tags['addr:housenumber'] || '';
    const neighbourhood = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags.neighbourhood || '';
    const city = inferCity(tags) || cityFallback || 'Cariri';
    const parts = [];
    if (street) parts.push(number ? `${street}, ${number}` : street);
    if (neighbourhood) parts.push(neighbourhood);
    parts.push(city);
    return parts.join(' • ');
  }

  function normalizeOsmEcoponto(el, index) {
    const tags = el.tags || {};
    const lat = typeof el.lat === 'number' ? el.lat : el.center && el.center.lat;
    const lng = typeof el.lon === 'number' ? el.lon : el.center && el.center.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;

    const city = inferCity(tags);
    const fallbackName = city ? `EcoPonto ${city}` : 'EcoPonto de reciclagem';
    const name = tags.name || tags.operator || fallbackName;
    return {
      id: `osm-${el.type}-${el.id || index}`,
      name: String(name).trim(),
      address: addressFromTags(tags, city),
      city,
      lat,
      lng,
      source: 'osm',
    };
  }

  function isValidMapPoint(p) {
    return (
      p &&
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      !Number.isNaN(p.lat) &&
      !Number.isNaN(p.lng) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lng) <= 180
    );
  }

  function normalizeMapPoint(p, source) {
    if (!isValidMapPoint(p)) return null;
    return {
      id: p.id || normalizeId(p.name) || `pev-${p.lat}-${p.lng}`,
      name: String(p.name || 'EcoPonto').trim(),
      address: String(p.address || p.city || '').trim(),
      city: String(p.city || '').trim(),
      lat: p.lat,
      lng: p.lng,
      source: source || p.source || 'catalog',
    };
  }

  function mergeEcopontoSources() {
    const merged = [];
    const seen = new Set();

    for (let s = 0; s < arguments.length; s += 1) {
      const source = arguments[s];
      if (!Array.isArray(source)) continue;
      source.forEach(function (raw) {
        const p = normalizeMapPoint(raw, raw && raw.source);
        if (!p) return;
        const key = `${p.id || ''}:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(p);
      });
    }

    return merged.sort(function (a, b) {
      const ca = (a.city || '').localeCompare(b.city || '', 'pt-BR');
      return ca || a.name.localeCompare(b.name, 'pt-BR');
    });
  }

  function readEcopontosCache() {
    try {
      const raw = sessionStorage.getItem(ECOPONTOS_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.points) || Date.now() - (data.t || 0) > ECOPONTOS_CACHE_MAX_AGE_MS) {
        return null;
      }
      return mergeEcopontoSources(data.points, FALLBACK_ECOPONTOS);
    } catch (eCacheRead) {
      return null;
    }
  }

  function writeEcopontosCache(points) {
    try {
      sessionStorage.setItem(
        ECOPONTOS_CACHE_KEY,
        JSON.stringify({ t: Date.now(), points: points })
      );
    } catch (eCacheWrite) {
    }
  }

  function ecopontosApiUrl() {
    if (typeof window.ecocoletaPhpUrl === 'function') {
      return window.ecocoletaPhpUrl('listar-ecopontos.php') + '?publico=1';
    }
    return projectRootUrl('api/listar-ecopontos.php?publico=1');
  }

  async function fetchEcopontosFromApi() {
    const res = await fetch(ecopontosApiUrl(), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('API ecopontos HTTP ' + res.status);
    }
    const raw = await res.text();
    const json = JSON.parse(raw.replace(/^\uFEFF/, '').trim());
    if (!json || json.sucesso !== true || !Array.isArray(json.ecopontos)) {
      throw new Error((json && json.erro) || 'Resposta inválida da API de ecopontos.');
    }
    return json.ecopontos.map(function (p) {
      return normalizeMapPoint(
        {
          id: p.id || p.catalog_id || ('pev-' + (p.id_pev || '')),
          name: p.name,
          address: p.address,
          city: p.city,
          lat: p.lat,
          lng: p.lng,
        },
        'api'
      );
    }).filter(Boolean);
  }

  async function fetchOsmEcopontosSupplement() {
    const b = CARIRI_BBOX;
    const query = `
      [out:json][timeout:12];
      (
        node["amenity"="recycling"](${b.south},${b.west},${b.north},${b.east});
        way["amenity"="recycling"](${b.south},${b.west},${b.north},${b.east});
        relation["amenity"="recycling"](${b.south},${b.west},${b.north},${b.east});
        node["recycling_type"](${b.south},${b.west},${b.north},${b.east});
        way["recycling_type"](${b.south},${b.west},${b.north},${b.east});
      );
      out center tags 80;
    `;

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }).toString(),
    });
    if (!res.ok) throw new Error('OpenStreetMap indisponível.');

    const data = await res.json();
    return Array.isArray(data.elements)
      ? data.elements.map(normalizeOsmEcoponto).filter(Boolean)
      : [];
  }

  async function loadEcopontos() {
    const cached = readEcopontosCache();
    if (cached && cached.length) {
      return cached;
    }

    let apiPoints = [];
    try {
      apiPoints = await fetchEcopontosFromApi();
    } catch (eApi) {
      apiPoints = [];
    }

    let osmPoints = [];
    try {
      osmPoints = await fetchOsmEcopontosSupplement();
    } catch (eOsm) {
      osmPoints = [];
    }

    const merged = mergeEcopontoSources(apiPoints, FALLBACK_ECOPONTOS, osmPoints);
    if (merged.length) {
      writeEcopontosCache(merged);
      return merged;
    }
    return FALLBACK_ECOPONTOS.slice();
  }

  function ensureRoutePane(leafletMap) {
    if (!leafletMap.getPane('ecoRoutePane')) {
      const pane = leafletMap.createPane('ecoRoutePane');

      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
    return 'ecoRoutePane';
  }

  function sanitizeRouteLatLngs(latlngs) {
    if (!Array.isArray(latlngs)) return [];
    const out = [];
    for (let i = 0; i < latlngs.length; i += 1) {
      const pt = latlngs[i];
      const lat = Array.isArray(pt) ? pt[0] : pt && pt.lat;
      const lng = Array.isArray(pt) ? pt[1] : pt && pt.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push([lat, lng]);
    }
    return out;
  }



  function addRoutePolylines(latlngs, layer, leafletMap, routePane) {
    const clean = sanitizeRouteLatLngs(latlngs);
    if (clean.length < 2 || !leafletMap) return null;

    const paneName = routePane || ensureRoutePane(leafletMap);
    const baseOpts = {
      pane: paneName,
      lineJoin: 'round',
      lineCap: 'round',
      interactive: false,
      smoothFactor: 1,
    };
    const glowOpts = {
      ...baseOpts,
      className: 'eco-route-line eco-route-line--glow',
      color: '#0a4d2a',
      weight: 9,
      opacity: 0.85,
    };
    const lineOpts = {
      ...baseOpts,
      className: 'eco-route-line',
      color: '#16a34a',
      weight: 5.5,
      opacity: 1,
    };

    let glow;
    let line;

    if (layer) {
      glow = L.polyline(clean, glowOpts);
      line = L.polyline(clean, lineOpts);
      layer.addLayer(glow);
      layer.addLayer(line);
    } else {
      glow = L.polyline(clean, glowOpts).addTo(leafletMap);
      line = L.polyline(clean, lineOpts).addTo(leafletMap);
    }

    if (typeof glow.redraw === 'function') glow.redraw();
    if (typeof line.redraw === 'function') line.redraw();
    if (typeof line.bringToFront === 'function') line.bringToFront();
    return { line, glow };
  }

  
  function setBackupRouteLine(latlngs, leafletMap) {
    const clean = sanitizeRouteLatLngs(latlngs);
    if (!leafletMap || clean.length < 2) return null;
    if (leafletMap._ecoBackupRouteLine) {
      try {
        leafletMap.removeLayer(leafletMap._ecoBackupRouteLine);
      } catch (eBackup) {
        
      }
    }
    const paneName = ensureRoutePane(leafletMap);
    leafletMap._ecoBackupRouteLine = L.polyline(clean, {
      pane: paneName,
      color: '#1a9e55',
      weight: 6,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
      interactive: false,
      className: 'eco-route-line',
    }).addTo(leafletMap);
    return leafletMap._ecoBackupRouteLine;
  }

  function isRouteLineOnMap(line) {
    return !!(line && line._map);
  }

  function fetchWithTimeout(url, ms) {
    const timeoutMs = typeof ms === 'number' ? ms : 12000;
    if (typeof AbortController === 'undefined') {
      return fetch(url);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  async function fetchOsrmRoute(profileKey, from, to) {
    const coords = `${coordsPair(from.lat, from.lng)};${coordsPair(to.lat, to.lng)}`;
    const aliases = PROFILE_ALIASES[profileKey] || [profileKey];
    let lastErr = null;

    for (let b = 0; b < OSRM_BASES.length; b++) {
      const base = OSRM_BASES[b];
      if (base.indexOf('openstreetmap.de') >= 0 && profileKey === 'foot') {
        continue;
      }
      const profileForBase = aliases;

      for (let i = 0; i < profileForBase.length; i++) {
        const profile = profileForBase[i];
        const url = `${base}/${profile}/${coords}?overview=full&geometries=geojson&steps=false`;
        try {
          const res = await fetchWithTimeout(url, 12000);
          if (!res.ok) {
            lastErr = new Error('Falha na rede de rotas.');
            continue;
          }
          const data = await res.json();
          if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const r = data.routes[0];
            return {
              duration: r.duration,
              distance: r.distance,
              geometry: r.geometry,
            };
          }
          lastErr = new Error('Não foi possível traçar a rota para estes pontos.');
        } catch (e) {
          lastErr = e && e.name === 'AbortError' ? new Error('Tempo esgotado ao buscar rota.') : e;
        }
      }
    }
    throw lastErr || new Error('Serviço de rotas indisponível.');
  }

  function latLngsForRoute(geometry, from, to) {
    let latlngs = geometryToLatLngs(geometry);
    if (latlngs.length >= 2) return latlngs;
    if (from && to && typeof from.lat === 'number' && typeof to.lat === 'number') {
      return [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ];
    }
    return latlngs;
  }

  function geometryToLatLngs(geometry) {
    if (!geometry || !geometry.coordinates) return [];
    return geometry.coordinates.map((c) => [c[1], c[0]]);
  }

  function cepDigitsOnly(value) {
    const d = String(value || '').replace(/\D/g, '');
    return d.length === 8 ? d : null;
  }

  function formatCep(cep8) {
    return `${cep8.slice(0, 5)}-${cep8.slice(5)}`;
  }

  async function fetchViaCep(cep8) {
    const res = await fetch(`https://viacep.com.br/ws/${cep8}/json/`);
    if (!res.ok) throw new Error('Não foi possível consultar o CEP.');
    const data = await res.json();
    if (data.erro) throw new Error('CEP não encontrado ou inválido.');
    return data;
  }

  function geocodeApiUrl(q, extra) {
    const params = new URLSearchParams();
    const query = String(q || '').trim();
    if (query) params.set('q', query);
    if (extra && typeof extra === 'object') {
      if (extra.rua) params.set('rua', String(extra.rua).trim());
      if (extra.bairro) params.set('bairro', String(extra.bairro).trim());
      if (extra.cidade) params.set('cidade', String(extra.cidade).trim());
    }
    const qs = params.toString();
    if (typeof window.ecocoletaPhpUrl === 'function') {
      const viaPhp = window.ecocoletaPhpUrl('geocode-nominatim.php');
      if (viaPhp) return `${viaPhp}?${qs}`;
    }
    return projectRootUrl(`api/geocode-nominatim.php?${qs}`);
  }

  function parseGeocodeHit(hit) {
    if (!hit || typeof hit !== 'object') return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon != null ? hit.lon : hit.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return {
      lat,
      lng,
      precision: String(hit.precision || 'exato'),
      displayName: String(hit.display_name || ''),
    };
  }

  async function geocodeEnderecoEstruturado(opts) {
    const options = opts || {};
    const rua = String(options.rua || options.address || '').trim();
    const bairro = String(options.bairro || '').trim();
    const cidade = String(options.cidade || '').trim();
    if (!rua && !bairro && !cidade) return null;

    try {
      const res = await fetchWithTimeout(
        geocodeApiUrl(rua, { rua, bairro, cidade }),
        18000
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsed = parseGeocodeHit(data[0]);
          if (parsed) return parsed;
        }
      }
    } catch (e) {
      
    }

    const tentativas = [];
    if (rua && bairro && cidade) tentativas.push(`${rua}, ${bairro}, ${cidade}, Brasil`);
    if (rua && cidade) tentativas.push(`${rua}, ${cidade}, Brasil`);
    if (bairro && cidade) tentativas.push(`${bairro}, ${cidade}, Brasil`);
    if (rua) tentativas.push(rua);

    for (let i = 0; i < tentativas.length; i++) {
      const geo = await nominatimGeocodeQuery(tentativas[i]);
      if (geo) {
        return {
          lat: geo.lat,
          lng: geo.lng,
          precision: 'exato',
          displayName: tentativas[i],
        };
      }
    }
    return null;
  }

  async function photonGeocodeQuery(q) {
    try {
      const res = await fetchWithTimeout(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=pt`,
        12000
      );
      if (!res.ok) return null;
      const data = await res.json();
      const feature = data && data.features && data.features[0];
      const coords = feature && feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng };
    } catch (e) {
      return null;
    }
  }

  async function nominatimGeocodeQuery(q) {
    const query = String(q || '').trim();
    if (!query) return null;

    try {
      const res = await fetchWithTimeout(geocodeApiUrl(query), 15000);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsed = parseGeocodeHit(data[0]);
          if (parsed) return parsed;
        }
      }
    } catch (e) {
      
    }

    return photonGeocodeQuery(query);
  }

  async function geocodeAddressFromViaCep(data, cep8) {
    const parts = [];
    if (data.logradouro) parts.push(data.logradouro);
    if (data.bairro) parts.push(data.bairro);
    parts.push(`${data.localidade}, ${data.uf}, Brasil`);

    let geo = await nominatimGeocodeQuery(parts.join(', '));
    if (!geo && data.localidade) {
      geo = await nominatimGeocodeQuery(`${data.localidade}, ${data.uf}, Brasil`);
    }
    if (!geo && data.localidade) {
      geo = await nominatimGeocodeQuery(`${cep8}, ${data.localidade}, ${data.uf}, Brasil`);
    }
    return geo;
  }

  const ecopontoIcon = L.divIcon({
    className: 'eco-marker',
    html: '<span class="eco-marker__symbol" aria-hidden="true"><span class="eco-marker__glyph">♻</span></span>',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
    tooltipAnchor: [0, -38],
  });

  
  const nearestEcopontoIcon = L.divIcon({
    className: 'eco-marker eco-marker--nearest',
    html:
      '<span class="eco-marker__nearest-badge" aria-hidden="true">Mais próximo</span>' +
      '<span class="eco-marker__symbol" aria-hidden="true"><span class="eco-marker__glyph">♻</span></span>',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -42],
  });



  function createRouteWidget(cfg) {
    let map = null;
    let routeLayer = null;
    let markersLayer = null;
    let routePaneName = null;
    let pendingUserPosition = null;
    let navigation = null;
    let currentOrigin = { ...DEFAULT_ORIGIN };
    let hasRouteOrigin = false;
    let manualOriginMode = false;
    let originDescription =
      '<strong>Sua partida</strong><br>Use o GPS ou o botão “Usar minha localização”.';
    let liveWatchId = null;
    let liveTrackingActive = false;
    let userOriginMarker = null;
    let userAccuracyCircle = null;
    let lastLiveUpdateAt = 0;
    let lastRouteRecalcAt = 0;
    let routeRecalcInFlight = false;
    let routeRecalcPending = false;
    let lastOsrmLatlngs = null;
    let routeGlowLine = null;
    let routeMainLine = null;
    let selectedTransportMode = 'car';
    let activeRouteDistanceM = 0;
    let activeRouteDurationS = 0;
    let lastRouteTimesByMode = null;
    let mapFollowUser = true;
    let lastMapPanAt = 0;
    let geoAutoRequested = false;
    let autoLocateOnInit = !!cfg.autoLocateOnInit;
    let autoRouteOnEcopontoSelect = cfg.autoRouteOnEcopontoSelect !== false;
    let autoNearestEnabled = cfg.autoNearestEcoponto !== false;
    const infoOnly = cfg.infoOnly === true;
    if (infoOnly) {
      autoLocateOnInit = false;
      autoRouteOnEcopontoSelect = false;
      autoNearestEnabled = false;
    }
    let infoOnlySelectedId = null;
    let nearestEcopontoId = null;
    let nearestRecalcTimer = null;
    const NEAREST_RECALC_DEBOUNCE_MS = 4000;
    let lastUserHeading = null;
    const LIVE_MIN_INTERVAL_MS = 1800;
    const LIVE_MIN_MOVE_M = 8;
    const ROUTE_PREVIEW_MIN_MOVE_M = 6;
    const ROUTE_RECALC_MIN_MOVE_M = 22;
    const ROUTE_RECALC_MIN_INTERVAL_MS = 18000;
    const MAP_PAN_MIN_INTERVAL_MS = 1100;
    const MAP_PAN_MIN_MOVE_M = 6;

    function setStatus(msg, isError) {
      const el = cfg.statusId ? $(cfg.statusId) : null;
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('is-error', !!isError);
    }

    function setRouteStatsVisible(visible) {
      const stats = cfg.routeStatsId ? $(cfg.routeStatsId) : null;
      if (stats) stats.classList.toggle('hidden', !visible);
    }

    function updateRouteStatsUI(distanceM, durationS) {
      const stats = cfg.routeStatsId ? $(cfg.routeStatsId) : null;
      if (!stats) return;
      const distEl = stats.querySelector('[data-route-dist]') || $('mapa-route-dist');
      const etaEl = stats.querySelector('[data-route-eta]') || $('mapa-route-eta');
      if (distEl) {
        distEl.textContent = `Distância restante: ${formatDistance(distanceM)}`;
      }
      if (etaEl) {
        etaEl.textContent = `Tempo estimado: ~${formatDuration(durationS)}`;
      }
      setRouteStatsVisible(true);
    }

    function getSelectedModeRouteStats(pos) {
      if (!lastRouteTimesByMode) return null;
      const base =
        lastRouteTimesByMode[selectedTransportMode] || lastRouteTimesByMode.car;
      if (!base) return null;
      const latlngs = lastOsrmLatlngs;
      if (pos && latlngs && latlngs.length >= 2 && base.distanceM > 0) {
        return estimateRemainingOnRoute(pos, latlngs, base.distanceM, base.durationS);
      }
      return { distanceM: base.distanceM, durationS: base.durationS };
    }

    function updateRemainingRouteStatsFromPosition(pos) {
      if (!hasRouteOrigin || !pos) return;
      const stats = getSelectedModeRouteStats(pos);
      if (!stats) return;
      updateRouteStatsUI(stats.distanceM, stats.durationS);
    }

    function checkGeoSecurityContext() {
      const Geo = window.EcoColetaGeo;
      if (Geo && typeof Geo.isSecureContextForGeo === 'function' && !Geo.isSecureContextForGeo()) {
        setStatus(Geo.getInsecureContextMessage(), true);
        return false;
      }
      return true;
    }

    function panToUserIfFollowing(pos, movedM) {
      if (!map || !mapFollowUser || !hasRouteOrigin || !pos) return;
      if (navigation && typeof navigation.isActive === 'function' && navigation.isActive()) {
        return;
      }
      const now = Date.now();
      const move = typeof movedM === 'number' ? movedM : MAP_PAN_MIN_MOVE_M;
      if (lastMapPanAt && now - lastMapPanAt < MAP_PAN_MIN_INTERVAL_MS && move < MAP_PAN_MIN_MOVE_M) {
        return;
      }
      lastMapPanAt = now;
      map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.4, noMoveStart: true });
    }

    function setSelectedTransportMode(mode) {
      if (!TRANSPORT_MODE_KEYS.includes(mode)) return;
      selectedTransportMode = mode;
      document.querySelectorAll('.mapa-mode-btn[data-mode]').forEach((btn) => {
        const isActive = btn.getAttribute('data-mode') === mode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      window.dispatchEvent(
        new CustomEvent('ecocoleta:transport-mode', { detail: { mode } })
      );
      if (lastRouteTimesByMode) {
        updateRemainingRouteStatsFromPosition(currentOrigin);
      }
      if (hasRouteOrigin) {
        drawPreviewRouteToDest({ fit: false });
        void calcularRota({ force: true });
      }
    }

    function fillSelect() {
      const sel = $(cfg.selectId);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = ECOPONTOS.map(
        (p) => `<option value="${p.id}">${p.name} — ${p.city || p.address}</option>`
      ).join('');
      if (prev && ECOPONTOS.some((p) => p.id === prev)) {
        sel.value = prev;
      }
    }

    function publishEcopontos() {
      const points = ECOPONTOS.map((p) => ({ ...p }));
      window.EcoColetaEcopontos = points;
      window.dispatchEvent(new CustomEvent('ecocoleta:ecopontos-loaded', {
        detail: { ecopontos: points },
      }));
    }

    function publishSelectedEcoponto(dest) {
      if (!dest) return;
      infoOnlySelectedId = dest.id || null;
      const sel = $(cfg.selectId);
      if (sel && dest.id) {
        sel.value = dest.id;
      }
      window.dispatchEvent(new CustomEvent('ecocoleta:ecoponto-selected', {
        detail: { ecoponto: { ...dest }, id: dest.id },
      }));
    }

    function renderInfoEcopontosMap(highlightPonto) {
      if (!map || !markersLayer) return;
      if (navigation && navigation.isActive && navigation.isActive()) {
        navigation.stopNavigation();
      }
      stopLiveLocationWatch();
      setFollowBtnVisible(false);
      clearRoutePolylines();
      markersLayer.clearLayers();
      clearUserMarkerRefs();
      const panel = cfg.timesPanelId ? $(cfg.timesPanelId) : null;
      if (panel) panel.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('ecocoleta:route-times-clear'));

      const bounds = [];
      ECOPONTOS.forEach((p) => {
        const highlighted = highlightPonto && highlightPonto.id === p.id;
        L.marker([p.lat, p.lng], {
          icon: ecopontoIcon,
          zIndexOffset: highlighted ? 400 : 0,
        })
          .addTo(markersLayer)
          .bindTooltip(p.name, {
            direction: 'top',
            offset: [0, -8],
            opacity: 1,
            className: 'eco-marker-tooltip',
          })
          .bindPopup(`<strong>${p.name}</strong><br>${p.address || p.city || ''}`)
          .on('click', () => onUserPickEcoponto(p));
        bounds.push([p.lat, p.lng]);
      });

      if (bounds.length) {
        if (highlightPonto) {
          map.setView([highlightPonto.lat, highlightPonto.lng], Math.max(map.getZoom(), 14), {
            animate: true,
          });
        } else {
          map.fitBounds(L.latLngBounds(bounds), {
            padding: [48, 48],
            maxZoom: 12,
            animate: true,
          });
        }
        window.requestAnimationFrame(function () {
          map.invalidateSize({ pan: false });
        });
      }

      if (highlightPonto) {
        setStatus(
          `${highlightPonto.name}${highlightPonto.city ? ' — ' + highlightPonto.city : ''}. Veja horários e materiais aceitos ao lado.`
        );
      } else {
        setStatus(
          `${ECOPONTOS.length} ecopontos no mapa. Clique em um marcador para ver os detalhes.`
        );
      }
    }

    function getSelectedPonto() {
      const sel = $(cfg.selectId);
      const id = sel
        ? sel.value
        : infoOnlySelectedId || (ECOPONTOS[0] && ECOPONTOS[0].id);
      return ECOPONTOS.find((p) => p.id === id) || ECOPONTOS[0];
    }



    function findNearestEcoponto(pos) {
      if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return null;
      let best = null;
      let bestMeters = Infinity;
      for (let i = 0; i < ECOPONTOS.length; i += 1) {
        const p = ECOPONTOS[i];
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
        const meters = haversineKm(pos.lat, pos.lng, p.lat, p.lng) * 1000;
        if (meters < bestMeters) {
          bestMeters = meters;
          best = p;
        }
      }
      return best ? { ponto: best, distanceM: bestMeters } : null;
    }



    function updateNearestSelection(pos) {
      if (!autoNearestEnabled || !pos) return null;
      const nearest = findNearestEcoponto(pos);
      if (!nearest) return null;
      const sel = $(cfg.selectId);
      const currentId = sel ? sel.value : nearestEcopontoId;
      const changed = nearest.ponto.id !== currentId;
      nearestEcopontoId = nearest.ponto.id;
      if (changed) {
        if (sel) sel.value = nearest.ponto.id;
        publishSelectedEcoponto(nearest.ponto);
      }
      return { ponto: nearest.ponto, distanceM: nearest.distanceM, changed };
    }

    
    function scheduleNearestRecalc() {
      if (nearestRecalcTimer) window.clearTimeout(nearestRecalcTimer);
      nearestRecalcTimer = window.setTimeout(function () {
        nearestRecalcTimer = null;
        if (!hasRouteOrigin) return;
        drawPreviewRouteToDest({ fit: false });
        void calcularRota({ force: true });
      }, NEAREST_RECALC_DEBOUNCE_MS);
    }

    
    function onUserPickEcoponto(p) {
      if (!p) return;
      if (infoOnly) {
        publishSelectedEcoponto(p);
        renderInfoEcopontosMap(p);
        return;
      }
      autoNearestEnabled = false;
      if (nearestRecalcTimer) {
        window.clearTimeout(nearestRecalcTimer);
        nearestRecalcTimer = null;
      }
      publishSelectedEcoponto(p);
      if (hasRouteOrigin) {
        drawPreviewRouteToDest();
        void calcularRota({ force: true });
      } else {
        showMapWithoutRoute();
      }
    }

    function initMap() {
      const isHomeEmbed = document.body.classList.contains('home');
      const mapEl = document.getElementById(cfg.mapElId);
      const mapWrap = mapEl?.closest('.mapa-leaflet-wrap');
      if (mapWrap) {
        void mapWrap.offsetWidth;
        void mapWrap.offsetHeight;
      }
      map = L.map(cfg.mapElId, {
        zoomControl: !isHomeEmbed,
        scrollWheelZoom: true,
      }).setView([CARIRI_MAP_CENTER.lat, CARIRI_MAP_CENTER.lng], 10);

      if (isHomeEmbed) {
        const preferBottomZoom =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(max-width: 720px)').matches;
        if (preferBottomZoom && mapWrap) {
          mapWrap.classList.add('mapa-leaflet-wrap--zoom-bottom');
        }
        L.control
          .zoom({ position: preferBottomZoom ? 'bottomright' : 'topright' })
          .addTo(map);
      }

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      routePaneName = ensureRoutePane(map);
      routeLayer = L.layerGroup().addTo(map);
      markersLayer = L.layerGroup().addTo(map);


      map.on('click', function (e) {
        if (!e || !e.latlng) return;
        if (hasRouteOrigin && !manualOriginMode) return;
        manualOriginMode = false;
        applyUserPosition(
          { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null },
          { manual: true }
        );
      });

      if (pendingUserPosition) {
        const queued = pendingUserPosition;
        pendingUserPosition = null;
        applyUserPosition(queued);
      }

      if (document.body.classList.contains('home')) {
        window.dispatchEvent(new CustomEvent('ecocoleta:home-map-ready'));
      }

      if (isHomeEmbed) {
        map.whenReady(function () {
          invalidateSize();
          scheduleMapResizePasses();
        });
      }
    }

  const GPS_STORAGE_KEY = 'ecocoleta_last_gps';
  const GPS_MAX_AGE_MS = 10 * 60 * 1000;

  function saveLastGps(pos) {
    try {
      sessionStorage.setItem(
        GPS_STORAGE_KEY,
        JSON.stringify({
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          t: Date.now(),
        })
      );
    } catch (eStorage) {
      
    }
  }

  function clearLastGps() {
    try {
      sessionStorage.removeItem(GPS_STORAGE_KEY);
    } catch (eClear) {
      
    }
  }

  function isSuspiciousEcopontoGuess(pos) {
    if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return false;
    const acc = Number.isFinite(pos.accuracy) ? pos.accuracy : null;

    if (acc == null || acc <= 0) return false;

    if (acc < 4000) return false;
    for (let i = 0; i < ECOPONTOS.length; i += 1) {
      const p = ECOPONTOS[i];
      const meters = haversineKm(pos.lat, pos.lng, p.lat, p.lng) * 1000;
      if (meters <= 5) return true;
    }
    return false;
  }

  function loadLastGps() {
    try {
      const raw = sessionStorage.getItem(GPS_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || Date.now() - data.t > GPS_MAX_AGE_MS) return null;
      const pos = {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
      };
      if (window.EcoColetaGeo && typeof window.EcoColetaGeo.validatePosition === 'function') {
        const check = window.EcoColetaGeo.validatePosition(pos, { allowApproximate: true });
        if (!check.ok) return null;
      }
      return pos;
    } catch (eLoad) {
      return null;
    }
  }

  function focusSelectedEcoponto(dest) {
    const p = dest || getSelectedPonto();
    if (!p || !map) return;
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 13), { animate: true });
  }

    function showMapWithoutRoute(statusMessage) {
    if (hasRouteOrigin) {
      if (statusMessage) setStatus(statusMessage);
      return;
    }
    if (!map || !routeLayer || !markersLayer) {
      if (statusMessage) setStatus(statusMessage);
      return;
    }
    const panel = cfg.timesPanelId ? $(cfg.timesPanelId) : null;
    if (navigation && navigation.isActive && navigation.isActive()) {
      navigation.stopNavigation();
    }
    if (!hasRouteOrigin) {
      stopLiveLocationWatch();
    }
    setFollowBtnVisible(false);
    clearRoutePolylines();
    markersLayer.clearLayers();
    clearUserMarkerRefs();
    if (panel) panel.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('ecocoleta:route-times-clear'));

    const bounds = [];
    ECOPONTOS.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: ecopontoIcon })
        .addTo(markersLayer)
        .bindTooltip(p.name, {
          direction: 'top',
          offset: [0, -8],
          opacity: 1,
          className: 'eco-marker-tooltip',
        })
        .bindPopup(`<strong>${p.name}</strong><br>${p.address}`)
        .on('click', () => onUserPickEcoponto(p));
      bounds.push([p.lat, p.lng]);
    });

    const dest = getSelectedPonto();
    if (dest) {
      L.marker([dest.lat, dest.lng], { icon: ecopontoIcon, zIndexOffset: 200 })
        .addTo(markersLayer)
        .bindTooltip('Destino: ' + dest.name, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 8],
          className: 'eco-marker-tooltip',
        });
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [72, 72], maxZoom: 12 });
    }
    focusSelectedEcoponto(dest);

    setStatus(
      statusMessage ||
        'Toque em “Atualizar minha localização” para traçar a rota a partir de onde você está — ou toque no mapa para marcar seu ponto de partida.'
    );
    setRefreshLocationVisible(true);
  }

    function clearRoutePolylines() {
      if (routeGlowLine && map) {
        try {
          map.removeLayer(routeGlowLine);
        } catch (eGlow) {
          
        }
      }
      if (routeMainLine && map) {
        try {
          map.removeLayer(routeMainLine);
        } catch (eLine) {
          
        }
      }
      if (map && map._ecoBackupRouteLine) {
        try {
          map.removeLayer(map._ecoBackupRouteLine);
        } catch (eBackup) {
          
        }
        map._ecoBackupRouteLine = null;
      }
      routeGlowLine = null;
      routeMainLine = null;
      if (routeLayer) routeLayer.clearLayers();
    }

    function routeLayerHasLines() {
      return isRouteLineOnMap(routeMainLine);
    }

    function syncPreviewRouteToDest() {

      if (!map || !hasRouteOrigin) return;
      if (userOriginMarker && currentOrigin && typeof currentOrigin.lat === 'number') {
        try {
          userOriginMarker.setLatLng([currentOrigin.lat, currentOrigin.lng]);
        } catch (e) {
          
        }
      }
    }

    
    function drawRoute(latlngs, dest, drawOpts) {
      if (!map || !routeLayer || !dest) {
        setStatus('Mapa ainda não está pronto para exibir a rota. Aguarde um instante.', true);
        return false;
      }
      const shouldFit = !(drawOpts && drawOpts.fit === false);

      const origin = currentOrigin;
      if (!Array.isArray(latlngs) || latlngs.length < 2) {
        latlngs = latLngsForRoute(null, origin, dest);
      }
      latlngs = sanitizeRouteLatLngs(latlngs);
      if (latlngs.length < 2) {
        const msg = 'Coordenadas insuficientes para traçar a rota até o ecoponto.';
        console.warn('drawRoute:', msg);
        setStatus(msg, true);
        return false;
      }

      clearRoutePolylines();
      markersLayer.clearLayers();

      const originDesc = originDescription;
      const acc =
        typeof origin.accuracy === 'number' && Number.isFinite(origin.accuracy)
          ? origin.accuracy
          : null;

      clearUserMarkerRefs();
      if (acc != null && acc > 0 && acc < 8000) {
        userAccuracyCircle = L.circle([origin.lat, origin.lng], {
          radius: acc,
          color: '#1a73e8',
          fillColor: '#1a73e8',
          fillOpacity: 0.1,
          weight: 1,
          dashArray: '5 8',
        }).addTo(markersLayer);
      }

      userOriginMarker = createUserPositionMarker([origin.lat, origin.lng], lastUserHeading)
        .addTo(markersLayer)
        .bindTooltip('Você está aqui', {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'eco-user-tooltip',
        })
        .bindPopup(originDesc || '<strong>Você está aqui</strong>');

      const routePolys = addRoutePolylines(latlngs, null, map, routePaneName);
      if (!routePolys || !routePolys.line) {
        setStatus(
          'Não foi possível desenhar a linha da rota no mapa. Toque em “Atualizar minha localização”.',
          true
        );
        return false;
      }
      routeGlowLine = routePolys.glow;
      routeMainLine = routePolys.line;
      setBackupRouteLine(latlngs, map);

      const destIsNearest = autoNearestEnabled && nearestEcopontoId === dest.id;
      L.marker([dest.lat, dest.lng], {
        icon: destIsNearest ? nearestEcopontoIcon : ecopontoIcon,
        zIndexOffset: destIsNearest ? 300 : 0,
      })
        .addTo(markersLayer)
        .bindTooltip(destIsNearest ? `Mais próximo: ${dest.name}` : dest.name, {
          direction: 'top',
          offset: [0, -8],
          opacity: 1,
          className: 'eco-marker-tooltip',
        })
        .bindPopup(`<strong>${dest.name}</strong><br>${dest.address}`)
        .on('click', () => onUserPickEcoponto(dest));

      if (shouldFit) {
        try {
          const size = map.getSize();
          if (size && size.x > 0 && size.y > 0) {
            const bounds = routeMainLine
              .getBounds()
              .extend([origin.lat, origin.lng])
              .extend([dest.lat, dest.lng]);
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          }
        } catch (eBounds) {
          map.setView([origin.lat, origin.lng], Math.max(map.getZoom(), 14));
        }
        window.setTimeout(function () {
          if (map) map.invalidateSize();
        }, 80);
        window.setTimeout(function () {
          if (map) map.invalidateSize();
        }, 350);
      }
      if (routeMainLine && typeof routeMainLine.redraw === 'function') {
        routeMainLine.redraw();
      }
      return isRouteLineOnMap(routeMainLine);
    }

    function setFollowBtnVisible(visible) {
      const btn = cfg.mapFollowBtnId ? $(cfg.mapFollowBtnId) : null;
      if (!btn) return;
      btn.classList.toggle('hidden', !visible);
    }

    function hideStaticRouteForNavigation() {
      clearRoutePolylines();
      markersLayer.clearLayers();
      clearUserMarkerRefs();
    }

    function clearUserMarkerRefs() {
      if (userOriginMarker && markersLayer) {
        try {
          markersLayer.removeLayer(userOriginMarker);
        } catch (eRemoveMarker) {
          
        }
      }
      if (userAccuracyCircle && markersLayer) {
        try {
          markersLayer.removeLayer(userAccuracyCircle);
        } catch (eRemoveCircle) {
          
        }
      }
      userOriginMarker = null;
      userAccuracyCircle = null;
    }

    function createUserPositionMarker(ll, heading) {
      const hasHeading =
        typeof heading === 'number' && Number.isFinite(heading) && heading >= 0;
      if (hasHeading) {
        const rot = Math.round(heading);
        return L.marker(ll, {
          icon: L.divIcon({
            className: 'eco-user-marker eco-user-marker--heading',
            html:
              '<span class="eco-user-marker__dot" aria-hidden="true"></span>' +
              '<span class="eco-user-marker__cone" style="transform:rotate(' +
              rot +
              'deg)" aria-hidden="true"></span>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          zIndexOffset: 900,
        });
      }
      return L.marker(ll, {
        icon: L.divIcon({
          className: 'eco-user-marker',
          html:
            '<span class="eco-user-marker__pulse" aria-hidden="true"></span>' +
            '<span class="eco-user-marker__dot" aria-hidden="true"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: 900,
      });
    }

    function setLocateBtnTracking(active) {
      const ids = [cfg.mapLocateBtnId, cfg.locateBtnId, cfg.refreshLocationBtnId].filter(Boolean);
      ids.forEach((id) => {
        const el = $(id);
        if (el) el.classList.toggle('is-tracking', !!active);
      });
    }

    function publishUserPosition(pos, extra) {
      if (!pos) return;
      window.dispatchEvent(
        new CustomEvent('ecocoleta:user-position', {
          detail: Object.assign({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }, extra || {}),
        })
      );
    }

    function trimRouteLatlngsAheadOfUser(latlngs, userPos) {
      if (!latlngs || latlngs.length < 2 || !userPos) return latlngs;
      const snap = closestOnRoutePolyline(userPos.lat, userPos.lng, latlngs);
      if (!Number.isFinite(snap.traveledMeters) || snap.traveledMeters <= 0) {
        return latlngs;
      }
      let cum = 0;
      const trimmed = [[userPos.lat, userPos.lng]];
      for (let i = 0; i < latlngs.length - 1; i++) {
        const a = latlngs[i];
        const b = latlngs[i + 1];
        const segLen = haversineKm(a[0], a[1], b[0], b[1]) * 1000;
        const segStart = cum;
        const segEnd = cum + segLen;
        if (segEnd <= snap.traveledMeters) {
          cum = segEnd;
          continue;
        }
        if (segStart < snap.traveledMeters) {
          trimmed.push(b);
        } else {
          if (trimmed.length === 1) trimmed.push(a);
          trimmed.push(b);
        }
        cum = segEnd;
      }
      return sanitizeRouteLatLngs(trimmed.length >= 2 ? trimmed : latlngs);
    }

    function updateRouteLineFromLivePosition(pos) {
      if (!lastOsrmLatlngs || lastOsrmLatlngs.length < 2 || !pos) return;
      const trimmed = trimRouteLatlngsAheadOfUser(lastOsrmLatlngs, pos);
      if (trimmed.length < 2) return;
      if (routeGlowLine && routeMainLine) {
        routeGlowLine.setLatLngs(trimmed);
        routeMainLine.setLatLngs(trimmed);
        if (typeof routeMainLine.redraw === 'function') routeMainLine.redraw();
      }
      if (map && map._ecoBackupRouteLine) {
        map._ecoBackupRouteLine.setLatLngs(trimmed);
      }
    }

    function createUserOriginMarker(pos, approximate) {
      if (!map || !markersLayer || !pos) return null;
      const ll = [pos.lat, pos.lng];
      const popupHtml = describeOriginFromPosition(pos, approximate);
      const acc =
        typeof pos.accuracy === 'number' && Number.isFinite(pos.accuracy) ? pos.accuracy : null;

      if (acc != null && acc > 0 && acc < 8000) {
        userAccuracyCircle = L.circle(ll, {
          radius: acc,
          color: '#1a73e8',
          fillColor: '#1a73e8',
          fillOpacity: 0.1,
          weight: 1,
          dashArray: '5 8',
        }).addTo(markersLayer);
      }

      userOriginMarker = createUserPositionMarker(ll, lastUserHeading)
        .addTo(markersLayer)
        .bindTooltip('Você está aqui', {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'eco-user-tooltip',
        })
        .bindPopup(popupHtml || '<strong>Você está aqui</strong>');

      return userOriginMarker;
    }

    function updateLiveDistanceStatus() {
      if (!hasRouteOrigin) return;
      const dest = getSelectedPonto();
      if (!dest) return;
      updateRemainingRouteStatsFromPosition(currentOrigin);
      const distM = metersBetween(currentOrigin, dest);
      const suffix = liveTrackingStatusSuffix();
      const modeLabel = TRANSPORT_MODE_LABELS[selectedTransportMode] || 'de carro';
      setStatus(
        `Rota ${modeLabel} até ${dest.name} · linha reta ${formatDistance(distM)}${suffix}`
      );
    }

    function liveTrackingStatusSuffix() {
      return liveTrackingActive ? ' · Localização em tempo real ativa' : '';
    }

    function stopLiveLocationWatch() {
      const Geo = window.EcoColetaGeo;
      if (liveWatchId != null) {
        if (Geo && typeof Geo.clearWatch === 'function') {
          Geo.clearWatch(liveWatchId);
        } else if (navigator.geolocation) {
          navigator.geolocation.clearWatch(liveWatchId);
        }
      }
      liveWatchId = null;
      liveTrackingActive = false;
      setLocateBtnTracking(false);
    }

    function metersBetween(a, b) {
      if (!a || !b) return 0;
      const Geo = window.EcoColetaGeo;
      if (Geo && typeof Geo.haversineMeters === 'function') {
        return Geo.haversineMeters(a.lat, a.lng, b.lat, b.lng);
      }
      return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
    }

    function acceptLivePosition(pos) {
      if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return null;
      const Geo = window.EcoColetaGeo;
      let approximate = false;
      if (Geo && typeof Geo.validatePosition === 'function') {
        const check = Geo.validatePosition(pos, { allowApproximate: true });
        if (!check.ok) return null;
        approximate = !!check.approximate;
      }
      if (isSuspiciousEcopontoGuess(pos)) return null;
      return { pos, approximate };
    }

    function updateUserMarkerOnMap(pos, approximate) {
      if (!map || !markersLayer || !pos) return;
      const ll = [pos.lat, pos.lng];
      const popupHtml = describeOriginFromPosition(pos, approximate);
      const heading =
        typeof pos.heading === 'number' && Number.isFinite(pos.heading) ? pos.heading : null;
      if (heading != null) lastUserHeading = heading;

      if (!userOriginMarker) {
        createUserOriginMarker(pos, approximate);
        return;
      }

      const needsHeadingMarker =
        heading != null &&
        userOriginMarker.options &&
        userOriginMarker.options.icon &&
        String(userOriginMarker.options.icon.options.className || '').includes('heading');
      const isCircle = typeof userOriginMarker.setRadius === 'function';

      if ((heading != null && isCircle) || (heading == null && needsHeadingMarker)) {
        if (markersLayer && userOriginMarker) {
          try {
            markersLayer.removeLayer(userOriginMarker);
          } catch (eRem) {
            
          }
        }
        userOriginMarker = null;
        createUserOriginMarker(pos, approximate);
        return;
      }

      userOriginMarker.setLatLng(ll);
      if (typeof userOriginMarker.setPopupContent === 'function') {
        userOriginMarker.setPopupContent(popupHtml);
      }
      if (needsHeadingMarker && userOriginMarker._icon) {
        const cone = userOriginMarker._icon.querySelector('.eco-user-marker__cone');
        if (cone) cone.style.transform = 'rotate(' + Math.round(heading) + 'deg)';
      }
      const acc =
        typeof pos.accuracy === 'number' && Number.isFinite(pos.accuracy) ? pos.accuracy : null;
      if (acc != null && acc > 0 && acc < 8000) {
        if (userAccuracyCircle) {
          userAccuracyCircle.setLatLng(ll);
          userAccuracyCircle.setRadius(acc);
        } else {
          userAccuracyCircle = L.circle(ll, {
            radius: acc,
            color: '#1a73e8',
            fillColor: '#1a73e8',
            fillOpacity: 0.1,
            weight: 1,
            dashArray: '5 8',
          }).addTo(markersLayer);
        }
      }
    }

    function onLivePositionUpdate(pos) {
      if (!hasRouteOrigin || !map) return;
      if (navigation && typeof navigation.isActive === 'function' && navigation.isActive()) {
        return;
      }

      const accepted = acceptLivePosition(pos);
      if (!accepted) return;

      const now = Date.now();
      const prev = currentOrigin;
      const movedM = prev && typeof prev.lat === 'number' ? metersBetween(prev, pos) : LIVE_MIN_MOVE_M;
      const elapsed = now - lastLiveUpdateAt;
      if (lastLiveUpdateAt && elapsed < LIVE_MIN_INTERVAL_MS && movedM < LIVE_MIN_MOVE_M) {
        return;
      }

      lastLiveUpdateAt = now;
      if (typeof pos.heading === 'number' && Number.isFinite(pos.heading)) {
        lastUserHeading = pos.heading;
      }
      currentOrigin = {
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        heading: pos.heading,
      };
      originDescription = describeOriginFromPosition(pos, accepted.approximate);
      saveLastGps(pos);
      updateUserMarkerOnMap(pos, accepted.approximate);


      const nearest = updateNearestSelection(pos);
      if (nearest && nearest.changed) {
        setStatus(
          `EcoPonto mais próximo agora é ${nearest.ponto.name} (${formatDistance(nearest.distanceM)} em linha reta). Atualizando rota…`
        );
        scheduleNearestRecalc();
      }

      updateRouteLineFromLivePosition(pos);
      updateLiveDistanceStatus();
      panToUserIfFollowing(pos, movedM);
      publishUserPosition(pos, { live: true, approximate: accepted.approximate });
      setLocateBtnTracking(true);

      const needsPreview =
        !routeLayerHasLines() || movedM >= ROUTE_PREVIEW_MIN_MOVE_M;
      if (needsPreview) {
        syncPreviewRouteToDest({ fit: false });
      }

      const routeElapsed = now - lastRouteRecalcAt;
      if (
        !(nearest && nearest.changed) &&
        movedM >= ROUTE_RECALC_MIN_MOVE_M &&
        routeElapsed >= ROUTE_RECALC_MIN_INTERVAL_MS &&
        !routeRecalcInFlight
      ) {
        lastRouteRecalcAt = now;
        void calcularRota({ force: true });
      }
    }

    function startLiveLocationWatch() {
      stopLiveLocationWatch();
      if (!checkGeoSecurityContext()) return;
      if (!navigator.geolocation || !hasRouteOrigin) return;
      if (navigation && typeof navigation.isActive === 'function' && navigation.isActive()) {
        return;
      }

      const Geo = window.EcoColetaGeo;
      const watchOpts = { enableHighAccuracy: true, maximumAge: 2000, timeout: 25000 };

      const onWatchError = (err) => {
        if (!err) return;
        const msg =
          (Geo && typeof Geo.mapGeolocationError === 'function'
            ? Geo.mapGeolocationError(err)
            : null) || err.message;
        if (msg) {
          setStatus(msg, true);
        }
      };

      if (Geo && typeof Geo.watchPosition === 'function') {
        liveWatchId = Geo.watchPosition(
          (p) => onLivePositionUpdate(p),
          onWatchError,
          watchOpts
        );
      } else {
        liveWatchId = navigator.geolocation.watchPosition(
          (position) => {
            onLivePositionUpdate({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading:
                typeof position.coords.heading === 'number' &&
                !Number.isNaN(position.coords.heading)
                  ? position.coords.heading
                  : null,
              speed: position.coords.speed,
            });
          },
          onWatchError,
          watchOpts
        );
      }

      liveTrackingActive = liveWatchId != null;
      setLocateBtnTracking(liveTrackingActive);
      if (liveTrackingActive) {
        updateLiveDistanceStatus();
        setStatus(
          (function () {
            const dest = getSelectedPonto();
            const base = dest
              ? `Localização em tempo real ativa — acompanhando distância até ${dest.name}.`
              : 'Localização em tempo real ativa — o marcador azul acompanha você no mapa.';
            return base + liveTrackingStatusSuffix();
          })()
        );
      }
    }

    function showAllEcopontos(statusMessage) {
      const panel = cfg.timesPanelId ? $(cfg.timesPanelId) : null;
      if (navigation && navigation.isActive && navigation.isActive()) {
        navigation.stopNavigation();
      }
      setFollowBtnVisible(false);
      clearRoutePolylines();
      markersLayer.clearLayers();
      if (panel) panel.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('ecocoleta:route-times-clear'));

      const bounds = [];
      ECOPONTOS.forEach((p) => {
        L.marker([p.lat, p.lng], { icon: ecopontoIcon })
          .addTo(markersLayer)
          .bindTooltip(p.name, {
            direction: 'top',
            offset: [0, -8],
            opacity: 1,
            className: 'eco-marker-tooltip',
          })
          .bindPopup(`<strong>${p.name}</strong><br>${p.address}`)
          .on('click', () => onUserPickEcoponto(p));
        bounds.push([p.lat, p.lng]);
      });

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [72, 72], maxZoom: 11 });
      }

      setStatus(
        statusMessage ||
          'Use sua localização para traçar a rota. Enquanto isso, exibimos ecopontos de Juazeiro, Crato, Barbalha, Missão Velha e cidades próximas.'
      );
    }

    function drawPreviewRouteToDest(previewOpts) {
      syncPreviewRouteToDest(previewOpts || { fit: true });
    }

    async function calcularRota(options) {
      if (infoOnly) return;
      const force = !!(options && options.force);
      if (!map || !routeLayer) return;

      const dest = getSelectedPonto();
      const panel = cfg.timesPanelId ? $(cfg.timesPanelId) : null;

      if (!dest) {
        setStatus('Nenhum ecoponto disponível no mapa.', true);
        return;
      }

      if (!hasRouteOrigin) {
        showMapWithoutRoute();
        return;
      }

      if (routeRecalcInFlight) {
        if (force) routeRecalcPending = true;
        if (hasRouteOrigin && !routeLayerHasLines()) {
          drawPreviewRouteToDest();
        }
        return;
      }
      routeRecalcInFlight = true;

      if (!routeLayerHasLines()) {
        drawPreviewRouteToDest();
      }

      setStatus('Calculando rota a partir da sua localização…');

      try {
        const RouteSvc = window.EcoColetaRoute;
        let carRoute;
        let footRoute;
        let bikeRoute;

        if (RouteSvc && typeof RouteSvc.fetchRoute === 'function') {
          const results = await Promise.allSettled([
            RouteSvc.fetchRoute('car', currentOrigin, dest, { steps: false }),
            RouteSvc.fetchRoute('walk', currentOrigin, dest, { steps: false }),
            RouteSvc.fetchRoute('bike', currentOrigin, dest, { steps: false }),
          ]);
          carRoute = results[0].status === 'fulfilled' ? results[0].value : null;
          footRoute = results[1].status === 'fulfilled' ? results[1].value : null;
          bikeRoute = results[2].status === 'fulfilled' ? results[2].value : null;
        }

        if (!carRoute) {
          const legacy = await fetchOsrmRoute('car', currentOrigin, dest);
          carRoute = {
            distance: legacy.distance,
            duration: legacy.duration,
            geometry: legacy.geometry,
            latlngs: latLngsForRoute(legacy.geometry, currentOrigin, dest),
          };
        }
        if (!footRoute) {
          try {
            const legacyFoot = await fetchOsrmRoute('foot', currentOrigin, dest);
            footRoute = {
              distance: legacyFoot.distance,
              duration: legacyFoot.duration,
              geometry: legacyFoot.geometry,
              latlngs: latLngsForRoute(legacyFoot.geometry, currentOrigin, dest),
            };
          } catch (footErr) {
            console.warn(footErr);
            footRoute = {
              distance: carRoute.distance * 1.25,
              duration: carRoute.duration * 1.6,
              latlngs: null,
            };
          }
        }
        if (!bikeRoute) {
          try {
            const legacyBike = await fetchOsrmRoute('bike', currentOrigin, dest);
            bikeRoute = {
              distance: legacyBike.distance,
              duration: legacyBike.duration,
              geometry: legacyBike.geometry,
              latlngs: latLngsForRoute(legacyBike.geometry, currentOrigin, dest),
            };
          } catch (bikeErr) {
            console.warn(bikeErr);
            bikeRoute = {
              distance: carRoute.distance * 1.08,
              duration: carRoute.duration * 1.35,
              latlngs: null,
            };
          }
        }

        const activeRoute =
          selectedTransportMode === 'walk'
            ? footRoute
            : selectedTransportMode === 'bike'
              ? bikeRoute
              : carRoute;

        let latlngs =
          activeRoute.latlngs && activeRoute.latlngs.length >= 2
            ? activeRoute.latlngs
            : latLngsForRoute(activeRoute.geometry, currentOrigin, dest);
        latlngs = sanitizeRouteLatLngs(latlngs);
        lastOsrmLatlngs = latlngs.length >= 2 ? latlngs.slice() : null;
        activeRouteDistanceM = activeRoute.distance || polylineLengthMeters(latlngs);
        activeRouteDurationS = activeRoute.duration || 0;

        lastRouteTimesByMode = buildRouteTimesByMode(footRoute, carRoute, bikeRoute);
        const selectedStats = getSelectedModeRouteStats(currentOrigin);
        if (selectedStats) {
          activeRouteDistanceM = selectedStats.distanceM;
          activeRouteDurationS = selectedStats.durationS;
        }

        const drewOsrm = drawRoute(latlngs, dest);
        if (!drewOsrm) {

          setStatus(
            'Não foi possível desenhar a rota por estradas agora. Toque em “Recalcular rota”.',
            true
          );
        }
        lastRouteRecalcAt = Date.now();
        updateRemainingRouteStatsFromPosition(currentOrigin);
        mapFollowUser = true;

        if (panel) {
          window.dispatchEvent(new CustomEvent('ecocoleta:route-times', {
            detail: routeTimesEventFromBundle(lastRouteTimesByMode),
          }));
          panel.classList.remove('hidden');
        }

        const modeLabel = TRANSPORT_MODE_LABELS[selectedTransportMode] || 'de carro';
        setStatus(
          `Sua localização → ${dest.name} (${modeLabel}): ${formatDistance(activeRouteDistanceM)} · ~${formatDuration(activeRouteDurationS)}${liveTrackingStatusSuffix()}`
        );
        setFollowBtnVisible(true);
      } catch (e) {
        console.error(e);
        const errMsg =
          (e && e.message) || 'Serviço de rotas indisponível no momento.';

        if (!routeLayerHasLines()) {
          if (panel) panel.classList.add('hidden');
          window.dispatchEvent(new CustomEvent('ecocoleta:route-times-clear'));
          setFollowBtnVisible(false);
        }
        setStatus(
          'Não foi possível calcular a rota por estradas agora (' +
            errMsg +
            '). Toque em “Recalcular rota” para tentar novamente.' +
            liveTrackingStatusSuffix(),
          true
        );
      } finally {
        routeRecalcInFlight = false;
        if (hasRouteOrigin && !routeLayerHasLines()) {
          drawPreviewRouteToDest();
        }
        if (routeRecalcPending) {
          routeRecalcPending = false;
          void calcularRota({ force });
        }
      }
    }

    function setRefreshLocationVisible(visible) {
      const btn = cfg.refreshLocationBtnId ? $(cfg.refreshLocationBtnId) : null;
      if (btn) btn.classList.toggle('hidden', !visible);
    }

    function describeOriginFromPosition(pos, approximate) {
      const acc = typeof pos.accuracy === 'number' ? pos.accuracy : null;
      const mobile =
        window.EcoColetaGeo && typeof window.EcoColetaGeo.isMobileLike === 'function'
          ? window.EcoColetaGeo.isMobileLike()
          : false;
      const isApprox =
        !!approximate ||
        (acc != null && Number.isFinite(acc) && acc > (mobile ? 450 : 900));
      let html = isApprox
        ? '<strong>Você está aqui</strong><br>Localização aproximada — a rota é orientativa.'
        : '<strong>Você está aqui</strong><br>Localização confirmada pelo GPS do aparelho.';
      if (acc != null && Number.isFinite(acc)) {
        const km = acc / 1000;
        html +=
          '<br><small>Precisão: ~' +
          (km >= 1 ? km.toFixed(1) + ' km' : Math.round(acc) + ' m') +
          '</small>';
      }
      return html;
    }

    function rejectUserPosition(message, reason) {

      if (hasRouteOrigin) {
        return;
      }
      stopLiveLocationWatch();
      hasRouteOrigin = false;
      clearLastGps();
      clearUserMarkerRefs();
      setRefreshLocationVisible(true);
      let text = message || 'Não foi possível usar sua localização.';
      if (reason === 'permission_denied') {
        text =
          'Permissão de localização negada. No celular, ative o GPS e permita o acesso ao site nas configurações do navegador.';
      } else if (reason === 'outside_cariri') {
        text =
          'Sua posição está fora da região do Cariri neste mapa. Confira o GPS no celular ou escolha o ecoponto de destino manualmente.';
      } else if (reason === 'fortaleza_guess') {
        text =
          'O navegador enviou uma posição aproximada em Fortaleza (comum no Wi‑Fi/PC). Use o GPS do celular e toque em “Atualizar minha localização”.';
      }

      manualOriginMode = true;
      text += ' Ou toque no mapa para marcar o seu ponto de partida.';
      setStatus(text, true);
      showMapWithoutRoute();
    }

    function applyUserPosition(pos, opts) {
      if (!map || !routeLayer) {
        pendingUserPosition = pos;
        return;
      }

      const manual = !!(opts && opts.manual);

      try {
        const Geo = window.EcoColetaGeo;
        let approximate = manual;
        if (!manual && Geo && typeof Geo.validatePosition === 'function') {
          const check = Geo.validatePosition(pos, { allowApproximate: true });
          if (!check.ok) {
            rejectUserPosition(check.message || 'Localização imprecisa.', check.reason);
            return;
          }
          approximate = !!check.approximate;
        }

        if (!manual && isSuspiciousEcopontoGuess(pos)) {
          rejectUserPosition(
            'O navegador enviou uma posição aproximada em cima de um ecoponto do mapa (comum no Wi‑Fi/PC). Ative o GPS no celular e toque em “Atualizar minha localização”.'
          );
          return;
        }

        manualOriginMode = false;
        currentOrigin = {
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
        };
        hasRouteOrigin = true;

        updateNearestSelection(currentOrigin);
        originDescription = manual
          ? '<strong>Ponto de partida</strong><br>Definido por você no mapa.'
          : describeOriginFromPosition(pos, approximate);
        if (!manual) saveLastGps(pos);
        lastLiveUpdateAt = 0;
        lastRouteRecalcAt = 0;
        map.setView([currentOrigin.lat, currentOrigin.lng], Math.max(map.getZoom(), 15), {
          animate: true,
        });
        mapFollowUser = true;
        lastMapPanAt = Date.now();
        setRefreshLocationVisible(true);
        setStatus(
          manual
            ? 'Ponto de partida definido no mapa. Calculando sua rota…'
            : approximate
              ? 'Localização aproximada aceita. Calculando rota orientativa…'
              : 'Localização confirmada. Calculando sua rota…'
        );
        drawPreviewRouteToDest();
        void calcularRota({ force: true });

        if (!manual) startLiveLocationWatch();
        publishUserPosition(pos, { approximate });
        setLocateBtnTracking(!manual);
      } catch (err) {
        console.error(err);
        rejectUserPosition(
          (err && err.message) ||
            'Não foi possível usar sua localização para traçar a rota. Tente “Atualizar minha localização”.'
        );
      }
    }

    async function usarMinhaLocalizacao(options) {
      const opts = options || {};
      if (!opts.skipConsent && window.EcoColetaGeoConsent) {
        const consent = await window.EcoColetaGeoConsent.requestPermission({
          force: !!(opts.forceConsent || opts.force),
          title: 'Disponibilizar sua localização?',
          message:
            'Usamos sua posição para mostrar onde você está no mapa e traçar a rota até o ecoponto, com distância e tempo estimados em tempo real.',
          onAllow: function () {
            void usarMinhaLocalizacao({ skipConsent: true });
          },
          onDeny: function () {
            setStatus(
              'Você optou por não compartilhar a localização. Toque em “Minha localização” quando quiser ativar.',
              false
            );
            showMapWithoutRoute();
          },
        });
        if (consent !== 'granted') return;
        return;
      }

      stopLiveLocationWatch();
      if (!checkGeoSecurityContext()) {
        setRefreshLocationVisible(true);
        return;
      }
      setStatus('Buscando sua localização…');
      setRefreshLocationVisible(true);

      if (!navigator.geolocation) {
        setStatus('Geolocalização indisponível neste navegador.', true);
        return;
      }

      const Geo = window.EcoColetaGeo;
      const mobile = Geo && typeof Geo.isMobileLike === 'function' ? Geo.isMobileLike() : false;

      const fetchPosition = () => {
        if (Geo && typeof Geo.getBestCurrentPosition === 'function') {
          return Geo.getBestCurrentPosition({
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 30000,
            maxWaitMs: mobile ? 28000 : 20000,
            targetAccuracy: mobile ? 150 : 900,
            stableMaxDeltaM: mobile ? 500 : 700,
            requireStableFix: false,
            mustValidate: true,
          });
        }
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
              };
              const check = Geo?.validatePosition?.(pos, { allowApproximate: true });
              if (check && !check.ok) {
                const geoErr = new Error(check.message);
                geoErr.reason = check.reason;
                reject(geoErr);
                return;
              }
              resolve(pos);
            },
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
          );
        });
      };

      const fetchApproximateFallback = () => {
        if (!Geo || typeof Geo.getCurrentPosition !== 'function') {
          return Promise.reject(new Error('Geolocalização indisponível.'));
        }
        return Geo.getCurrentPosition({
          enableHighAccuracy: !mobile,
          maximumAge: mobile ? 0 : 15000,
          timeout: 18000,
        }).then((pos) => {
          const check = Geo.validatePosition(pos, { allowApproximate: true });
          if (!check.ok) throw new Error(check.message || 'Localização fora da região do mapa.');
          return pos;
        });
      };

      try {
        const pos = await fetchPosition();
        applyUserPosition(pos);
      } catch (err) {
        console.warn(err);
        try {
          const pos = await fetchApproximateFallback();
          applyUserPosition(pos);
        } catch (fallbackErr) {
          console.warn(fallbackErr);
          const reason = (fallbackErr && fallbackErr.reason) || (err && err.reason);
          if (
            (reason === 'unstable_gps' || reason === 'timeout') &&
            Geo &&
            typeof Geo.getCurrentPosition === 'function'
          ) {
            try {
              const quick = await Geo.getCurrentPosition({
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 12000,
              });
              const check = Geo.validatePosition(quick, { allowApproximate: true });
              if (check.ok) {
                applyUserPosition(quick);
                return;
              }
            } catch (quickErr) {
              console.warn(quickErr);
            }
          }
          const msg =
            (fallbackErr && fallbackErr.message) ||
            (err && err.message) ||
            'Não foi possível obter GPS preciso. Use o celular com localização ativa.';
          rejectUserPosition(msg, reason);
        }
      }
    }

    async function usarCepOrigem() {
      const input = cfg.cepInputId ? $(cfg.cepInputId) : $('cep-origem');
      const cep8 = input ? cepDigitsOnly(input.value) : null;
      if (!cep8) {
        setStatus('Digite um CEP válido com 8 dígitos.', true);
        return;
      }
      setStatus('Consultando CEP e preparando rota…');
      try {
        const via = await fetchViaCep(cep8);
        const geo = await geocodeAddressFromViaCep(via, cep8);
        if (!geo) {
          throw new Error('Não foi possível localizar esse CEP no mapa.');
        }
        applyUserPosition({
          lat: geo.lat,
          lng: geo.lng,
          accuracy: 450,
        });
        setStatus(
          `Partida: ${formatCep(cep8)} · ${via.localidade || ''}/${via.uf || ''}. Calculando rota até o ecoponto…`
        );
      } catch (e) {
        console.error(e);
        setStatus(e.message || 'Erro ao usar o CEP como partida.', true);
      }
    }

    function onDestinoChange() {

      autoNearestEnabled = false;
      if (nearestRecalcTimer) {
        window.clearTimeout(nearestRecalcTimer);
        nearestRecalcTimer = null;
      }
      const dest = getSelectedPonto();
      if (dest) publishSelectedEcoponto(dest);

      if (!hasRouteOrigin && autoRouteOnEcopontoSelect) {
        void usarMinhaLocalizacao();
        return;
      }

      if (hasRouteOrigin) {
        drawPreviewRouteToDest();
        void calcularRota({ force: true });
      } else {
        showMapWithoutRoute();
      }
    }

    function bindUi() {
      const sel = $(cfg.selectId);
      if (sel) sel.addEventListener('change', onDestinoChange);

      if (cfg.recalcBtnId) {
        const b = $(cfg.recalcBtnId);
        if (b) b.addEventListener('click', () => calcularRota());
      }

      if (cfg.locateBtnId) {
        const b = $(cfg.locateBtnId);
        if (b) b.addEventListener('click', () => usarMinhaLocalizacao({ forceConsent: true }));
      }

      if (cfg.mapLocateBtnId) {
        const b = $(cfg.mapLocateBtnId);
        if (b) {
          b.addEventListener('click', () => {
            if (infoOnly) {
              infoOnlySelectedId = null;
              renderInfoEcopontosMap(null);
              window.dispatchEvent(new CustomEvent('ecocoleta:ecopontos-show-all'));
              return;
            }
            mapFollowUser = true;
            if (hasRouteOrigin && map) {
              map.setView([currentOrigin.lat, currentOrigin.lng], Math.max(map.getZoom(), 15), {
                animate: true,
              });
              if (!liveTrackingActive) startLiveLocationWatch();
              updateLiveDistanceStatus();
              return;
            }
            void usarMinhaLocalizacao({ forceConsent: true });
          });
        }
      }

      const cepInputEl = cfg.cepInputId ? $(cfg.cepInputId) : $('cep-origem');
      const cepBtnEl = cfg.cepBtnId ? $(cfg.cepBtnId) : $('btn-cep');
      if (cepBtnEl) {
        cepBtnEl.addEventListener('click', () => usarCepOrigem());
      }
      if (cepInputEl) {
        cepInputEl.addEventListener('input', () => {
          const d = cepInputEl.value.replace(/\D/g, '').slice(0, 8);
          cepInputEl.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
        });
        cepInputEl.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            void usarCepOrigem();
          }
        });
      }

      if (cfg.refreshLocationBtnId) {
        const b = $(cfg.refreshLocationBtnId);
        if (b) b.addEventListener('click', () => usarMinhaLocalizacao({ forceConsent: true }));
      }

      document.querySelectorAll('.mapa-mode-btn[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-mode');
          if (mode) setSelectedTransportMode(mode);
        });
      });

      window.addEventListener('ecocoleta:route-times', (ev) => {
        if (!ev.detail) return;
        document.querySelectorAll('.mapa-mode-btn[data-mode]').forEach((btn) => {
          const mode = btn.getAttribute('data-mode');
          const info = ev.detail[mode];
          const meta = btn.querySelector('[data-mode-meta]');
          if (info && info.time) {
            const text = info.detail ? `${info.detail} · ${info.time}` : info.time;
            if (meta) meta.textContent = text;
            const label = TRANSPORT_MODE_TITLES[mode] || mode;

            btn.removeAttribute('title');
            btn.setAttribute('aria-label', `${label}: ${text}`);
          }
        });
      });

      window.addEventListener('ecocoleta:route-times-clear', () => {
        lastRouteTimesByMode = null;
        setRouteStatsVisible(false);
        document.querySelectorAll('.mapa-mode-btn[data-mode]').forEach((btn) => {
          const meta = btn.querySelector('[data-mode-meta]');
          if (meta) meta.textContent = '—';
          const mode = btn.getAttribute('data-mode');
          const label = TRANSPORT_MODE_TITLES[mode] || mode;
          btn.removeAttribute('title');
          btn.setAttribute('aria-label', label);
        });
      });

      window.addEventListener('ecocoleta:transport-mode', (ev) => {
        const mode = ev.detail && ev.detail.mode;
        if (mode && mode !== selectedTransportMode) {
          setSelectedTransportMode(mode);
        }
      });
    }

    function maybeAutoRequestGeolocation() {
      if (infoOnly) return;
      if (geoAutoRequested || hasRouteOrigin) return;
      if (!checkGeoSecurityContext()) {
        geoAutoRequested = true;
        return;
      }
      geoAutoRequested = true;
      const isHome = document.body.classList.contains('home');
      if (window.EcoColetaGeoConsent && window.EcoColetaGeoConsent.isOverlayOpen()) {
        return;
      }

      if (isHome && window.EcoColetaHomeMap) {
        window.dispatchEvent(new CustomEvent('ecocoleta:map-section-visible'));
        return;
      }

      if (window.EcoColetaGeoConsent) {
        void window.EcoColetaGeoConsent.requestPermission({
          title: 'Disponibilizar sua localização?',
          message:
            'Permita o acesso à sua localização para traçar automaticamente a rota até o ecoponto escolhido.',
          onAllow: function () {
            void usarMinhaLocalizacao({ skipConsent: true });
          },
          onDeny: function () {
            showMapWithoutRoute(
              'Sem localização, exibimos apenas os ecopontos no mapa. Você pode permitir depois.'
            );
          },
        });
        return;
      }

      void usarMinhaLocalizacao({ skipConsent: true });
    }

    function getNavigationDestination() {
      const dest = getSelectedPonto();
      if (!dest || typeof dest.lat !== 'number' || typeof dest.lng !== 'number') return null;
      return {
        lat: dest.lat,
        lng: dest.lng,
        label: dest.name || dest.address || 'EcoPonto',
      };
    }

    function setupNavigation() {
      if (infoOnly) return;
      if (!window.EcoColetaNavigation || !map) return;
      const mountEl = cfg.navMountId ? $(cfg.navMountId) : null;
      const followBtn = cfg.mapFollowBtnId ? $(cfg.mapFollowBtnId) : null;
      if (!mountEl && !followBtn) return;

      navigation = window.EcoColetaNavigation.createNavigationController({
        map,
        mountEl,
        floatingStartBtn: followBtn,
        uiMode: mountEl ? 'map-overlay' : 'inline',
        getTransportMode: () => selectedTransportMode,
        getDestination:
          typeof cfg.getDestination === 'function' ? cfg.getDestination : getNavigationDestination,
        onStatus: (msg, isError) => setStatus(msg, isError),
        onNavigationStart: () => {
          stopLiveLocationWatch();
          hideStaticRouteForNavigation();
        },
        onNavigationStop: () => {
          void calcularRota({ force: true });
          if (hasRouteOrigin) {
            startLiveLocationWatch();
          }
        },
      });
      navigation.attach();
    }

    function invalidateSize() {
      if (map) map.invalidateSize({ pan: false });
    }

    function scheduleMapResizePasses() {
      [0, 120, 400, 900].forEach(function (delay) {
        window.setTimeout(invalidateSize, delay);
      });
    }

    function watchMapContainerResize() {
      const wrap = document.getElementById(cfg.mapElId)?.closest('.mapa-leaflet-wrap');
      if (!wrap || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(function () {
        window.requestAnimationFrame(invalidateSize);
      });
      observer.observe(wrap);
    }

    function watchMapSectionVisibility() {
      const section =
        document.getElementById('eco-pontos-mapa') ||
        document.getElementById(cfg.mapElId)?.closest('.eco-pontos');
      if (!section || typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              scheduleMapResizePasses();
              maybeAutoRequestGeolocation();
            }
          });
        },
        { threshold: 0.12, rootMargin: '40px 0px' }
      );
      observer.observe(section);
    }

    function runWhenHomeGeoReady(run) {
      if (!document.body.classList.contains('home')) {
        run();
        return;
      }
      const overlayOpen =
        (window.EcoColetaGeoConsent && window.EcoColetaGeoConsent.isOverlayOpen()) ||
        (function () {
          const overlay = document.getElementById('home-geo-overlay');
          return (
            overlay &&
            !overlay.classList.contains('hidden') &&
            !overlay.classList.contains('geo-overlay--closed')
          );
        })();
      if (!overlayOpen) {
        run();
        return;
      }
      let started = false;
      function startAfterGeo() {
        if (started) return;
        started = true;
        window.setTimeout(run, 120);
      }
      window.addEventListener('ecocoleta:home-geo-closed', startAfterGeo, { once: true });
      window.addEventListener('ecocoleta:geo-consent-closed', startAfterGeo, { once: true });
    }

    return {
      init() {
        runWhenHomeGeoReady(function () {
          if (map) return;
          initMap();
          setupNavigation();
          setStatus('Carregando ecopontos da região do Cariri…');
          loadEcopontos()
            .then((points) => {
              if (Array.isArray(points) && points.length) {
                ECOPONTOS = points;
              }
            })
            .catch(() => {
              ECOPONTOS = mergeEcopontoSources(FALLBACK_ECOPONTOS);
            })
            .finally(() => {
              if (cfg.selectId) fillSelect();
              publishEcopontos();
              bindUi();
              if (infoOnly) {
                renderInfoEcopontosMap(null);
              } else {
                const cached = loadLastGps();
                if (cached) {
                  applyUserPosition(cached);
                } else if (!hasRouteOrigin) {
                  showMapWithoutRoute();
                }
                if (autoLocateOnInit && !hasRouteOrigin) {
                  window.setTimeout(function () {
                    if (!hasRouteOrigin) void usarMinhaLocalizacao({});
                  }, 600);
                }
                if (cfg.autoRouteLiveTrackingOnInit && hasRouteOrigin) {
                  window.setTimeout(() => startLiveLocationWatch(), 1000);
                }
              }
            });
          invalidateSize();
          scheduleMapResizePasses();
          watchMapContainerResize();
          watchMapSectionVisibility();
          window.addEventListener('load', function () {
            scheduleMapResizePasses();
          });
          window.addEventListener('resize', invalidateSize);
          window.addEventListener('hashchange', function () {
            if (location.hash === '#eco-pontos-mapa') scheduleMapResizePasses();
          });
          window.addEventListener('ecocoleta:home-geo-closed', function () {
            scheduleMapResizePasses();
          });
          window.addEventListener('pagehide', stopLiveLocationWatch);
          window.addEventListener('beforeunload', stopLiveLocationWatch);
        });
      },
      invalidateSize,
      requestLocation: usarMinhaLocalizacao,
      setTransportMode: setSelectedTransportMode,
      setAutoNearest(enabled) {
        autoNearestEnabled = !!enabled;
        if (autoNearestEnabled && hasRouteOrigin) {
          const nearest = updateNearestSelection(currentOrigin);
          if (nearest && nearest.changed) {
            drawPreviewRouteToDest({ fit: false });
            void calcularRota({ force: true });
          }
        }
      },
      setMapFollow(enabled) {
        mapFollowUser = !!enabled;
      },
      applyDebugPosition(pos) {
        applyUserPosition(
          Object.assign({ accuracy: 30 }, pos || {})
        );
      },
      stopLiveTracking: stopLiveLocationWatch,
      startLiveTracking: startLiveLocationWatch,
      get navigation() {
        return navigation;
      },
    };
  }

  function findEcopontoInCatalog(name) {
    const norm = normalizeId(name);
    if (!norm) return null;
    const exact = ECOPONTOS.find((p) => normalizeId(p.name) === norm);
    if (exact) return exact;
    return (
      ECOPONTOS.find((p) => {
        const pn = normalizeId(p.name);
        return pn.includes(norm) || norm.includes(pn);
      }) || null
    );
  }



  async function resolveEcopontoLocation(info) {
    const name = String(info?.name || '').trim() || 'EcoPonto';
    const address = String(info?.address || '').trim();
    const lat = info?.lat;
    const lng = info?.lng;

    if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { name, address, lat, lng };
    }

    const found = findEcopontoInCatalog(name);
    if (found) {
      return {
        name: found.name,
        address: address || found.address || found.city || '',
        lat: found.lat,
        lng: found.lng,
      };
    }

    const queries = [];
    if (address) queries.push(`${address}, Brasil`);
    if (name && name !== 'EcoPonto') queries.push(`${name}, Brasil`);

    for (let i = 0; i < queries.length; i++) {
      const geo = await nominatimGeocodeQuery(queries[i]);
      if (geo) {
        return { name, address: address || queries[i], lat: geo.lat, lng: geo.lng };
      }
    }

    const caririFallback = FALLBACK_ECOPONTOS[0] || {
      name: 'EcoPonto Verde',
      address: 'Centro, Juazeiro do Norte',
      lat: DEFAULT_ORIGIN.lat,
      lng: DEFAULT_ORIGIN.lng,
    };

    return {
      name: name || caririFallback.name,
      address: address || caririFallback.address || 'Juazeiro do Norte, CE',
      lat: caririFallback.lat,
      lng: caririFallback.lng,
    };
  }



  function createEcopontoAdminMap(cfg) {
    let map = null;
    let routeLayer = null;
    let markersLayer = null;
    let routePaneName = null;
    let navigation = null;
    let ecopontoOrigin = {
      name: 'EcoPonto',
      address: '',
      lat: DEFAULT_CARIRI_ECOPONTO.lat,
      lng: DEFAULT_CARIRI_ECOPONTO.lng,
    };
    let lastDestination = null;
    let lastDestinationLabel = '';

    function setStatus(msg, isError) {
      const el = cfg.statusId ? $(cfg.statusId) : null;
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('is-error', !!isError);
    }

    function initMap() {
      map = L.map(cfg.mapElId, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([ecopontoOrigin.lat, ecopontoOrigin.lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      routePaneName = ensureRoutePane(map);
      routeLayer = L.layerGroup().addTo(map);
      markersLayer = L.layerGroup().addTo(map);
    }

    function showEcopontoOnly(statusMessage) {
      if (!map) return;
      routeLayer.clearLayers();
      markersLayer.clearLayers();

      L.marker([ecopontoOrigin.lat, ecopontoOrigin.lng], { icon: ecopontoIcon })
        .addTo(markersLayer)
        .bindTooltip(ecopontoOrigin.name, {
          direction: 'top',
          offset: [0, -8],
          opacity: 1,
          className: 'eco-marker-tooltip',
        })
        .bindPopup(
          `<strong>${ecopontoOrigin.name}</strong><br>${ecopontoOrigin.address || 'Seu EcoPonto'}`
        );

      map.setView([ecopontoOrigin.lat, ecopontoOrigin.lng], 16);
      if (statusMessage) setStatus(statusMessage);
    }

    function drawRouteFromEcoponto(latlngs, dest, destLabel) {
      routeLayer.clearLayers();
      markersLayer.clearLayers();

      let routePoints = Array.isArray(latlngs) ? latlngs.slice() : [];
      if (routePoints.length < 2 && dest) {
        routePoints = [
          [ecopontoOrigin.lat, ecopontoOrigin.lng],
          [dest.lat, dest.lng],
        ];
      }
      if (routePoints.length < 2) return;

      const routePolys = addRoutePolylines(routePoints, routeLayer, map, routePaneName);
      if (!routePolys || !routePolys.line) return;

      L.marker([ecopontoOrigin.lat, ecopontoOrigin.lng], { icon: ecopontoIcon })
        .addTo(markersLayer)
        .bindPopup(
          `<strong>${ecopontoOrigin.name}</strong><br>${ecopontoOrigin.address || 'Origem — seu EcoPonto'}`
        );

      L.circleMarker([dest.lat, dest.lng], {
        radius: 10,
        color: '#0f2c21',
        fillColor: '#e53935',
        fillOpacity: 1,
        weight: 2,
      })
        .addTo(markersLayer)
        .bindPopup(`<strong>Destino</strong><br>${destLabel || 'Endereço buscado'}`);

      const bounds = routePolys.line
        .getBounds()
        .extend([ecopontoOrigin.lat, ecopontoOrigin.lng])
        .extend([dest.lat, dest.lng]);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
    }

    function previewDestination(geo, label) {
      lastDestination = { lat: geo.lat, lng: geo.lng };
      lastDestinationLabel = label;

      markersLayer.clearLayers();
      routeLayer.clearLayers();

      L.marker([ecopontoOrigin.lat, ecopontoOrigin.lng], { icon: ecopontoIcon })
        .addTo(markersLayer)
        .bindPopup(`<strong>${ecopontoOrigin.name}</strong><br>Origem`);

      L.circleMarker([geo.lat, geo.lng], {
        radius: 10,
        color: '#0f2c21',
        fillColor: '#e53935',
        fillOpacity: 1,
        weight: 2,
      })
        .addTo(markersLayer)
        .bindPopup(`<strong>Destino</strong><br>${label}`);

      map.fitBounds(
        [
          [ecopontoOrigin.lat, ecopontoOrigin.lng],
          [geo.lat, geo.lng],
        ],
        { padding: [48, 48], maxZoom: 16 }
      );
    }

    async function buscarDestino(options) {
      const input = cfg.searchInputId ? $(cfg.searchInputId) : null;
      const q = input ? String(input.value || '').trim() : '';
      if (!q) {
        setStatus('Digite uma rua, bairro ou endereço de destino.', true);
        return null;
      }

      const btn = cfg.searchBtnId ? $(cfg.searchBtnId) : null;
      const prevLabel = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Buscando…';
      }

      setStatus('Localizando destino no mapa…');

      try {
        let geo = await nominatimGeocodeQuery(`${q}, Brasil`);
        if (!geo) {
          geo = await nominatimGeocodeQuery(q);
        }
        if (!geo) {
          throw new Error('Endereço não encontrado. Tente incluir bairro ou cidade.');
        }

        previewDestination(geo, q);
        if (options && options.traceRoute) {
          setStatus('Destino localizado. Calculando rota…');
          await calcularRotaParaDestino();
        } else {
          setStatus('Destino localizado. Clique em “Traçar rota” para ver o caminho.');
        }
        return lastDestination;
      } catch (e) {
        console.error(e);
        setStatus(e.message || 'Erro ao buscar endereço.', true);
        return null;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prevLabel || 'Buscar';
        }
      }
    }

    async function buscarDestinoPorCep(options) {
      const input = cfg.cepInputId ? $(cfg.cepInputId) : null;
      const cep8 = input ? cepDigitsOnly(input.value) : null;
      if (!cep8) {
        setStatus('Digite um CEP válido com 8 dígitos.', true);
        return null;
      }

      const btn = cfg.cepBtnId ? $(cfg.cepBtnId) : null;
      const prevLabel = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Buscando…';
      }

      setStatus('Consultando CEP e localizando destino…');

      try {
        const via = await fetchViaCep(cep8);
        const geo = await geocodeAddressFromViaCep(via, cep8);
        if (!geo) {
          throw new Error(
            'Não foi possível localizar esse CEP no mapa. Tente outro CEP ou busque pela rua.'
          );
        }

        const cepFmt = formatCep(cep8);
        const addrParts = [cepFmt];
        if (via.logradouro) addrParts.push(via.logradouro);
        if (via.bairro) addrParts.push(via.bairro);
        addrParts.push(`${via.localidade}/${via.uf}`);
        const label = addrParts.join(' · ');

        previewDestination(geo, label);
        setStatus('CEP localizado. Clique em “Traçar rota” para ver o caminho.');
        if (options && options.traceRoute) {
          await calcularRotaParaDestino();
        }
        return lastDestination;
      } catch (e) {
        console.error(e);
        setStatus(e.message || 'Erro ao buscar CEP.', true);
        return null;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prevLabel || 'Buscar CEP';
        }
      }
    }

    async function calcularRotaParaDestino() {
      if (!lastDestination) {
        const cepInput = cfg.cepInputId ? $(cfg.cepInputId) : null;
        const hasCep = cepInput && cepDigitsOnly(cepInput.value);
        const found = hasCep
          ? await buscarDestinoPorCep({ traceRoute: false })
          : await buscarDestino({ traceRoute: false });
        if (!found) return;
      }

      setStatus('Calculando rota a partir do seu EcoPonto…');

      try {
        const [footRoute, carRoute] = await Promise.all([
          fetchOsrmRoute('foot', ecopontoOrigin, lastDestination),
          fetchOsrmRoute('car', ecopontoOrigin, lastDestination),
        ]);

        const latlngs = geometryToLatLngs(carRoute.geometry);
        drawRouteFromEcoponto(latlngs, lastDestination, lastDestinationLabel);

        setStatus(
          `Rota do EcoPonto até o destino · Carro: ${formatDistance(carRoute.distance)} (${formatDuration(carRoute.duration)}) · A pé: ${formatDistance(footRoute.distance)} (${formatDuration(footRoute.duration)})`
        );
      } catch (e) {
        console.error(e);
        routeLayer.clearLayers();
        showEcopontoOnly();
        setStatus(e.message || 'Não foi possível traçar a rota. Tente outro endereço.', true);
      }
    }

    async function traceRouteToAddress(address, options) {
      const opts = options || {};
      const raw = String(address || '').trim();
      if (!raw || raw === '—' || raw === '-') {
        setStatus('Endereço indisponível para traçar rota.', true);
        return null;
      }

      const bairro = String(opts.bairro || '').trim();
      const usuario = String(opts.usuario || '').trim();
      const rua = String(opts.rua || '').trim();
      const cidadeRef =
        String(opts.cidade || '').trim() ||
        (function () {
          const addr = String(ecopontoOrigin.address || '').trim();
          if (!addr) return 'Juazeiro do Norte';
          const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
          if (parts.length >= 2) return parts[parts.length - 1];
          return parts[0] || 'Juazeiro do Norte';
        })();

      const ruaBusca = rua || raw;
      setStatus('Localizando endereço da coleta…');

      try {
        let geo = await geocodeEnderecoEstruturado({
          rua: ruaBusca,
          bairro,
          cidade: cidadeRef,
          address: raw,
        });

        if (!geo) {
          throw new Error('Endereço não encontrado no mapa. Tente incluir bairro ou cidade.');
        }

        const label = usuario ? `${usuario} · ${raw}` : raw;
        lastDestination = { lat: geo.lat, lng: geo.lng };
        lastDestinationLabel = label;

        if (cfg.searchInputId) {
          const inp = $(cfg.searchInputId);
          if (inp) inp.value = raw;
        }

        setStatus('Calculando rota de caminhão a partir do EcoPonto…');
        let truckRoute = await fetchOsrmRoute('car', ecopontoOrigin, lastDestination);
        if (truckRoute.distance > 300000) {
          const caririFallback = FALLBACK_ECOPONTOS[0];
          if (caririFallback) {
            ecopontoOrigin = {
              name: ecopontoOrigin.name,
              address: ecopontoOrigin.address || caririFallback.address,
              lat: caririFallback.lat,
              lng: caririFallback.lng,
            };
            truckRoute = await fetchOsrmRoute('car', ecopontoOrigin, lastDestination);
          }
        }
        const latlngs = geometryToLatLngs(truckRoute.geometry);
        drawRouteFromEcoponto(latlngs, lastDestination, lastDestinationLabel);

        let statusMsg =
          `Rota de caminhão · ${label} · ${formatDistance(truckRoute.distance)} · ~${formatDuration(truckRoute.duration)}`;
        if (geo.precision && geo.precision !== 'exato') {
          const precisaoLabel =
            geo.precision === 'bairro'
              ? 'localização aproximada no bairro'
              : geo.precision === 'aproximado'
                ? 'área aproximada do bairro'
                : 'localização aproximada na cidade';
          statusMsg += ` · ${precisaoLabel}`;
        }
        setStatus(statusMsg);

        if (map) {
          window.setTimeout(() => map.invalidateSize(), 120);
        }

        return {
          distance: truckRoute.distance,
          duration: truckRoute.duration,
          lat: geo.lat,
          lng: geo.lng,
          label,
          precision: geo.precision || 'exato',
        };
      } catch (e) {
        console.error(e);
        routeLayer.clearLayers();
        showEcopontoOnly();
        setStatus(e.message || 'Não foi possível traçar a rota.', true);
        return null;
      }
    }

    function bindUi() {
      const searchOpts = cfg.autoRouteOnSearch ? { traceRoute: true } : { traceRoute: false };

      if (cfg.searchBtnId) {
        const b = $(cfg.searchBtnId);
        if (b) b.addEventListener('click', () => buscarDestino(searchOpts));
      }

      if (cfg.cepBtnId) {
        const b = $(cfg.cepBtnId);
        if (b) b.addEventListener('click', () => buscarDestinoPorCep({ traceRoute: false }));
      }

      if (cfg.routeBtnId) {
        const b = $(cfg.routeBtnId);
        if (b) b.addEventListener('click', () => calcularRotaParaDestino());
      }

      if (cfg.cepInputId) {
        const inp = $(cfg.cepInputId);
        if (inp) {
          inp.addEventListener('input', () => {
            const d = inp.value.replace(/\D/g, '').slice(0, 8);
            inp.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
          });
          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              buscarDestinoPorCep({ traceRoute: false });
            }
          });
        }
      }

      if (cfg.searchInputId) {
        const inp = $(cfg.searchInputId);
        if (inp) {
          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              buscarDestino(searchOpts);
            }
          });
        }
      }
    }

    function getNavigationDestination() {
      if (!lastDestination) return null;
      return {
        lat: lastDestination.lat,
        lng: lastDestination.lng,
        label: lastDestinationLabel || 'Destino',
      };
    }

    function setupNavigation() {
      if (!cfg.navMountId || !window.EcoColetaNavigation) return;
      const mountEl = $(cfg.navMountId);
      if (!mountEl || !map) return;
      navigation = window.EcoColetaNavigation.createNavigationController({
        map,
        mountEl,
        getDestination:
          typeof cfg.getDestination === 'function' ? cfg.getDestination : getNavigationDestination,
        onStatus: (msg, isError) => setStatus(msg, isError),
      });
      navigation.attach();
    }

    function invalidateSize() {
      if (map) map.invalidateSize();
    }

    return {
      init(initialInfo) {
        initMap();
        setupNavigation();
        bindUi();
        const info =
          initialInfo ||
          (typeof cfg.getEcopontoInfo === 'function' ? cfg.getEcopontoInfo() : null) ||
          {};
        return resolveEcopontoLocation(info)
          .then((loc) => {
            ecopontoOrigin = loc;
            showEcopontoOnly();
          })
          .catch((e) => {
            console.error(e);
            showEcopontoOnly();
          })
          .finally(() => {
            invalidateSize();
            window.addEventListener('load', invalidateSize);
          });
      },
      setEcoponto(info) {
        return resolveEcopontoLocation(info || {})
          .then((loc) => {
            ecopontoOrigin = loc;
            lastDestination = null;
            lastDestinationLabel = '';
            showEcopontoOnly();
          })
          .catch((e) => {
            console.error(e);
            setStatus('Não foi possível atualizar o EcoPonto no mapa.', true);
          });
      },
      invalidateSize,
      traceRouteToAddress,
      get navigation() {
        return navigation;
      },
    };
  }

  window.EcoColetaMapa = {
    createRouteWidget,
    createEcopontoAdminMap,
    resolveEcopontoLocation,
    findEcopontoInCatalog,
  };

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(() => {
    const isEcopontosPage = document.body.classList.contains('pagina-ecopontos');
    if ($('map') && ($('ecoponto-select') || isEcopontosPage)) {
      const isHome =
        document.body.classList.contains('home') || !!document.querySelector('.mapa-toolbar--home');
      const widget = createRouteWidget({
        mapElId: 'map',
        selectId: 'ecoponto-select',
        statusId: 'mapa-status',
        timesPanelId: 'times-panel',
        infoOnly: isEcopontosPage,
        autoLocateOnInit: !isEcopontosPage,
        autoRouteLiveTrackingOnInit: isHome,
        autoRouteOnEcopontoSelect: !isEcopontosPage,
        autoNearestEcoponto: !isEcopontosPage,
        ...(isHome
          ? {
              navMountId: 'mapa-nav-mount',
              mapFollowBtnId: 'map-nav-follow-btn',
              refreshLocationBtnId: 'map-refresh-location',
              transportModesId: 'mapa-transport-modes',
              routeStatsId: 'mapa-route-stats',
            }
          : isEcopontosPage
            ? {
                mapLocateBtnId: 'map-locate-btn',
              }
            : {
                locateBtnId: 'btn-local',
                mapLocateBtnId: 'map-locate-btn',
                recalcBtnId: 'btn-calcular',
                cepInputId: 'cep-origem',
                cepBtnId: 'btn-cep',
                navMountId: 'mapa-nav-mount',
                transportModesId: 'mapa-transport-modes',
                routeStatsId: 'mapa-route-stats',
              }),
      });
      widget.init();
      if (isHome) {
        window.EcoColetaHomeMap = widget;
        const debugGeo =
          typeof URLSearchParams !== 'undefined' &&
          new URLSearchParams(window.location.search).get('debug') === '1';
        if (debugGeo) {
          window.addEventListener(
            'ecocoleta:home-map-ready',
            function () {
              window.setTimeout(function () {
                if (window.EcoColetaHomeMap && typeof window.EcoColetaHomeMap.applyDebugPosition === 'function') {
                  window.EcoColetaHomeMap.applyDebugPosition({
                    lat: -7.234,
                    lng: -39.409,
                    accuracy: 30,
                  });
                }
              }, 400);
            },
            { once: true }
          );
        }
      }
    }

    if ($('adm-map')) {
      const widget = createEcopontoAdminMap({
        mapElId: 'adm-map',
        searchInputId: 'adm-map-search-input',
        searchBtnId: 'adm-map-search-btn',
        statusId: 'adm-map-search-status',
        navMountId: 'adm-map-nav-mount',
        autoRouteOnSearch: true,
        getEcopontoInfo() {
          const nameEl = document.getElementById('ecopontoDetailName');
          const addrEl = document.getElementById('ecopontoDetailAddress');
          return {
            name: nameEl ? nameEl.textContent.trim() : '',
            address: addrEl ? addrEl.textContent.trim() : '',
          };
        },
      });
      widget.init();
      window.EcoColetaAdmMap = widget;
    }
  });
})();
