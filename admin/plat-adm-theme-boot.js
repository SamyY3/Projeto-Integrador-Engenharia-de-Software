(function () {
  "use strict";
  var KEY = "ecocoletaPlatTema";
  var tema = "light";
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") tema = saved;
  } catch (e) {

  }
  document.documentElement.setAttribute("data-plat-tema", tema);
})();
