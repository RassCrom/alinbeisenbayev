"""
Bake the poster fallback (stage 7): one PNG of the archipelago at today's
layout for browsers without WebGL, composed from the same layout JSON the
app derives (via scripts/print-atlas.ts --json) and the same sprites under
public/atlas/. Writes:

  public/atlas/poster.webp     2400 x 1600, quality 82
  src/atlas/poster-frame.ts    GENERATED: the world rectangle the image spans,
                               so AtlasPoster.tsx can place its hotspots

Usage: python scripts/bake-atlas-poster.py [--font path.ttf]
Needs Pillow and node (for the layout). Island names are set in Georgia if
the font is found on this machine, else in Pillow's default face; pass
--font to choose.
"""

from __future__ import annotations

import json
import math
import os
import random
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ATLAS_DIR = ROOT / "public" / "atlas"
WIDTH, HEIGHT = 2400, 1600
PAD = 0.045
PAINTING_SCALE = 0.92  # paintingHalfWidth = radius * 0.92, as in layout.ts
SPRITE_SCALE = 1.25  # SETTLEMENT_SPRITE_SCALE
ANCHOR_Y = {"fortress": 0.8, "walled-town": 0.78, "market-town": 0.78, "hamlet": 0.76, "ruin": 0.78}
GOLD = (214, 182, 110)
BONE = (235, 225, 201)


