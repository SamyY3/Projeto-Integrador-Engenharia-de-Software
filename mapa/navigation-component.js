

(function (global) {
  'use strict';

  const Geo = global.EcoColetaGeo;
  const Route = global.EcoColetaRoute;
  const NavEngine = global.EcoColetaNavEngine;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function createNavigationController(cfg) {
    if (!Geo || !Route || !NavEngine) {
      console.warn('Módulos de navegação não carregados.');
      return { attach: function () {}, destroy: function () {} };
    }

    const map = cfg.map;
    const getDestination = cfg.getDestination;
    const onStatus = cfg.onStatus || function () {};
    const mountEl = cfg.mountEl || map.getContainer().parentElement;
    const floatingStartBtn = cfg.floatingStartBtn || null;
    const uiMode = cfg.uiMode || 'inline';
    const onNavigationStart = cfg.onNavigationStart || null;
    const onNavigationStop = cfg.onNavigationStop || null;
    const getTransportMode = cfg.getTransportMode || null;

    let engine = NavEngine.createNavigationEngine(cfg.engineOptions);
    let watchId = null;
    let animFrame = null;
    let markerAnim = null;
    let mode = 'car';

    let navLayer = L.layerGroup().addTo(map);
    let passedLine = null;
    let remainingLine = null;
    let remainingGlow = null;
    let userMarker = null;
    let destMarker = null;

    let uiRoot = null;
    let uiEls = {};

    function setStatus(msg, isError) {
      onStatus(msg, isError);
      if (uiEls.status) {
        uiEls.status.textContent = msg || '';
        uiEls.status.classList.toggle('is-error', !!isError);
      }
    }

    function resolveMode() {
      if (typeof getTransportMode === 'function') {
        const external = getTransportMode();
        if (external) {
          return external === 'moto' ? 'car' : external;
        }
      }
      return mode;
    }

    function buildUi() {
      if (uiRoot || !mountEl) return;
      const isOverlay = uiMode === 'map-overlay';
      uiRoot = document.createElement('div');
      uiRoot.className =
        'nav-gps-panel' + (isOverlay ? ' nav-gps-panel--overlay nav-gps-panel--compact' : '');

      if (isOverlay) {
        uiRoot.innerHTML =
          '<div class="nav-gps-compact">' +
          '<span class="nav-gps-panel__badge" id="navGpsBadge">GPS</span>' +
          '<div class="nav-gps-compact__body">' +
          '<p class="nav-gps-instruction" id="navInstruction">Siga em frente no mapa</p>' +
          '<p class="nav-gps-compact__meta">' +
          '<strong id="navStepDist">—</strong>' +
          '<span class="nav-gps-compact__sep" aria-hidden="true">·</span>' +
          '<span id="navDistRemaining">—</span>' +
          '<span class="nav-gps-compact__sep" aria-hidden="true">·</span>' +
          '<span id="navTimeRemaining">—</span>' +
          '</p>' +
          '</div>' +
          '<button type="button" class="nav-gps-compact__stop" id="navStopBtn" aria-label="Parar acompanhamento">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
          '<path d="M6 6h12v12H6z" stroke-linecap="round"/></svg>' +
          '</button>' +
          '</div>' +
          '<p class="nav-gps-status nav-gps-status--compact" id="navGpsStatus" role="status" aria-live="polite"></p>';
      } else {
        uiRoot.innerHTML =
          '<div class="nav-gps-panel__head">' +
          '<span class="nav-gps-panel__badge" id="navGpsBadge">GPS</span>' +
          '<strong>Navegação ao vivo</strong>' +
          '</div>' +
          '<div class="nav-gps-modes" role="group" aria-label="Meio de transporte">' +
          '<button type="button" class="nav-gps-mode is-active" data-mode="car">🚗 Carro</button>' +
          '<button type="button" class="nav-gps-mode" data-mode="walk">🚶 Caminhada</button>' +
          '<button type="button" class="nav-gps-mode" data-mode="bike">🚲 Bicicleta</button>' +
          '<button type="button" class="nav-gps-mode" data-mode="transit">🚌 Público</button>' +
          '</div>' +
          '<div class="nav-gps-stats">' +
          '<div><span>Distância</span><strong id="navDistRemaining">—</strong></div>' +
          '<div><span>Tempo</span><strong id="navTimeRemaining">—</strong></div>' +
          '</div>' +
          '<p class="nav-gps-instruction" id="navInstruction">Siga as instruções enquanto se desloca.</p>' +
          '<p class="nav-gps-next" id="navNextStep"></p>' +
          '<ol class="nav-gps-steps" id="navStepsList" hidden></ol>' +
          '<div class="nav-gps-actions">' +
          '<button type="button" class="nav-gps-btn nav-gps-btn--primary" id="navStartBtn">Iniciar navegação</button>' +
          '<button type="button" class="nav-gps-btn nav-gps-btn--ghost hidden" id="navStopBtn">Parar acompanhamento</button>' +
          '</div>' +
          '<p class="nav-gps-status" id="navGpsStatus" role="status" aria-live="polite"></p>';
      }

      mountEl.appendChild(uiRoot);
      if (isOverlay) {
        uiRoot.classList.add('hidden');
      }

      uiEls = {
        badge: uiRoot.querySelector('#navGpsBadge'),
        dist: uiRoot.querySelector('#navDistRemaining'),
        time: uiRoot.querySelector('#navTimeRemaining'),
        stepDist: uiRoot.querySelector('#navStepDist'),
        instruction: uiRoot.querySelector('#navInstruction'),
        next: uiRoot.querySelector('#navNextStep'),
        steps: uiRoot.querySelector('#navStepsList'),
        start: uiRoot.querySelector('#navStartBtn'),
        stop: uiRoot.querySelector('#navStopBtn'),
        status: uiRoot.querySelector('#navGpsStatus'),
        modes: uiRoot.querySelectorAll('.nav-gps-mode'),
      };

      if (uiEls.start) uiEls.start.addEventListener('click', () => startNavigation());
      if (uiEls.stop) uiEls.stop.addEventListener('click', () => stopNavigation());

      uiEls.modes.forEach((btn) => {
        btn.addEventListener('click', () => {
          uiEls.modes.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          mode = btn.getAttribute('data-mode') || 'car';
          if (engine.getState().active) {
            rerouteFromCurrentPosition();
          }
        });
      });

      if (isOverlay && typeof window !== 'undefined') {
        window.addEventListener('ecocoleta:transport-mode', (ev) => {
          const nextMode = ev.detail && ev.detail.mode;
          if (!nextMode || !engine.getState().active) return;
          mode = nextMode === 'moto' ? 'car' : nextMode;
          rerouteFromCurrentPosition();
        });
      }
    }

    function userIcon(heading) {
      const rot = typeof heading === 'number' ? heading : 0;
      return L.divIcon({
        className: 'nav-user-marker-wrap',
        html:
          '<span class="nav-user-marker" style="transform:rotate(' +
          rot +
          'deg)"><span class="nav-user-marker__dot"></span><span class="nav-user-marker__arrow"></span></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }

    function clearLayers() {
      navLayer.clearLayers();
      passedLine = null;
      remainingLine = null;
      remainingGlow = null;
      userMarker = null;
      destMarker = null;
    }

    function setOverlayVisible(visible) {
      if (uiMode !== 'map-overlay') return;
      if (mountEl) mountEl.classList.toggle('hidden', !visible);
      if (uiRoot) uiRoot.classList.toggle('hidden', !visible);
      if (floatingStartBtn) floatingStartBtn.classList.toggle('hidden', visible);
      const wrap = map.getContainer && map.getContainer().closest('.mapa-leaflet-wrap');
      if (wrap) wrap.classList.toggle('is-route-following', !!visible);
    }

    function drawRouteLayers(remainingLatLngs, passedLatLngs, dest, userPos) {
      navLayer.clearLayers();

      if (passedLatLngs && passedLatLngs.length > 1) {
        passedLine = L.polyline(passedLatLngs, {
          color: '#94a89e',
          weight: 5,
          opacity: 0.55,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(navLayer);
      }

      if (remainingLatLngs && remainingLatLngs.length > 1) {
        remainingGlow = L.polyline(remainingLatLngs, {
          color: '#8fffc7',
          weight: 10,
          opacity: 0.35,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(navLayer);

        remainingLine = L.polyline(remainingLatLngs, {
          color: '#0f6b3a',
          weight: 7,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(navLayer);
      }

      if (dest) {
        destMarker = L.circleMarker([dest.lat, dest.lng], {
          radius: 11,
          color: '#0f2c21',
          fillColor: '#e53935',
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(navLayer)
          .bindPopup('<strong>Destino</strong><br>' + (dest.label || ''));
      }

      if (userPos) {
        userMarker = L.marker([userPos.lat, userPos.lng], {
          icon: userIcon(userPos.heading),
          zIndexOffset: 1000,
        }).addTo(navLayer);
      }
    }

    function animateMarkerTo(target, heading) {
      if (!userMarker) {
        userMarker = L.marker([target.lat, target.lng], {
          icon: userIcon(heading),
          zIndexOffset: 1000,
        }).addTo(navLayer);
        return;
      }

      const from = userMarker.getLatLng();
      const start = performance.now();
      const duration = 480;

      if (markerAnim) cancelAnimationFrame(markerAnim);

      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const ease = t * (2 - t);
        const lat = lerp(from.lat, target.lat, ease);
        const lng = lerp(from.lng, target.lng, ease);
        userMarker.setLatLng([lat, lng]);
        userMarker.setIcon(userIcon(heading));
        if (t < 1) markerAnim = requestAnimationFrame(frame);
      }
      markerAnim = requestAnimationFrame(frame);
    }

    function renderStepsList(steps, activeIndex) {
      if (uiMode === 'map-overlay' || !uiEls.steps) return;
      if (!steps || !steps.length) {
        uiEls.steps.hidden = true;
        return;
      }
      uiEls.steps.hidden = false;
      uiEls.steps.innerHTML = steps
        .map((s, i) => {
          const street = s.name ? ` · ${s.name}` : '';
          const cls = i === activeIndex ? ' class="is-current"' : i < activeIndex ? ' class="is-done"' : '';
          return (
            '<li' +
            cls +
            '><span>' +
            s.instruction +
            street +
            '</span><small>' +
            Route.formatDistance(s.distance) +
            '</small></li>'
          );
        })
        .join('');
    }

    function updateUiFromTick(tick) {
      const isCompact = uiMode === 'map-overlay';
      const step = tick.currentStep;

      if (uiEls.dist) {
        uiEls.dist.textContent = isCompact
          ? Route.formatDistance(tick.remainingDistance)
          : Route.formatDistance(tick.remainingDistance);
      }
      if (uiEls.time) {
        uiEls.time.textContent = Route.formatDuration(tick.remainingDuration);
      }

      if (step && uiEls.instruction) {
        const street = step.name ? ` · ${step.name}` : '';
        uiEls.instruction.textContent = step.instruction + street;
      }

      if (uiEls.stepDist) {
        uiEls.stepDist.textContent = step ? Route.formatDistance(step.distance) : '—';
      }

      if (!isCompact) {
        if (uiEls.next) {
          if (tick.nextStep) {
            uiEls.next.textContent =
              'Depois: ' + tick.nextStep.instruction + (tick.nextStep.name ? ' · ' + tick.nextStep.name : '');
          } else {
            uiEls.next.textContent = '';
          }
        }
        renderStepsList(engine.getState().route?.steps, tick.stepIndex);
      }
    }

    function followUser(lat, lng) {
      const zoom = Math.max(map.getZoom(), 17);
      if (uiMode === 'map-overlay' && map.getSize) {
        const size = map.getSize();
        const projected = map.project([lat, lng], zoom);
        const offset = L.point(projected.x, projected.y + size.y * 0.12);
        const shifted = map.unproject(offset, zoom);
        map.setView(shifted, zoom, { animate: true, duration: 0.35 });
        return;
      }
      map.setView([lat, lng], zoom, { animate: true, duration: 0.45 });
    }

    async function fetchAndApplyRoute(from, dest) {
      const routeMode = resolveMode();
      const route = await Route.fetchRoute(routeMode, from, dest, { steps: true });
      engine.setRoute(route, dest);

      drawRouteLayers(route.latlngs, [], dest, from);
      updateUiFromTick({
        remainingDistance: route.distance,
        remainingDuration: route.duration,
        currentStep: route.steps[0] || null,
        nextStep: route.steps[1] || null,
        stepIndex: 0,
      });

      if (route.transitEstimated) {
        setStatus('Rota de transporte público estimada (sem linhas em tempo real).');
      } else {
        setStatus('Rota calculada. Siga as instruções.');
      }

      return route;
    }

    async function rerouteFromCurrentPosition() {
      const dest = getDestination();
      if (!dest) return;
      const pos = engine.getState().lastPosition;
      if (!pos) return;

      setStatus('Recalculando rota…');
      engine.markRerouted();
      try {
        await fetchAndApplyRoute({ lat: pos.lat, lng: pos.lng }, dest);
      } catch (e) {
        setStatus(e.message || 'Falha ao recalcular.', true);
      }
    }

    function onPositionUpdate(position) {
      const tick = engine.updatePosition(position);
      if (tick.type === 'idle') return;

      if (tick.type === 'reroute') {
        setStatus('Você saiu do caminho. Recalculando…');
        rerouteFromCurrentPosition();
        return;
      }

      const latlngs = engine.getState().route?.latlngs || [];
      const passed = latlngs.slice(0, Math.max(1, engine.getState().progressIndex + 1));
      const dest = engine.getState().destination;

      drawRouteLayers(tick.remainingLatLngs, passed, dest, position);
      animateMarkerTo({ lat: position.lat, lng: position.lng }, position.heading);
      followUser(position.lat, position.lng);
      updateUiFromTick(tick);

      if (uiEls.badge) uiEls.badge.classList.add('is-live');

      if (tick.remainingDistance < 35) {
        setStatus('Você chegou ao destino!');
        stopNavigation();
      }
    }

    async function startNavigation() {
      const dest = getDestination();
      if (!dest || typeof dest.lat !== 'number' || typeof dest.lng !== 'number') {
        setStatus('Defina um destino antes de iniciar a navegação.', true);
        return;
      }

      if (!Geo.isSupported()) {
        setStatus(Geo.ERROR_MESSAGES.NOT_SUPPORTED, true);
        return;
      }

      if (uiEls.start) uiEls.start.disabled = true;
      setStatus('Obtendo sua localização…');

      try {
        const pos = await Geo.getCurrentPosition({
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 25000,
        });

        if (typeof Geo.validatePosition === 'function') {
          const check = Geo.validatePosition(pos);
          if (!check.ok) {
            setStatus(check.message || Geo.ERROR_MESSAGES.LOW_ACCURACY, true);
            if (uiEls.start) uiEls.start.disabled = false;
            return;
          }
        }

        if (onNavigationStart) onNavigationStart();
        mode = resolveMode();
        await fetchAndApplyRoute({ lat: pos.lat, lng: pos.lng }, dest);
        engine.start(mode, engine.getState().route, dest);

        if (uiEls.start) {
          uiEls.start.classList.add('hidden');
          uiEls.start.disabled = false;
        }
        if (uiEls.stop && uiMode !== 'map-overlay') uiEls.stop.classList.remove('hidden');
        setOverlayVisible(true);

        watchId = Geo.watchPosition(
          onPositionUpdate,
          (err) => setStatus(err.message, true),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }
        );

        onPositionUpdate(pos);
        setStatus(uiMode === 'map-overlay' ? '' : 'Navegação ativa — acompanhe o mapa e as instruções.');
      } catch (e) {
        if (onNavigationStop) onNavigationStop();
        if (uiEls.start) uiEls.start.disabled = false;
        setStatus(e.message || 'Não foi possível iniciar a navegação.', true);
      }
    }

    function stopNavigation() {
      Geo.clearWatch(watchId);
      watchId = null;
      engine.stop();
      if (markerAnim) cancelAnimationFrame(markerAnim);
      clearLayers();
      if (uiEls.start) uiEls.start.classList.remove('hidden');
      if (uiEls.stop && uiMode !== 'map-overlay') uiEls.stop.classList.add('hidden');
      if (uiEls.badge) uiEls.badge.classList.remove('is-live');
      setOverlayVisible(false);
      setStatus('Navegação encerrada.');
      if (onNavigationStop) onNavigationStop();
    }

    function destroy() {
      stopNavigation();
      clearLayers();
      if (uiRoot && uiRoot.parentNode) uiRoot.parentNode.removeChild(uiRoot);
      uiRoot = null;
    }

    function attach() {
      if (mountEl) buildUi();
      if (floatingStartBtn) {
        floatingStartBtn.addEventListener('click', () => startNavigation());
      }
    }

    return {
      attach,
      destroy,
      startNavigation,
      stopNavigation,
      isActive: () => engine.getState().active,
    };
  }

  global.EcoColetaNavigation = {
    createNavigationController,
  };
})(typeof window !== 'undefined' ? window : this);
