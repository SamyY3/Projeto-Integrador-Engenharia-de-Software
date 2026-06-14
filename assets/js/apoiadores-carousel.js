(function (global) {
  "use strict";

  function buildCard(item) {
    return (
      '<article class="apoio-card">' +
      '<div class="apoio-box">' +
      '<span class="apoio-box__mark" aria-hidden="true">' +
      (item.initials || item.name.slice(0, 2)) +
      "</span>" +
      '<strong class="apoio-box__name">' +
      item.name +
      "</strong>" +
      "</div>" +
      '<span class="apoio-card__sector">' +
      item.sector +
      "</span>" +
      "</article>"
    );
  }

  function renderCarousel(container, items) {
    if (!container || !items || !items.length) return;

    var cards = items.map(buildCard).join("");
    container.innerHTML =
      '<div class="apoiadores-track">' +
      '<div class="apoiadores-group">' +
      cards +
      "</div>" +
      '<div class="apoiadores-group" aria-hidden="true">' +
      cards +
      "</div>" +
      "</div>";
  }

  global.EcoApoiadoresCarousel = {
    render: renderCarousel,
    mount: function (selector) {
      var root = document.querySelector(selector);
      if (!root || !global.EcoApoiadoresCatalog) return;
      root.classList.add("apoiadores", "overflow-x-auto", "scroll-smooth");
      renderCarousel(root, global.EcoApoiadoresCatalog);
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    EcoApoiadoresCarousel.mount("#eco-apoiadores-carousel");
    EcoApoiadoresCarousel.mount("#eco-apoiadores-carousel-page");
  });
})(window);
