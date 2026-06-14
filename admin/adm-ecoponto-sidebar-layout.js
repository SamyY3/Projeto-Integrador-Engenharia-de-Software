
(function (app) {
  "use strict";
  if (!app) return;
  var open = true;
  try {
    open = sessionStorage.getItem("ecopontoAdmSidebarExpanded") !== "0";
  } catch (e) {
    open = true;
  }
  app.setAttribute("data-sidebar-state", open ? "open" : "closed");
  app.style.setProperty("grid-template-columns", (open ? "280px" : "70px") + " 1fr", "important");
  app.classList.toggle("is-sidebar-expanded", open);
  app.classList.toggle("is-sidebar-collapsed", !open);
})(document.currentScript && document.currentScript.parentElement);
