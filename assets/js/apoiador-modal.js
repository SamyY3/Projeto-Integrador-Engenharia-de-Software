(function (global) {
  "use strict";

  var formBound = false;
  var lastFocus = null;
  var ensurePromise = null;
  var selectedMaterials = new Set(["plastico", "papel"]);

  var APO_MATERIAIS = [
    { id: "plastico", label: "Plástico", emoji: "🧴" },
    { id: "papel", label: "Papel / papelão", emoji: "📦" },
    { id: "vidro", label: "Vidro", emoji: "🍾" },
    { id: "metal", label: "Metal", emoji: "🛢️" },
    { id: "organico", label: "Orgânico", emoji: "🍃" },
    { id: "eletronico", label: "Eletrônico", emoji: "📱" },
    { id: "misto", label: "Rejeitos", emoji: "♻️" },
    { id: "madeira", label: "Madeira", emoji: "🪵" },
  ];

  function getRoot() {
    return document.getElementById("apo-modal-root");
  }

  function fragmentUrl() {
    return global.ecocoletaPageUrl
      ? global.ecocoletaPageUrl("apoiador.html")
      : "apoiador.html";
  }

  function mountToBody() {
    var root = getRoot();
    if (!root || root.parentElement === document.body) return;
    document.body.appendChild(root);
  }

  function ensureModal() {
    var root = getRoot();
    if (root && root.querySelector("#apo-formulario")) {
      mountToBody();
      bindCloseHandlers(root);
      bindForm();
      return Promise.resolve(root);
    }

    var mount = document.getElementById("apo-modal-body-mount");
    if (root && mount && !mount.innerHTML.trim()) {
      if (ensurePromise) return ensurePromise;

      ensurePromise = fetch(fragmentUrl())
        .then(function (res) {
          if (!res.ok) throw new Error("fetch failed");
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var sourceBody = doc.querySelector(".apo-modal__body");
          if (!sourceBody) throw new Error("missing body");
          mount.innerHTML = sourceBody.innerHTML;
          mountToBody();
          bindCloseHandlers(root);
          bindForm();
          return root;
        })
        .catch(function () {
          ensurePromise = null;
          return null;
        });

      return ensurePromise;
    }

    if (root) {
      mountToBody();
      bindCloseHandlers(root);
      bindForm();
      return Promise.resolve(root);
    }

    return Promise.resolve(null);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function needsEcopontoFields(tipo) {
    return tipo === "ecoponto" || tipo === "ambos";
  }

  function setFormMessage(msgEl, type, text) {
    if (!msgEl) return;
    msgEl.className = "apo-form-msg is-" + type;
    msgEl.textContent = text;
  }

  function clearFieldError(field) {
    if (!field) return;
    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
  }

  function markFieldError(field) {
    if (!field) return;
    field.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");
  }

  function syncMateriaisInputs() {
    var holder = document.getElementById("apo-materiais-inputs");
    if (!holder) return;
    holder.innerHTML = "";
    APO_MATERIAIS.forEach(function (item) {
      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "materiais";
      input.value = item.id;
      input.checked = selectedMaterials.has(item.id);
      input.tabIndex = -1;
      input.hidden = true;
      holder.appendChild(input);
    });
  }

  function atualizarContadorMateriais() {
    var countEl = document.getElementById("apoMateriaisCount");
    if (!countEl) return;
    var n = selectedMaterials.size;
    countEl.textContent = n === 1 ? "1 selecionado" : n + " selecionados";
  }

  function renderMateriaisPicker() {
    var grid = document.getElementById("apo-materiais-grid");
    if (!grid) return;

    grid.innerHTML = "";
    APO_MATERIAIS.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      var ativo = selectedMaterials.has(item.id);
      btn.className =
        "balanca-material-card balanca-material-card--" +
        item.id +
        (ativo ? " is-active" : "");
      btn.dataset.tipo = item.id;
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
      btn.setAttribute("aria-label", item.label + (ativo ? " — selecionado" : ""));
      btn.innerHTML =
        '<span class="balanca-material-card__check" aria-hidden="true">✓</span>' +
        '<span class="balanca-material-card__icon" aria-hidden="true">' +
        item.emoji +
        "</span>" +
        '<span class="balanca-material-card__label">' +
        item.label +
        "</span>";
      btn.addEventListener("click", function () {
        if (selectedMaterials.has(item.id)) {
          if (selectedMaterials.size > 1) {
            selectedMaterials.delete(item.id);
          }
        } else {
          selectedMaterials.add(item.id);
        }
        renderMateriaisPicker();
      });
      grid.appendChild(btn);
    });

    syncMateriaisInputs();
    atualizarContadorMateriais();
  }

  function initMateriaisPicker() {
    if (!document.getElementById("apo-materiais-grid")) return;
    renderMateriaisPicker();
  }

  function getCheckedMateriais(form) {
    var list = [];
    form.querySelectorAll('input[name="materiais"]:checked').forEach(function (box) {
      list.push(box.value);
    });
    return list;
  }

  function updateEcopontoSection() {
    var tipo = document.getElementById("apo-tipo");
    var section = document.getElementById("apo-ecoponto-section");
    if (!tipo || !section) return;

    var show = needsEcopontoFields(tipo.value);
    section.classList.toggle("is-hidden", !show);
    section.setAttribute("aria-hidden", show ? "false" : "true");
    section.querySelectorAll(".apo-req--pev").forEach(function (el) {
      el.style.display = show ? "" : "none";
    });
  }

  function validateForm(form) {
    var tipo = String(form.tipo_solicitacao.value || "ambos");
    var invalid = [];

    [form.empresa, form.contato, form.email, form.telefone, form.consentimento].forEach(
      clearFieldError
    );

    if (!String(form.empresa.value || "").trim()) {
      markFieldError(form.empresa);
      invalid.push("informe a razão social ou nome fantasia");
    }
    if (!String(form.contato.value || "").trim()) {
      markFieldError(form.contato);
      invalid.push("informe o nome do responsável");
    }
    if (!isValidEmail(String(form.email.value || "").trim())) {
      markFieldError(form.email);
      invalid.push("informe um e-mail de contato válido");
    }
    if (!String(form.telefone.value || "").trim()) {
      markFieldError(form.telefone);
      invalid.push("informe telefone ou WhatsApp");
    }
    if (!form.consentimento || !form.consentimento.checked) {
      markFieldError(form.consentimento);
      invalid.push("aceite o uso dos dados para contato");
    }

    if (needsEcopontoFields(tipo)) {
      [
        form.nome_ecoponto,
        form.responsavel_ecoponto,
        form.endereco_ecoponto,
        form.bairro_ecoponto,
        form.cidade_ecoponto,
        form.horario_ecoponto,
      ].forEach(clearFieldError);

      if (!String(form.nome_ecoponto.value || "").trim()) {
        markFieldError(form.nome_ecoponto);
        invalid.push("informe o nome do EcoPonto");
      }
      if (!String(form.responsavel_ecoponto.value || "").trim()) {
        markFieldError(form.responsavel_ecoponto);
        invalid.push("informe o responsável no local");
      }
      if (!String(form.endereco_ecoponto.value || "").trim()) {
        markFieldError(form.endereco_ecoponto);
        invalid.push("informe o endereço completo do EcoPonto");
      }
      if (!String(form.bairro_ecoponto.value || "").trim()) {
        markFieldError(form.bairro_ecoponto);
        invalid.push("informe o bairro do EcoPonto");
      }
      if (!String(form.cidade_ecoponto.value || "").trim()) {
        markFieldError(form.cidade_ecoponto);
        invalid.push("informe a cidade do EcoPonto");
      }
      if (!String(form.horario_ecoponto.value || "").trim()) {
        markFieldError(form.horario_ecoponto);
        invalid.push("informe o horário de funcionamento");
      }
      if (!getCheckedMateriais(form).length) {
        invalid.push("selecione ao menos um material aceito");
      }
    }

    return invalid;
  }

  function bindForm() {
    if (formBound) return;

    var form = document.getElementById("apo-formulario");
    var tipo = document.getElementById("apo-tipo");
    if (!form) return;

    formBound = true;

    if (tipo) {
      tipo.addEventListener("change", updateEcopontoSection);
      updateEcopontoSection();
    }

    initMateriaisPicker();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = document.getElementById("apo-form-msg");
      var errors = validateForm(form);

      if (errors.length) {
        setFormMessage(
          msg,
          "error",
          "Revise o formulário: " + errors.slice(0, 3).join("; ") + "."
        );
        var firstInvalid = form.querySelector(".is-invalid");
        var scrollRoot = form.closest(".apo-modal__body");
        if (firstInvalid && scrollRoot) {
          firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      var email = String(form.email.value || "").trim();
      setFormMessage(
        msg,
        "success",
        "Solicitação registrada! Enviaremos retorno para " +
          email +
          " em até 2 dias úteis com os próximos passos da parceria."
      );
      form.reset();
      if (tipo) {
        tipo.value = "ambos";
        updateEcopontoSection();
      }
      selectedMaterials = new Set(["plastico", "papel"]);
      renderMateriaisPicker();
    });
  }

  function openModal(opts) {
    var root = getRoot();
    if (!root) return;

    lastFocus = document.activeElement;
    root.classList.remove("hidden");
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("apo-modal-open");

    if (opts && opts.tier) {
      var select = document.getElementById("apo-tier");
      if (select) select.value = opts.tier;
    }

    var body = root.querySelector(".apo-modal__body");
    if (body) body.scrollTop = 0;

    var closeBtn = root.querySelector(".apo-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    var root = getRoot();
    if (!root) return;

    root.classList.add("hidden");
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("apo-modal-open");

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function bindCloseHandlers(root) {
    if (!root || root.dataset.apoCloseBound === "1") return;
    root.dataset.apoCloseBound = "1";
    root.querySelectorAll("[data-apo-close-modal]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
  }

  function openFromTrigger(trigger) {
    var tier = trigger.getAttribute("data-tier") || "";
    ensureModal().then(function (root) {
      if (!root) {
        alert("Não foi possível abrir o formulário. Tente novamente.");
        return;
      }
      openModal({ tier: tier });
    });
  }

  function initTriggers() {
    document.addEventListener("click", function (e) {
      var openBtn = e.target.closest("[data-apo-open-modal], .btn-apoiador");
      if (!openBtn) return;
      e.preventDefault();
      e.stopPropagation();
      openFromTrigger(openBtn);
    });
  }

  function init() {
    mountToBody();
    ensureModal();
    initTriggers();

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var root = getRoot();
      if (root && root.classList.contains("is-open")) closeModal();
    });

    if (global.location.search.indexOf("open=1") >= 0) {
      openFromTrigger(document.createElement("button"));
    }
  }

  global.EcoApoiadorModal = {
    open: function (opts) {
      return ensureModal().then(function (root) {
        if (!root) return false;
        openModal(opts || {});
        return true;
      });
    },
    close: closeModal,
    init: init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
