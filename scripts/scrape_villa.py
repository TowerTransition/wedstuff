"""Scrape villarvedi.it for image URLs of the villa & garden."""
from __future__ import annotations

import re
import sys
import urllib.request

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

PAGES = [
    "https://www.villarvedi.it/",
    "https://www.villarvedi.it/la-villa/",
    "https://www.villarvedi.it/eventi-privati/matrimoni/",
    "https://www.villarvedi.it/galleria/",
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def main() -> int:
    all_urls: set[str] = set()
    for p in PAGES:
        try:
            html = fetch(p)
        except Exception as exc:  # noqa: BLE001
            print(f"SKIP {p}: {exc}", file=sys.stderr)
            continue
        found = re.findall(
            r'(https?://[^"\'\s>]*villarvedi\.it/[^"\'\s>]+\.(?:jpe?g|png))',
            html,
            flags=re.IGNORECASE,
        )
        for u in found:
            all_urls.add(u)

    keywords = ["giardin", "garden", "villa", "home", "fronte", "parco", "arvedi", "salon", "sala"]
    candidates = sorted(u for u in all_urls if any(k in u.lower() for k in keywords))

    print(f"Total image URLs: {len(all_urls)}\n")
    print("Garden/villa candidates:")
    for u in candidates:
        print(f"  {u}")
    print("\nAll URLs:")
    for u in sorted(all_urls):
        print(f"  {u}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
