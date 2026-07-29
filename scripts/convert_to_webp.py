#!/usr/bin/env python3
"""
Batch PNG/JPG to WebP Converter Script

This script scans a target directory or file and converts images (PNG, JPG, JPEG, BMP, TIFF) to WebP format.
It supports configurable quality, lossless compression, recursive directory search, and size savings reporting.

Usage examples:
  # Convert all images in a folder:
  python scripts/convert_to_webp.py path/to/images

  # Convert recursively with 85 quality:
  python scripts/convert_to_webp.py path/to/images -r -q 85

  # Convert lossless:
  python scripts/convert_to_webp.py path/to/images --lossless

  # Specify output directory preserving structure:
  python scripts/convert_to_webp.py path/to/input_dir -o path/to/output_dir -r
"""

import argparse
import sys
from pathlib import Path
from PIL import Image

SUPPORTED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'}


def convert_image(file_path: Path, output_path: Path, quality: int, lossless: bool) -> tuple[bool, int, int]:
    """
    Converts a single image file to WebP format.
    Returns (success, original_size, new_size).
    """
    try:
        orig_size = file_path.stat().st_size
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(file_path) as img:
            # Handle color mode for transparency / WebP compatibility
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

            # Save as WebP
            save_kwargs = {"format": "WEBP"}
            if lossless:
                save_kwargs["lossless"] = True
            else:
                save_kwargs["quality"] = quality
                save_kwargs["method"] = 6  # Highest effort compression

            img.save(output_path, **save_kwargs)

        new_size = output_path.stat().st_size
        return True, orig_size, new_size
    except Exception as e:
        print(f"❌ Error converting {file_path.name}: {e}", file=sys.stderr)
        return False, 0, 0


def format_size(bytes_size: float) -> str:
    """Formats bytes into human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if abs(bytes_size) < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"


def main():
    parser = argparse.ArgumentParser(
        description="Batch convert PNG/JPG images to WebP format.",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input image file or directory containing images"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=None,
        help="Output directory (default: same directory as input file)"
    )
    parser.add_argument(
        "-q", "--quality",
        type=int,
        default=80,
        help="WebP quality factor from 1 (lowest) to 100 (highest) (default: 80)"
    )
    parser.add_argument(
        "-l", "--lossless",
        action="store_true",
        help="Enable lossless WebP compression"
    )
    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="Search input directory recursively"
    )
    parser.add_argument(
        "-d", "--delete-original",
        action="store_true",
        help="Delete original images after successful conversion"
    )

    args = parser.parse_args()

    input_path: Path = args.input.resolve()

    if not input_path.exists():
        print(f"Error: Input path '{input_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    # Collect target files
    files_to_convert: list[Path] = []
    if input_path.is_file():
        if input_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files_to_convert.append(input_path)
        else:
            print(f"Error: Unsupported file format '{input_path.suffix}'. Supported: {', '.join(SUPPORTED_EXTENSIONS)}", file=sys.stderr)
            sys.exit(1)
    elif input_path.is_dir():
        pattern = "**/*" if args.recursive else "*"
        files_to_convert = [
            p for p in input_path.glob(pattern)
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
        ]

    if not files_to_convert:
        print(f"No matching images found in '{input_path}'.")
        return

    print(f"Found {len(files_to_convert)} image(s) to convert.")
    print(f"Settings: Quality={args.quality}, Lossless={args.lossless}, Recursive={args.recursive}\n")

    successful = 0
    failed = 0
    total_orig_bytes = 0
    total_new_bytes = 0

    for file_path in files_to_convert:
        # Determine output location
        if args.output:
            out_dir = args.output.resolve()
            if input_path.is_dir():
                rel_path = file_path.relative_to(input_path)
                output_file = (out_dir / rel_path).with_suffix(".webp")
            else:
                output_file = (out_dir / file_path.name).with_suffix(".webp")
        else:
            output_file = file_path.with_suffix(".webp")

        success, orig_size, new_size = convert_image(file_path, output_file, args.quality, args.lossless)

        if success:
            successful += 1
            total_orig_bytes += orig_size
            total_new_bytes += new_size
            saved_pct = ((orig_size - new_size) / orig_size * 100) if orig_size > 0 else 0
            print(f"  [OK] {file_path.name} -> {output_file.name} [{format_size(orig_size)} -> {format_size(new_size)}, {saved_pct:+.1f}%]")

            if args.delete_original and file_path != output_file:
                file_path.unlink()
        else:
            failed += 1

    print("\n" + "=" * 50)
    print(f"Batch Conversion Finished:")
    print(f"   Success: {successful}/{len(files_to_convert)}")
    if failed > 0:
        print(f"   Failed:  {failed}")
    
    if total_orig_bytes > 0:
        saved_bytes = total_orig_bytes - total_new_bytes
        pct = (saved_bytes / total_orig_bytes) * 100
        print(f"   Total Size:  {format_size(total_orig_bytes)} -> {format_size(total_new_bytes)}")
        print(f"   Space Saved: {format_size(saved_bytes)} ({pct:.1f}%)")
    print("=" * 50)


if __name__ == "__main__":
    main()
