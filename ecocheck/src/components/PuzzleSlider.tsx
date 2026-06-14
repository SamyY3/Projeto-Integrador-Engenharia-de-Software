import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ChallengeState } from "../types";
import { HumanBehaviorValidator } from "../services/HumanBehaviorValidator";

interface PuzzleSliderProps {
  challenge: ChallengeState;
  onSuccess: (positionX: number, validator: HumanBehaviorValidator) => void;
  onFail: (message: string) => void;
  disabled?: boolean;
}

function PuzzleSliderInner({
  challenge,
  onSuccess,
  onFail,
  disabled,
}: PuzzleSliderProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const validatorRef = useRef(new HumanBehaviorValidator());
  const trackRef = useRef<HTMLDivElement>(null);
  const moveRafRef = useRef(0);
  const pendingMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const maxX = challenge.width - challenge.pieceSize;

  const resetPiece = useCallback(() => {
    setOffsetX(0);
    validatorRef.current.reset();
  }, []);

  useEffect(() => {
    resetPiece();
  }, [challenge.challengeId, resetPiece]);

  useEffect(() => {
    return () => {
      if (moveRafRef.current) {
        cancelAnimationFrame(moveRafRef.current);
      }
    };
  }, []);

  const pointerDown = (clientX: number, clientY: number) => {
    if (disabled) return;
    setDragging(true);
    validatorRef.current.start();
    validatorRef.current.addSample(clientX, clientY);
  };

  const pointerMove = (clientX: number, clientY: number) => {
    if (!dragging || !trackRef.current) return;
    pendingMoveRef.current = { clientX, clientY };
    if (moveRafRef.current) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = 0;
      const pending = pendingMoveRef.current;
      const track = trackRef.current;
      if (!pending || !track) return;
      const rect = track.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(maxX, pending.clientX - rect.left - challenge.pieceSize / 2)
      );
      setOffsetX(x);
      validatorRef.current.addSample(pending.clientX, pending.clientY);
    });
  };

  const pointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const analysis = validatorRef.current.analyze();
    if (!analysis.ok) {
      onFail(analysis.reason || "Comportamento suspeito.");
      resetPiece();
      return;
    }
    onSuccess(offsetX, validatorRef.current);
  };

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-xl border border-eco-mint/80 bg-eco-cream shadow-inner"
        style={{ width: challenge.width, height: challenge.height }}
      >
        {challenge.background ? (
          <img
            src={challenge.background}
            alt=""
            className="h-full w-full object-cover select-none pointer-events-none"
            draggable={false}
            decoding="async"
          />
        ) : (
          <div
            className="h-full w-full bg-gradient-to-br from-eco-mint/40 to-eco-emerald/20"
            aria-hidden
          />
        )}

        {challenge.piece && (
          <img
            src={challenge.piece}
            alt=""
            className="absolute select-none touch-none"
            style={{
              width: challenge.pieceSize,
              height: challenge.pieceSize,
              left: offsetX,
              top: challenge.pieceY,
              cursor: disabled ? "not-allowed" : dragging ? "grabbing" : "grab",
              transition: dragging ? "none" : "left 0.15s ease",
              filter: "drop-shadow(0 8px 16px rgba(10,61,46,0.25))",
            }}
            draggable={false}
            decoding="async"
            onMouseDown={(e) => {
              e.preventDefault();
              pointerDown(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              pointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }}
          />
        )}
      </div>

      <p className="m-0 w-full text-center text-xs font-semibold text-eco-forest/90">
        Deslize o botão verde até a peça encaixar
      </p>

      <div
        ref={trackRef}
        className="relative h-11 rounded-full bg-gradient-to-r from-slate-100 to-eco-cream border border-eco-mint/70"
        style={{ width: challenge.width, maxWidth: "100%" }}
        onMouseMove={(e) => pointerMove(e.clientX, e.clientY)}
        onMouseUp={pointerUp}
        onMouseLeave={() => dragging && pointerUp()}
        onTouchMove={(e) => pointerMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={pointerUp}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-gradient-to-br from-eco-forest to-eco-emerald shadow-md border-2 border-white flex items-center justify-center text-white text-lg cursor-grab active:cursor-grabbing"
          style={{
            left: Math.max(
              0,
              Math.min(
                challenge.width - 36,
                offsetX + challenge.pieceSize / 2 - 18
              )
            ),
            transition: dragging ? "none" : "left 0.15s ease",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            pointerDown(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            pointerDown(e.touches[0].clientX, e.touches[0].clientY);
          }}
          role="slider"
          aria-valuenow={offsetX}
          aria-valuemin={0}
          aria-valuemax={maxX}
          aria-label="Arrastar peca do puzzle"
        >
          ⋮⋮
        </div>
      </div>
    </div>
  );
}

export const PuzzleSlider = memo(PuzzleSliderInner);
