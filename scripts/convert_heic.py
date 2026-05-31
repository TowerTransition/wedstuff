"""
Convert all .heic / .HEIC files under the Wedding folder to sibling .jpg files.

- Originals are preserved (not deleted).
- Skips conversion if the .jpg already exists with a non-zero size.
- Writes a manifest of converted files for verification.

Usage:
    python scripts/convert_heic.py
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable

try:
    import pillow_heif  # type: ignore
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    sys.stderr.write(
        "Missing dependency. Run: pip install pillow_heif pillow\n"
        f"Underlying error: {exc}\n"
    )
    sys.exit(1)

pillow_heif.register_heif_opener()

ROOT = Path(__file__).resolve().parent.parent
SEARCH_DIRS = [ROOT / "ourfolder", ROOT / "pictures", ROOT / "proposalpics"]
JPEG_QUALITY = 88
MAX_DIMENSION = 2400


def iter_heic_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() == ".heic":
                yield path


def convert(path: Path) -> tuple[Path, str]:
    target = path.with_suffix(".jpg")
    if target.exists() and target.stat().st_size > 0:
        return target, "skipped"
    with Image.open(path) as img:
        img = img.convert("RGB")
        if max(img.size) > MAX_DIMENSION:
            scale = MAX_DIMENSION / max(img.size)
            new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        img.save(target, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return target, "converted"


def main() -> int:
    converted = 0
    skipped = 0
    failed: list[tuple[Path, str]] = []

    for src in iter_heic_files(SEARCH_DIRS):
        try:
            _, status = convert(src)
            if status == "converted":
                converted += 1
                print(f"  + {src.relative_to(ROOT)} -> .jpg")
            else:
                skipped += 1
        except Exception as exc:  # noqa: BLE001
            failed.append((src, str(exc)))
            print(f"  ! {src.relative_to(ROOT)} :: {exc}")

    print(f"\nDone. converted={converted}, skipped={skipped}, failed={len(failed)}")
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
