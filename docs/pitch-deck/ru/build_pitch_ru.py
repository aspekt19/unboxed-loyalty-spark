#!/usr/bin/env python3
"""Build Russian pitch deck PDFs from their HTML sources.

Usage:
  python3 build_pitch_ru.py

Output:
  docs/pitch-deck/ru/LoyalSpark_Pitch_RU.pdf
  docs/pitch-deck/ru/PITCH_DECK_PRESENTATION_RU.pdf

Requires Google Chrome or Chromium for headless print-to-PDF.
Mirrors ../build_pitch_en.py; keep the Chrome flags in sync.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
TARGETS = [
    (DIR / "LoyalSpark_Pitch_RU.html", DIR / "LoyalSpark_Pitch_RU.pdf"),
    (DIR / "PITCH_DECK_PRESENTATION_RU.html", DIR / "PITCH_DECK_PRESENTATION_RU.pdf"),
]

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]


def find_chrome() -> str | None:
    for candidate in CHROME_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    return None


def build_pdfs() -> None:
    chrome = find_chrome()
    if not chrome:
        print("Chrome/Chromium not found. Export PDFs manually:")
        for html, _ in TARGETS:
            print(f"  Open file://{html} → Print → Save as PDF (background graphics ON)")
        sys.exit(1)

    for html, pdf in TARGETS:
        if not html.exists():
            raise FileNotFoundError(f"Missing source: {html}")
        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf}",
            html.resolve().as_uri(),
        ]
        subprocess.run(cmd, check=True)
        print(f"Saved: {pdf} ({pdf.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build_pdfs()
