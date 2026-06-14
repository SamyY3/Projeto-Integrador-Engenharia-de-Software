
(function () {
  "use strict";
  var KEY = "ecopontoAdmSidebarExpanded";
  var expanded = true;
  try {
    expanded = sessionStorage.getItem(KEY) !== "0";
  } catch (e) {
    expanded = true;
  }
  var root = document.documentElement;
  root.classList.toggle("adm-sidebar-pref-expanded", expanded);
  root.classList.toggle("adm-sidebar-pref-collapsed", !expanded);
})();
