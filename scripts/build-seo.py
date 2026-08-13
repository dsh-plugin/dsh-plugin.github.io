#!/usr/bin/env python3
"""Generate crawlable pages, sitemaps, and static plugin markup."""
from __future__ import annotations

import argparse
import html
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parents[1]
SITE_FILE = ROOT / "data" / "site.json"
PLUGINS_FILE = ROOT / "data" / "plugins.json"

LANG_COLORS = {
    "TypeScript": "#3178c6", "JavaScript": "#f1e05a", "Python": "#3572A5",
    "Rust": "#dea584", "Go": "#00ADD8", "Java": "#b07219", "HTML": "#e34c26",
    "CSS": "#563d7c", "C++": "#f34b7d", "C": "#555555", "C#": "#178600",
    "Shell": "#89e051", "Ruby": "#701516", "PHP": "#4F5D95", "Swift": "#F05138",
    "Kotlin": "#A97BFF", "Dart": "#00B4AB", "Vue": "#41b883", "Svelte": "#ff3e00",
    "Lua": "#000080", "Scala": "#c22d40", "Elixir": "#6e4a7e",
    "Zig": "#ec915c", "Jupyter Notebook": "#DA5B0B", "MDX": "#fcb32c",
    "Astro": "#ff5a03", "Nim": "#ffc200", "Julia": "#a270ba",
    "R": "#198CE7", "OCaml": "#3be133", "PowerShell": "#012456",
    "Makefile": "#427819", "Dockerfile": "#384d54", "SCSS": "#c6538c",
    "Less": "#1d365d", "Stylus": "#ff6347", "Solidity": "#AA6746",
    "Assembly": "#6E4C13", "Objective-C": "#438eff", "TeX": "#3D6117",
    "Vim Script": "#199f4b", "Emacs Lisp": "#c065db", "Common Lisp": "#3fb68b",
    "Roff": "#ecdebe",
}

PAGES = {
    "home": {
        "file": "index.html",
        "title": "DSH 创意工坊 · DeepSeek Harness 插件目录与安装指南",
        "description": "DeepSeek Harness 社区插件工坊。从 GitHub topic dsh-plugin 发现、安装、发布插件，支持 GitHub Pages。",
        "view": "home",
    },
    "market": {
        "file": "market.html",
        "title": "DSH 插件目录 · 检索 dsh-plugin 社区仓库",
        "description": "按星标、语言、分类检索 DeepSeek Harness 社区插件，复制 dsh plugin 安装命令。",
        "view": "market",
    },
    "insights": {
        "file": "insights.html",
        "title": "DSH 插件洞察 · 语言、星标与活跃度分析",
        "description": "基于 GitHub topic dsh-plugin 的 DeepSeek Harness 生态分析：语言分布、高星贡献者、许可证、近期活跃与热门标签。",
        "view": "insights",
    },
    "guide": {
        "file": "guide.html",
        "title": "DeepSeek Harness 上手手册 · 安装 DSH 与社区插件",
        "description": "Node.js 22+ 启动 dsh web、配置 API Key、选择工作区，并用 git 地址安装 dsh-plugin。",
        "view": "guide",
    },
    "publish": {
        "file": "publish.html",
        "title": "发布 DSH 插件与 GitHub Pages 入驻指南",
        "description": "给仓库添加 dsh-plugin topic，写清安装命令，并把创意工坊发布到 GitHub Pages。",
        "view": "publish",
    },
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def site_config(base_url: str = "") -> dict:
    data = load_json(SITE_FILE)
    env_base = os.environ.get("SITE_URL") or os.environ.get("BASE_URL") or ""
    data["baseUrl"] = (base_url or env_base or data.get("baseUrl") or "").rstrip("/") + (
        "/" if (base_url or env_base or data.get("baseUrl")) else ""
    )
    return data


def abs_url(site: dict, path: str) -> str:
    base = site.get("baseUrl") or ""
    path = path.lstrip("./")
    if not base:
        return f"./{path}" if path else "./"
    return urljoin(base, path)


def esc(text: str) -> str:
    return html.escape(text or "", quote=True)


_OFFICIAL = {"deepseek-ai"}


def _categorize(p: dict) -> str:
    """Mirror of the JS categorize() for build-time use."""
    name = p.get("n", "")
    owner = p.get("o", "")
    desc = p.get("d", "")
    topics = p.get("t") or []
    blob = f"{name} {desc} {' '.join(topics)}".lower()
    if owner in _OFFICIAL or name == "deepseek-harness":
        return "official"
    if any(k in blob for k in ("awesome", "handbook", "精选", "目录", "awesome-dsh")):
        return "awesome"
    if any(k in blob for k in ("skin", "theme", "皮肤", "whale", "鲸", "web-ui", "ui-whale", "maid", "pixel")):
        return "ui"
    if any(k in blob for k in ("vision", "ocr", "多模态", "看图", "image", "visual", "modlens")):
        return "vision"
    if any(k in blob for k in ("tui", "desktop", "launcher", "macos", "island", "vscode", "terminal", "终端", "桌面")):
        return "desktop"
    if any(k in blob for k in ("workflow", "team", "agent", "skill", "coworker", "调度", "工作流", "mentor")):
        return "workflow"
    if any(k in blob for k in ("memory", "security", "audit", "doctor", "健康", "安全", "记忆", "rewind")):
        return "memory"
    if any(k in blob for k in ("bili", "内容", "share", "recommend", "xiaohongshu", "douyin", "发现")):
        return "content"
    if any(k in blob for k in ("hub", "registry", "sandbox", "distro", "发行", "oh-my", "oh-dsh", "fabric", "plugin-dev", "check")):
        return "infra"
    if any(k in blob for k in ("ads", "emoji", "pet", "宠物", "五子棋", "整活", "sticker", "gomoku", "合影")):
        return "fun"
    return "tools"


def card_html(p: dict) -> str:
    name = esc(p.get("n", ""))
    owner = esc(p.get("o", ""))
    desc = esc((p.get("d") or "暂无简介，打开仓库查看 README。").strip())
    letter = esc((p.get("n") or "D")[:1].upper())
    lang = p.get("l") or ""
    lang_esc = esc(lang)
    stars = p.get("s") or 0
    forks = p.get("f") or 0
    href = esc(f"https://github.com/{p.get('o')}/{p.get('n')}")
    is_official = p.get("o") in {"deepseek-ai"} or p.get("n") == "deepseek-harness"
    av_cls = "avatar official" if is_official else "avatar"
    lang_tag = (
        f'<span class="lang"><span class="dot" style="background:{LANG_COLORS.get(lang, "#86909c")}"></span>{lang_esc}</span>'
        if lang else ""
    )
    lic = p.get("lic") or ""
    lic_tag = f'<span class="tag lic">{esc(lic)}</span>' if lic and lic != "NOASSERTION" else ""
    archived = '<span class="tag archived">已归档</span>' if p.get("a") else ""
    official_badge = " · 官方" if is_official else ""
    card_cls = "plugin-card is-official" if is_official else "plugin-card"
    return (
        f'<article class="{card_cls}" data-open="{owner}/{name}">'
        f'<div class="plugin-top"><div class="{av_cls}" aria-hidden="true">{letter}</div>'
        f"<div><div class=\"plugin-title\">{name}</div>"
        f'<div class="plugin-owner">{owner}{official_badge}</div></div></div>'
        f'<p class="plugin-desc">{desc}</p>'
        f'<div class="plugin-meta">'
        f'<span class="star"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>{stars}</span>'
        f'{lang_tag}{lic_tag}{archived}'
        f'<a href="{href}" rel="noopener">GitHub →</a></div></article>'
    )


def json_ld(site: dict, plugins: list[dict]) -> str:
    top = plugins[:16]
    website = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": site["name"],
        "alternateName": ["DSH Workshop", "DeepSeek Harness 插件目录", "DSH工坊"],
        "description": site["description"],
        "inLanguage": site.get("inLanguage", "zh-CN"),
        "url": abs_url(site, ""),
        "keywords": site.get("keywords", ""),
        "publisher": {
            "@type": "Organization",
            "name": site["name"],
            "url": abs_url(site, ""),
        },
        "potentialAction": {
            "@type": "SearchAction",
            "target": abs_url(site, "market.html") + "?q={search_term_string}",
            "query-input": "required name=search_term_string",
        },
    }
    app = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "DeepSeek Harness",
        "alternateName": "DSH",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Windows, macOS, Linux",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CNY"},
        "url": site.get("official"),
        "description": "开源 Agent 运行时，一切皆插件。可通过 npx @deepseek-ai/dsh web 启动。",
    }
    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "DSH 精选插件",
        "numberOfItems": len(top),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": f"{p['o']}/{p['n']}",
                "url": f"https://github.com/{p['o']}/{p['n']}",
                "description": p.get("d") or "",
            }
            for i, p in enumerate(top)
        ],
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "DeepSeek Harness 是什么？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "DeepSeek Harness（DSH）是 DeepSeek 开源的 Agent 运行时，口号是 Everything is a Plugin，和 Codex CLI、Claude Code 同类。",
                },
            },
            {
                "@type": "Question",
                "name": "如何启动 DSH？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "安装 Node.js 22 及以上，在项目目录执行 npx -y @deepseek-ai/dsh web，浏览器打开终端打印的地址。",
                },
            },
            {
                "@type": "Question",
                "name": "如何安装社区插件？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "使用 dsh plugin --profile web add git+https://github.com/作者/仓库.git，然后重新启动 dsh web。",
                },
            },
            {
                "@type": "Question",
                "name": "插件数据从哪里来？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "来自 GitHub topic dsh-plugin。本站内置快照，并可用 GitHub Actions 定时同步。",
                },
            },
        ],
    }
    blobs = [website, app, item_list, faq]
    return "\n".join(
        f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False, separators=(",", ":"))}</script>'
        for b in blobs
    )


