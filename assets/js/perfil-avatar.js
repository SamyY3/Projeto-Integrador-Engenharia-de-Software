(function (global) {
  'use strict';

  var STORAGE_KEY = 'userFoto';
  var STORAGE_HISTORY = 'userFotoHistory';
  var MAX_HISTORY = 8;
  var MAX_EDGE = 512;
  var JPEG_QUALITY = 0.82;

  var pendingDataUrl = null;
  var openingSnapshot = null;
  var els = {};
  var didBind = false;

  function getStored() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setStored(dataUrl) {
    try {
      if (dataUrl) {
        localStorage.setItem(STORAGE_KEY, dataUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}
  }

  function getHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_HISTORY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (x) {
        return typeof x === 'string' && x.indexOf('data:image') === 0;
      });
    } catch (e) {
      return [];
    }
  }

  function setHistory(arr) {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr.slice(0, MAX_HISTORY)));
    } catch (e) {
      try {
        localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr.slice(0, 3)));
      } catch (e2) {}
    }
  }

  function pushHistory(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return;
    var h = getHistory().filter(function (x) {
      return x !== dataUrl;
    });
    h.unshift(dataUrl);
    setHistory(h);
  }

  function resizeDataUrl(dataUrl, callback) {
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) {
        callback(null);
        return;
      }
      var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
      var tw = Math.round(w * scale);
      var th = Math.round(h * scale);
      var canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      var ctx = canvas.getContext('2d');
      if (!ctx) {
        callback(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, tw, th);
      try {
        callback(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (e) {
        callback(dataUrl);
      }
    };
    img.onerror = function () {
      callback(null);
    };
    img.src = dataUrl;
  }

  function isAvatarImageRef(u) {
    if (!u || typeof u !== 'string') return false;
    if (u.indexOf('data:image') === 0) return true;
    if (u.indexOf('http://') === 0 || u.indexOf('https://') === 0) return true;
    if (u.indexOf('//') === 0) return true;
    if (u.indexOf('assets/images/') === 0) return true;
    if (u.indexOf('uploads/') === 0) return true;
    if (u.indexOf('/') === 0) return true;
    return false;
  }

  function readFileAsResized(file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      var raw = reader.result;
      if (typeof raw !== 'string') {
        callback(null);
        return;
      }
      resizeDataUrl(raw, callback);
    };
    reader.onerror = function () {
      callback(null);
    };
    reader.readAsDataURL(file);
  }

  function syncRing(ring, img, url) {
    if (!ring || !img) return;
    img.onerror = function () {
      try {
        img.removeAttribute('src');
        ring.classList.remove('avatar-perfil--has-photo');
        localStorage.removeItem(STORAGE_KEY);
      } catch (e0) {}
    };
    var u = url != null ? url : getStored();
    if (isAvatarImageRef(u)) {
      ring.classList.add('avatar-perfil--has-photo');
      img.src = u;
    } else {
      img.removeAttribute('src');
      ring.classList.remove('avatar-perfil--has-photo');
    }
  }

  function refreshAllRings() {
    var u = getStored();
    if (els.cardRing && els.cardImg) syncRing(els.cardRing, els.cardImg, u);
    if (els.modalRing && els.modalImg) syncRing(els.modalRing, els.modalImg, u);
  }

  function setPreview(dataUrl) {
    pendingDataUrl = dataUrl;
    var prev = els.preview;
    var ph = els.previewPh;
    if (!prev) return;
    if (isAvatarImageRef(dataUrl)) {
      prev.src = dataUrl;
      prev.classList.add('is-visible');
      if (ph) ph.classList.add('hidden');
    } else {
      prev.removeAttribute('src');
      prev.classList.remove('is-visible');
      if (ph) ph.classList.remove('hidden');
    }
    updateSaveEnabled();
  }

  function updateSaveEnabled() {}

  function applyNewImageDataUrl(dataUrl, fromFileUpload) {
    if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return;
    if (fromFileUpload) {
      pushHistory(dataUrl);
    }
    setStored(dataUrl);
    refreshAllRings();
    closeModal();
  }

  function handleLocalAvatarFile(file, inputEl) {
    if (!file) {
      if (inputEl) inputEl.value = '';
      return;
    }
    if (!file.type || file.type.indexOf('image/') !== 0) {
      if (inputEl) inputEl.value = '';
      return;
    }
    readFileAsResized(file, function (out) {
      if (out) {
        applyNewImageDataUrl(out, true);
      } else {
        if (window.UserPopup && typeof window.UserPopup.alert === 'function') {
          void window.UserPopup.alert('Não foi possível processar esta imagem. Tente outro arquivo.', { variant: 'error' });
        } else {
          window.alert('Não foi possível processar esta imagem. Tente outro arquivo.');
        }
      }
      if (inputEl) inputEl.value = '';
    });
  }

  function renderHistoryGrid() {
    var grid = els.historyGrid;
    var empty = els.historyEmpty;
    if (!grid) return;
    grid.innerHTML = '';
    var list = getHistory();
    if (!list.length) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    list.forEach(function (dataUrl, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'avatar-photo-history__btn';
      b.setAttribute('aria-label', 'Usar imagem ' + (idx + 1));
      var im = document.createElement('img');
      im.alt = '';
      im.src = dataUrl;
      b.appendChild(im);
      b.addEventListener('click', function () {
        var all = grid.querySelectorAll('.avatar-photo-history__btn');
        for (var i = 0; i < all.length; i++) {
          all[i].classList.remove('is-selected');
        }
        b.classList.add('is-selected');
        resizeDataUrl(dataUrl, function (small) {
          var u = small || dataUrl;
          setStored(u);
          refreshAllRings();
          closeModal();
        });
      });
      grid.appendChild(b);
    });
  }

  function openModal() {
    var root = els.modalRoot;
    if (!root) return;
    openingSnapshot = getStored() || null;
    pendingDataUrl = openingSnapshot;
    setPreview(openingSnapshot || null);
    renderHistoryGrid();
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('photo-modal-open');
    if (els.fileInput) els.fileInput.value = '';
  }

  function closeModal() {
    var root = els.modalRoot;
    if (!root) return;
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('photo-modal-open');
    pendingDataUrl = null;
    openingSnapshot = null;
    if (els.fileInput) els.fileInput.value = '';
  }

  function commitSave() {
    closeModal();
  }

  function bind() {
    els.modalRoot = document.getElementById('avatarPhotoModal');
    els.cardRing = document.getElementById('cardAvatarRing');
    els.cardImg = document.getElementById('avatarPerfilImg');
    els.cardFile = document.getElementById('avatarPerfilFile');
    els.modalRing = document.getElementById('modalAvatarRing');
    els.modalImg = document.getElementById('modalFoto');
    els.modalFile = document.getElementById('avatarPerfilFileModal');
    els.preview = document.getElementById('avatarPhotoPreview');
    els.previewPh = document.getElementById('avatarPhotoPreviewPh');
    els.btnClose = document.getElementById('avatarPhotoModalClose');
    els.btnCancel = document.getElementById('avatarPhotoModalCancel');
    els.btnFile = document.getElementById('avatarPhotoModalChooseFile');
    els.fileInput = document.getElementById('avatarPhotoFileInput');
    els.historyGrid = document.getElementById('avatarPhotoHistoryGrid');
    els.historyEmpty = document.getElementById('avatarPhotoHistoryEmpty');
    els.libraryBtn = document.getElementById('avatarOpenLibraryBtn');

    if (els.libraryBtn) {
      els.libraryBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    }

    if (els.cardFile) {
      els.cardFile.addEventListener('change', function (ev) {
        var f = ev.target.files && ev.target.files[0];
        handleLocalAvatarFile(f, els.cardFile);
      });
    }
    if (els.modalFile) {
      els.modalFile.addEventListener('change', function (ev) {
        var f = ev.target.files && ev.target.files[0];
        handleLocalAvatarFile(f, els.modalFile);
      });
    }

    if (els.btnClose) els.btnClose.addEventListener('click', closeModal);
    if (els.btnCancel) els.btnCancel.addEventListener('click', closeModal);

    if (els.modalRoot) {
      els.modalRoot.addEventListener('click', function (e) {
        if (e.target === els.modalRoot) {
          closeModal();
        }
        if (e.target.classList && e.target.classList.contains('avatar-photo-modal__backdrop')) {
          closeModal();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.modalRoot && !els.modalRoot.classList.contains('hidden')) {
        closeModal();
      }
    });

    if (els.btnFile && els.fileInput) {
      els.btnFile.addEventListener('click', function () {
        els.fileInput.click();
      });
    }

    if (els.fileInput) {
      els.fileInput.addEventListener('change', function () {
        var file = els.fileInput.files && els.fileInput.files[0];
        handleLocalAvatarFile(file, els.fileInput);
      });
    }

    refreshAllRings();
  }

  function init() {
    if (didBind) {
      refreshAllRings();
      return;
    }
    didBind = true;
    bind();
  }

  global.EcoColetaAvatar = {
    init: init,
    refresh: refreshAllRings,
    openModal: openModal,
    closeModal: closeModal,
    syncModalMiniFromStorage: function () {
      if (els.modalRing && els.modalImg) syncRing(els.modalRing, els.modalImg);
    },
  };
})(typeof window !== 'undefined' ? window : this);
