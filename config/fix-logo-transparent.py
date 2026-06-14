#!/usr/bin/env python3
"""Remove fundo sólido da logo.2.png (mint) → PNG transparente."""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Instale Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "logo.2.png")
BAK = os.path.join(ROOT, "assets", "images", "logo.2.bak.png")


def color_dist(c1, c2):
    return sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5


def sample_bg(img: Image.Image) -> tuple[int, int, int]:
    w, h = img.size
    pts = [
        (1, 1),
        (w - 2, 1),
        (1, h - 2),
        (w - 2, h - 2),
        (w // 2, 1),
        (w // 2, h - 2),
    ]
    rs = gs = bs = 0
    n = 0
    px = img.load()
    for x, y in pts:
        r, g, b, _ = px[x, y]
        rs += r
        gs += g
        bs += b
        n += 1
    return (rs // n, gs // n, bs // n)


def make_transparent(img: Image.Image, bg: tuple[int, int, int], tol: float = 38.0) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    soft = tol + 22.0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = color_dist((r, g, b), bg)
            if d <= tol:
                px[x, y] = (r, g, b, 0)
            elif d < soft:
                fade = int(255 * (d - tol) / (soft - tol))
                px[x, y] = (r, g, b, min(a, fade))
    return img


def main() -> int:
    if not os.path.isfile(SRC):
        print("Arquivo não encontrado:", SRC, file=sys.stderr)
        return 1
    img = Image.open(SRC)
    bg = sample_bg(img.convert("RGBA"))
    print("Background médio:", bg)
    if not os.path.isfile(BAK):
        img.save(BAK)
        print("Backup:", BAK)
    out = make_transparent(img, bg)
    out.save(SRC, "PNG", optimize=True)
    print("Salvo transparente:", SRC, "size", out.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