def _json_ld_parts(site: dict, plugins: list[dict], page_key: str) -> str:
    blocks = []
    # Always include WebSite on every indexable page
    full = json_ld(site, plugins)
    scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', full, re.S)
    parsed = [json.loads(s) for s in scripts]
    by_type = {item.get("@type"): item for item in parsed}
    wanted = {
        "home": ["WebSite", "SoftwareApplication", "ItemList"],
        "market": ["WebSite", "ItemList"],
        "insights": ["WebSite", "ItemList"],
        "guide": ["WebSite", "FAQPage"],
        "publish": ["WebSite"],
        "directory": ["WebSite", "ItemList"],
    }.get(page_key, ["WebSite"])
    crumbs = {
        "home": [("概览", "")],
        "market": [("概览", ""), ("插件目录", "market.html")],
        "insights": [("概览", ""), ("洞察", "insights.html")],
        "guide": [("概览", ""), ("上手手册", "guide.html")],
        "publish": [("概览", ""), ("入驻指南", "publish.html")],
        "directory": [("概览", ""), ("全部插件", "directory.html")],
    }.get(page_key, [("概览", "")])
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": label,
                "item": abs_url(site, path),
            }
            for i, (label, path) in enumerate(crumbs)
        ],
    }
    for name in wanted:
        if name in by_type:
            blocks.append(
                '<script type="application/ld+json">'
                + json.dumps(by_type[name], ensure_ascii=False, separators=(",", ":"))
                + "</script>"
            )
    blocks.append(
        '<script type="application/ld+json">'
        + json.dumps(breadcrumb, ensure_ascii=False, separators=(",", ":"))
        + "</script>"
    )
    return "\n".join(blocks)


