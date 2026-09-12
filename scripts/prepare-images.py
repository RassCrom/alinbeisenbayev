"""
Responsive variants and social cards for every cover image the site shows.

    python scripts/prepare-images.py

Reads the cover URLs from src/data/projects/*.json, src/data/stories.json and
the `cover:` frontmatter of src/content/blog/*.mdx, then for each one:
  1. writes narrower WebP copies next to the original (cover.webp ->
     cover-w640.webp, cover-w1280.webp, ...) for the widths it is wider than,
     so cards and heroes can offer a srcset instead of the full master;
  2. writes a 1200x630 JPEG under public/og/ for the route's og:image, since
     link unfurlers are unreliable with WebP.

The result is recorded in src/data/image-variants.json, which the app
(src/utils/images.ts) and the build's route prerender
(scripts/prerender-routes.mjs) read. Nothing is regenerated when the output is
newer than its source. Needs Pillow.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OG_DIR = PUBLIC / "og"
MANIFEST = ROOT / "src" / "data" / "image-variants.json"

WIDTHS = (640, 1280, 1920)
# A variant is only worth a request when it is clearly smaller than the original.
MIN_SHRINK = 1.15
WEBP_QUALITY = 80
OG_SIZE = (1200, 630)
OG_QUALITY = 82


def cover_urls() -> list[str]:
    urls: list[str] = []
    for path in sorted((ROOT / "src" / "data" / "projects").glob("*.json")):
        urls += [p["coverImage"] for p in json.loads(path.read_text(encoding="utf-8"))["projects"]]
    stories = json.loads((ROOT / "src" / "data" / "stories.json").read_text(encoding="utf-8"))
    urls += [s["coverImage"] for s in stories["stories"]]
    for path in sorted((ROOT / "src" / "content" / "blog").glob("*.mdx")):
        match = re.search(r'^cover:\s*"([^"]+)"', path.read_text(encoding="utf-8"), re.MULTILINE)
        if match:
            urls.append(match.group(1))
    # Placeholders stay placeholders; a local path is all this handles.
    return sorted({u for u in urls if u.startswith("/") and "placeholder" not in u})


def fresh(target: Path, source: Path) -> bool:
    return target.exists() and target.stat().st_mtime >= source.stat().st_mtime


def og_name(url: str) -> str:
    """'/images/projects/gulag/cover.webp' -> 'projects-gulag-cover.jpg'."""
    parts = Path(url).with_suffix("").parts[1:]
    if parts and parts[0] == "images":
        parts = parts[1:]
    return "-".join(parts) + ".jpg"


def main() -> None:
    OG_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict] = {}
    for url in cover_urls():
        source = PUBLIC / url.lstrip("/")
        if not source.exists():
            print(f"missing {url}")
            continue
        image = Image.open(source)
        width, height = image.size
        widths: list[int] = []
        for target_width in WIDTHS:
            if width < target_width * MIN_SHRINK:
                continue
            target = source.with_name(f"{source.stem}-w{target_width}.webp")
            if not fresh(target, source):
                resized = image.resize(
                    (target_width, round(height * target_width / width)), Image.Resampling.LANCZOS
                )
                resized.save(target, "WEBP", quality=WEBP_QUALITY, method=6)
            widths.append(target_width)

        og_target = OG_DIR / og_name(url)
        if not fresh(og_target, source):
            card = ImageOps.fit(image.convert("RGB"), OG_SIZE, Image.Resampling.LANCZOS)
            card.save(og_target, "JPEG", quality=OG_QUALITY, optimize=True, progressive=True)

        manifest[url] = {"width": width, "variants": widths, "og": f"/og/{og_target.name}"}
        print(f"{url:70s} {width:5d}w  variants {widths}")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)} for {len(manifest)} images")


if __name__ == "__main__":
    main()
