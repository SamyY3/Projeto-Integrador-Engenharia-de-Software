

(function () {
  if (typeof window.ecocoletaLoadScrollbarStyles === "function") {
    window.ecocoletaLoadScrollbarStyles();
  }
  var LEGACY = [
    "footer-container",
    "footer-info",
    "footer-logo",
    "footer-contato",
    "social",
    "footer-copy",
  ];

  var ICON = ' style="width:18px;height:18px;max-width:18px;max-height:18px;object-fit:contain;display:block"';
  var LOGO = "";
  var GRID =
    ' style="display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:28px 42px;width:100%"';
  var COL = ' style="padding:0;box-sizing:border-box"';
  var BRAND_COL = ' style="width:100%"';
  var SOCIAL_ROW =
    ' style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px"';

  var FOOTER_CSS =
    "#ecocoleta-site-footer,#ecocoleta-site-footer.footer{background:linear-gradient(165deg,#c5e8d4 0%,#7ef0b8 100%)!important;color:#1a3d2a!important;padding:calc(36px + var(--ecocoleta-header-offset,89px)) 0 28px!important;width:100%!important;max-width:100%!important;margin:0!important;box-sizing:border-box!important;clear:both!important;scroll-margin-top:var(--ecocoleta-header-offset,89px)}" +
    "#ecocoleta-site-footer .footer-inner{max-width:1180px;margin:0 auto;padding:0 28px;box-sizing:border-box}" +
    "#ecocoleta-site-footer .footer-grid{display:flex!important;flex-wrap:wrap!important;gap:32px 28px!important;align-items:flex-start!important;width:100%!important}" +
    "#ecocoleta-site-footer .footer-brand{flex:1.15 1 260px!important;min-width:220px!important}#ecocoleta-site-footer .footer-col{flex:1 1 220px!important;min-width:200px!important}" +
    "#ecocoleta-site-footer .footer-col{display:block!important;min-width:0!important;position:static!important;width:auto!important}" +
    "#ecocoleta-site-footer .footer-nav{width:auto!important;order:unset!important;flex:none!important;display:block!important;justify-content:flex-start!important}" +
    "#ecocoleta-site-footer .footer-nav ul,#ecocoleta-site-footer .footer-list{list-style:none!important;margin:0!important;padding:0!important}" +
    "#ecocoleta-site-footer .footer-list li{display:flex!important;align-items:flex-start;gap:10px}" +
    "#ecocoleta-site-footer .footer-nav a,#ecocoleta-site-footer .footer-list a{color:#1a3d2a!important;text-decoration:none!important}" +
    "#ecocoleta-site-footer .footer-list-icon img,#ecocoleta-site-footer .footer-social-link img{width:18px!important;height:18px!important;max-width:18px!important;max-height:18px!important}" +
    "body.app .footer-container,body.app .footer-info,body.app .footer-logo,body.app .footer-contato,body.app div.social:not(.footer-social),body.app div.footer-copy:not(#ecocoleta-site-footer p.footer-copy){display:none!important}" +
    "@media(max-width:900px){#ecocoleta-site-footer .footer-grid{grid-template-columns:1fr!important}#ecocoleta-site-footer .footer-brand{grid-column:auto}}";

  function ensureFooterAssets() {
    if (!document.getElementById("ecocoleta-footer-styles")) {
      var style = document.createElement("style");
      style.id = "ecocoleta-footer-styles";
      style.textContent = FOOTER_CSS;
      document.head.appendChild(style);
    }
    if (!document.querySelector('link[href*="footer.css"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "assets/css/footer.css?v=10";
      document.head.appendChild(link);
    }
  }

  function buildFooterHtml(year) {
    var d = "div";
    return (
      "<" + d + ' class="footer-inner">' +
        "<" + d + ' class="footer-brand">' +
            '<a href="tela-inicia.html" class="footer-logo-link">' +
              '<img class="eco-brand-img" src="assets/images/logo.2.png?v=5" alt="EcoColeta" width="184" height="80" loading="lazy" decoding="async"' + LOGO + ">" +
            "</a>" +
            '<p class="footer-tagline">Reciclar com propósito. Ganhar com consciência.</p>' +
            '<p class="footer-about">Plataforma de reciclagem que conecta moradores, pontos de coleta e benefícios locais.</p>' +
          "</" + d + ">" +
        "<" + d + ' class="footer-grid"' + GRID + ">" +
          "<" + d + ' class="footer-col"' + COL + ">" +
            "<h4>Institucional</h4>" +
            '<ul class="footer-list">' +
              '<li><span class="footer-list-icon"><img src="assets/images/icons pessoa.png" alt=""' + ICON + "></span><span>Universidade Faculdade Paraíso</span></li>" +
              '<li><span class="footer-list-icon"><img src="assets/images/cnpj..png" alt=""' + ICON + "></span><span>CNPJ: 00.000.000/0000-00</span></li>" +
            "</ul>" +
          "</" + d + ">" +
          "<" + d + ' class="footer-col"' + COL + ">" +
            "<h4>Contato</h4>" +
            '<ul class="footer-list">' +
              '<li><span class="footer-list-icon"><img src="assets/images/telefone-.png" alt=""' + ICON + '></span><a href="tel:+5588900000000">(88) 90000-0000</a></li>' +
              '<li><span class="footer-list-icon"><img src="assets/images/o-email 1.png" alt=""' + ICON + '></span><a href="mailto:ecocoleta@gmail.com">ecocoleta@gmail.com</a></li>' +
            "</ul>" +
            '<p class="footer-hours">Atendimento: seg–sex, 8h às 18h</p>' +
          "</" + d + ">" +
        "</" + d + ">" +
        "<" + d + ' class="footer-bottom">' +
          "<" + d + ' class="footer-social" aria-label="Redes sociais"' + SOCIAL_ROW + ">" +
            '<a href="#" class="footer-social-link" aria-label="Facebook"><img src="assets/images/icons facebook.png" alt=""' + ICON + "></a>" +
            '<a href="mailto:ecocoleta@gmail.com" class="footer-social-link footer-social-link--text" aria-label="E-mail" title="E-mail">✉</a>' +
            '<a href="#" class="footer-social-link" aria-label="X"><img src="assets/images/icons apicativo X.png" alt=""' + ICON + "></a>" +
            '<a href="#" class="footer-social-link" aria-label="YouTube"><img src="assets/images/icons-youtube.png" alt=""' + ICON + "></a>" +
            '<a href="#" class="footer-social-link" aria-label="Instagram"><img src="assets/images/icons-instagram.png" alt=""' + ICON + "></a>" +
          "</" + d + ">" +
          '<p class="footer-copy">© ' + year + " EcoColeta. Todos os direitos reservados.</p>" +
        "</" + d + ">" +
      "</" + d + ">"
    );
  }

  function removeLegacyNodes() {
    LEGACY.forEach(function (cls) {
      document.querySelectorAll("." + cls).forEach(function (el) {
        if (!el.closest("#ecocoleta-site-footer .footer-inner")) {
          el.remove();
        }
      });
    });

    var mount = document.getElementById("ecocoleta-site-footer");
    if (!mount) return;
    var next = mount.nextElementSibling;
    while (next && next.tagName !== "SCRIPT") {
      var following = next.nextElementSibling;
      var cls = next.className || "";
      if (
        LEGACY.some(function (name) {
          return cls.indexOf(name) !== -1;
        })
      ) {
        next.remove();
      }
      next = following;
    }
  }

  function removeFooterNavigation() {
    var mount = document.getElementById("ecocoleta-site-footer");
    if (!mount) return;
    mount.querySelectorAll(".footer-col").forEach(function (col) {
      var heading = col.querySelector("h4");
      if (heading && heading.textContent.trim().toLowerCase() === "navegação") {
        col.remove();
      }
    });
  }

  function initFooter() {
    var mount = document.getElementById("ecocoleta-site-footer");
    if (!mount) return;

    ensureFooterAssets();
    removeLegacyNodes();
    mount.setAttribute("role", "contentinfo");
    mount.classList.add("footer");
    mount.innerHTML = buildFooterHtml(new Date().getFullYear());
    var logoLink = mount.querySelector(".footer-logo-link");
    if (logoLink && window.ecocoletaPageUrl) {
      logoLink.href = window.ecocoletaPageUrl("tela-inicia.html");
    }
    if (typeof window.ecocoletaApplyHdLogo === "function") {
      window.ecocoletaApplyHdLogo();
    }
    removeLegacyNodes();
    removeFooterNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFooter);
  } else {
    initFooter();
  }
})();
