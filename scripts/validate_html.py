"""Validate index.html structure: tag matching + presence of key sections + tabs."""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class Validator(HTMLParser):
    VOID = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__()
        self.stack: list[tuple[str, tuple[int, int]]] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        # Void elements are self-closing; HTMLParser fires endtag for `<img />`-style
        # self-closing void tags. Skip them — they're never on our stack.
        if tag in self.VOID:
            return
        if not self.stack:
            self.errors.append(f"unexpected </{tag}> at {self.getpos()}")
            return
        opened, pos = self.stack[-1]
        if opened != tag:
            self.errors.append(
                f"mismatch: opened <{opened}> at {pos} but closing </{tag}> at {self.getpos()}"
            )
            while self.stack and self.stack[-1][0] != tag:
                self.stack.pop()
            if self.stack:
                self.stack.pop()
        else:
            self.stack.pop()


def main() -> int:
    src = Path(__file__).resolve().parent.parent / "index.html"
    text = src.read_text(encoding="utf-8")

    v = Validator()
    v.feed(text)

    bad = bool(v.errors) or bool(v.stack)
    if v.errors:
        print("ERRORS:")
        for e in v.errors:
            print(f"  - {e}")
    if v.stack:
        print("UNCLOSED at end:")
        for t in v.stack:
            print(f"  - {t}")

    if not bad:
        print("HTML well-formed: every opening tag has a matching close.")

    sections = re.findall(r'<section id="(page-[^"]+)"', text)
    nav_buttons = sorted(set(re.findall(r'<button class="nav-btn" data-page="([^"]+)"', text)))
    print(f"\nSections: {sections}")
    print(f"Nav tabs: {nav_buttons}")

    expected_tabs = {"home", "events", "story", "rsvp", "registry", "faq", "pictures"}
    missing_tabs = expected_tabs - set(nav_buttons)
    if missing_tabs:
        print(f"\nMISSING expected tabs in nav: {sorted(missing_tabs)}")
        bad = True

    expected_sections = {f"page-{t}" for t in expected_tabs} | {"page-password"}
    missing_sections = expected_sections - set(sections)
    if missing_sections:
        print(f"\nMISSING expected sections: {sorted(missing_sections)}")
        bad = True

    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