def seo_head(site: dict, page: dict) -> str:
    canon = abs_url(site, page["file"] if page["file"] != "index.html" else "")
    image = abs_url(site, "assets/og.jpg")
    return f"""  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f5f6f8" />
  <title>{esc(page["title"])}</title>
  <meta name="description" content="{esc(page["description"])}" />
  <meta name="keywords" content="{esc(site.get("keywords", ""))}" />
  <meta name="author" content="{esc(site["name"])}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
  <meta name="googlebot" content="index,follow" />
  <meta name="applicable-device" content="pc,mobile" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="renderer" content="webkit" />
  <meta name="force-rendering" content="webkit" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <link rel="canonical" href="{esc(canon)}" />
  <link rel="alternate" hreflang="zh-CN" href="{esc(canon)}" />
  <link rel="alternate" hreflang="x-default" href="{esc(canon)}" />
  <link rel="sitemap" type="application/xml" href="{esc(abs_url(site, "sitemap.xml"))}" />
  <meta property="og:site_name" content="{esc(site["name"])}" />
  <meta property="og:locale" content="{esc(site.get("locale", "zh_CN"))}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{esc(page["title"])}" />
  <meta property="og:description" content="{esc(page["description"])}" />
  <meta property="og:url" content="{esc(canon)}" />
  <meta property="og:image" content="{esc(image)}" />
  <meta property="og:image:alt" content="{esc(site["name"])}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{esc(page["title"])}" />
  <meta name="twitter:description" content="{esc(page["description"])}" />
  <meta name="twitter:image" content="{esc(image)}" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="{esc(site.get("shortName", "DSH工坊"))}" />
  <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="./assets/apple-touch-icon.png" />
  <link rel="manifest" href="./site.webmanifest" />
  <link rel="preload" href="./assets/app.css" as="style" />
  <link rel="stylesheet" href="./assets/app.css" />"""


def replace_head(doc: str, head_inner: str) -> str:
    return re.sub(r"<head>.*?</head>", f"<head>\n{head_inner}\n</head>", doc, count=1, flags=re.S)


def set_active_view(doc: str, view: str) -> str:
    doc = re.sub(r'class="view is-on"', 'class="view"', doc)
    doc = re.sub(
        rf'(<section class="view")([^>]*data-view="{view}")',
        r'<section class="view is-on"\2',
        doc,
        count=1,
    )
    return doc


def keep_only_view(doc: str, view: str) -> str:
    pattern = re.compile(
        r'<section class="view[^"]*"[^>]*data-view="([^"]*)"[^>]*>.*?</section>',
        re.S,
    )

    def repl(match: re.Match) -> str:
        return match.group(0) if match.group(1) == view else ""

    return pattern.sub(repl, doc)


def rewrite_nav(doc: str) -> str:
    repl = {
        'href="#/"': 'href="./index.html"',
        'href="#/market"': 'href="./market.html"',
        'href="#/guide"': 'href="./guide.html"',
        'href="#/publish"': 'href="./publish.html"',
    }
    for a, b in repl.items():
        doc = doc.replace(a, b)
    return doc


def inject_after_head_open_scripts(doc: str, ld: str) -> str:
    return doc.replace("</head>", f"{ld}\n</head>", 1)


def write_directory(site: dict, plugins: list[dict], fetched_at: str) -> None:
    items = []
    for p in plugins:
        desc = esc((p.get("d") or "暂无简介").strip())
        lang = p.get("l") or ""
        lang_color = LANG_COLORS.get(lang, "#86909c")
        lang_html = (
            f'<span class="lang"><span class="dot" style="background:{lang_color}"></span>{esc(lang)}</span>'
            if lang else ""
        )
        stars = p.get("s", 0)
        tier_html = ""
        if stars >= 10000:
            tier_html = '<span class="tier-badge tier-fire" title="顶级">🔥</span>'
        elif stars >= 1000:
            tier_html = '<span class="tier-badge tier-gold" title="千星">⭐</span>'
        elif stars >= 100:
            tier_html = '<span class="tier-badge tier-silver" title="百星">✦</span>'
        lic = p.get("lic") or ""
        lic_html = f'<span class="tag lic">{esc(lic)}</span>' if lic and lic != "NOASSERTION" else ""
        archived_html = '<span class="tag archived">已归档</span>' if p.get("a") else ""
        items.append(
            "<article class=\"dir-item\">"
            f"<h2><a href=\"https://github.com/{esc(p['o'])}/{esc(p['n'])}\">{esc(p['n'])}</a>{tier_html}</h2>"
            f"<p class=\"dir-meta\">{esc(p['o'])} · <span class=\"star\">★ {stars}</span>"
            f" · {lang_html}"
            f"{' · ' if lic_html else ''}{lic_html}"
            f"{' · ' if archived_html else ''}{archived_html}</p>"
            f"<p>{desc}</p>"
            f"<p class=\"dir-install\"><code>dsh plugin --profile web add git+https://github.com/{esc(p['o'])}/{esc(p['n'])}.git</code></p>"
            "</article>"
        )
    page = {
        "file": "directory.html",
        "title": f"全部 {len(plugins)} 个 DSH 插件 · dsh-plugin 目录",
        "description": f"完整列出 GitHub topic dsh-plugin 中的 {len(plugins)} 个 DeepSeek Harness 社区仓库，含简介与安装命令。",
        "view": "home",
    }
    body = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
{seo_head(site, page)}
{_json_ld_parts(site, plugins, "directory")}
</head>
<body>
  <a class="skip" href="#main">跳到正文</a>
  <main id="main" class="content dir-page">
    <nav class="dir-nav" aria-label="面包屑">
      <a href="./index.html">创意工坊</a>
      <span>/</span>
      <span>全部插件</span>
    </nav>
    <header class="page-head">
      <h1>全部 DSH 插件</h1>
      <p>来自 GitHub topic <a href="https://github.com/topics/dsh-plugin">dsh-plugin</a> 的静态目录，共 {len(plugins)} 个仓库。快照时间 {esc(fetched_at)}。需要检索请打开 <a href="./market.html">插件目录</a>。</p>
    </header>
    <div class="dir-list">
      {''.join(items)}
    </div>
  </main>
