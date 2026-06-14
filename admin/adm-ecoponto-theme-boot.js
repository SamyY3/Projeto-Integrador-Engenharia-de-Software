(function () {
  "use strict";
  var KEY = "ecopontoAdmTema";
  var tema = "dark";
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") tema = saved;
  } catch (e) {

  }
  document.documentElement.setAttribute("data-adm-tema", tema);
})();
