

export interface ChallengeResponse {
  sucesso: boolean;
  challengeId?: string;
  width?: number;
  height?: number;
  pieceSize?: number;
  pieceY?: number;
  background?: string;
  piece?: string;
  fallbackClientRender?: boolean;
  visualSeed?: number;
  expiresIn?: number;
  erro?: string;
}

export interface BehaviorMetrics {
  durationMs: number;
  sampleCount: number;
  straightRatio: number;
  velocityStd: number;
  totalDistance: number;
}

export interface VerifyResponse {
  sucesso: boolean;
  token?: string;
  expiresIn?: number;
  mensagem?: string;
  erro?: string;
  retry?: boolean;
}

export type ModalStatus = "idle" | "loading" | "playing" | "success" | "error";

export interface ChallengeState {
  challengeId: string;
  width: number;
  height: number;
  pieceSize: number;
  pieceY: number;
  background?: string;
  piece?: string;
  fallbackClientRender?: boolean;
  visualSeed?: number;
}
