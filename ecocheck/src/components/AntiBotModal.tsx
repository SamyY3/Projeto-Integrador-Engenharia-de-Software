import { useCallback, useEffect, useState } from "react";
import type { ChallengeState, ModalStatus } from "../types";
import { VerificationService } from "../services/VerificationService";
import { HumanBehaviorValidator } from "../services/HumanBehaviorValidator";
import { PuzzleSlider } from "./PuzzleSlider";

interface AntiBotModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (token: string) => void;
  verificationService: VerificationService;
}

export function AntiBotModal({
  open,
  onClose,
  onVerified,
  verificationService,
}: AntiBotModalProps) {
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const loadChallenge = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      const next = await verificationService.fetchChallenge();
      setChallenge(next);
      setStatus("playing");
      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent("ecocheck:challenge-ready"));
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Erro ao carregar puzzle.");
    }
  }, [verificationService]);

  useEffect(() => {
    if (open) {
      loadChallenge();
    } else {
      setStatus("idle");
      setChallenge(null);
      setMessage("");
    }
  }, [open, loadChallenge]);

  const handleSuccess = async (
    positionX: number,
    validator: HumanBehaviorValidator
  ) => {
    if (!challenge) return;
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("ecocheck:verifying"));
    }
    setStatus("loading");
    const analysis = validator.analyze();
    const metrics = analysis.metrics;

    let result;
    try {
      result = await verificationService.verify(
        challenge.challengeId,
        positionX,
        metrics,
        honeypot
      );
    } finally {
      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent("ecocheck:verify-done"));
      }
    }

    if (result.sucesso && result.token) {
      setStatus("success");
      setMessage(result.mensagem || "Verificado com sucesso!");
      setTimeout(() => {
        onVerified(result.token!);
        onClose();
      }, 700);
      return;
    }

    setStatus("error");
    setMessage(result.erro || "Falha na verificacao.");
    if (result.retry) {
      setTimeout(() => loadChallenge(), 900);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-eco-deep/45 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ecocheck-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-eco border border-eco-mint/60 overflow-hidden animate-[slideUp_0.25s_ease]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-eco-mint/50 bg-gradient-to-r from-eco-cream to-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-eco-emerald">
              EcoCheck
            </p>
            <h2 id="ecocheck-title" className="text-lg font-bold text-eco-deep">
              Verificação humana
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Arraste a peça do puzzle até o encaixe correto. Isso confirma que você não é um robô.
          </p>

          {}
          <input
            type="text"
            name="ecocheck_hp"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="absolute -left-[9999px] opacity-0 h-0 w-0"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
          />

          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="h-10 w-10 rounded-full border-[3px] border-eco-mint border-t-eco-emerald animate-spin" />
              <p className="text-sm font-medium text-eco-forest">Carregando desafio…</p>
            </div>
          )}

          {status === "playing" && challenge && (
            <PuzzleSlider
              challenge={challenge}
              onSuccess={handleSuccess}
              onFail={(err) => {
                setStatus("error");
                setMessage(err);
                setTimeout(() => loadChallenge(), 800);
              }}
            />
          )}

          {status === "success" && (
            <div className="flex flex-col items-center py-8 gap-2 text-eco-emerald">
              <div className="h-14 w-14 rounded-full bg-eco-mint/40 flex items-center justify-center text-2xl">
                ✓
              </div>
              <p className="font-semibold">{message}</p>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex justify-center flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          {(status === "error" || status === "playing") && (
            <button
              type="button"
              onClick={loadChallenge}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-eco-forest to-eco-emerald shadow-md"
            >
              Novo puzzle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
