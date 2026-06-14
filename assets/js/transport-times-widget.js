(function () {
  'use strict';

  const e = React.createElement;

  function IconWalk(props) {
    return e('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', ...props },
      e('circle', { cx: 12, cy: 4.5, r: 2.2 }),
      e('path', { d: 'M10.7 8.2 9.2 13l-2.4 2.5' }),
      e('path', { d: 'm13.2 9.2 2.1 3.2 2.9.8' }),
      e('path', { d: 'm11 13 3.1 2.2 1.4 4.3' }),
      e('path', { d: 'm8.8 15.5-1.5 4' }),
    );
  }

  function IconCar(props) {
    return e('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', ...props },
      e('path', { d: 'M4.5 14.2 6.1 9.8A3 3 0 0 1 9 7.8h6a3 3 0 0 1 2.9 2l1.6 4.4' }),
      e('path', { d: 'M3.8 14.2h16.4v4.3a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.7H7.2v.7a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1v-4.3Z' }),
      e('path', { d: 'M7 14.2h.1' }),
      e('path', { d: 'M17 14.2h.1' }),
    );
  }

  function IconMoto(props) {
    return e('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', ...props },
      e('circle', { cx: 6.5, cy: 17, r: 3 }),
      e('circle', { cx: 17.5, cy: 17, r: 3 }),
      e('path', { d: 'M9.2 17h3.3l2.2-5.2h2.2' }),
      e('path', { d: 'M12.5 17 9.8 11h-2' }),
      e('path', { d: 'M14.6 11.8 17.5 17' }),
      e('path', { d: 'M7.8 11h3.8' }),
    );
  }

  function IconBus(props) {
    return e('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', ...props },
      e('path', { d: 'M6.5 4.5h11A2.5 2.5 0 0 1 20 7v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2.5 2.5 0 0 1 2.5-2.5Z' }),
      e('path', { d: 'M6.5 8h11' }),
      e('path', { d: 'M7 13h.1' }),
      e('path', { d: 'M17 13h.1' }),
      e('path', { d: 'M7 18.5 6 21' }),
      e('path', { d: 'm17 18.5 1 2.5' }),
    );
  }

  const TRANSPORTS = [
    { key: 'walk', label: 'A pé', Icon: IconWalk },
    { key: 'car', label: 'Carro', Icon: IconCar },
    { key: 'moto', label: 'Moto', Icon: IconMoto },
    { key: 'transit', label: 'Ônibus', Icon: IconBus },
  ];

  function formatBadgeText(item, data) {
    if (!data) return '';
    return `${item.label}: ${data.time}${data.detail ? ' · ' + data.detail : ''}`;
  }

  function TransportButton({ item, data }) {
    const Icon = item.Icon;
    const tooltip = formatBadgeText(item, data);

    return e('div', { className: 'ttw-mode' },
      e('span', {
        className: 'ttw-badge',
        role: 'tooltip',
      }, tooltip),
      e('button', {
        type: 'button',
        className:
          'ttw-mode-btn flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-900/10 bg-white/85 text-emerald-900 shadow-sm backdrop-blur transition duration-200 ease-out hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:h-12 sm:w-12',
        'aria-label': tooltip,
      }, e(Icon, { className: 'h-5 w-5 sm:h-6 sm:w-6' }))
    );
  }

  function TransportTimesWidget() {
    const [times, setTimes] = React.useState(null);

    React.useEffect(function () {
      function onTimes(ev) {
        setTimes(ev.detail || null);
      }
      function onClear() {
        setTimes(null);
      }

      window.addEventListener('ecocoleta:route-times', onTimes);
      window.addEventListener('ecocoleta:route-times-clear', onClear);
      return () => {
        window.removeEventListener('ecocoleta:route-times', onTimes);
        window.removeEventListener('ecocoleta:route-times-clear', onClear);
      };
    }, []);

    if (!times) {
      return e('div', { className: 'ttw-wrap flex items-center gap-2 text-xs font-semibold text-slate-500' },
        e('span', { className: 'h-2 w-2 animate-pulse rounded-full bg-emerald-400' }),
        'Calculando tempos...'
      );
    }

    return e('div', { className: 'ttw-wrap font-sora flex w-full flex-col items-stretch' },
      e('div', { className: 'ttw-modes grid flex-1 grid-cols-4 gap-2 sm:gap-3' },
        TRANSPORTS.map(function (item) {
          return e(TransportButton, {
            key: item.key,
            item: item,
            data: times[item.key],
          });
        })
      )
    );
  }

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('transport-times-widget');
    if (!root || !window.React || !window.ReactDOM) return;
    ReactDOM.createRoot(root).render(e(TransportTimesWidget));
  });
})();
