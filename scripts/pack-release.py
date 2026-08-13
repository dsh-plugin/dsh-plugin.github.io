#!/usr/bin/env python3
"""Pack a GitHub-ready folder and zip, excluding local junk."""
from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "dsh-workshop"
ZIP_PATH = ROOT / "dsh-workshop-github.zip"

INCLUDE_ROOT = {
    ".gitignore",
    ".nojekyll",
    "404.html",
    "LICENSE",
    "README.md",
    "发布说明.txt",
    "directory.html",
    "guide.html",
    "index.html",
    "llms.txt",
    "market.html",
    "publish.html",
    "robots.txt",
    "site.webmanifest",
    "sitemap.html",
    "sitemap.xml",
}
INCLUDE_DIRS = {
    ".github": None,
    "assets": {"app.css", "app.js", "apple-touch-icon.png", "favicon.svg", "og.jpg"},
    "data": {"plugins.json", "site.json"},
    "scripts": {"build-seo.py", "sync-plugins.py", "pack-release.py"},
    "templates": {"app.html"},
}


def reset(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)


def main() -> int:
    reset(OUT_DIR)
    for name in INCLUDE_ROOT:
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, OUT_DIR / name)
    for folder, allow in INCLUDE_DIRS.items():
        dest = OUT_DIR / folder
        dest.mkdir(parents=True, exist_ok=True)
        src_dir = ROOT / folder
        if not src_dir.exists():
            continue
        for item in src_dir.rglob("*"):
            if item.is_dir():
                continue
            if item.name == ".DS_Store" or "__pycache__" in item.parts:
                continue
            rel = item.relative_to(src_dir)
            if allow is not None and rel.parts[0] not in allow and str(rel) not in allow:
                continue
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file in OUT_DIR.rglob("*"):
            if file.is_file():
                zf.write(file, Path("dsh-workshop") / file.relative_to(OUT_DIR))
    files = sum(1 for p in OUT_DIR.rglob("*") if p.is_file())
    print(f"packed {files} files → {OUT_DIR}")
    print(f"zip {ZIP_PATH} ({ZIP_PATH.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
