"""Verify every image path referenced by index.html, styles.css, and app.js
exists on disk.

Exits 0 if all paths resolve, 1 otherwise.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CSS  = (ROOT / "styles.css").read_text(encoding="utf-8")
JS   = (ROOT / "app.js").read_text(encoding="utf-8")

paths: set[str] = set()

# index.html: src="..."
for m in re.finditer(r'src="([^"]+\.(?:jpe?g|png|JPG|JPEG|PNG|mp3))"', HTML):
    paths.add(m.group(1))

# styles.css: url(...)
for m in re.finditer(r"url\(['\"]?([^'\")]+\.(?:jpe?g|png|JPG|JPEG|PNG))['\"]?\)", CSS):
    paths.add(m.group(1))

# app.js: GALLERY BASE_PATH combined with each `f:' filename
gallery_base_match = re.search(r"GALLERY_BASE_PATH\s*=\s*'([^']+)'", JS)
gallery_base = gallery_base_match.group(1) if gallery_base_match else "pictures/Engagement%20shoot/"
proposal_gallery_match = re.search(r"PROPOSAL_GALLERY_BASE\s*=\s*'([^']+)'", JS)
proposal_gallery_base = (
    proposal_gallery_match.group(1)
    if proposal_gallery_match
    else "proposalpics/The%20proposal/"
)
proposal_files: set[str] = set()
for m in re.finditer(
    r"\{[^\{\}]*\bf:\s*'([^']+\.(?:jpe?g|JPG|JPEG))'[^\{\}]*\bproposal\s*:\s*true[^\{\}]*\}",
    JS,
):
    fname = m.group(1)
    proposal_files.add(fname)
    paths.add(proposal_gallery_base + fname)
for m in re.finditer(r"f:\s*'([^']+\.(?:jpe?g|JPG|JPEG))'", JS):
    fname = m.group(1)
    if fname in proposal_files:
        continue
    paths.add(gallery_base + fname)

# app.js: wedding music playlist URLs
pl_block = re.search(r"MUSIC_PLAYLIST:\s*\[([\s\S]*?)\]\s*,", JS)
if pl_block:
    for mp in re.finditer(r"'(Music[^']+\.(?:mp3|MP3))'", pl_block.group(1)):
        paths.add(mp.group(1))

# audio source (<source>) — optional if playlist is JS-only
for m in re.finditer(r'<source[^>]+src="([^"]+)"', HTML):
    paths.add(m.group(1))

missing: list[str] = []
ok = 0
for p in sorted(paths):
    decoded = unquote(p)
    full = ROOT / decoded
    if full.exists():
        ok += 1
    else:
        missing.append(decoded)

print(f"Verified {ok}/{len(paths)} referenced asset paths exist.")
if missing:
    print("MISSING:")
    for m in missing:
        print(f"  - {m}")
    sys.exit(1)
print("All asset references resolve cleanly.")