def layout() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "atlas.json"
        subprocess.run(
            ["node", str(ROOT / "scripts" / "print-atlas.ts"), "--json", str(out)],
            check=True,
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return json.loads(out.read_text(encoding="utf-8"))


def find_font(explicit: str | None, size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    candidates = [explicit] if explicit else []
    windir = os.environ.get("WINDIR", "C:/Windows")
    candidates += [
        f"{windir}/Fonts/georgia.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ]
    for path in candidates:
        if path and Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def sea(width: int, height: int) -> Image.Image:
    """A dark radial gradient with a little grain, the atlas's resting sea."""
    base = Image.new("RGB", (width, height))
    px = base.load()
    cx, cy = width * 0.5, height * 0.45
    reach = math.hypot(width * 0.5, height * 0.5)
    for y in range(height):
        for x in range(0, width):
            d = math.hypot(x - cx, y - cy) / reach
            t = min(1.0, d * d)
            px[x, y] = (int(16 + (7 - 16) * t), int(35 + (18 - 35) * t), int(63 + (36 - 63) * t))
    grain = Image.effect_noise((width, height), 12).convert("L")
    grain = Image.merge("RGB", (grain, grain, grain))
    return Image.blend(base, grain, 0.045)


def spaced_text(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font, fill, spacing: int, stroke) -> None:
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    cursor = x - total / 2
    for ch, w in zip(text, widths):
        draw.text((cursor, y), ch, font=font, fill=fill, stroke_width=3, stroke_fill=stroke)
        cursor += w + spacing


def dashed_curve(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, dash: int, gap: int, width: int) -> None:
    """Dashes along a polyline."""
    on = True
    carry = 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg == 0:
            continue
        pos = 0.0
        while pos < seg:
            run = (dash if on else gap) - carry
            end = min(seg, pos + run)
            if on:
                t0, t1 = pos / seg, end / seg
                draw.line([(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0), (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1)], fill=fill, width=width)
            if end >= pos + run:
                on = not on
                carry = 0.0
            else:
                carry += end - pos
            pos = end


def bow_side(lane_id: str) -> int:
    h = 0
    for ch in lane_id:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return 1 if h % 2 == 0 else -1


def main() -> None:
    font_arg = None
    if "--font" in sys.argv:
        font_arg = sys.argv[sys.argv.index("--font") + 1]
    atlas = layout()
    b = atlas["bounds"]
    rw = b["maxX"] - b["minX"] + 2 * PAD
    rh = b["maxY"] - b["minY"] + 2 * PAD
    scale = min(WIDTH / rw, HEIGHT / rh)
    cx = (b["minX"] + b["maxX"]) / 2
    cy = (b["minY"] + b["maxY"]) / 2
    frame = {
        "minX": cx - WIDTH / scale / 2,
        "maxX": cx + WIDTH / scale / 2,
        "minY": cy - HEIGHT / scale / 2,
        "maxY": cy + HEIGHT / scale / 2,
    }

    def X(x: float) -> float:
        return (x - frame["minX"]) * scale

    def Y(y: float) -> float:
        return (y - frame["minY"]) * scale

    image = sea(WIDTH, HEIGHT).convert("RGBA")

    # Coast glow under each painting, then the paintings, back to front.
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for island in atlas["islands"]:
        r = island["radius"] * PAINTING_SCALE * scale
        gd.ellipse([X(island["x"]) - r, Y(island["y"]) - r, X(island["x"]) + r, Y(island["y"]) + r], fill=(120, 170, 210, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    image.alpha_composite(glow)
    for island in sorted(atlas["islands"], key=lambda i: i["y"]):
        painting = Image.open(ATLAS_DIR / f"island-{island['id']}.webp").convert("RGBA")
        half = island["radius"] * PAINTING_SCALE * scale
        size = max(2, int(round(2 * half)))
        painting = painting.resize((size, size), Image.LANCZOS)
        image.alpha_composite(painting, (int(round(X(island["x"]) - half)), int(round(Y(island["y"]) - half))))

    by_slug = {s["slug"]: s for s in atlas["settlements"]}
    lanes = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lanes)
    for lane in atlas["lanes"]:
        a, c = by_slug.get(lane["from"]), by_slug.get(lane["to"])
        if not a or not c:
            continue
        dx, dy = c["x"] - a["x"], c["y"] - a["y"]
        length = math.hypot(dx, dy) or 1e-6
        side = bow_side(lane["id"])
        ctrl = ((a["x"] + c["x"]) / 2 - dy * 0.14 * side, (a["y"] + c["y"]) / 2 + dx * 0.14 * side)
        pts = []
        for i in range(25):
            t = i / 24
            x = (1 - t) ** 2 * a["x"] + 2 * (1 - t) * t * ctrl[0] + t * t * c["x"]
            y = (1 - t) ** 2 * a["y"] + 2 * (1 - t) * t * ctrl[1] + t * t * c["y"]
            pts.append((X(x), Y(y)))
        colour = (*GOLD, 150) if lane["crossing"] else (160, 120, 70, 130)
        dashed_curve(ld, pts, colour, 14 if lane["crossing"] else 8, 10, 2)
    image.alpha_composite(lanes)

    for s in sorted(atlas["settlements"], key=lambda s: s["y"]):
        sprite = Image.open(ATLAS_DIR / f"settlement-{s['tier']}.webp").convert("RGBA")
        half = s["footprint"] * SPRITE_SCALE * scale
        size = max(2, int(round(2 * half)))
        sprite = sprite.resize((size, size), Image.LANCZOS)
        image.alpha_composite(sprite, (int(round(X(s["x"]) - half)), int(round(Y(s["y"]) - ANCHOR_Y[s["tier"]] * size))))

    draw = ImageDraw.Draw(image)
    name_font = find_font(font_arg, 44)
    for island in atlas["islands"]:
        r = island["radius"] * scale
        spaced_text(draw, int(X(island["x"])), int(Y(island["y"]) - r - 62), island["name"].upper(), name_font, BONE, 12, (5, 9, 18))
    small = find_font(font_arg, 22)
    draw.text((40, HEIGHT - 60), f"Atlas of works · as of {atlas['asOf']} · the chart without WebGL", font=small, fill=(*BONE, 200))

    ATLAS_DIR.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(ATLAS_DIR / "poster.webp", "WEBP", quality=82, method=6)

    ts = ROOT / "src" / "atlas" / "poster-frame.ts"
    ts.write_text(
        "/* GENERATED by scripts/bake-atlas-poster.py; do not edit. The world rectangle public/atlas/poster.webp spans. */\n"
        "export const POSTER_FRAME = {\n"
        f"  minX: {frame['minX']:.6f},\n  minY: {frame['minY']:.6f},\n  maxX: {frame['maxX']:.6f},\n  maxY: {frame['maxY']:.6f},\n"
        f"  width: {WIDTH},\n  height: {HEIGHT},\n"
        f"  asOf: '{atlas['asOf']}',\n"
        "} as const;\n",
        encoding="utf-8",
    )
    print(f"wrote {ATLAS_DIR / 'poster.webp'} and {ts}")


if __name__ == "__main__":
    random.seed(7)
    main()
