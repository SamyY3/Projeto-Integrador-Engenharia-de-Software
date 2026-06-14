(function () {
  function eyeOpenSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  function eyeClosedSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }

  function syncButton(button, input) {
    if (!button || !input) return;
    var hidden = input.type === 'password';
    button.innerHTML = hidden ? eyeOpenSvg() : eyeClosedSvg();
    button.setAttribute('aria-label', hidden ? 'Mostrar senha' : 'Ocultar senha');
  }

  window.initPasswordToggle = function (button, input) {
    if (!button || !input || button.getAttribute('data-pw-toggle-bound') === '1') return;
    button.setAttribute('data-pw-toggle-bound', '1');
    syncButton(button, input);
    button.addEventListener('click', function () {
      input.type = input.type === 'password' ? 'text' : 'password';
      syncButton(button, input);
    });
  };

  function bindAllToggles() {
    document.querySelectorAll('[data-password-toggle-for]').forEach(function (btn) {
      var id = btn.getAttribute('data-password-toggle-for');
      var input = id ? document.getElementById(id) : null;
      window.initPasswordToggle(btn, input);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAllToggles);
  } else {
    bindAllToggles();
  }
})();