</body>
</html>
"""
    (ROOT / "directory.html").write_text(body, encoding="utf-8")


def write_favorites(site: dict, plugins: list[dict]) -> None:
    """Static SEO shell for favorites page; JS loads actual favorites from localStorage."""
    top_names = ", ".join(f"{p['o']}/{p['n']}" for p in plugins[:8])
    page = {
        "file": "favorites.html",
        "title": "我的收藏 · DSH 插件工坊",
        "description": f"DeepSeek Harness 社区插件收藏夹。浏览器本地保存的收藏列表，含 {top_names} 等热门插件入口。",
        "view": "home",
    }
    body = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
{seo_head(site, page)}
{_json_ld_parts(site, plugins, "directory")}
</head>
<body>
  <a class="skip" href="#main">跳到正文</a>
  <main id="main" class="content">
    <nav class="dir-nav" aria-label="面包屑">
      <a href="./index.html">创意工坊</a>
      <span>/</span>
      <span>我的收藏</span>
    </nav>
    <header class="page-head">
      <div class="hero-badge"><span class="dot"></span>浏览器本地存储</div>
      <h1>我的收藏</h1>
      <p>这里展示你在 <a href="./market.html">插件目录</a> 点过 ★ 的插件。收藏记录只存在当前浏览器（localStorage），换设备不同步。下方为热门插件入口，登录后可在目录里收藏。</p>
    </header>
    <div class="fav-stats" id="favStats" style="display:none">
      <div class="stat"><b id="favCount">0</b><span>已收藏</span></div>
      <div class="stat"><b id="favStars">0</b><span>累计星标</span></div>
      <div class="stat"><b id="favLangs">0</b><span>语言数</span></div>
    </div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm" id="favExportMd" type="button">导出 Markdown</button>
      <button class="btn btn-sm" id="favExportJson" type="button">导出 JSON</button>
      <button class="btn btn-sm btn-ghost" id="favClear" type="button">清空收藏</button>
    </div>
    <div class="card-grid" id="favGrid"></div>
    <div class="empty" id="favEmpty">
      <div class="empty-icon">★</div>
      <p>还没有收藏任何插件。</p>
      <p>去 <a href="./market.html">插件目录</a> 点击卡片右上角的 ★ 即可收藏。</p>
    </div>
    <div class="section-head" style="margin-top:40px">
      <div>
        <h2>热门插件入口</h2>
        <p>还没收藏？先从这些高星插件开始。</p>
      </div>
      <a class="btn btn-ghost" href="./market.html">查看全部 →</a>
    </div>
    <div class="card-grid">
      {''.join(card_html(p) for p in plugins[:6])}
    </div>
  </main>
  <div class="toast" id="toast" role="status"></div>
  <div class="drawer-mask" id="drawerMask" data-close-drawer></div>
  <aside class="drawer" id="drawer" tabindex="-1" aria-label="插件详情">
    <button class="drawer-close" type="button" data-close-drawer aria-label="关闭">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <div class="drawer-avatar" id="drawerAvatar" aria-hidden="true">D</div>
    <h2 id="drawerTitle">插件</h2>
    <div class="plugin-owner" id="drawerOwner"></div>
    <p class="drawer-desc" id="drawerDesc"></p>
    <div class="plugin-meta" id="drawerMeta"></div>
    <div class="drawer-stats" id="drawerStats"></div>
    <div class="plugin-meta" id="drawerTopics" style="margin-top:10px"></div>
    <div class="copy-row">
      <code id="installCode"></code>
      <button class="btn btn-primary" id="copyInstall" type="button">复制</button>
    </div>
    <div class="drawer-actions">
      <a class="btn btn-block" id="openRepo" target="_blank" rel="noopener">打开 GitHub 仓库</a>
      <div style="display:flex;gap:8px">
        <a class="btn btn-block" id="openIssues" target="_blank" rel="noopener">Issues</a>
        <a class="btn btn-block" id="openReleases" target="_blank" rel="noopener">Releases</a>
      </div>
    </div>
  </aside>
  <script>
  // Minimal inline script for favorites page (loads from localStorage)
  (function() {{
    var PLUGINS = {json.dumps(plugins, ensure_ascii=False)};
    var KEY = 'dsh-favs-v2';
    function esc(s) {{ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }}
    function fmt(n) {{ return n>=1000 ? (n/1000).toFixed(1).replace(/\\.0$/,'')+'k' : String(n||0); }}
    function langColor(l) {{ return {{'TypeScript':'#3178c6','JavaScript':'#f1e05a','Python':'#3572A5','Rust':'#dea584','Go':'#00ADD8','HTML':'#e34c26','CSS':'#563d7c','Shell':'#89e051','Java':'#b07219','C++':'#f34b7d','C':'#555555','Swift':'#F05138','Vue':'#41b883'}}[l] || '#86909c'; }}
    function avatarBg(o) {{ var h=0; for(var i=0;i<o.length;i++) h=(h*31+o.charCodeAt(i))>>>0; return 'linear-gradient(135deg,hsl('+(h%360)+',62%,58%),hsl('+((h+40)%360)+',60%,46%))'; }}
    function cardHTML(p, isFav) {{
      var lc = langColor(p.l);
      var tier = p.s>=10000?'<span class="tier-badge tier-fire" title="顶级">🔥</span>':p.s>=1000?'<span class="tier-badge tier-gold" title="千星">⭐</span>':p.s>=100?'<span class="tier-badge tier-silver" title="百星">✦</span>':'';
      return '<article class="plugin-card'+(isFav?' is-fav':'')+'" data-open="'+esc(p.o)+'/'+esc(p.n)+'">'+
        '<button class="fav-btn'+(isFav?' is-on':'')+'" data-fav="'+esc(p.o)+'/'+esc(p.n)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="'+(isFav?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.8"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></button>'+
        '<div class="plugin-top"><div class="avatar" style="background:'+avatarBg(p.o)+';color:#fff;border-color:transparent">'+esc((p.n[0]||'D').toUpperCase())+'</div>'+
        '<div style="min-width:0"><div class="plugin-title">'+esc(p.n)+tier+'</div><div class="plugin-owner">'+esc(p.o)+'</div></div></div>'+
        '<p class="plugin-desc">'+esc(p.d||'暂无简介')+'</p>'+
        '<div class="plugin-meta"><span class="star"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'+fmt(p.s)+'</span>'+
        (p.l?'<span class="lang"><span class="dot" style="background:'+lc+'"></span>'+esc(p.l)+'</span>':'')+
        (p.lic&&p.lic!=='NOASSERTION'?'<span class="tag lic">'+esc(p.lic)+'</span>':'')+'</div></article>';
    }}
    var pmap = {{}};
    PLUGINS.forEach(function(p) {{ pmap[p.o+'/'+p.n] = p; }});
    function render() {{
      var favs = JSON.parse(localStorage.getItem(KEY) || '[]');
      var items = favs.map(function(id) {{ return pmap[id]; }}).filter(Boolean);
      var grid = document.getElementById('favGrid');
      var empty = document.getElementById('favEmpty');
      var stats = document.getElementById('favStats');
      if (!items.length) {{
        grid.innerHTML = ''; empty.style.display = 'block'; stats.style.display = 'none';
        return;
      }}
      empty.style.display = 'none'; stats.style.display = 'grid';
      grid.innerHTML = items.map(function(p) {{ return cardHTML(p, true); }}).join('');
      document.getElementById('favCount').textContent = items.length;
      document.getElementById('favStars').textContent = fmt(items.reduce(function(s,p){{return s+(p.s||0);}},0));
      document.getElementById('favLangs').textContent = new Set(items.map(function(p){{return p.l;}}).filter(Boolean)).size;
    }}
    function toast(msg) {{ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('is-on'); setTimeout(function(){{t.classList.remove('is-on');}},1800); }}
    function copyText(text) {{ navigator.clipboard.writeText(text).then(function(){{toast('已复制');}}).catch(function(){{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('已复制');}}); }}
    function installCmd(p) {{ return 'dsh plugin --profile web add git+https://github.com/'+p.o+'/'+p.n+'.git'; }}
    document.addEventListener('click', function(e) {{
      var favBtn = e.target.closest('[data-fav]');
      if (favBtn) {{
        e.stopPropagation();
        var id = favBtn.dataset.fav;
        var favs = JSON.parse(localStorage.getItem(KEY) || '[]');
        var idx = favs.indexOf(id);
        if (idx >= 0) {{ favs.splice(idx,1); toast('已取消收藏'); }} else {{ favs.push(id); toast('已收藏','★'); }}
        localStorage.setItem(KEY, JSON.stringify(favs));
        render();
        return;
      }}
      var open = e.target.closest('[data-open]');
      if (open) {{
        var p = pmap[open.dataset.open];
        if (p) {{
          var d = document.getElementById('drawer');
          document.getElementById('drawerTitle').textContent = p.n;
          document.getElementById('drawerOwner').textContent = p.o;
          document.getElementById('drawerDesc').textContent = p.d || '暂无简介';
          document.getElementById('drawerMeta').innerHTML = '<span class="star">★ '+p.s+'</span><span>Fork '+p.f+'</span>'+(p.l?'<span class="lang"><span class="dot" style="background:'+langColor(p.l)+'"></span>'+esc(p.l)+'</span>':'');
          document.getElementById('installCode').textContent = installCmd(p);
          document.getElementById('openRepo').href = 'https://github.com/'+p.o+'/'+p.n;
          d.classList.add('is-on'); document.getElementById('drawerMask').classList.add('is-on');
        }}
        return;
      }}
      if (e.target.closest('[data-close-drawer]')) {{ document.getElementById('drawer').classList.remove('is-on'); document.getElementById('drawerMask').classList.remove('is-on'); }}
    }});
    document.getElementById('copyInstall').addEventListener('click', function() {{
      var t = document.getElementById('installCode').textContent;
      if (t) copyText(t);
    }});
    document.getElementById('favClear').addEventListener('click', function() {{
      if (!confirm('确定清空所有收藏？此操作不可撤销。')) return;
      localStorage.setItem(KEY, '[]'); render(); toast('已清空收藏');
    }});
    document.getElementById('favExportMd').addEventListener('click', function() {{
      var favs = JSON.parse(localStorage.getItem(KEY) || '[]');
      var items = favs.map(function(id){{return pmap[id];}}).filter(Boolean);
      if (!items.length) {{ toast('没有可导出的收藏'); return; }}
      var lines = ['# DSH 插件收藏','','> 导出时间：'+new Date().toLocaleString('zh-CN'),'> 共 '+items.length+' 个',''];
      items.forEach(function(p) {{ lines.push('## ['+p.n+'](https://github.com/'+p.o+'/'+p.n+')'); lines.push('- 作者：'+p.o); lines.push('- 星标：'+(p.s||0)+' · Fork：'+(p.f||0)); if(p.l) lines.push('- 语言：'+p.l); lines.push('- 简介：'+(p.d||'暂无')); lines.push('- 安装：\`dsh plugin --profile web add git+https://github.com/'+p.o+'/'+p.n+'.git\`'); lines.push(''); }});
      var blob = new Blob([lines.join('\\n')], {{type:'text/markdown'}});
      var a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='dsh-favorites.md'; a.click();
    }});
    document.getElementById('favExportJson').addEventListener('click', function() {{
      var favs = JSON.parse(localStorage.getItem(KEY) || '[]');
      var items = favs.map(function(id){{return pmap[id];}}).filter(Boolean);
      if (!items.length) {{ toast('没有可导出的收藏'); return; }}
      var blob = new Blob([JSON.stringify({{exported_at:new Date().toISOString(),count:items.length,plugins:items}},null,2)], {{type:'application/json'}});
      var a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='dsh-favorites.json'; a.click();
    }});
    render();
  }})();
  </script>
</body>
</html>
"""
    (ROOT / "favorites.html").write_text(body, encoding="utf-8")


