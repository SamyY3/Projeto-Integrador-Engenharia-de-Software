function requestHomeLocation() {
  const run = () => {
    if (window.EcoColetaHomeMap && typeof window.EcoColetaHomeMap.requestLocation === "function") {
      window.EcoColetaHomeMap.requestLocation({ skipConsent: true });
    }
  };

  if (window.EcoColetaHomeMap) {
    run();
    return;
  }

  window.addEventListener("ecocoleta:home-map-ready", run, { once: true });
}

function ensureLiveWatchAfterGrant() {
  window.addEventListener(
    "ecocoleta:home-map-ready",
    () => {
      if (
        window.EcoColetaHomeMap &&
        typeof window.EcoColetaHomeMap.startLiveTracking === "function"
      ) {
        window.EcoColetaHomeMap.startLiveTracking();
      }
    },
    { once: true }
  );
}

function initHomeGeoPopup() {
  if (!document.body || !document.body.classList.contains("home")) return;
  if (window.__ecocoletaGeoPopupInit) return;
  window.__ecocoletaGeoPopupInit = true;

  if (!window.EcoColetaGeoConsent) return;

  window.EcoColetaGeoConsent.init();

  void window.EcoColetaGeoConsent.requestPermission({
    title: "Disponibilizar sua localização?",
    message:
      "Precisamos da sua localização atual para mostrar ecopontos próximos e calcular rotas no mapa.",
    onAllow: () => {
      ensureLiveWatchAfterGrant();
      requestHomeLocation();
    },
    onDeny: () => {},
  });
}

function initHomePageExtras() {
  if (window.__ecocoletaHomeExtrasInit) return;
  window.__ecocoletaHomeExtrasInit = true;

  if (!window.__ecocoletaNotifInit) {
    const btnNotif = document.querySelector(".notif-btn");
    const overlay = document.querySelector(".notif-overlay");
    const closeNotif = document.querySelector(".close-notif");

    if (btnNotif && overlay) {
      btnNotif.addEventListener("click", () => {
        overlay.classList.remove("hidden");
      });

      if (closeNotif) {
        closeNotif.addEventListener("click", () => {
          overlay.classList.add("hidden");
        });
      }

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.add("hidden");
        }
      });
    }
  }

  const links = document.querySelectorAll(".menu a");

  links.forEach((link) => {
    const href = link.getAttribute("href");

    if (href === "#") {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        alert("Página em construção 🚧");
      });
    }
  });
}

function bootHomePage() {
  initHomeGeoPopup();
  initHomePageExtras();
}

bootHomePage();
