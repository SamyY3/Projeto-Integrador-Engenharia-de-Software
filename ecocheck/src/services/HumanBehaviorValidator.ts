

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export interface BehaviorAnalysis {
  ok: boolean;
  reason?: string;
  metrics: {
    durationMs: number;
    sampleCount: number;
    straightRatio: number;
    velocityStd: number;
    totalDistance: number;
  };
}

export class HumanBehaviorValidator {
  private samples: PointerSample[] = [];
  private startedAt = 0;

  start(): void {
    this.samples = [];
    this.startedAt = performance.now();
  }

  reset(): void {
    this.samples = [];
    this.startedAt = 0;
  }

  addSample(x: number, y: number): void {
    if (!this.startedAt) this.startedAt = performance.now();
    const last = this.samples[this.samples.length - 1];
    if (last && last.x === x && last.y === y) return;
    this.samples.push({ x, y, t: performance.now() });
  }

  analyze(): BehaviorAnalysis {
    const durationMs = this.startedAt ? performance.now() - this.startedAt : 0;
    const sampleCount = this.samples.length;

    if (durationMs < 500) {
      return this.fail("Interacao muito rapida.", durationMs, sampleCount);
    }
    if (sampleCount < 6) {
      return this.fail("Poucos movimentos registrados.", durationMs, sampleCount);
    }

    let totalDistance = 0;
    const velocities: number[] = [];

    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1];
      const b = this.samples[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const dt = Math.max(1, b.t - a.t);
      totalDistance += dist;
      velocities.push(dist / dt);
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const straightLine = Math.hypot(last.x - first.x, last.y - first.y);
    const straightRatio =
      totalDistance > 0 ? Math.min(1, straightLine / totalDistance) : 1;

    const avg =
      velocities.reduce((s, v) => s + v, 0) / Math.max(1, velocities.length);
    const variance =
      velocities.reduce((s, v) => s + (v - avg) ** 2, 0) /
      Math.max(1, velocities.length);
    const velocityStd = Math.sqrt(variance);

    const metrics = {
      durationMs: Math.round(durationMs),
      sampleCount,
      straightRatio: Number(straightRatio.toFixed(4)),
      velocityStd: Number(velocityStd.toFixed(4)),
      totalDistance: Number(totalDistance.toFixed(2)),
    };

    if (straightRatio > 0.985 && velocityStd < 0.02 && durationMs < 900) {
      return { ok: false, reason: "Movimento retilíneo demais.", metrics };
    }
    if (velocityStd < 0.015 && durationMs < 1200) {
      return { ok: false, reason: "Velocidade suspeita.", metrics };
    }

    return { ok: true, metrics };
  }

  private fail(
    reason: string,
    durationMs: number,
    sampleCount: number
  ): BehaviorAnalysis {
    return {
      ok: false,
      reason,
      metrics: {
        durationMs: Math.round(durationMs),
        sampleCount,
        straightRatio: 1,
        velocityStd: 0,
        totalDistance: 0,
      },
    };
  }
}
