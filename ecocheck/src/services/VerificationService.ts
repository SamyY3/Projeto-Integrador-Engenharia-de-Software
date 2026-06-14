import type {
  BehaviorMetrics,
  ChallengeResponse,
  ChallengeState,
  VerifyResponse,
} from "../types";

const TOKEN_KEY = "ecocheck_token";
const TOKEN_EXP_KEY = "ecocheck_token_exp";

export class VerificationService {
  private apiUrl: string;

  constructor(apiUrl = "ecocheck-api.php") {
    this.apiUrl = apiUrl;
  }

  async fetchChallenge(): Promise<ChallengeState> {
    const url = `${this.apiUrl}?action=challenge&_=${Date.now()}`;
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    const data = (await res.json()) as ChallengeResponse;

    if (!data.sucesso || !data.challengeId) {
      throw new Error(data.erro || "Nao foi possivel carregar o desafio.");
    }

    return {
      challengeId: data.challengeId,
      width: data.width ?? 300,
      height: data.height ?? 150,
      pieceSize: data.pieceSize ?? 52,
      pieceY: data.pieceY ?? 49,
      background: data.background,
      piece: data.piece,
      fallbackClientRender: data.fallbackClientRender,
      visualSeed: data.visualSeed,
    };
  }

  async verify(
    challengeId: string,
    positionX: number,
    metrics: BehaviorMetrics,
    honeypot = ""
  ): Promise<VerifyResponse> {
    const res = await fetch(`${this.apiUrl}?action=verify`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId,
        positionX: Math.round(positionX),
        durationMs: metrics.durationMs,
        sampleCount: metrics.sampleCount,
        straightRatio: metrics.straightRatio,
        velocityStd: metrics.velocityStd,
        honeypot,
      }),
    });

    const data = (await res.json()) as VerifyResponse;

    if (data.sucesso && data.token) {
      this.saveToken(data.token, data.expiresIn ?? 600);
    }

    return data;
  }

  saveToken(token: string, expiresInSec: number): void {
    const exp = Date.now() + expiresInSec * 1000;
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXP_KEY, String(exp));
  }

  getToken(): string | null {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0);
    if (!token || exp < Date.now()) {
      this.clearToken();
      return null;
    }
    return token;
  }

  hasValidToken(): boolean {
    return !!this.getToken();
  }

  clearToken(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
  }
}
