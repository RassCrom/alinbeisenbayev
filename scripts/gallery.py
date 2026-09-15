"""
The gallery: every finished visual, from one drop folder to /gallery.

    npm run gallery               compress what is new or changed, update the manifest
    npm run gallery -- --check    only report what would happen, touch nothing
    npm run gallery -- --force    re-encode everything

Drop finished works into assets-src/gallery/ (the masters stay out of git, like
the rest of assets-src). Images (png, jpg, tif, webp) and videos (mp4, mov,
m4v, webm, mkv) are picked up; a subfolder becomes the series name, so
assets-src/gallery/coral-city-roads/almaty.mp4 shows as "Almaty",
series "Coral City Roads".

Only finished work is published:
  - anything under a folder or file starting with "_" or "." is ignored, as are
    folders named drafts / wip / archive / trash / process / sketches;
  - files with draft, wip, test, tmp, temp, backup or copy in their name are
    skipped;
  - of several versions of one work (map-v2.png, map-v3.png, map-final.png)
    only the latest is kept — "final" beats any number;
  - of the same work saved in two image formats, the lossless one wins.

The title comes from the file name: "Heat Stress in Vienna.png" is used as is,
"heat-stress-vienna_1080x1920-v3.png" becomes "Heat Stress Vienna". Titles,
series, date and `hidden: true` can also be edited in src/data/gallery.json;
those edits survive every later run, including a re-export of the file.

What gets written to public/gallery/ (names carry a short content stamp, so a
re-exported file never hides behind a cached old copy):
  image  <id>-<stamp>.webp at most 2560 px on the long side, plus -w480/-w960/
         -w1600 copies for the grid's srcset
  video  <id>-<stamp>.mp4 (H.264, faststart, at most 1920 px), a short silent
         -loop.mp4 the grid plays on hover, and a -poster.webp still

A file is re-encoded only when it is new, its size or modification time changed,
or one of its outputs went missing. Outputs nothing refers to any more are
deleted. Needs Pillow, and ffmpeg/ffprobe on PATH for videos.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets-src" / "gallery"
OUT = ROOT / "public" / "gallery"
MANIFEST = ROOT / "src" / "data" / "gallery.json"
URL_PREFIX = "/gallery"

# Lower rank wins when one work exists in several image formats.
IMAGE_EXT = {".png": 0, ".tif": 0, ".tiff": 0, ".jpg": 1, ".jpeg": 1, ".webp": 2}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}

IMAGE_MAX = 2560
IMAGE_WIDTHS = (480, 960, 1600)
# A variant is only worth a request when it is clearly smaller than the master.
MIN_SHRINK = 1.15
WEBP_QUALITY = 82

VIDEO_MAX = 1920
VIDEO_CRF = 26
LOOP_MAX = 720
LOOP_SECONDS = 6
LOOP_CRF = 30
POSTER_MAX = 1080

# Fields a person may edit in the manifest; a re-run never overwrites them.
EDITABLE = ("title", "series", "date", "hidden")

SKIP_DIRS = {"draft", "drafts", "wip", "archive", "trash", "process", "sketches"}
SKIP_WORDS = re.compile(r"(?:^|[\s_.\-])(draft|wip|test|tmp|temp|backup|copy)(?=$|[\s_.\-\d])", re.I)
VERSION = re.compile(r"[\s_\-]*(?:v(\d+)|(final))$", re.I)
SIZE_TAG = re.compile(r"[\s_\-]*\d{3,5}x\d{3,5}", re.I)
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs"}

CYRILLIC = dict(zip(
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюяәғқңөұүһі",
    ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p",
     "r", "s", "t", "u", "f", "kh", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya",
     "a", "g", "q", "ng", "o", "u", "u", "h", "i"],
))

Image.MAX_IMAGE_PIXELS = None  # local masters, not uploads: big posters are expected


@dataclass
class Work:
    path: Path
    rel: Path
    kind: str
    key: str
    base: str
    version: float
    ext_rank: int
    size: int
    mtime: int
    superseded: list[Path] = field(default_factory=list)

    @property
    def fingerprint(self) -> dict:
        return {"path": self.rel.as_posix(), "size": self.size, "mtime": self.mtime}


def rel_root(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def strip_noise(stem: str) -> str:
    return VERSION.sub("", SIZE_TAG.sub("", stem)).strip(" _-.")


def humanize(stem: str) -> str:
    text = strip_noise(stem)
    # A name typed with spaces or capitals is already a title; keep its casing.
    if " " in text or any(c.isupper() for c in text):
        return re.sub(r"\s+", " ", text.replace("_", " ")).strip()
    words = [w for w in re.split(r"[\s_\-]+", text) if w]
    return " ".join(
        w if (i and w in SMALL_WORDS) else w[:1].upper() + w[1:] for i, w in enumerate(words)
    )


def slugify(text: str) -> str:
    text = "".join(CYRILLIC.get(c, c) for c in text.lower())
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "work"


def version_rank(stem: str) -> float:
    match = VERSION.search(SIZE_TAG.sub("", stem))
    if not match:
        return 0
    return float("inf") if match.group(2) else int(match.group(1))


def discover() -> tuple[list[Work], list[tuple[Path, str]]]:
    groups: dict[str, list[Work]] = {}
    skipped: list[tuple[Path, str]] = []
    for path in sorted(SOURCE.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(SOURCE)
        ext = path.suffix.lower()
        kind = "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else None
        if kind is None:
            continue
        if any(part.startswith(("_", ".")) for part in rel.parts):
            continue
        if any(part.lower() in SKIP_DIRS for part in rel.parts[:-1]):
            skipped.append((rel, "in a drafts folder"))
            continue
        if SKIP_WORDS.search(path.stem):
            skipped.append((rel, "draft by name"))
            continue
        base = strip_noise(path.stem)
        key = f"{rel.parent.as_posix()}/{base.lower()}:{kind}"
        stat = path.stat()
        groups.setdefault(key, []).append(Work(
            path=path, rel=rel, kind=kind, key=key, base=base,
            version=version_rank(path.stem), ext_rank=IMAGE_EXT.get(ext, 0),
            size=stat.st_size, mtime=int(stat.st_mtime),
        ))

    works: list[Work] = []
    for members in groups.values():
        members.sort(key=lambda w: (-w.version, w.ext_rank, -w.size))
        chosen = members[0]
        chosen.superseded = [w.rel for w in members[1:]]
        works.append(chosen)
    return works, skipped


def load_manifest() -> dict[str, dict]:
    if not MANIFEST.exists():
        return {}
    items = json.loads(MANIFEST.read_text(encoding="utf-8")).get("items", [])
    return {item["key"]: item for item in items}


def output_paths(item: dict) -> list[Path]:
    urls = [item.get("src"), item.get("poster"), item.get("preview")]
    paths = [OUT / Path(u).name for u in urls if u]
    base = item["src"].rsplit(".", 1)[0]
    paths += [OUT / Path(f"{base}-w{w}.webp").name for w in item.get("variants", [])]
    return paths


def outputs_exist(item: dict) -> bool:
    return all(p.exists() for p in output_paths(item))


def url(name: str) -> str:
    return f"{URL_PREFIX}/{name}"


# ---- Images --------------------------------------------------------------------


def process_image(work: Work, stem: str) -> dict:
    with Image.open(work.path) as opened:
        image = ImageOps.exif_transpose(opened)
        has_alpha = "A" in image.getbands() or "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")
    image.thumbnail((IMAGE_MAX, IMAGE_MAX), Image.Resampling.LANCZOS)
    width, height = image.size
    image.save(OUT / f"{stem}.webp", "WEBP", quality=WEBP_QUALITY, method=6)
    variants: list[int] = []
    for target in IMAGE_WIDTHS:
        if width < target * MIN_SHRINK:
            continue
        resized = image.resize((target, round(height * target / width)), Image.Resampling.LANCZOS)
        resized.save(OUT / f"{stem}-w{target}.webp", "WEBP", quality=WEBP_QUALITY, method=6)
        variants.append(target)
    return {"kind": "image", "width": width, "height": height, "src": url(f"{stem}.webp"), "variants": variants}


# ---- Videos --------------------------------------------------------------------


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    result = subprocess.run(cmd, capture_output=True, **kwargs)
    if result.returncode != 0:
        tail = result.stderr.decode("utf-8", "replace").strip().splitlines()[-6:]
        raise RuntimeError("\n      ".join([f"{Path(cmd[0]).name} failed:", *tail]))
    return result


def probe(path: Path) -> dict:
    out = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration", "-of", "json", str(path),
    ]).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    return {"width": stream["width"], "height": stream["height"], "duration": float(data["format"]["duration"])}


def fit(limit: int) -> str:
    # Quoted so the commas inside min() are not read as filter separators.
    return (
        f"scale=w='min(iw,{limit})':h='min(ih,{limit})':"
        "force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p"
    )


def process_video(work: Work, stem: str) -> dict:
    src = str(work.path)
    duration = probe(work.path)["duration"]
    x264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-movflags", "+faststart"]

    full = OUT / f"{stem}.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0?",
         "-vf", fit(VIDEO_MAX), *x264, "-crf", str(VIDEO_CRF), "-c:a", "aac", "-b:a", "96k", str(full)])

    # The hover loop and the poster start at the same frame, so the switch from
    # still to motion does not jump. Past the middle, where an animated map has
    # usually drawn most of itself.
    start = max(0.0, min(duration * 0.55 - LOOP_SECONDS / 2, duration - LOOP_SECONDS))
    loop = OUT / f"{stem}-loop.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}", "-i", src, "-t", str(LOOP_SECONDS),
         "-an", "-vf", fit(LOOP_MAX), *x264, "-crf", str(LOOP_CRF), str(loop)])

    frame = run(["ffmpeg", "-v", "error", "-ss", f"{start:.2f}", "-i", src, "-frames:v", "1",
                 "-f", "image2pipe", "-c:v", "png", "-"]).stdout
    with Image.open(io.BytesIO(frame)) as still:
        poster = still.convert("RGB")
    poster.thumbnail((POSTER_MAX, POSTER_MAX), Image.Resampling.LANCZOS)
    poster.save(OUT / f"{stem}-poster.webp", "WEBP", quality=WEBP_QUALITY, method=6)

    meta = probe(full)
    return {
        "kind": "video",
        "width": meta["width"],
        "height": meta["height"],
        "src": url(full.name),
        "poster": url(f"{stem}-poster.webp"),
        "preview": url(loop.name),
        "duration": round(meta["duration"], 1),
    }


# ---- Main ----------------------------------------------------------------------


def size_label(num: int) -> str:
    return f"{num / 1_048_576:.1f} MB" if num >= 1_048_576 else f"{num / 1024:.0f} KB"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Build the /gallery page from assets-src/gallery/.")
    parser.add_argument("--check", action="store_true", help="report only, change nothing")
    parser.add_argument("--force", action="store_true", help="re-encode every work")
    args = parser.parse_args()

    if not SOURCE.exists():
        SOURCE.mkdir(parents=True)
        print(f"created {rel_root(SOURCE)}/ — drop finished works there and run again")

    works, skipped = discover()
    previous = load_manifest()

    plan: list[tuple[Work, str, dict | None]] = []
    for work in sorted(works, key=lambda w: w.rel.as_posix()):
        prev = previous.get(work.key)
        if prev is None:
            status = "new"
        elif args.force or prev.get("source") != work.fingerprint:
            status = "changed"
        elif not outputs_exist(prev):
            status = "missing"
        else:
            status = "ok"
        plan.append((work, status, prev))

    keys = {w.key for w in works}
    removed = [item for key, item in previous.items() if key not in keys]

    for work, status, _ in plan:
        if status != "ok":
            print(f"  {status:9s} {work.rel.as_posix():60s} {work.kind:5s} {size_label(work.size)}")
        for old in work.superseded:
            print(f"  {'older':9s} {old.as_posix():60s} superseded by {work.rel.name}")
    for item in removed:
        print(f"  {'removed':9s} {item['source']['path']}")
    for rel, reason in skipped:
        print(f"  {'skipped':9s} {rel.as_posix():60s} {reason}")
    todo = [p for p in plan if p[1] != "ok"]
    unchanged = len(plan) - len(todo)
    print(f"{len(todo)} to encode, {unchanged} unchanged, {len(removed)} removed, {len(skipped)} skipped")

    if args.check:
        return
    if any(w.kind == "video" for w, _, _ in todo) and not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        sys.exit("ffmpeg and ffprobe must be on PATH to encode videos")

    OUT.mkdir(parents=True, exist_ok=True)
    used_ids = {prev["id"] for _, _, prev in plan if prev}
    items: list[dict] = []
    for index, (work, status, prev) in enumerate(plan, 1):
        if status == "ok":
            items.append(prev)
            continue

        title = humanize(work.path.stem)
        series = humanize(work.rel.parent.name) if work.rel.parent != Path(".") else None
        if prev:
            item_id = prev["id"]
        else:
            item_id = base_id = slugify(f"{series or ''} {title}")
            n = 2
            while item_id in used_ids:
                item_id, n = f"{base_id}-{n}", n + 1
            used_ids.add(item_id)
        stamp = hashlib.sha1(json.dumps(work.fingerprint).encode()).hexdigest()[:6]

        print(f"[{index}/{len(plan)}] {work.rel.as_posix()} ...", flush=True)
        try:
            media = (process_image if work.kind == "image" else process_video)(work, f"{item_id}-{stamp}")
        except Exception as error:  # keep going; one broken file should not block the rest
            print(f"      failed: {error}")
            if prev:
                items.append(prev)
            continue

        item = {
            "id": item_id,
            "key": work.key,
            "title": title,
            **({"series": series} if series else {}),
            "date": datetime.fromtimestamp(work.mtime).date().isoformat(),
            **media,
            "source": work.fingerprint,
        }
        if prev:
            for name in EDITABLE:
                if name in prev:
                    item[name] = prev[name]
                elif name in item and name != "date":
                    item.pop(name)
        items.append(item)

    # Newest first; within a day, alphabetical (sort is stable).
    items.sort(key=lambda i: i["title"].lower())
    items.sort(key=lambda i: i["date"], reverse=True)
    MANIFEST.write_text(
        json.dumps(
            {
                "_note": "Written by scripts/gallery.py. Edit title, series, date or add \"hidden\": true — those edits survive re-runs.",
                "items": items,
            },
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    referenced = {p.name for item in items for p in output_paths(item)}
    orphans = [p for p in OUT.iterdir() if p.is_file() and p.name not in referenced]
    for path in orphans:
        path.unlink()
    total = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file())
    print(f"wrote {rel_root(MANIFEST)}: {len(items)} works, {size_label(total)} in {rel_root(OUT)}/"
          + (f", deleted {len(orphans)} stale files" if orphans else ""))


if __name__ == "__main__":
    main()