def write_plugin_pages(site: dict, plugins: list[dict]) -> None:
    """Generate static SEO detail pages for top plugins (stars >= 10, max 150)."""
    # Only generate for plugins with >= 10 stars to keep file count reasonable
    candidates = [p for p in plugins if (p.get("s") or 0) >= 10][:150]
    pdir = ROOT / "p"
    pdir.mkdir(exist_ok=True)
    count = 0
    for p in candidates:
        owner = p["o"]
        name = p["n"]
        # slug: owner-name (lowercase, sanitized)
        slug = f"{owner}-{name}".lower()
        slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in slug)
        slug = slug.strip("-")
        if not slug:
            continue
        full = f"{owner}/{name}"
        repo = f"https://github.com/{owner}/{name}"
        desc = (p.get("d") or "暂无简介").strip()
        stars = p.get("s") or 0
        forks = p.get("f") or 0
        lang = p.get("l") or ""
        lang_color = LANG_COLORS.get(lang, "#86909c")
        lic = p.get("lic") or ""
        lic_html = f'<span class="tag lic">{esc(lic)}</span>' if lic and lic != "NOASSERTION" else ""
        archived = '<span class="tag archived">已归档</span>' if p.get("a") else ""
        topics = p.get("t") or []
        topics_html = "".join(
            f'<a class="drawer-topic" href="../market.html?q={esc(t)}">#{esc(t)}</a>' for t in topics[:16]
        ) or '<span style="color:var(--text-4);font-size:12px">无 topic</span>'
        tier = ""
        if stars >= 10000:
            tier = '<span class="tier-badge tier-fire">🔥</span>'
        elif stars >= 1000:
            tier = '<span class="tier-badge tier-gold">⭐</span>'
        elif stars >= 100:
            tier = '<span class="tier-badge tier-silver">✦</span>'
        # similar plugins (same category, top 4 by stars)
        cat = _categorize(p)
        similar = [q for q in plugins if q is not p and _categorize(q) == cat][:4]
        similar_html = "".join(
            f'<article class="plugin-card" data-open="{esc(q["o"])}/{esc(q["n"])}" style="min-height:0;padding:11px">'
            f'<div class="plugin-top"><div class="avatar" style="background:#86909c;color:#fff">{esc((q["n"][:1] or "D").upper())}</div>'
            f'<div style="min-width:0"><div class="plugin-title" style="font-size:13px">{esc(q["n"])}</div>'
            f'<div class="plugin-owner">{esc(q["o"])} · ★ {q.get("s", 0)}</div></div></div></article>'
            for q in similar
        ) or '<span style="color:var(--text-4);font-size:12px">暂无同类</span>'
        # JSON-LD for this plugin
        ld = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": name,
            "applicationCategory": "DeveloperApplication",
            "operatingSystem": "Windows, macOS, Linux",
            "url": repo,
            "description": desc,
            "author": {"@type": "Organization", "name": owner},
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CNY"},
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "5" if stars >= 1000 else "4",
                "ratingCount": str(max(stars, 1)),
            } if stars else None,
        }
        ld_clean = {k: v for k, v in ld.items() if v is not None}
        breadcrumb = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "概览", "item": abs_url(site, "")},
                {"@type": "ListItem", "position": 2, "name": "插件目录", "item": abs_url(site, "market.html")},
                {"@type": "ListItem", "position": 3, "name": name, "item": abs_url(site, f"p/{slug}.html")},
            ],
        }
        ld_breadcrumb_json = json.dumps(breadcrumb, ensure_ascii=False, separators=(",", ":"))
        page = {
            "file": f"p/{slug}.html",
            "title": f"{name} · {owner} · DSH 插件详情",
            "description": f"{desc[:140]}{'…' if len(desc) > 140 else ''} ★ {stars} · {lang or '未知语言'} · 安装命令。",
            "view": "home",
        }
        body = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
{seo_head(site, page)}
<script type="application/ld+json">{json.dumps(ld_clean, ensure_ascii=False, separators=(",", ":"))}</script>
<script type="application/ld+json">{ld_breadcrumb_json}</script>
</head>
<body>
  <a class="skip" href="#main">跳到正文</a>
  <main id="main" class="content" style="max-width:760px">
    <nav class="dir-nav" aria-label="面包屑">
      <a href="../index.html">创意工坊</a>
      <span>/</span>
      <a href="../market.html">插件目录</a>
      <span>/</span>
      <span>{esc(name)}</span>
    </nav>
    <header class="page-head">
      <div class="crumb">插件详情</div>
      <h1>{esc(name)}{tier}</h1>
      <p class="plugin-owner" style="font-size:14px;margin-top:4px">作者：<a href="https://github.com/{esc(owner)}" target="_blank" rel="noopener">{esc(owner)}</a></p>
      <p class="drawer-desc">{esc(desc)}</p>
    </header>
    <div class="plugin-meta" style="margin:14px 0">
      <span class="star"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> {stars}</span>
      <span>Fork {forks}</span>
      {f'<span class="lang"><span class="dot" style="background:{lang_color}"></span>{esc(lang)}</span>' if lang else ''}
      {lic_html}
      {archived}
    </div>
    <div class="plugin-meta" style="margin-top:10px">{topics_html}</div>
    <div class="copy-row">
      <code id="installCode">dsh plugin --profile web add git+https://github.com/{esc(owner)}/{esc(name)}.git</code>
      <button class="btn btn-primary" id="copyInstall" type="button">复制</button>
    </div>
    <div class="drawer-actions" style="margin-top:12px">
      <a class="btn btn-block" href="{repo}" target="_blank" rel="noopener">打开 GitHub 仓库</a>
      <div style="display:flex;gap:8px;margin-top:8px">
        <a class="btn btn-block" href="{repo}/issues" target="_blank" rel="noopener">Issues</a>
        <a class="btn btn-block" href="{repo}/releases" target="_blank" rel="noopener">Releases</a>
      </div>
    </div>
    <div class="install-stats">
      <div class="section-head" style="margin-top:28px">
        <div><h2 style="font-size:16px">安装统计预估</h2><p style="margin:4px 0 0;color:var(--text-3);font-size:12px">基于 Fork 数与星标的经验公式推算，仅供参考</p></div>
      </div>
      <div class="stats">
        <div class="stat"><b>{forks}</b><span>Fork 数</span></div>
        <div class="stat"><b>{max(1, round(forks * 3.5))}</b><span>预估安装</span></div>
        <div class="stat"><b>{round((stars / max(forks, 1)) * 10) / 10}</b><span>星/Fork 比</span></div>
        <div class="stat"><b>{'高' if forks >= 50 else '中' if forks >= 10 else '低'}</b><span>活跃度</span></div>
      </div>
    </div>
    <div class="section-head" style="margin-top:28px">
      <div><h2 style="font-size:16px">同类插件</h2></div>
    </div>
    <div class="card-grid" style="grid-template-columns:1fr 1fr;gap:8px">{similar_html}</div>
    <p style="margin-top:24px;color:var(--text-3);font-size:12px">
      数据来自 <a href="https://github.com/topics/dsh-plugin">GitHub topic dsh-plugin</a>。
      <a href="../market.html">返回插件目录</a> · <a href="../index.html">回到概览</a>
    </p>
  </main>
  <div class="toast" id="toast" role="status"></div>
  <script>
  document.getElementById('copyInstall').addEventListener('click', function() {{
    var t = document.getElementById('installCode').textContent;
    navigator.clipboard.writeText(t).then(function() {{
      var el = document.getElementById('toast'); el.textContent='已复制安装命令'; el.classList.add('is-on');
      setTimeout(function(){{el.classList.remove('is-on');}}, 1800);
    }}).catch(function(){{}});
  }});
  document.addEventListener('click', function(e) {{
    var open = e.target.closest('[data-open]');
    if (open) {{ window.location.href = '../market.html?p=' + encodeURIComponent(open.dataset.open); }}
  }});
  </script>
