

(function (global) {
  'use strict';

  var root;
  var settle;
  var onKey;

  function mount() {
    if (root) {
      return;
    }
    root = document.createElement('div');
    root.id = 'ecocoletaUserPopup';
    root.className = 'ecocoleta-popup-overlay hidden';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="ecocoleta-popup ecocoleta-popup--info" role="dialog" aria-modal="true" aria-labelledby="ecocoletaPopupTitle">' +
      '  <div class="ecocoleta-popup__accent"></div>' +
      '  <div class="ecocoleta-popup__head">' +
      '    <h3 class="ecocoleta-popup__title" id="ecocoletaPopupTitle">Aviso</h3>' +
      '    <button type="button" class="ecocoleta-popup__close" aria-label="Fechar">&times;</button>' +
      '  </div>' +
      '  <div class="ecocoleta-popup__body">' +
      '    <p class="ecocoleta-popup__message" id="ecocoletaPopupMessage"></p>' +
      '    <div class="ecocoleta-popup__field hidden" id="ecocoletaPopupField">' +
      '      <input type="text" class="ecocoleta-popup__input" id="ecocoletaPopupInput" autocomplete="name" />' +
      '    </div>' +
      '  </div>' +
      '  <div class="ecocoleta-popup__actions">' +
      '    <button type="button" class="ecocoleta-popup__btn ecocoleta-popup__btn--secondary hidden" id="ecocoletaPopupCancel">Cancelar</button>' +
      '    <button type="button" class="ecocoleta-popup__btn ecocoleta-popup__btn--primary" id="ecocoletaPopupOk">OK</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(root);

    root.addEventListener('click', function (e) {
      if (e.target === root) {
        var o = root._ecocoletaOpts || {};
        if (!o.showCancel && !o.showInput) {
          finish(true, null);
        } else {
          finish(false, null);
        }
      }
    });

    var panel = root.querySelector('.ecocoleta-popup');
    if (panel) {
      panel.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    root.querySelector('.ecocoleta-popup__close').addEventListener('click', function () {
      var o = root._ecocoletaOpts || {};
      if (!o.showCancel && !o.showInput) {
        finish(true, null);
      } else {
        finish(false, null);
      }
    });
    root.querySelector('#ecocoletaPopupCancel').addEventListener('click', function () {
      finish(false, null);
    });
    root.querySelector('#ecocoletaPopupOk').addEventListener('click', function () {
      var opts = root._ecocoletaOpts || {};
      if (opts.showInput) {
        var inp = root.querySelector('#ecocoletaPopupInput');
        var v = inp ? inp.value : '';
        if (opts.requireNonEmpty && String(v).trim() === '') {
          if (inp) {
            inp.classList.add('ecocoleta-popup__input--error');
            inp.focus();
          }
          return;
        }
        if (inp) {
          inp.classList.remove('ecocoleta-popup__input--error');
        }
        finish(true, v);
      } else {
        finish(true, null);
      }
    });
  }

  function finish(ok, value) {
    if (typeof settle !== 'function') {
      return;
    }
    var fn = settle;
    settle = null;
    if (onKey) {
      document.removeEventListener('keydown', onKey);
      onKey = null;
    }
    hide();
    fn({ ok: ok, value: value });
  }

  function hide() {
    if (!root) {
      return;
    }
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ecocoleta-popup-open');
    var inp = root.querySelector('#ecocoletaPopupInput');
    if (inp) {
      inp.classList.remove('ecocoleta-popup__input--error');
    }
  }

  function show(opts) {
    mount();
    opts = opts || {};
    return new Promise(function (resolve) {
      settle = resolve;

      var variant = opts.variant === 'success' || opts.variant === 'error' || opts.variant === 'info' ? opts.variant : 'info';
      var panel = root.querySelector('.ecocoleta-popup');
      panel.classList.remove('ecocoleta-popup--success', 'ecocoleta-popup--error', 'ecocoleta-popup--info');
      panel.classList.add('ecocoleta-popup--' + variant);

      var title = opts.title;
      if (!title) {
        if (variant === 'success') {
          title = 'Sucesso';
        } else if (variant === 'error') {
          title = 'Erro';
        } else {
          title = 'Aviso';
        }
      }
      root.querySelector('#ecocoletaPopupTitle').textContent = title;
      root.querySelector('#ecocoletaPopupMessage').textContent = opts.message != null ? String(opts.message) : '';

      var showInput = !!opts.showInput;
      var field = root.querySelector('#ecocoletaPopupField');
      var inp = root.querySelector('#ecocoletaPopupInput');
      field.classList.toggle('hidden', !showInput);
      if (showInput) {
        inp.value = opts.defaultValue != null ? String(opts.defaultValue) : '';
      }

      var showCancel = !!opts.showCancel;
      var btnCancel = root.querySelector('#ecocoletaPopupCancel');
      btnCancel.classList.toggle('hidden', !showCancel);

      var btnOk = root.querySelector('#ecocoletaPopupOk');
      btnOk.textContent = opts.primaryLabel || (showInput ? 'Salvar' : 'Entendi');

      btnCancel.textContent = opts.cancelLabel || 'Cancelar';

      root._ecocoletaOpts = {
        showInput: showInput,
        requireNonEmpty: !!opts.requireNonEmpty,
        showCancel: showCancel,
      };

      root.classList.remove('hidden');
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('ecocoleta-popup-open');

      onKey = function (ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          var o = root._ecocoletaOpts || {};
          if (!o.showCancel && !o.showInput) {
            finish(true, null);
          } else {
            finish(false, null);
          }
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          btnOk.click();
        }
      };
      document.addEventListener('keydown', onKey);

      setTimeout(function () {
        if (showInput) {
          inp.focus();
          try {
            inp.select();
          } catch (e1) {

          }
        } else {
          btnOk.focus();
        }
      }, 50);
    });
  }

  global.UserPopup = {
    alert: function (message, o) {
      o = o || {};
      return show({
        message: message,
        title: o.title,
        variant: o.variant || 'info',
        showInput: false,
        showCancel: false,
        primaryLabel: o.okLabel || 'Entendi',
      }).then(function () {
        return undefined;
      });
    },

    confirm: function (message, o) {
      o = o || {};
      return show({
        message: message,
        title: o.title || 'Confirmar',
        variant: o.variant || 'info',
        showInput: false,
        showCancel: true,
        primaryLabel: o.okLabel || 'Sim',
        cancelLabel: o.cancelLabel || 'Não',
      }).then(function (r) {
        return !!(r && r.ok);
      });
    },

    prompt: function (message, defaultValue, o) {
      o = o || {};
      return show({
        message: message,
        title: o.title || 'Entrada',
        variant: 'info',
        showInput: true,
        defaultValue: defaultValue,
        showCancel: true,
        primaryLabel: o.okLabel || 'OK',
        cancelLabel: o.cancelLabel || 'Cancelar',
        requireNonEmpty: !!o.requireNonEmpty,
      }).then(function (r) {
        if (!r || !r.ok) {
          return null;
        }
        return r.value != null ? String(r.value) : '';
      });
    },
  };
})(typeof window !== 'undefined' ? window : this);
