#!/usr/bin/env python3
"""Build English pitch deck PDF from LoyalSpark_Pitch_EN.html.

Usage:
  python3 build_pitch_en.py

Output:
  docs/pitch-deck/LoyalSpark_Pitch_EN.pdf

Requires Google Chrome or Chromium for headless print-to-PDF.
If Chrome is not found, prints manual export instructions.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
HTML = DIR / "LoyalSpark_Pitch_EN.html"
PDF = DIR / "LoyalSpark_Pitch_EN.pdf"

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


def build_pdf() -> None:
    if not HTML.exists():
        raise FileNotFoundError(f"Missing source: {HTML}")

    chrome = find_chrome()
    if not chrome:
        print("Chrome/Chromium not found. Export PDF manually:")
        print(f"  1. Open file://{HTML}")
        print("  2. Print → Save as PDF (background graphics ON)")
        sys.exit(1)

    url = HTML.resolve().as_uri()
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF}",
        url,
    ]
    subprocess.run(cmd, check=True)
    print(f"Saved: {PDF} ({PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build_pdf()