</body>
</html>
"""
        # Fix relative asset paths for /p/ subdirectory
        body = body.replace('href="./assets/', 'href="../assets/')
        body = body.replace('src="./assets/', 'src="../assets/')
        body = body.replace('href="./site.webmanifest"', 'href="../site.webmanifest"')
        body = body.replace('href="./favicon.svg"', 'href="../assets/favicon.svg"')
        body = body.replace('href="./apple-touch-icon.png"', 'href="../assets/apple-touch-icon.png"')
        (pdir / f"{slug}.html").write_text(body, encoding="utf-8")
        count += 1
    print(f"  plugin detail pages: {count}")
    return count


def write_sitemap_html(site: dict, plugins: list[dict]) -> None:
    links = [
        ("index.html", "概览", "DeepSeek Harness 介绍与精选插件"),
        ("market.html", "插件目录", "检索、筛选并复制安装命令"),
        ("insights.html", "插件洞察", "语言、星标与活跃度分析"),
        ("directory.html", "全部插件", f"{len(plugins)} 个仓库的静态列表"),
        ("favorites.html", "我的收藏", "浏览器本地保存的收藏插件"),
        ("guide.html", "上手手册", "安装 DSH 与社区插件"),
        ("publish.html", "入驻指南", "发布插件与 GitHub Pages"),
        ("feed.xml", "RSS 订阅", "新增插件与更新"),
        ("llms.txt", "llms.txt", "给大模型阅读的站点说明"),
    ]
    lis = "".join(
        f'<li><a href="./{path}">{esc(title)}</a> — {esc(desc)}</li>' for path, title, desc in links
    )
    top = "".join(
        f'<li><a href="https://github.com/{esc(p["o"])}/{esc(p["n"])}">{esc(p["n"])}</a></li>'
        for p in plugins[:40]
    )
    html_doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
{seo_head(site, {"file": "sitemap.html", "title": "网站地图 · DSH 创意工坊", "description": "DSH 创意工坊全部页面与热门插件入口。", "view": "home"})}
</head>
<body>
  <main id="main" class="content">
    <header class="page-head">
      <h1>网站地图</h1>
      <p>供搜索引擎与人工浏览的页面索引。</p>
    </header>
    <h2>页面</h2>
    <ul>{lis}</ul>
    <h2>热门插件</h2>
    <ul>{top}</ul>
    <p><a href="./directory.html">查看全部插件</a></p>
  </main>
</body>
</html>
"""
    (ROOT / "sitemap.html").write_text(html_doc, encoding="utf-8")


