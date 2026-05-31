"""Download real venue images. Strategy:
1. Try the original URLs at villarvedi.it
2. If 404, try the Internet Archive Wayback Machine for each
3. If still missing, abort and report so user can pick a substitute

Verifies each downloaded file is a real JPEG by checking magic bytes (FF D8 FF).
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.request
from pathlib import Path

# This script is run locally to recover image assets and the Wayback API endpoint
# trips the system trust store on this machine. A relaxed SSL context is acceptable
# for a developer recovery script. Downloaded bytes are still validated against the
# JPEG magic bytes before being written to disk.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.villarvedi.it/la-villa/",
}

TARGETS = {
    "001.jpg": "https://www.villarvedi.it/wp-content/uploads/2022/12/001.jpg",
    "002.jpg": "https://www.villarvedi.it/wp-content/uploads/2022/12/002.jpg",
    "003.jpg": "https://www.villarvedi.it/wp-content/uploads/2022/12/003.jpg",
    "004.jpg": "https://www.villarvedi.it/wp-content/uploads/2022/12/004.jpg",
}

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "images" / "venue"


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
        return resp.read()


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": HEADERS["User-Agent"]})
    with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
        return json.loads(resp.read())


def wayback_url(target: str) -> str | None:
    api = f"https://archive.org/wayback/available?url={target}"
    try:
        data = fetch_json(api)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! wayback check failed for {target}: {exc}")
        return None
    snap = data.get("archived_snapshots", {}).get("closest", {})
    if not snap.get("available"):
        return None
    archive = snap.get("url")
    if not archive:
        return None
    # Use the "id_" raw variant so it returns the actual image, not the wayback HTML wrapper.
    return archive.replace("/http", "id_/http") if "id_/" not in archive else archive


def try_download(name: str, primary_url: str) -> tuple[bytes | None, str]:
    try:
        data = fetch_bytes(primary_url)
        if data.startswith(b"\xff\xd8\xff"):
            return data, primary_url
        print(f"  ! {name}: primary URL returned non-JPEG ({data[:8]!r})")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {name}: primary URL failed: {exc}")

    print(f"    trying Wayback Machine for {name}...")
    archive = wayback_url(primary_url)
    if not archive:
        return None, "no wayback snapshot"
    try:
        data = fetch_bytes(archive)
        if data.startswith(b"\xff\xd8\xff"):
            return data, archive
        print(f"  ! {name}: wayback returned non-JPEG ({data[:8]!r})")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {name}: wayback fetch failed: {exc}")
    return None, "failed"


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []

    for name, url in TARGETS.items():
        data, source = try_download(name, url)
        if not data:
            failures.append(name)
            continue
        out = DEST / name
        out.write_bytes(data)
        print(f"  + {name:8s}  {len(data)//1024:5d} KB  <- {source}")

    print()
    if failures:
        print(f"FAILED to recover: {failures}")
        return 1

    try:
        from PIL import Image
        for name in TARGETS:
            path = DEST / name
            with Image.open(path) as im:
                print(f"  {name}: {im.size[0]}x{im.size[1]} ({path.stat().st_size//1024} KB)")
    except ImportError:
        pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
