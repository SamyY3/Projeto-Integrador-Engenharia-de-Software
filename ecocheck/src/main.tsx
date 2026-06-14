import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AntiBotModal } from "./components/AntiBotModal";
import { VerificationService } from "./services/VerificationService";

const verificationService = new VerificationService(
  typeof window !== "undefined" && (window as EcoCheckWindow).EcoCheckConfig?.apiUrl
    ? (window as EcoCheckWindow).EcoCheckConfig!.apiUrl!
    : "ecocheck-api.php"
);

interface EcoCheckWindow extends Window {
  EcoCheckConfig?: { apiUrl?: string };
  EcoCheck?: EcoCheckApi;
  EcoAntiBot?: EcoCheckLegacyApi;
  EcoCheckBridge?: { updateStatus: () => void };
}

export interface EcoCheckApi {
  open: () => Promise<{ ok: boolean; token?: string; erro?: string }>;
  ensureVerified: () => Promise<{ ok: boolean; token?: string; erro?: string }>;
  hasValidToken: () => boolean;
  getToken: () => string | null;
  clearToken: () => void;
}

export interface EcoCheckLegacyApi {
  init: () => void;
  validate: () => { ok: boolean; erro: string | null };
  reset: () => void;
  isVerified: () => boolean;
  openModal: () => Promise<{ ok: boolean; token?: string; erro?: string }>;
}

function App({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: (token: string) => void;
}) {
  return (
    <AntiBotModal
      open={open}
      onVerified={onVerified}
      onClose={onClose}
      verificationService={verificationService}
    />
  );
}

function mountEcoCheck(): EcoCheckApi {
  let rootEl = document.getElementById("ecocheck-root");
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "ecocheck-root";
    document.body.appendChild(rootEl);
  }

  const root = createRoot(rootEl);
  let resolveOpen: ((v: { ok: boolean; token?: string; erro?: string }) => void) | null =
    null;

  const render = (open: boolean) => {
    root.render(
      <App
        open={open}
        onClose={() => {
          render(false);
          if (typeof document !== "undefined") {
            document.dispatchEvent(new CustomEvent("ecocheck:modal-closed"));
          }
          if (resolveOpen) {
            resolveOpen({ ok: false, erro: "Verificacao cancelada." });
            resolveOpen = null;
          }
        }}
        onVerified={(token) => {
          if (typeof document !== "undefined") {
            document.dispatchEvent(new CustomEvent("ecocheck:verified"));
          }
          if (window.EcoCheckBridge && typeof (window as EcoCheckWindow).EcoCheckBridge?.updateStatus === "function") {
            (window as EcoCheckWindow).EcoCheckBridge!.updateStatus();
          }
          if (resolveOpen) {
            resolveOpen({ ok: true, token });
            resolveOpen = null;
          }
        }}
      />
    );
  };

  render(false);

  const api: EcoCheckApi = {
    hasValidToken: () => verificationService.hasValidToken(),
    getToken: () => verificationService.getToken(),
    clearToken: () => verificationService.clearToken(),
    open: () =>
      new Promise((resolve) => {
        if (verificationService.hasValidToken()) {
          resolve({ ok: true, token: verificationService.getToken()! });
          return;
        }
        resolveOpen = resolve;
        render(true);
      }),
    ensureVerified: async () => {
      if (verificationService.hasValidToken()) {
        return { ok: true, token: verificationService.getToken()! };
      }
      return api.open();
    },
  };

  return api;
}

const ecoCheckApi = mountEcoCheck();

(window as EcoCheckWindow).EcoCheck = ecoCheckApi;

(window as EcoCheckWindow).EcoAntiBot = {
  init: () => {},
  validate: () => {
    const token = verificationService.getToken();
    if (!token) {
      return { ok: false, erro: 'Conclua a verificacao EcoCheck "Nao sou um robo".' };
    }
    return { ok: true, erro: null };
  },
  reset: () => verificationService.clearToken(),
  isVerified: () => verificationService.hasValidToken(),
  openModal: () => ecoCheckApi.open(),
};
