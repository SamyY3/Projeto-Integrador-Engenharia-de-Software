(function () {
  if (document.getElementById("adm-sidebar-sprite")) return;

  document.write(
    '<svg id="adm-sidebar-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
      '<symbol id="adm-icon-menu" viewBox="0 0 24 24">' +
        '<path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-home" viewBox="0 0 24 24">' +
        '<path d="M4 10.5 12 4l8 6.5V20a1.75 1.75 0 0 1-1.75 1.75H5.75A1.75 1.75 0 0 1 4 20v-9.5Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>' +
        '<path d="M10 21.75V14h4v7.75" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-truck" viewBox="0 0 24 24">' +
        '<path d="M3.25 9h9.25V7h2.35l2.15 2.25H19.5v5.75H18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="7" cy="18" r="1.65" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
        '<circle cx="16.5" cy="18" r="1.65" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M3.25 13.5H5.5M8.65 18H14.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-materiais" viewBox="0 0 24 24">' +
        '<path d="M12 2.75 4.5 7.25v9.5L12 21.25l7.5-4.5V7.25L12 2.75Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M12 2.75v18.5M4.5 7.25 12 11.75l7.5-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-recycle" viewBox="0 0 24 24">' +
        '<path d="M7.75 8.75a6.25 6.25 0 0 1 10.75-1.25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M16.75 6.75v2.75h-2.75M16.25 15.25a6.25 6.25 0 0 1-10.75 1.25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M7.25 17.25v-2.75h2.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-reports" viewBox="0 0 24 24">' +
        '<path d="M14.25 2.25H8.25a1.75 1.75 0 0 0-1.75 1.75v15.5a1.75 1.75 0 0 0 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75V7.75l-4.5-4.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M14.25 2.25v5.5h5.5M8.25 13.25h7.5M8.25 16.75h5.25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-settings" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M12 3.25v2M12 18.75v2M5.55 5.55l1.4 1.4M17.05 17.05l1.4 1.4M3.25 12h2M18.75 12h2M5.55 18.45l1.4-1.4M17.05 6.95l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-kpi-peso" viewBox="0 0 24 24">' +
        '<path d="M12 3.25v13.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>' +
        '<path d="M8.25 7.25h7.5M6.75 16.75h10.5M7.75 19.75h8.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>' +
        '<path d="M9.5 10.25h5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-kpi-taxa" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.45"/>' +
        '<path d="M12 12V4.25M12 12h7.25" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-plastico" viewBox="0 0 24 24">' +
        '<path d="M10 2.25h4v1.75h2a.85.85 0 0 1 .85.85v.9h-.85v12.35a2.15 2.15 0 0 1-2.15 2.15h-2.7a2.15 2.15 0 0 1-2.15-2.15V6.75H7.15v-.9a.85.85 0 0 1 .85-.85h2V2.25Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>' +
        '<path d="M9.25 8.25h5.5M9.25 12h5.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-papel" viewBox="0 0 24 24">' +
        '<path d="M14.25 2.25H8.25a1.75 1.75 0 0 0-1.75 1.75v15.5a1.75 1.75 0 0 0 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75V7.75l-4.5-4.5Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>' +
        '<path d="M14.25 2.25v5.5h5.5M8.25 13.25h7.5M8.25 17h4.75" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-vidro" viewBox="0 0 24 24">' +
        '<path d="M9.25 2.25h5.5l1.35 2.65H18.5v1.65h-.85l-1.1 13.35a1.75 1.75 0 0 1-1.75 1.35H8.7a1.75 1.75 0 0 1-1.75-1.35L5.85 6.55H5V4.9h2.35L9.25 2.25Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>' +
        '<path d="M8.25 10.25h7.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-metal" viewBox="0 0 24 24">' +
        '<path d="M8.25 3.25h7.5l1.1 2.75H18.5v12.65a1.75 1.75 0 0 1-1.75 1.75H7.25a1.75 1.75 0 0 1-1.75-1.75V6h2.55L8.25 3.25Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>' +
        '<ellipse cx="12" cy="13.25" rx="3.75" ry="1.1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-organico" viewBox="0 0 24 24">' +
        '<path d="M12 3.25c-3.2 3.45-5.5 6.2-5.5 9.75a5.5 5.5 0 0 0 11 0c0-3.55-2.3-6.3-5.5-9.75Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>' +
        '<path d="M12 13.25v3.75M10.25 16.75h3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-madeira" viewBox="0 0 24 24">' +
        '<path d="M8 4h8v4H8V4ZM7 8h10l-1 12H8L7 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-eletronicos" viewBox="0 0 24 24">' +
        '<rect x="5" y="4" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M9 18h6M12 7v4l2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</symbol>" +
      '<symbol id="adm-icon-mat-outros" viewBox="0 0 24 24">' +
        '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-.9 1.8 1.8 0 0 1 0-1.8l3-5.5M11 19h8.2a1.8 1.8 0 0 0 1.6-.9 1.8 1.8 0 0 0 0-1.8l-1.2-2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="m14 16-3 3 3 3M8.3 13.6 7.2 9.5 3.1 10.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      "</symbol>" +
    "</svg>"
  );
})();