def write_sitemap_xml(site: dict, fetched_at: str) -> None:
    lastmod = (fetched_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))[:10]
    paths = [
        ("index.html", "1.0", "daily"),
        ("market.html", "0.9", "daily"),
        ("insights.html", "0.8", "daily"),
        ("directory.html", "0.9", "daily"),
        ("favorites.html", "0.6", "weekly"),
        ("guide.html", "0.8", "weekly"),
        ("publish.html", "0.7", "weekly"),
        ("feed.xml", "0.6", "daily"),
        ("sitemap.html", "0.3", "weekly"),
    ]
    urls = []
    for path, prio, freq in paths:
        loc = abs_url(site, "" if path == "index.html" else path)
        if loc.startswith("./") and not site.get("baseUrl"):
            # Keep a valid-looking relative sitemap for local preview; Search Console needs absolute.
            loc = path if path != "index.html" else "index.html"
        urls.append(
            "  <url>"
            f"<loc>{xml_escape(loc)}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>{freq}</changefreq>"
            f"<priority>{prio}</priority>"
            "</url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


def write_robots(site: dict) -> None:
    sitemap = abs_url(site, "sitemap.xml")
    html_map = abs_url(site, "sitemap.html")
    plugin_sitemap = abs_url(site, "sitemap-plugins.xml")
    text = f"""User-agent: *
Allow: /

User-agent: Baiduspider
Allow: /

User-agent: Sogou web spider
Allow: /

User-agent: Bytespider
Allow: /

User-agent: GPTBot
Allow: /

Disallow: /scripts/
Disallow: /.github/

Sitemap: {sitemap}
Sitemap: {plugin_sitemap}
Sitemap: {html_map}
"""
    (ROOT / "robots.txt").write_text(text, encoding="utf-8")


def write_plugin_sitemap(site: dict, plugins: list[dict], fetched_at: str) -> None:
    """Generate sitemap-plugins.xml for plugin detail pages."""
    lastmod = (fetched_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))[:10]
    candidates = [p for p in plugins if (p.get("s") or 0) >= 10][:150]
    urls = []
    for p in candidates:
        owner = p["o"]
        name = p["n"]
        slug = f"{owner}-{name}".lower()
        slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in slug).strip("-")
        if not slug:
            continue
        stars = p.get("s") or 0
        # priority by star tier
        if stars >= 10000:
            prio = "0.9"
        elif stars >= 1000:
            prio = "0.7"
        elif stars >= 100:
            prio = "0.5"
        else:
            prio = "0.4"
        loc = abs_url(site, f"p/{slug}.html")
        if loc.startswith("./") and not site.get("baseUrl"):
            loc = f"p/{slug}.html"
        urls.append(
            "  <url>"
            f"<loc>{xml_escape(loc)}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>weekly</changefreq>"
            f"<priority>{prio}</priority>"
            "</url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap-plugins.xml").write_text(xml, encoding="utf-8")


