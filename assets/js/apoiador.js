(function () {
  "use strict";

  function renderStats() {
    var root = document.getElementById("apo-stats-hero");
    if (!root || !window.EcoApoiadoresStats) return;
    root.innerHTML = window.EcoApoiadoresStats.map(function (s) {
      return (
        '<div class="apo-stat"><strong>' +
        s.value +
        "</strong><span>" +
        s.label +
        "</span></div>"
      );
    }).join("");
  }

  function renderPartners() {
    var root = document.getElementById("apo-partners-grid");
    if (!root || !window.EcoApoiadoresCatalog) return;
    root.innerHTML = window.EcoApoiadoresCatalog.map(function (p) {
      return (
        '<article class="apo-partner-card" style="--partner-accent:' +
        (p.accent || "#0f2c21") +
        '">' +
        '<div class="apo-partner-card__top">' +
        '<div class="apo-partner-card__logo" aria-hidden="true">' +
        p.initials +
        "</div>" +
        "<div><h3>" +
        p.name +
        '</h3><p class="apo-partner-card__meta">' +
        p.sector +
        " · desde " +
        p.since +
        "</p></div></div>" +
        "<p>" +
        p.highlight +
        "</p></article>"
      );
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderStats();
    renderPartners();
  });
})();
