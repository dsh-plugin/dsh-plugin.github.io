#!/usr/bin/env python3
"""Refresh data/plugins.json from GitHub topic:dsh-plugin.

Designed for GitHub Actions (GITHUB_TOKEN) and local runs.
Unauthenticated quota is 60 req/h; authenticated is 5000.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "plugins.json"
TOPIC = "dsh-plugin"
PER_PAGE = 100
MAX_PAGES = 10
UA = "dsh-creative-workshop/1.0 (+https://github.com/topics/dsh-plugin)"


def request_json(url: str) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": UA,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40) as resp:
        return json.load(resp)


def fetch_all() -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        url = (
            "https://api.github.com/search/repositories"
            f"?q=topic:{TOPIC}&sort=stars&order=desc"
            f"&per_page={PER_PAGE}&page={page}"
        )
        try:
            payload = request_json(url)
        except urllib.error.HTTPError as exc:
            print(f"HTTP {exc.code} on page {page}: {exc.reason}", file=sys.stderr)
            if exc.code in (403, 429) and items:
                print("rate limited, keeping partial snapshot", file=sys.stderr)
                break
            raise
        batch = payload.get("items") or []
        print(f"page {page}: {len(batch)}  total_count={payload.get('total_count')}")
        for repo in batch:
            key = repo["full_name"].lower()
            if key in seen:
                continue
            seen.add(key)
            lic = repo.get("license") or {}
            items.append(
                {
                    "n": repo["name"],
                    "o": repo["owner"]["login"],
                    "d": (repo.get("description") or "").strip(),
                    "s": repo.get("stargazers_count") or 0,
                    "f": repo.get("forks_count") or 0,
                    "l": repo.get("language") or "",
                    "t": repo.get("topics") or [],
                    "u": repo.get("updated_at") or "",
                    "c": repo.get("created_at") or "",
                    "lic": lic.get("spdx_id") or "",
                    "a": 1 if repo.get("archived") else 0,
                }
            )
        if len(batch) < PER_PAGE:
            break
        time.sleep(0.35)
    items.sort(key=lambda x: (-x["s"], f"{x['o']}/{x['n']}".lower()))
    return items


def main() -> int:
    plugins = fetch_all()
    if not plugins:
        print("no plugins fetched", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "https://github.com/topics/dsh-plugin",
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": len(plugins),
        "plugins": plugins,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({len(plugins)} plugins)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
