"""Verify exact case of every asset path referenced in HTML/CSS/JS matches
the actual filename on disk. Critical for case-sensitive hosts (Netlify/Linux).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "styles.css").read_text(encoding="utf-8")
JS = (ROOT / "app.js").read_text(encoding="utf-8")

paths: set[str] = set()
for m in re.finditer(r'src="([^"]+\.(?:jpe?g|png|JPG|JPEG|PNG|mp3))"', HTML):
    paths.add(m.group(1))
for m in re.finditer(r"url\(['\"]?([^'\")]+\.(?:jpe?g|png|JPG|JPEG|PNG))['\"]?\)", CSS):
    paths.add(m.group(1))
gb = re.search(r"GALLERY_BASE_PATH\s*=\s*'([^']+)'", JS)
gb_path = gb.group(1) if gb else "pictures/Engagement%20shoot/"
proposal_gb = re.search(r"PROPOSAL_GALLERY_BASE\s*=\s*'([^']+)'", JS)
proposal_gb_path = (
    proposal_gb.group(1)
    if proposal_gb
    else "proposalpics/The%20proposal/"
)
proposal_files: set[str] = set()
for m in re.finditer(
    r"\{[^\{\}]*\bf:\s*'([^']+\.(?:jpe?g|JPG|JPEG))'[^\{\}]*\bproposal\s*:\s*true[^\{\}]*\}",
    JS,
):
    fname = m.group(1)
    proposal_files.add(fname)
    paths.add(proposal_gb_path + fname)
for m in re.finditer(r"f:\s*'([^']+\.(?:jpe?g|JPG|JPEG))'", JS):
    fname = m.group(1)
    if fname in proposal_files:
        continue
    paths.add(gb_path + fname)
pl_block_js = re.search(r"MUSIC_PLAYLIST:\s*\[([\s\S]*?)\]\s*,", JS)
if pl_block_js:
    for mp in re.finditer(r"'(Music[^']+\.(?:mp3|MP3))'", pl_block_js.group(1)):
        paths.add(mp.group(1))
for m in re.finditer(r"background-image:url\(['\"]?([^'\")]+)['\"]?\)", HTML):
    paths.add(m.group(1))

mismatches: list[tuple[str, str]] = []
ok = 0
for ref in sorted(paths):
    decoded = unquote(ref)
    parts = decoded.split("/")
    cur = ROOT
    actual_parts: list[str] = []
    bad = False
    for part in parts:
        if not cur.exists():
            bad = True
            break
        siblings = {child.name for child in cur.iterdir()}
        if part in siblings:
            actual_parts.append(part)
            cur = cur / part
        else:
            ci_match = next((s for s in siblings if s.lower() == part.lower()), None)
            if ci_match:
                actual_parts.append(ci_match)
                mismatches.append((decoded, "/".join(actual_parts + parts[len(actual_parts):])))
                cur = cur / ci_match
            else:
                bad = True
                break
    if not bad and not any(decoded == m[0] for m in mismatches):
        ok += 1

print(f"Checked {len(paths)} paths.")
print(f"  Exact-case matches: {ok}")
print(f"  Case mismatches:    {len(mismatches)}")
if mismatches:
    print("\nThese will 404 on Netlify (Linux):")
    for ref, actual in mismatches:
        print(f"  referenced: {ref}")
        print(f"  on disk:    {actual}\n")
    sys.exit(1)
print("\nAll paths case-correct.")