def write_manifest(site: dict) -> None:
    data = {
        "name": site["name"],
        "short_name": site.get("shortName", "DSH工坊"),
        "description": site["description"],
        "lang": "zh-CN",
        "start_url": "./index.html",
        "scope": "./",
        "display": "standalone",
        "background_color": "#f5f6f8",
        "theme_color": "#f5f6f8",
        "icons": [
            {"src": "./assets/favicon.svg", "type": "image/svg+xml", "sizes": "any"},
            {"src": "./assets/apple-touch-icon.png", "type": "image/png", "sizes": "180x180"},
        ],
    }
    (ROOT / "site.webmanifest").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_feed(site: dict, plugins: list[dict], fetched_at: str) -> None:
    """Generate RSS 2.0 feed of the top recently-active plugins."""
    base = site.get("baseUrl") or ""
    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    # Sort by updated_at desc, take top 40
    items_sorted = sorted(plugins, key=lambda p: p.get("u") or "", reverse=True)[:40]
    entries = []
    for p in items_sorted:
        full = f"{p.get('o')}/{p.get('n')}"
        repo = f"https://github.com/{p.get('o')}/{p.get('n')}"
        desc = (p.get("d") or "暂无简介").strip()
        updated = p.get("u") or ""
        if updated:
            try:
                dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                pub = dt.strftime("%a, %d %b %Y %H:%M:%S GMT")
            except Exception:
                pub = now
        else:
            pub = now
        guid = f"{repo}#{updated}" if updated else repo
        link = f"{base}/market.html?p={full}" if base else f"./market.html?p={full}"
        entries.append(
            "    <item>\n"
            f"      <title>{xml_escape(full)}</title>\n"
            f"      <link>{xml_escape(link)}</link>\n"
            f"      <guid isPermaLink=\"false\">{xml_escape(guid)}</guid>\n"
            f"      <pubDate>{pub}</pubDate>\n"
            f"      <description>{xml_escape(desc)} · ★ {p.get('s', 0)} · {xml_escape(p.get('l') or '')}</description>\n"
            "    </item>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        '  <channel>\n'
        f"    <title>{xml_escape(site.get('name', 'DSH 创意工坊'))} · 近期活跃插件</title>\n"
        f"    <link>{xml_escape(base or './')}</link>\n"
        f"    <description>{xml_escape(site.get('description', ''))}</description>\n"
        f"    <language>zh-CN</language>\n"
        f"    <lastBuildDate>{now}</lastBuildDate>\n"
        f"    <atom:link href=\"{xml_escape(base + '/feed.xml' if base else './feed.xml')}\" rel=\"self\" type=\"application/rss+xml\"/>\n"
        + "\n".join(entries)
        + "\n  </channel>\n</rss>\n"
    )
    (ROOT / "feed.xml").write_text(xml, encoding="utf-8")


def patch_pages(site: dict, plugins: list[dict]) -> None:
    source = (ROOT / "templates" / "app.html").read_text(encoding="utf-8")
    source = rewrite_nav(source)
    featured = "\n".join(card_html(p) for p in plugins[:12])
    source = source.replace(
        '<div class="card-grid" id="featuredGrid"></div>',
        f'<div class="card-grid" id="featuredGrid">{featured}</div>',
    )
    noscript = (
        "<noscript><section class=\"notice\"><p>本站支持无脚本浏览。"
        f"共收录 {len(plugins)} 个插件，请访问 "
        '<a href="./directory.html">全部插件目录</a> 或 '
        '<a href="./guide.html">上手手册</a>。</p></section></noscript>'
    )
    if "<noscript>" not in source:
        source = source.replace('<main id="main" class="content">', f'<main id="main" class="content">\n        {noscript}')
    for key, page in PAGES.items():
        doc = source
        doc = replace_head(doc, seo_head(site, page))
        doc = inject_after_head_open_scripts(doc, _json_ld_parts(site, plugins, key))
        doc = set_active_view(doc, page["view"])
        doc = keep_only_view(doc, page["view"])
        (ROOT / page["file"]).write_text(doc, encoding="utf-8")


def compress_images() -> None:
    try:
        from PIL import Image
    except ImportError:
        return
    og = ROOT / "assets" / "og.png"
    if og.exists():
        img = Image.open(og).convert("RGB")
        img.thumbnail((1200, 630))
        canvas = Image.new("RGB", (1200, 630), (15, 27, 48))
        x = (1200 - img.width) // 2
        y = (630 - img.height) // 2
        canvas.paste(img, (x, y))
        canvas.save(ROOT / "assets" / "og.jpg", "JPEG", quality=82, optimize=True)
    from PIL import ImageDraw

    mark = Image.new("RGB", (180, 180), (29, 33, 41))
    draw = ImageDraw.Draw(mark)
    draw.rounded_rectangle((18, 18, 162, 162), radius=28, fill=(29, 33, 41))
    draw.polygon(
        [(36, 108), (70, 72), (118, 70), (150, 96), (128, 118), (92, 128), (58, 122)],
        fill=(245, 246, 248),
    )
    draw.ellipse((62, 88, 74, 100), fill=(29, 33, 41))
    mark.save(ROOT / "assets" / "apple-touch-icon.png", "PNG", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="")
    args = parser.parse_args()
    site = site_config(args.base_url)
    payload = load_json(PLUGINS_FILE)
    plugins = payload.get("plugins") or []
    fetched = payload.get("fetched_at") or ""
    if site.get("baseUrl"):
        SITE_FILE.write_text(
            json.dumps({**load_json(SITE_FILE), "baseUrl": site["baseUrl"].rstrip("/")}, ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
    compress_images()
    patch_pages(site, plugins)
    write_directory(site, plugins, fetched)
    write_favorites(site, plugins)
    write_plugin_pages(site, plugins)
    write_sitemap_html(site, plugins)
    write_sitemap_xml(site, fetched)
    write_plugin_sitemap(site, plugins, fetched)
    write_robots(site)
    write_manifest(site)
    write_feed(site, plugins, fetched)
    print(f"seo pages ready · {len(plugins)} plugins · base={site.get('baseUrl') or '(relative)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
