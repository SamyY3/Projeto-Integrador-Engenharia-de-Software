

(function (global) {
  'use strict';

  const R = 6371000;

  function toRad(d) {
    return (d * Math.PI) / 180;
  }

  function haversineMeters(aLat, aLng, bLat, bLng) {
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function cumulativeDistances(latlngs) {
    const cum = [0];
    for (let i = 1; i < latlngs.length; i++) {
      cum[i] =
        cum[i - 1] +
        haversineMeters(latlngs[i - 1][0], latlngs[i - 1][1], latlngs[i][0], latlngs[i][1]);
    }
    return cum;
  }

  function closestOnPolyline(lat, lng, latlngs) {
    if (!latlngs || latlngs.length === 0) {
      return { index: 0, distance: Infinity, point: [lat, lng], traveledMeters: 0 };
    }
    if (latlngs.length === 1) {
      return {
        index: 0,
        distance: haversineMeters(lat, lng, latlngs[0][0], latlngs[0][1]),
        point: latlngs[0],
        traveledMeters: 0,
      };
    }

    let bestDist = Infinity;
    let bestIndex = 0;
    let bestPoint = latlngs[0];
    let traveled = 0;
    const cum = cumulativeDistances(latlngs);

    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i + 1];
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
      const d = haversineMeters(py, px, cy, cx);

      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
        bestPoint = [cy, cx];
        traveled = cum[i] + t * (cum[i + 1] - cum[i]);
      }
    }

    return { index: bestIndex, distance: bestDist, point: bestPoint, traveledMeters: traveled };
  }

  function trimPolyline(latlngs, fromIndex, snapPoint) {
    if (!latlngs.length) return [];
    const idx = Math.max(0, Math.min(fromIndex, latlngs.length - 1));
    const rest = latlngs.slice(idx);
    if (snapPoint && rest.length) {
      rest[0] = snapPoint;
    }
    return rest;
  }

  function polylineLengthMeters(latlngs) {
    let total = 0;
    for (let i = 1; i < latlngs.length; i++) {
      total += haversineMeters(
        latlngs[i - 1][0],
        latlngs[i - 1][1],
        latlngs[i][0],
        latlngs[i][1]
      );
    }
    return total;
  }

  function estimateRemainingDuration(totalDurationSec, totalDistanceM, remainingM) {
    if (totalDistanceM <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, remainingM / totalDistanceM));
    return totalDurationSec * ratio;
  }

  function findCurrentStep(steps, lat, lng) {
    if (!steps || !steps.length) return { index: 0, step: null };
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') continue;
      const d = haversineMeters(lat, lng, s.lat, s.lng);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return { index: best, step: steps[best] || null };
  }

  function createNavigationEngine(options) {
    const opts = Object.assign(
      {
        offRouteThresholdM: 45,
        rerouteCooldownMs: 8000,
        minProgressAdvanceM: 8,
      },
      options || {}
    );

    let state = {
      active: false,
      mode: 'car',
      destination: null,
      route: null,
      progressIndex: 0,
      traveledMeters: 0,
      lastRerouteAt: 0,
      lastPosition: null,
    };

    function reset() {
      state = {
        active: false,
        mode: 'car',
        destination: null,
        route: null,
        progressIndex: 0,
        traveledMeters: 0,
        lastRerouteAt: 0,
        lastPosition: null,
      };
    }

    function setRoute(route, destination) {
      state.route = route;
      state.destination = destination;
      state.progressIndex = 0;
      state.traveledMeters = 0;
    }

    function start(mode, route, destination) {
      state.active = true;
      state.mode = mode || 'car';
      setRoute(route, destination);
    }

    function stop() {
      state.active = false;
    }

    function updatePosition(position) {
      if (!state.active || !state.route) {
        return { type: 'idle' };
      }

      const latlngs = state.route.latlngs || [];
      const snap = closestOnPolyline(position.lat, position.lng, latlngs);
      const offRoute = snap.distance > opts.offRouteThresholdM;
      const now = Date.now();
      const needReroute =
        offRoute && now - state.lastRerouteAt > opts.rerouteCooldownMs;

      if (snap.traveledMeters > state.traveledMeters + opts.minProgressAdvanceM) {
        state.traveledMeters = snap.traveledMeters;
        state.progressIndex = snap.index;
      }

      const remainingLatLngs = trimPolyline(latlngs, state.progressIndex, snap.point);
      const totalDist = state.route.distance || polylineLengthMeters(latlngs);
      const remainingDist = polylineLengthMeters(remainingLatLngs);
      const remainingDuration = estimateRemainingDuration(
        state.route.duration,
        totalDist,
        remainingDist
      );

      const stepInfo = findCurrentStep(state.route.steps, position.lat, position.lng);
      const nextStep = state.route.steps[stepInfo.index + 1] || null;

      state.lastPosition = position;

      return {
        type: needReroute ? 'reroute' : 'update',
        offRoute,
        snap,
        remainingLatLngs,
        remainingDistance: remainingDist,
        remainingDuration,
        currentStep: stepInfo.step,
        nextStep,
        stepIndex: stepInfo.index,
        position,
      };
    }

    function markRerouted() {
      state.lastRerouteAt = Date.now();
      state.progressIndex = 0;
      state.traveledMeters = 0;
    }

    return {
      getState: () => ({ ...state }),
      start,
      stop,
      reset,
      setRoute,
      updatePosition,
      markRerouted,
    };
  }

  global.EcoColetaNavEngine = {
    createNavigationEngine,
    haversineMeters,
    closestOnPolyline,
    trimPolyline,
    polylineLengthMeters,
  };
})(typeof window !== 'undefined' ? window : this);
