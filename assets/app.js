/* ============================================================
   DSH 创意工坊 — app.js v2
   纯静态前端逻辑：快照 + 实时同步 + 检索 + 收藏 + 洞察
   ============================================================ */
(() => {
  const PAGE_SIZE = 12;
  const TOPIC_URL = "https://github.com/topics/dsh-plugin";
  const OFFICIAL = new Set(["deepseek-ai"]);

  const FEATURED = [
    "deepseek-ai/deepseek-harness",
    "zhu1090093659/dsh-web-ui",
    "liustack/modlens",
    "Anionex/agent-vision-toolkit",
    "omdsh-dev/DSH-better-sidebar",
    "ccch1mneyyy/dsh-cc-tui",
    "hust-open-atom-club/oh-dsh",
    "Electricitysheep/dsh-handbook",
    "Small-tailqwq/dsh-deep-whale",
    "Nagi-ovo/dsh-visualize",
    "omdsh-dev/dsh-genui",
    "Anionex/dsh-computer-use",
    "paean-ai/deeptide",
    "whiteguo233/OpenBiliClaw",
    "csyangwen/dsh-memory-evolve",
    "hellodigua/dsh-share",
    "AdamPlatin123/awesome-dsh-plugins",
    "ZSeven-W/dsh-openpencil",
  ];

  const CATS = [
    { id: "all", name: "全部" },
    { id: "official", name: "官方核心" },
    { id: "ui", name: "界面皮肤" },
    { id: "vision", name: "视觉多模态" },
    { id: "desktop", name: "桌面终端" },
    { id: "workflow", name: "工作流" },
    { id: "tools", name: "效率工具" },
    { id: "infra", name: "基建发行" },
    { id: "memory", name: "记忆安全" },
    { id: "content", name: "内容发现" },
    { id: "fun", name: "趣味整活" },
    { id: "awesome", name: "精选目录" },
    { id: "fav", name: "我的收藏" },
  ];

  // GitHub language colors (subset)
  const LANG_COLORS = {
    TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
    Rust: "#dea584", Go: "#00ADD8", Java: "#b07219", HTML: "#e34c26",
    CSS: "#563d7c", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
    Shell: "#89e051", Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138",
    Kotlin: "#A97BFF", Dart: "#00B4AB", Vue: "#41b883", Svelte: "#ff3e00",
    Lua: "#000080", Perl: "#0298c3", Scala: "#c22d40", Elixir: "#6e4a7e",
    Haskell: "#5e5086", Clojure: "#db5855", Zig: "#ec915c", "Jupyter Notebook": "#DA5B0B",
    MDX: "#fcb32c", Astro: "#ff5a03", Nim: "#ffc200", Julia: "#a270ba",
    R: "#198CE7", OCaml: "#3be133", PowerShell: "#012456", Makefile: "#427819",
    Dockerfile: "#384d54", SCSS: "#c6538c", Less: "#1d365d", Stylus: "#ff6347",
    Solidity: "#AA6746", Assembly: "#6E4C13", "Objective-C": "#438eff",
    "Objective-C++": "#6866fb", TeX: "#3D6117", "Vim Script": "#199f4b",
    "Emacs Lisp": "#c065db", "Common Lisp": "#3fb68b", Roff: "#ecdebe",
  };

  function langColor(lang) {
    if (!lang) return "#86909c";
    return LANG_COLORS[lang] || "#86909c";
  }

  // Deterministic owner color for avatar gradient
  function ownerHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function avatarBg(owner) {
    const h = ownerHue(owner);
    return `linear-gradient(135deg, hsl(${h}, 62%, 58%), hsl(${(h + 40) % 360}, 60%, 46%))`;
  }

  function avatarImgUrl(owner) {
    return `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?s=80&v=4`;
  }

  const state = {
    plugins: [],
    fetchedAt: "",
    totalHint: 0,
    q: "",
    cat: "all",
    sort: "stars",
    lang: "all",
    page: 1,
    route: "home",
    selected: null,
    live: false,
    favs: new Set(JSON.parse(localStorage.getItem("dsh-favs-v2") || "[]")),
    view: localStorage.getItem("dsh-view-v2") || "grid",
    history: JSON.parse(localStorage.getItem("dsh-history-v2") || "[]"),
    recent: JSON.parse(localStorage.getItem("dsh-recent-v2") || "[]"),
    compare: JSON.parse(localStorage.getItem("dsh-compare-v2") || "[]"),
    hideArchived: false,
  };

  const COMPARE_MAX = 3;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fullName = (p) => `${p.o}/${p.n}`;
  const repoUrl = (p) => `https://github.com/${p.o}/${p.n}`;
  const installCmd = (p) => `dsh plugin --profile web add git+https://github.com/${p.o}/${p.n}.git`;

  function categorize(p) {
    const blob = `${p.n} ${p.d} ${(p.t || []).join(" ")}`.toLowerCase();
    if (OFFICIAL.has(p.o) || p.n === "deepseek-harness") return "official";
    if (/awesome|handbook|精选|目录|awesome-dsh/.test(blob)) return "awesome";
    if (/skin|theme|皮肤|whale|鲸|web-ui|ui-whale|maid|pixel/.test(blob)) return "ui";
    if (/vision|ocr|多模态|看图|image|visual|modlens/.test(blob)) return "vision";
    if (/tui|desktop|launcher|macos|island|vscode|terminal|终端|桌面/.test(blob)) return "desktop";
    if (/workflow|team|agent|skill|coworker|调度|工作流|mentor/.test(blob)) return "workflow";
    if (/memory|security|audit|doctor|健康|安全|记忆|rewind/.test(blob)) return "memory";
    if (/bili|内容|share|recommend|xiaohongshu|douyin|发现/.test(blob)) return "content";
    if (/hub|registry|sandbox|distro|发行|oh-my|oh-dsh|fabric|plugin-dev|check/.test(blob)) return "infra";
    if (/ads|emoji|pet|宠物|五子棋|整活|sticker|gomoku|合影/.test(blob)) return "fun";
    if (/tool|toolkit|git|browser|通知|annotation|visualize|genui|panel/.test(blob)) return "tools";
    return "tools";
  }

  function formatStars(n) {
    if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(n || 0);
  }

  function relTime(iso) {
    if (!iso) return "未知";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "未知";
    const diff = Date.now() - t;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "刚刚";
    if (min < 60) return `${min} 分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} 小时前`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} 天前`;
    const mon = Math.floor(day / 30);
    if (mon < 12) return `${mon} 个月前`;
    return `${Math.floor(mon / 12)} 年前`;
  }

  function isRecent(iso) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t < 86400000 * 3;
  }

  // Check if created within N days (more meaningful than updated_at for trending topics)
  function isNew(iso, days) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t < 86400000 * days;
  }

  // Star tier badge: 🔥 10k+, ⭐ 1k+, ✦ 100+, · 10+
  function starTier(s) {
    s = s || 0;
    if (s >= 10000) return { cls: "tier-fire", label: "🔥", title: `${s.toLocaleString()} 星 · 顶级` };
    if (s >= 1000) return { cls: "tier-gold", label: "⭐", title: `${s.toLocaleString()} 星 · 千星` };
    if (s >= 100) return { cls: "tier-silver", label: "✦", title: `${s.toLocaleString()} 星 · 百星` };
    if (s >= 10) return { cls: "tier-bronze", label: "·", title: `${s.toLocaleString()} 星` };
    return null;
  }

  function pushHistory(q) {
    q = (q || "").trim();
    if (!q) return;
    state.history = state.history.filter((h) => h !== q);
    state.history.unshift(q);
    state.history = state.history.slice(0, 8);
    localStorage.setItem("dsh-history-v2", JSON.stringify(state.history));
  }

  function pushRecent(id) {
    state.recent = state.recent.filter((r) => r !== id);
    state.recent.unshift(id);
    state.recent = state.recent.slice(0, 8);
    localStorage.setItem("dsh-recent-v2", JSON.stringify(state.recent));
  }

  function toast(msg, icon) {
    const el = $("#toast");
    if (!el) return;
    el.innerHTML = icon ? `${icon} ${esc(msg)}` : esc(msg);
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-on"), 2000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("已复制到剪贴板", "✓");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
      toast("已复制到剪贴板", "✓");
    }
  }

  function applyTheme(next) {
    const theme = next || localStorage.getItem("dsh-theme-v2") || "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dsh-theme-v2", theme);
    const btn = $("#themeBtn");
    if (btn) {
      btn.title = theme === "dark" ? "切换浅色" : "切换深色";
      btn.innerHTML = theme === "dark"
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 13a6 6 0 1 1-5-9.8A8 8 0 1 0 16 13z"/></svg>`;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#141416" : "#f5f6f8");
  }

  const PAGES = {
    home: { file: "index.html", title: "DSH 创意工坊 · DeepSeek Harness 插件目录与安装指南" },
    market: { file: "market.html", title: "DSH 插件目录 · 检索 dsh-plugin 社区仓库" },
    insights: { file: "insights.html", title: "DSH 插件洞察 · 语言、星标与活跃度分析" },
    guide: { file: "guide.html", title: "DeepSeek Harness 上手手册 · 安装 DSH 与社区插件" },
    publish: { file: "publish.html", title: "发布 DSH 插件与 GitHub Pages 入驻指南" },
  };

  function pageFile(route) { return (PAGES[route] && PAGES[route].file) || "index.html"; }

  function fileRoute() {
    const f = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (f.includes("market")) return "market";
    if (f.includes("guide")) return "guide";
    if (f.includes("publish")) return "publish";
    if (f.includes("insights")) return "insights";
    if (f.includes("directory")) return "directory";
    return "home";
  }

  function applySeo(route) {
    const meta = PAGES[route];
    if (meta) document.title = meta.title;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const url = new URL(pageFile(route), location.href);
      canonical.setAttribute("href", url.href);
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", new URL(pageFile(route), location.href).href);
  }

  function setRoute(route, replace = false) {
    const here = fileRoute();
    if (route !== here && PAGES[route]) {
      const url = new URL(pageFile(route), location.href);
      if (route === "market" && state.q) url.searchParams.set("q", state.q);
      const next = url.pathname + url.search;
      if (replace) location.replace(next);
      else location.href = next;
      return;
    }
    state.route = here === "directory" ? "home" : here;
    $$(".view").forEach((v) => v.classList.toggle("is-on", v.dataset.view === state.route));
    $$("[data-nav]").forEach((a) => a.classList.toggle("is-on", a.dataset.nav === state.route));
    applySeo(state.route);
    if (state.route === "market") renderMarket();
    if (state.route === "insights") renderInsights();
    if (!replace) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function parseEntry() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const [hashRoute, ...rest] = raw.split("/");
    if (fileRoute() === "home" && PAGES[hashRoute]) {
      location.replace(`./${pageFile(hashRoute)}`);
      return;
    }
    if (hashRoute === "plugin" && rest.length >= 2) {
      location.replace(`./market.html?p=${encodeURIComponent(rest.join("/"))}`);
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.get("q")) {
      state.q = params.get("q");
      const g = $("#globalSearch");
      const s = $("#searchInput");
      if (g) g.value = state.q;
      if (s) s.value = state.q;
    }
    setRoute(fileRoute(), true);
    const pid = params.get("p");
    if (pid) {
      const plugin = state.plugins.find((p) => fullName(p) === pid);
      if (plugin) openDrawer(plugin);
    }
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = state.plugins.slice();
    if (state.cat === "fav") {
      list = list.filter((p) => state.favs.has(fullName(p)));
    } else if (state.cat !== "all") {
      list = list.filter((p) => categorize(p) === state.cat);
    }
    if (state.lang !== "all") list = list.filter((p) => p.l === state.lang);
    if (state.hideArchived) list = list.filter((p) => !p.a);
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.o} ${p.n} ${p.d} ${(p.t || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (state.sort === "updated") return (b.u || "").localeCompare(a.u || "");
      if (state.sort === "name") return a.n.localeCompare(b.n);
      if (state.sort === "recent") return (b.c || "").localeCompare(a.c || "");
      if (state.sort === "forks") return (b.f || 0) - (a.f || 0) || a.n.localeCompare(b.n);
      if (state.sort === "relevance" && q) {
        // relevance: name match (10) > owner match (5) > desc match (2) > topic match (1), tiebreak by stars
        const score = (p) => {
          let s = 0;
          if (p.n.toLowerCase().includes(q)) s += 10;
          if (p.o.toLowerCase().includes(q)) s += 5;
          if ((p.d || "").toLowerCase().includes(q)) s += 2;
          if ((p.t || []).some((t) => t.toLowerCase().includes(q))) s += 1;
          return s;
        };
        return score(b) - score(a) || b.s - a.s || a.n.localeCompare(b.n);
      }
      return b.s - a.s || a.n.localeCompare(b.n);
    });
    return list;
  }

  function favCountFor(cat) {
    if (cat === "fav") return state.favs.size;
    if (cat === "all") return state.plugins.length;
    return state.plugins.filter((p) => categorize(p) === cat).length;
  }

  function cardHTML(p) {
    const id = fullName(p);
    const letter = (p.n[0] || "D").toUpperCase();
    const desc = p.d || "暂无简介，打开仓库查看 README。";
    const isFav = state.favs.has(id);
    const isOff = OFFICIAL.has(p.o) || p.n === "deepseek-harness";
    const newPlugin = isNew(p.c, 7);
    const lc = langColor(p.l);
    const tier = starTier(p.s);
    const avatarStyle = isOff ? "" : `style="background:${avatarBg(p.o)};color:#fff;border-color:transparent"`;
    const avatarCls = isOff ? "avatar official" : "avatar";
    const q = state.q;
    return `
      <article class="plugin-card${isFav ? " is-fav" : ""}${isOff ? " is-official" : ""}" data-open="${id}" style="--idx:0">
        <button class="fav-btn${isFav ? " is-on" : ""}" data-fav="${id}" aria-label="${isFav ? "取消收藏" : "收藏"}" title="${isFav ? "取消收藏" : "收藏"}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
        <button class="card-copy" data-copy-install="${id}" aria-label="复制安装命令" title="复制安装命令">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
        </button>
        <div class="plugin-top">
          <div class="${avatarCls}" ${avatarStyle} aria-hidden="true">${letter}</div>
          <div style="min-width:0">
            <div class="plugin-title">${highlight(p.n, q)}${tier ? `<span class="tier-badge ${tier.cls}" title="${esc(tier.title)}">${tier.label}</span>` : ""}</div>
            <div class="plugin-owner">${highlight(p.o, q)}${isOff ? ' · 官方' : ''}</div>
          </div>
        </div>
        <p class="plugin-desc">${highlight(desc, q)}</p>
        <div class="plugin-meta">
          <span class="star" title="${(p.s || 0).toLocaleString()} 星">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            ${formatStars(p.s)}
          </span>
          ${p.l ? `<span class="lang"><span class="dot" style="background:${lc}"></span>${highlight(p.l, q)}</span>` : ""}
          ${newPlugin ? `<span class="new-badge" title="创建于 ${relTime(p.c)}">NEW</span>` : `<span class="updated" title="更新于 ${relTime(p.u)}">${relTime(p.u)}</span>`}
          ${p.a ? `<span class="tag archived">已归档</span>` : ""}
          ${p.lic && p.lic !== "NOASSERTION" ? `<span class="tag lic">${esc(p.lic)}</span>` : ""}
        </div>
      </article>`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // Escape RegExp special chars
  function escRe(s) {
    return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Highlight query matches in text (case-insensitive), returns escaped HTML with <mark>
  function highlight(text, query) {
    const t = String(text ?? "");
    if (!query || !query.trim()) return esc(t);
    const q = query.trim();
    // split query into words for multi-word match
    const words = q.split(/\s+/).filter((w) => w.length >= 1).map(escRe);
    if (!words.length) return esc(t);
    const re = new RegExp(`(${words.join("|")})`, "gi");
    return esc(t).replace(re, '<mark class="hl">$1</mark>');
  }

  function renderChips() {
    const box = $("#chips");
    if (!box) return;
    box.innerHTML = CATS.map((c) => {
      const n = favCountFor(c.id);
      return `<button class="chip${c.id === state.cat ? " is-on" : ""}" data-cat="${c.id}">${esc(c.name)}<span class="chip-count">${n}</span></button>`;
    }).join("");
  }

  function renderLangs() {
    const langs = [...new Set(state.plugins.map((p) => p.l).filter(Boolean))].sort();
    const sel = $("#langSelect");
    if (!sel) return;
    const current = state.lang;
    sel.innerHTML =
      `<option value="all">全部语言</option>` +
      langs.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
    sel.value = current;
  }

  function renderMarket() {
    const list = filtered();
    const grid = $("#marketGrid");
    if (!grid) return;
    grid.classList.toggle("is-list", state.view === "list");
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);
    if (slice.length) {
      grid.innerHTML = slice.map(cardHTML).join("");
    } else {
      // No results — recommend similar (top stars from all, or same category if a cat is selected)
      let recs;
      if (state.cat !== "all" && state.cat !== "fav") {
        recs = state.plugins.filter((p) => categorize(p) === state.cat).sort((a, b) => b.s - a.s).slice(0, 3);
      } else {
        recs = state.plugins.slice().sort((a, b) => b.s - a.s).slice(0, 3);
      }
      const recHTML = recs.length
        ? `<div class="no-result-recs"><h3>💡 你可能感兴趣</h3><div class="card-grid">${recs.map(cardHTML).join("")}</div></div>`
        : "";
      // Spelling suggestions — find plugin names/topics similar to the query
      const q = (state.q || "").trim().toLowerCase();
      let suggestHTML = "";
      if (q && q.length >= 2) {
        const suggestions = new Set();
        const qLen = q.length;
        for (const p of state.plugins) {
          // check name and topics for substring similarity
          const name = (p.n || "").toLowerCase();
          const topics = (p.t || []).map((t) => t.toLowerCase());
          // exact substring in name → suggest the name
          if (name.includes(q) && !suggestions.has(name)) {
            suggestions.add(p.n);
          }
          // topic contains query → suggest topic
          for (const t of topics) {
            if (t.includes(q) && suggestions.size < 6) suggestions.add(t);
          }
          // name contains a word sharing prefix with query (3+ chars)
          if (qLen >= 3) {
            const words = name.split(/[-_.]/);
            for (const w of words) {
              if (w.length >= 3 && q.slice(0, 3) === w.slice(0, 3) && suggestions.size < 6) {
                suggestions.add(p.n);
              }
            }
          }
          if (suggestions.size >= 6) break;
        }
        if (suggestions.size) {
          suggestHTML = `<div class="spell-suggest"><span class="ss-label">你是不是想搜：</span>${[...suggestions].map((s) =>
            `<button class="ss-chip" data-history="${esc(s)}">${esc(s)}</button>`
          ).join("")}</div>`;
        }
      }
      grid.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div>没有找到匹配「${esc(state.q || state.cat)}」的插件。换个关键词，或<a href="https://github.com/topics/dsh-plugin" target="_blank" rel="noopener">看看 GitHub topic</a>。</div>${suggestHTML}${recHTML}`;
    }
    const count = $("#marketCount");
    if (count) count.textContent = `共 ${list.length} 个结果`;
    const info = $("#pageInfo");
    if (info) info.textContent = `${state.page} / ${pages}`;
    if ($("#prevPage")) $("#prevPage").disabled = state.page <= 1;
    if ($("#nextPage")) $("#nextPage").disabled = state.page >= pages;
    const clearBtn = $("#searchClear");
    if (clearBtn) clearBtn.classList.toggle("is-on", !!state.q);
  }

  function renderHome() {
    const featured = FEATURED.map((id) => state.plugins.find((p) => fullName(p) === id)).filter(Boolean);
    const extra = state.plugins
      .filter((p) => !FEATURED.includes(fullName(p)) && p.s >= 20)
      .slice(0, Math.max(0, 12 - featured.length));
    const featuredGrid = $("#featuredGrid");
    if (featuredGrid) {
      featuredGrid.classList.toggle("is-list", state.view === "list");
      featuredGrid.innerHTML = [...featured, ...extra].slice(0, 12).map(cardHTML).join("");
    }

    const total = state.totalHint || state.plugins.length;
    const stars = state.plugins.reduce((s, p) => s + (p.s || 0), 0);
    const langs = new Set(state.plugins.map((p) => p.l).filter(Boolean)).size;
    // Use created_at (not updated_at) — for a trending topic, updated_at clusters on fetch day.
    const fresh = state.plugins.filter((p) => isNew(p.c, 7)).length;
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };
    animateNum("statPlugins", total);
    animateNum("statStars", stars, formatStars);
    animateNum("statLangs", langs);
    animateNum("statFresh", fresh);
    setText(
      "syncHint",
      state.fetchedAt
        ? `快照更新于 ${relTime(state.fetchedAt)}${state.live ? " · 已同步 GitHub 实时数据" : ""}`
        : "正在读取插件快照"
    );

    // Trending: recently created (growth signal) + decent stars
    const trendingGrid = $("#trendingGrid");
    if (trendingGrid) {
      const trending = state.plugins
        .filter((p) => isNew(p.c, 14) && p.s >= 3)
        .sort((a, b) => (b.c || "").localeCompare(a.c || ""))
        .slice(0, 6);
      trendingGrid.classList.toggle("is-list", state.view === "list");
      trendingGrid.innerHTML = trending.map((p, i) => {
        const html = cardHTML(p);
        return html.replace('style="--idx:0"', `style="--idx:${i}"`);
      }).join("") ||
        `<div class="empty"><div class="empty-icon">🌱</div>近两周没有新仓库。看看<a href="./market.html">完整目录</a>。</div>`;
    }

    // Topic cloud
    const cloud = $("#topicCloud");
    if (cloud) {
      const counts = new Map();
      for (const p of state.plugins) {
        for (const t of p.t || []) {
          if (t === "dsh-plugin") continue;
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28);
      cloud.innerHTML = top.map(([t, n]) =>
        `<a class="topic-item" href="./market.html?q=${encodeURIComponent(t)}">${esc(t)}<span class="topic-n">${n}</span></a>`
      ).join("");
    }
  }

  function animateNum(id, target, fmt) {
    const node = document.getElementById(id);
    if (!node) return;
    const fmtFn = fmt || ((n) => String(n));
    const start = parseInt(node.dataset.val || "0", 10);
    const dur = 700;
    const t0 = performance.now();
    if (node._raf) cancelAnimationFrame(node._raf);
    function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(start + (target - start) * eased);
      node.textContent = fmtFn(val);
      if (p < 1) node._raf = requestAnimationFrame(step);
      else node.dataset.val = String(target);
    }
    node._raf = requestAnimationFrame(step);
  }

  /* ---------- Insights page ---------- */
  function renderAuthorTable(sortKey) {
    const box = $("#insAuthors");
    if (!box || !state._authorData) return;
    const data = state._authorData.slice();
    const sorters = {
      stars: (a, b) => b.stars - a.stars,
      repos: (a, b) => b.repos - a.repos,
      forks: (a, b) => b.forks - a.forks,
      langs: (a, b) => b.langCount - a.langCount,
    };
    data.sort(sorters[sortKey] || sorters.stars);
    const arrow = (k) => k === sortKey ? ' <span class="sort-arrow">▼</span>' : "";
    box.innerHTML = `
      <table class="lb-table">
        <thead>
          <tr>
            <th class="lb-rank">#</th>
            <th class="lb-author">作者</th>
            <th class="lb-num" data-sort="stars" title="点击排序">星标${arrow("stars")}</th>
            <th class="lb-num" data-sort="repos" title="点击排序">仓库${arrow("repos")}</th>
            <th class="lb-num" data-sort="forks" title="点击排序">Fork${arrow("forks")}</th>
            <th class="lb-num" data-sort="langs" title="点击排序">语言${arrow("langs")}</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((d, i) => `
            <tr data-open="${esc(d.o)}/—" title="查看 ${esc(d.o)} 的仓库">
              <td class="lb-rank">${i + 1}</td>
              <td class="lb-author">
                <span class="lb-avatar" style="background:${avatarBg(d.o)}">${esc((d.o[0] || "?").toUpperCase())}</span>
                <span class="lb-name">${esc(d.o)}</span>
              </td>
              <td class="lb-num"><span class="star"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>${formatStars(d.stars)}</span></td>
              <td class="lb-num">${d.repos}</td>
              <td class="lb-num">${formatStars(d.forks)}</td>
              <td class="lb-num">${d.langCount}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    // wire sort headers
    box.querySelectorAll("[data-sort]").forEach((th) => {
      th.addEventListener("click", () => renderAuthorTable(th.dataset.sort));
    });
  }

  function renderInsights() {
    const plugins = state.plugins;
    if (!plugins.length) return;

    // Language distribution
    const langCounts = new Map();
    for (const p of plugins) {
      if (!p.l) continue;
      langCounts.set(p.l, (langCounts.get(p.l) || 0) + 1);
    }
    const topLangs = [...langCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const maxLang = topLangs.length ? topLangs[0][1] : 1;
    const langBox = $("#insLang");
    if (langBox) {
      langBox.innerHTML = topLangs.map(([l, n]) => {
        const pct = ((n / maxLang) * 100).toFixed(1);
        return `<div class="bar-row">
          <span class="bar-label"><span class="legend-dot" style="background:${langColor(l)};width:9px;height:9px;border-radius:50%;display:inline-block"></span>${esc(l)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg, ${langColor(l)}, ${langColor(l)}cc)"></span></span>
          <span class="bar-val">${n}</span>
        </div>`;
      }).join("");
    }

    // Top owners by stars
    const ownerStats = new Map();
    for (const p of plugins) {
      const cur = ownerStats.get(p.o) || { repos: 0, stars: 0 };
      cur.repos += 1;
      cur.stars += p.s || 0;
      ownerStats.set(p.o, cur);
    }
    const topOwners = [...ownerStats.entries()]
      .map(([o, s]) => ({ o, ...s }))
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 10);
    const maxOwnerStars = topOwners.length ? topOwners[0].stars : 1;
    const ownerBox = $("#insOwners");
    if (ownerBox) {
      ownerBox.innerHTML = topOwners.map((d) => {
        const pct = ((d.stars / maxOwnerStars) * 100).toFixed(1);
        return `<div class="bar-row" data-open="${esc(d.o)}/—" style="cursor:pointer">
          <span class="bar-label"><span style="width:14px;height:14px;border-radius:4px;background:${avatarBg(d.o)};display:inline-block;flex:0 0 auto"></span>${esc(d.o)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
          <span class="bar-val">${formatStars(d.stars)} · ${d.repos} 个</span>
        </div>`;
      }).join("");
    }

    // License distribution (donut via conic-gradient)
    const licCounts = new Map();
    let noLic = 0;
    for (const p of plugins) {
      const lic = p.lic && p.lic !== "NOASSERTION" ? p.lic : "其它";
      if (!p.lic || p.lic === "NOASSERTION") noLic++;
      licCounts.set(lic, (licCounts.get(lic) || 0) + 1);
    }
    const topLic = [...licCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const licColors = ["#f59e0b", "#3178c6", "#00b42a", "#f53f3f", "#8b5cf6", "#86909c"];
    const licBox = $("#insLic");
    if (licBox) {
      let acc = 0;
      const total = plugins.length;
      const segs = topLic.map(([l, n], i) => {
        const start = (acc / total) * 100;
        acc += n;
        const end = (acc / total) * 100;
        return { l, n, color: licColors[i % licColors.length], start, end };
      });
      const donut = segs.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(", ");
      const donutEl = licBox.querySelector(".donut");
      if (donutEl) donutEl.style.background = `conic-gradient(${donut})`;
      const legend = licBox.querySelector(".donut-legend");
      if (legend) {
        legend.innerHTML = segs.map((s) =>
          `<div class="legend-row"><span class="legend-dot" style="background:${s.color}"></span><span class="legend-name">${esc(s.l)}</span><span class="legend-val">${s.n}</span></div>`
        ).join("");
      }
      const totalEl = licBox.querySelector(".donut-total");
      if (totalEl) totalEl.textContent = formatStars(total);
    }

    // Newest additions timeline (by created_at — more meaningful than updated_at)
    const recent = plugins
      .filter((p) => p.c)
      .sort((a, b) => (b.c || "").localeCompare(a.c || ""))
      .slice(0, 14);
    const tlBox = $("#insTimeline");
    if (tlBox) {
      tlBox.innerHTML = recent.map((p) =>
        `<div class="timeline-item" data-open="${esc(fullName(p))}">
          <div style="flex:1;min-width:0">
            <div class="tl-name">${esc(p.n)} <span style="color:var(--text-3);font-weight:400">· ${esc(p.o)}</span></div>
            <div class="tl-meta">★ ${formatStars(p.s)}${p.l ? " · " + esc(p.l) : ""}</div>
          </div>
          <div class="tl-time" title="创建于 ${esc(p.c)}">建 ${relTime(p.c)}</div>
        </div>`
      ).join("") || `<div class="empty">暂无数据。</div>`;
    }

    // Category distribution (donut)
    const catBox = $("#insCat");
    if (catBox) {
      const catCounts = new Map();
      const CAT_NAMES = {
        official: "官方核心", ui: "界面皮肤", vision: "视觉多模态", desktop: "桌面终端",
        workflow: "工作流", tools: "效率工具", infra: "基建发行", memory: "记忆安全",
        content: "内容发现", fun: "趣味整活", awesome: "精选目录",
      };
      for (const p of plugins) {
        const c = categorize(p);
        catCounts.set(c, (catCounts.get(c) || 0) + 1);
      }
      const cats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
      const total = plugins.length;
      const catColors = ["#f59e0b", "#3178c6", "#00b42a", "#8b5cf6", "#f53f3f", "#1664ff", "#ff7d00", "#00ADD8", "#ec4899", "#14b8a6", "#a855f7", "#86909c"];
      let acc = 0;
      const segs = cats.map(([c, n], i) => {
        const start = (acc / total) * 100;
        acc += n;
        const end = (acc / total) * 100;
        return { c, n, name: CAT_NAMES[c] || c, color: catColors[i % catColors.length], start, end };
      });
      const donut = catBox.querySelector(".donut");
      if (donut) donut.style.background = `conic-gradient(${segs.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(",")})`;
      const totalEl = catBox.querySelector(".donut-total");
      if (totalEl) totalEl.textContent = String(cats.length);
      const legend = catBox.querySelector(".donut-legend");
      if (legend) {
        legend.innerHTML = segs.map((s) =>
          `<div class="legend-row"><span class="legend-dot" style="background:${s.color}"></span><span class="legend-name">${esc(s.name)}</span><span class="legend-val">${s.n}</span></div>`
        ).join("");
      }
    }

    // Star buckets distribution
    const starBox = $("#insStarBuckets");
    if (starBox) {
      const buckets = [
        { label: "🔥 10k+", min: 10000, color: "#dc2626" },
        { label: "⭐ 1k–10k", min: 1000, color: "#f59e0b" },
        { label: "✦ 100–1k", min: 100, color: "#3178c6" },
        { label: "· 10–100", min: 10, color: "#00b42a" },
        { label: "0–10", min: 0, color: "#86909c" },
      ];
      const counts = buckets.map((b) => ({
        ...b,
        n: plugins.filter((p) => (p.s || 0) >= b.min && (b.label === "0–10" || (p.s || 0) < (buckets[buckets.indexOf(b) - 1] || { min: 0 }).min)).length,
      }));
      // recompute properly
      const realCounts = buckets.map((b, i) => {
        const upper = i > 0 ? buckets[i - 1].min : Infinity;
        const n = plugins.filter((p) => (p.s || 0) >= b.min && (p.s || 0) < upper).length;
        return { ...b, n };
      });
      const maxB = Math.max(...realCounts.map((b) => b.n), 1);
      starBox.innerHTML = realCounts.map((b) => {
        const pct = ((b.n / maxB) * 100).toFixed(1);
        return `<div class="bar-row">
          <span class="bar-label">${esc(b.label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg, ${b.color}, ${b.color}cc)"></span></span>
          <span class="bar-val">${b.n}</span>
        </div>`;
      }).join("");
    }

    // Topic cloud (bigger set)
    const cloud = $("#insTopics");
    if (cloud) {
      const counts = new Map();
      for (const p of plugins) {
        for (const t of p.t || []) {
          if (t === "dsh-plugin") continue;
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
      cloud.innerHTML = top.map(([t, n]) =>
        `<a class="topic-item" href="./market.html?q=${encodeURIComponent(t)}">${esc(t)}<span class="topic-n">${n}</span></a>`
      ).join("");
    }

    // Contributor activity heatmap (last 6 months by created_at)
    const heatBox = $("#insHeat");
    if (heatBox) {
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ y: d.getFullYear(), m: d.getMonth(), label: `${d.getMonth() + 1}月`, count: 0 });
      }
      for (const p of plugins) {
        if (!p.c) continue;
        const d = new Date(p.c);
        if (Number.isNaN(d.getTime())) continue;
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (diff >= 0 && diff < 6) {
          months[5 - diff].count += 1;
        }
      }
      const maxC = Math.max(...months.map((m) => m.count), 1);
      heatBox.innerHTML = months.map((mo) => {
        const pct = (mo.count / maxC) * 100;
        const intensity = mo.count === 0 ? 0 : Math.ceil((mo.count / maxC) * 4);
        return `<div class="heat-col" title="${mo.label}：${mo.count} 个">
          <div class="heat-bar" style="height:${Math.max(4, pct)}%" data-intensity="${intensity}"></div>
          <span class="heat-val">${mo.count}</span>
          <span class="heat-label">${mo.label}</span>
        </div>`;
      }).join("");
    }

    // Language trend stacked chart (last 6 months x top 5 languages)
    const ltBox = $("#insLangTrend");
    if (ltBox) {
      const now = new Date();
      const monthLabels = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthLabels.push({ y: d.getFullYear(), m: d.getMonth(), label: `${d.getMonth() + 1}月`, langs: {} });
      }
      // top 5 languages overall
      const langTotals = new Map();
      for (const p of plugins) {
        if (!p.l) continue;
        langTotals.set(p.l, (langTotals.get(p.l) || 0) + 1);
      }
      const topLangs = [...langTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l);
      // count per month per lang
      for (const p of plugins) {
        if (!p.c || !p.l) continue;
        const d = new Date(p.c);
        if (Number.isNaN(d.getTime())) continue;
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (diff >= 0 && diff < 6) {
          const mo = monthLabels[5 - diff];
          if (topLangs.includes(p.l)) {
            mo.langs[p.l] = (mo.langs[p.l] || 0) + 1;
          } else {
            mo.langs["其他"] = (mo.langs["其他"] || 0) + 1;
          }
        }
      }
      const allLangs = [...topLangs, "其他"];
      const ltColors = ["#3178c6", "#f1e05a", "#3572A5", "#dea584", "#e34c26", "#86909c"];
      const maxTotal = Math.max(...monthLabels.map((mo) => allLangs.reduce((s, l) => s + (mo.langs[l] || 0), 0)), 1);
      ltBox.innerHTML = `
        <div class="stack-chart">
          ${monthLabels.map((mo) => {
            const total = allLangs.reduce((s, l) => s + (mo.langs[l] || 0), 0);
            const heightPct = (total / maxTotal) * 100;
            return `<div class="stack-col" title="${mo.label}：${total} 个">
              <div class="stack-bar" style="height:${Math.max(2, heightPct)}%">
                ${allLangs.map((l, i) => {
                  const n = mo.langs[l] || 0;
                  if (!n) return "";
                  const segPct = (n / total) * 100;
                  return `<div class="stack-seg" style="height:${segPct}%;background:${ltColors[i]}" title="${esc(l)}: ${n}"></div>`;
                }).join("")}
              </div>
              <span class="stack-val">${total}</span>
              <span class="stack-label">${mo.label}</span>
            </div>`;
          }).join("")}
        </div>
        <div class="stack-legend">
          ${allLangs.map((l, i) => `<span class="legend-row" style="display:inline-flex;margin-right:12px;font-size:12px"><span class="legend-dot" style="background:${ltColors[i]};margin-right:5px"></span>${esc(l)}</span>`).join("")}
        </div>
      `;
    }

    // Category trend stacked chart (last 6 months x top categories)
    const ctBox = $("#insCatTrend");
    if (ctBox) {
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ y: d.getFullYear(), m: d.getMonth(), label: `${d.getMonth() + 1}月`, cats: {} });
      }
      const CAT_NAMES = {
        official: "官方核心", ui: "界面皮肤", vision: "视觉多模态", desktop: "桌面终端",
        workflow: "工作流", tools: "效率工具", infra: "基建发行", memory: "记忆安全",
        content: "内容发现", fun: "趣味整活", awesome: "精选目录",
      };
      // count per month per category
      for (const p of plugins) {
        if (!p.c) continue;
        const d = new Date(p.c);
        if (Number.isNaN(d.getTime())) continue;
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (diff >= 0 && diff < 6) {
          const mo = months[5 - diff];
          const c = categorize(p);
          mo.cats[c] = (mo.cats[c] || 0) + 1;
        }
      }
      // top 6 categories by total
      const catTotals = new Map();
      months.forEach((mo) => {
        for (const [c, n] of Object.entries(mo.cats)) {
          catTotals.set(c, (catTotals.get(c) || 0) + n);
        }
      });
      const topCats = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
      const ctColors = ["#f59e0b", "#3178c6", "#00b42a", "#8b5cf6", "#f53f3f", "#1664ff"];
      const maxTotal = Math.max(...months.map((mo) => topCats.reduce((s, c) => s + (mo.cats[c] || 0), 0)), 1);
      ctBox.innerHTML = `
        <div class="stack-chart">
          ${months.map((mo) => {
            const total = topCats.reduce((s, c) => s + (mo.cats[c] || 0), 0);
            const heightPct = (total / maxTotal) * 100;
            return `<div class="stack-col" title="${mo.label}：${total} 个">
              <div class="stack-bar" style="height:${Math.max(2, heightPct)}%">
                ${topCats.map((c, i) => {
                  const n = mo.cats[c] || 0;
                  if (!n) return "";
                  const segPct = (n / total) * 100;
                  return `<div class="stack-seg" style="height:${segPct}%;background:${ctColors[i]}" title="${esc(CAT_NAMES[c] || c)}: ${n}"></div>`;
                }).join("")}
              </div>
              <span class="stack-val">${total}</span>
              <span class="stack-label">${mo.label}</span>
            </div>`;
          }).join("")}
        </div>
        <div class="stack-legend">
          ${topCats.map((c, i) => `<span class="legend-row" style="display:inline-flex;margin-right:12px;font-size:12px"><span class="legend-dot" style="background:${ctColors[i]};margin-right:5px"></span>${esc(CAT_NAMES[c] || c)}</span>`).join("")}
        </div>
      `;
    }

    // Author leaderboard (sortable table)
    const lbBox = $("#insAuthors");
    if (lbBox) {
      const ownerStats = new Map();
      for (const p of plugins) {
        const cur = ownerStats.get(p.o) || { repos: 0, stars: 0, forks: 0, langs: new Set(), latest: "" };
        cur.repos += 1;
        cur.stars += p.s || 0;
        cur.forks += p.f || 0;
        if (p.l) cur.langs.add(p.l);
        if (p.u && p.u > cur.latest) cur.latest = p.u;
        ownerStats.set(p.o, cur);
      }
      const owners = [...ownerStats.entries()]
        .map(([o, s]) => ({ o, ...s, langCount: s.langs.size }))
        .sort((a, b) => b.stars - a.stars)
        .slice(0, 20);
      state._authorData = owners;
      renderAuthorTable("stars");
    }

    // Summary numbers
    const setText = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    setText("insTotal", String(plugins.length));
    setText("insTotalStars", formatStars(plugins.reduce((s, p) => s + (p.s || 0), 0)));
    setText("insTotalForks", formatStars(plugins.reduce((s, p) => s + (p.f || 0), 0)));
    setText("insActive", String(plugins.filter((p) => isNew(p.c, 7)).length));
  }

  function openDrawer(p) {
    state.selected = p;
    const isOff = OFFICIAL.has(p.o) || p.n === "deepseek-harness";
    const av = $("#drawerAvatar");
    if (av) {
      av.innerHTML = isOff
        ? `<div class="avatar official" style="width:100%;height:100%;border:0;font-size:20px">${esc((p.n[0] || "D").toUpperCase())}</div>`
        : `<img src="${avatarImgUrl(p.o)}" alt="${esc(p.o)} avatar" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${esc((p.n[0]||"D").toUpperCase())}',style:'width:100%;height:100%;display:grid;place-items:center;font-weight:700'}))" />`;
      if (!isOff) av.style.background = avatarBg(p.o);
    }
    $("#drawerTitle").textContent = p.n;
    $("#drawerOwner").textContent = p.o + (isOff ? " · 官方" : "");
    $("#drawerDesc").textContent = p.d || "暂无简介。";
    $("#drawerMeta").innerHTML = `
      <span class="star">★ ${p.s}</span>
      <span>Fork ${p.f}</span>
      ${p.l ? `<span class="lang"><span class="dot" style="background:${langColor(p.l)}"></span>${esc(p.l)}</span>` : ""}
      ${p.lic && p.lic !== "NOASSERTION" ? `<span class="tag lic">${esc(p.lic)}</span>` : ""}
      ${p.a ? `<span class="tag archived">已归档</span>` : ""}
    `;
    $("#drawerTopics").innerHTML = (p.t || [])
      .slice(0, 16)
      .map((t) => `<a class="drawer-topic" href="./market.html?q=${encodeURIComponent(t)}">#${esc(t)}</a>`)
      .join("") || `<span style="color:var(--text-4);font-size:12px">无 topic</span>`;

    const stats = $("#drawerStats");
    if (stats) stats.innerHTML = `
      <div class="drawer-stat"><b>${formatStars(p.s)}</b><span>Stars</span></div>
      <div class="drawer-stat"><b>${formatStars(p.f)}</b><span>Forks</span></div>
      <div class="drawer-stat"><b>${p.l ? esc(p.l) : "—"}</b><span>主语言</span></div>
    `;

    $("#installCode").textContent = installCmd(p);
    $("#openRepo").href = repoUrl(p);
    const issuesLink = $("#openIssues");
    if (issuesLink) issuesLink.href = `${repoUrl(p)}/issues`;
    const releasesLink = $("#openReleases");
    if (releasesLink) releasesLink.href = `${repoUrl(p)}/releases`;

    // similar plugins
    const simBox = $("#drawerSimilar");
    if (simBox) {
      const sameCat = state.plugins
        .filter((q) => fullName(q) !== fullName(p) && categorize(q) === categorize(p))
        .sort((a, b) => b.s - a.s)
        .slice(0, 4);
      simBox.innerHTML = sameCat.length
        ? sameCat.map((q) =>
          `<article class="plugin-card" data-open="${esc(fullName(q))}" style="min-height:0;padding:11px">
            <div class="plugin-top"><div class="avatar" style="background:${avatarBg(q.o)};color:#fff;border-color:transparent">${esc((q.n[0]||"D").toUpperCase())}</div>
            <div style="min-width:0"><div class="plugin-title" style="font-size:13px">${esc(q.n)}</div><div class="plugin-owner">${esc(q.o)} · ★ ${formatStars(q.s)}</div></div></div>
          </article>`
        ).join("")
        : `<span style="color:var(--text-4);font-size:12px">暂无同类</span>`;
    }

    $("#drawer").classList.add("is-on");
    $("#drawerMask").classList.add("is-on");
    pushRecent(fullName(p));
    renderRecentInDrawer();
    const url = new URL(location.href);
    url.searchParams.set("p", fullName(p));
    history.replaceState(null, "", url.pathname + url.search);
    const el = $("#drawer");
    if (el) el.focus();
  }

  function renderRecentInDrawer() {
    const box = $("#drawerRecent");
    if (!box) return;
    const items = state.recent
      .map((id) => state.plugins.find((p) => fullName(p) === id))
      .filter(Boolean)
      .slice(0, 6);
    if (!items.length) { box.innerHTML = ""; return; }
    box.innerHTML = items.map((q) =>
      `<article class="plugin-card" data-open="${esc(fullName(q))}" style="min-height:0;padding:11px">
        <div class="plugin-top"><div class="avatar" style="background:${avatarBg(q.o)};color:#fff;border-color:transparent">${esc((q.n[0]||"D").toUpperCase())}</div>
        <div style="min-width:0"><div class="plugin-title" style="font-size:13px">${esc(q.n)}</div><div class="plugin-owner">${esc(q.o)} · ★ ${formatStars(q.s)}</div></div></div>
      </article>`
    ).join("");
  }

  function closeDrawer() {
    $("#drawer").classList.remove("is-on");
    $("#drawerMask").classList.remove("is-on");
    state.selected = null;
    const url = new URL(location.href);
    if (url.searchParams.has("p")) {
      url.searchParams.delete("p");
      history.replaceState(null, "", url.pathname + url.search);
    }
  }

  function toggleFav(id) {
    if (state.favs.has(id)) {
      state.favs.delete(id);
      toast("已取消收藏");
    } else {
      state.favs.add(id);
      toast("已加入收藏", "★");
    }
    localStorage.setItem("dsh-favs-v2", JSON.stringify([...state.favs]));
    // update card states
    $$(`.plugin-card[data-open="${CSS.escape(id)}"]`).forEach((card) => {
      const isFav = state.favs.has(id);
      card.classList.toggle("is-fav", isFav);
      const btn = card.querySelector(".fav-btn");
      if (btn) {
        btn.classList.toggle("is-on", isFav);
        const path = btn.querySelector("svg path");
        if (path) path.setAttribute("fill", isFav ? "currentColor" : "none");
      }
    });
    // refresh chips count if on fav
    if (state.cat === "fav") renderMarket();
    renderChips();
  }

  function hydrate(payload) {
    state.plugins = payload.plugins || [];
    state.fetchedAt = payload.fetched_at || "";
    state.totalHint = payload.total || state.plugins.length;
    renderLangs();
    renderChips();
    renderHome();
    if (state.route === "market") renderMarket();
    if (state.route === "insights") renderInsights();
    renderCompareBar();
    // update noscript / notice count
    document.querySelectorAll("[data-total-count]").forEach((el) => {
      el.textContent = String(state.totalHint || state.plugins.length);
    });
    // notice bar: dismiss if already dismissed for this version
    const noticeBar = $("#noticeBar");
    if (noticeBar) {
      const version = String(state.totalHint || state.plugins.length || "");
      if (localStorage.getItem("dsh-notice-dismissed-v2") === version) {
        noticeBar.classList.add("is-off");
      } else {
        noticeBar.classList.remove("is-off");
      }
      // init multi-message rotator
      initNoticeRotator();
    }
  }

  function initNoticeRotator() {
    const rotator = $("#noticeRotator");
    const dotsBox = $("#noticeDots");
    if (!rotator || rotator._init) return;
    rotator._init = true;
    const slides = [...rotator.querySelectorAll(".notice-text")];
    if (slides.length <= 1) return;
    let cur = 0;
    // build dots
    if (dotsBox) {
      dotsBox.innerHTML = slides.map((_, i) => `<span class="notice-dot${i === 0 ? " is-on" : ""}" data-notice-dot="${i}"></span>`).join("");
      dotsBox.addEventListener("click", (e) => {
        const dot = e.target.closest("[data-notice-dot]");
        if (!dot) return;
        cur = parseInt(dot.dataset.noticeDot, 10);
        showSlide(cur);
        resetTimer();
      });
    }
    function showSlide(i) {
      slides.forEach((s, idx) => {
        s.style.display = idx === i ? "" : "none";
      });
      dotsBox?.querySelectorAll(".notice-dot").forEach((d, idx) => {
        d.classList.toggle("is-on", idx === i);
      });
    }
    let timer = 0;
    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(() => {
        cur = (cur + 1) % slides.length;
        showSlide(cur);
      }, 5000);
    }
    resetTimer();
    // pause on hover
    const bar = $("#noticeBar");
    bar?.addEventListener("mouseenter", () => clearInterval(timer));
    bar?.addEventListener("mouseleave", resetTimer);
  }

  async function loadSnapshot() {
    const res = await fetch("./data/plugins.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("snapshot");
    return res.json();
  }

  async function refreshLive() {
    try {
      const url =
        "https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=stars&order=desc&per_page=30";
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) return;
      const data = await res.json();
      const map = new Map(state.plugins.map((p) => [fullName(p), p]));
      for (const repo of data.items || []) {
        const next = {
          n: repo.name,
          o: repo.owner.login,
          d: (repo.description || "").trim(),
          s: repo.stargazers_count || 0,
          f: repo.forks_count || 0,
          l: repo.language || "",
          t: repo.topics || [],
          u: repo.updated_at || "",
          c: repo.created_at || "",
          lic: (repo.license && repo.license.spdx_id) || "",
          a: repo.archived ? 1 : 0,
        };
        map.set(`${next.o}/${next.n}`, next);
      }
      state.plugins = [...map.values()].sort((a, b) => b.s - a.s);
      state.totalHint = data.total_count || state.plugins.length;
      state.live = true;
      renderLangs();
      renderChips();
      renderHome();
      if (state.route === "market") renderMarket();
      if (state.route === "insights") renderInsights();
    } catch {
      /* snapshot is enough */
    }
  }

  function setView(v) {
    state.view = v;
    localStorage.setItem("dsh-view-v2", v);
    $$(".view-toggle button").forEach((b) => b.classList.toggle("is-on", b.dataset.view === v));
    if (state.route === "market") renderMarket();
    renderHome();
  }

  /* ---------- Random discover ---------- */
  function openRandom() {
    if (!state.plugins.length) return;
    const pool = state.plugins.filter((p) => (p.s || 0) >= 5);
    const arr = pool.length ? pool : state.plugins;
    const p = arr[Math.floor(Math.random() * arr.length)];
    openDrawer(p);
    toast("随机发现", "🎲");
  }

  /* ---------- Export filtered results ---------- */
  function exportResults(fmt) {
    const list = filtered();
    if (!list.length) { toast("没有可导出的结果"); return; }
    let text, filename, mime;
    if (fmt === "json") {
      text = JSON.stringify({ exported_at: new Date().toISOString(), count: list.length, plugins: list }, null, 2);
      filename = "dsh-plugins.json";
      mime = "application/json";
    } else {
      const lines = [`# DSH 插件导出`, `> 导出时间：${new Date().toLocaleString("zh-CN")}`, `> 共 ${list.length} 个`, ""];
      for (const p of list) {
        lines.push(`## [${p.n}](https://github.com/${p.o}/${p.n})`);
        lines.push(`- 作者：${p.o}`);
        lines.push(`- 星标：${p.s || 0} · Fork：${p.f || 0}`);
        if (p.l) lines.push(`- 语言：${p.l}`);
        if (p.lic && p.lic !== "NOASSERTION") lines.push(`- 许可证：${p.lic}`);
        lines.push(`- 简介：${p.d || "暂无"}`);
        lines.push(`- 安装：\`dsh plugin --profile web add git+https://github.com/${p.o}/${p.n}.git\``);
        lines.push("");
      }
      text = lines.join("\n");
      filename = "dsh-plugins.md";
      mime = "text/markdown";
    }
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`已导出 ${list.length} 个为 ${filename}`, "⬇");
  }

  /* ---------- Search history dropdown ---------- */
  function renderSearchHistory(input, boxId) {
    const boxIdResolved = boxId || (input.id === "globalSearch" ? "#globalSearchHistory" : "#searchHistory");
    const box = $(boxIdResolved);
    if (!box) return;
    // Only show when focused and input is empty
    if (!state.history.length || document.activeElement !== input || (input.value || "").trim()) {
      box.classList.remove("is-on");
      return;
    }
    box.classList.add("is-on");
    box.innerHTML = state.history.map((h) =>
      `<button class="history-item" data-history="${esc(h)}">${esc(h)}</button>`
    ).join("") + `<button class="history-clear" id="historyClear">清除历史</button>`;
  }

  /* ---------- Shortcuts modal ---------- */
  function toggleShortcuts() {
    const m = $("#shortcutsModal");
    if (!m) return;
    m.classList.toggle("is-on");
    $("#shortcutsMask")?.classList.toggle("is-on");
  }

  function openCompareModal() {
    const m = $("#compareModal");
    const body = $("#compareBody");
    if (!m || !body) return;
    const items = state.compare
      .map((id) => state.plugins.find((p) => fullName(p) === id))
      .filter(Boolean);
    if (items.length < 2) {
      toast("至少需要 2 个才能对比");
      return;
    }
    // Build comparison table
    const rows = [
      { label: "仓库", get: (p) => `${p.o}/${p.n}`, link: true },
      { label: "星标", get: (p) => p.s || 0, max: true },
      { label: "Fork", get: (p) => p.f || 0, max: true },
      { label: "语言", get: (p) => p.l || "—", max: false },
      { label: "许可证", get: (p) => (p.lic && p.lic !== "NOASSERTION" ? p.lic : "—"), max: false },
      { label: "创建于", get: (p) => relTime(p.c), max: false, sortKey: (p) => p.c || "" },
      { label: "更新于", get: (p) => relTime(p.u), max: false, sortKey: (p) => p.u || "" },
      { label: "Topic 数", get: (p) => (p.t || []).length, max: true },
      { label: "归档", get: (p) => (p.a ? "是" : "否"), max: false },
    ];
    body.innerHTML = `
      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead><tr><th></th>${items.map((p) => `<th><a href="${repoUrl(p)}" target="_blank" rel="noopener">${esc(p.n)}</a><div class="cmp-owner">${esc(p.o)}</div></th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((r) => {
              const vals = items.map(r.get);
              let maxIdx = -1;
              if (r.max) {
                let max = -Infinity;
                vals.forEach((v, i) => {
                  const n = typeof v === "number" ? v : -Infinity;
                  if (n > max) { max = n; maxIdx = i; }
                });
              }
              return `<tr>
                <td class="cmp-label">${esc(r.label)}</td>
                ${vals.map((v, i) => `<td class="${i === maxIdx ? "cmp-max" : ""}">${typeof v === "number" ? v.toLocaleString() : esc(v)}</td>`).join("")}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div class="cmp-foot">
        <button class="btn btn-sm" id="cmpCopyMd" type="button">复制为 Markdown</button>
        <button class="btn btn-sm btn-ghost" data-close-compare type="button">关闭</button>
      </div>
    `;
    m.classList.add("is-on");
    $("#compareMask")?.classList.add("is-on");
    // wire copy markdown
    const cpBtn = $("#cmpCopyMd");
    if (cpBtn) cpBtn.onclick = () => {
      const md = ["| 指标 | " + items.map((p) => `${p.o}/${p.n}`).join(" | ") + " |",
                  "|" + "---|".repeat(items.length + 1)];
      for (const r of rows) {
        md.push("| " + r.label + " | " + items.map((p) => String(r.get(p))).join(" | ") + " |");
      }
      copyText(md.join("\n"));
    };
    // save to compare history
    saveCompareHistory(items);
    // render history section
    renderCompareHistory();
  }

  function saveCompareHistory(items) {
    if (!items || items.length < 2) return;
    const entry = {
      ids: items.map(fullName),
      names: items.map((p) => p.n),
      ts: Date.now(),
    };
    let hist = JSON.parse(localStorage.getItem("dsh-compare-hist-v2") || "[]");
    // dedupe by ids set
    const key = entry.ids.slice().sort().join("|");
    hist = hist.filter((h) => h.ids.slice().sort().join("|") !== key);
    hist.unshift(entry);
    hist = hist.slice(0, 5);
    localStorage.setItem("dsh-compare-hist-v2", JSON.stringify(hist));
    state.compareHist = hist;
  }

  function renderCompareHistory() {
    const box = $("#cmpHistory");
    if (!box) return;
    const hist = JSON.parse(localStorage.getItem("dsh-compare-hist-v2") || "[]");
    if (!hist.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<h3 class="cmp-hist-h">最近对比</h3>` + hist.map((h, i) => {
      const names = h.names.join(" vs ");
      const date = new Date(h.ts);
      const ago = relTime(h.ts ? new Date(h.ts).toISOString() : "");
      return `<div class="cmp-hist-row" data-hist-idx="${i}" title="${esc(names)}">
        <span class="cmp-hist-names">${esc(names)}</span>
        <span class="cmp-hist-ago">${ago}</span>
        <button class="cmp-hist-restore" data-hist-restore="${i}" type="button">恢复</button>
      </div>`;
    }).join("");
  }

  function on(sel, ev, fn) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (el) el.addEventListener(ev, fn);
  }

  function bind() {
    renderChips();
    on("#chips", "click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      state.cat = btn.dataset.cat;
      state.page = 1;
      renderChips();
      renderMarket();
    });

    let timer = 0;
    let prevSort = state.sort;
    const applyQuery = (value) => {
      const hadQuery = !!state.q;
      state.q = value;
      state.page = 1;
      if (value && value.trim().length >= 2) pushHistory(value.trim());
      // Auto-switch to relevance sort when searching (if user hasn't manually chosen another)
      const ss = $("#sortSelect");
      if (ss) {
        if (value && state.sort !== "relevance" && !state._sortManual) {
          if (state.sort === "stars") prevSort = "stars";
          state.sort = "relevance";
          ss.value = "relevance";
        } else if (!value && state.sort === "relevance" && prevSort) {
          state.sort = prevSort;
          ss.value = prevSort;
        }
      }
      const market = $("#searchInput");
      const global = $("#globalSearch");
      if (market && market.value !== value) market.value = value;
      if (global && global.value !== value) global.value = value;
      if (fileRoute() !== "market") {
        setRoute("market");
        return;
      }
      const url = new URL(location.href);
      if (value) url.searchParams.set("q", value);
      else url.searchParams.delete("q");
      history.replaceState(null, "", url.pathname + url.search);
      renderMarket();
      // refresh history dropdown if input still focused
      const si = $("#searchInput");
      if (si && document.activeElement === si) renderSearchHistory(si);
      const gs = $("#globalSearch");
      if (gs && document.activeElement === gs) renderSearchHistory(gs);
    };
    on("#searchInput", "input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => applyQuery(e.target.value), 120);
    });
    on("#globalSearch", "input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => applyQuery(e.target.value), 120);
    });
    on("#globalSearch", "keydown", (e) => {
      if (e.key === "Enter") applyQuery(e.target.value);
    });
    on("#searchClear", "click", () => applyQuery(""));
    // search history dropdown (market page)
    on("#searchInput", "focus", (e) => renderSearchHistory(e.target));
    on("#searchInput", "blur", () => setTimeout(() => $("#searchHistory")?.classList.remove("is-on"), 150));
    // search history dropdown (global top bar)
    on("#globalSearch", "focus", (e) => renderSearchHistory(e.target));
    on("#globalSearch", "blur", () => setTimeout(() => $("#globalSearchHistory")?.classList.remove("is-on"), 150));

    on("#sortSelect", "change", (e) => {
      state.sort = e.target.value;
      state._sortManual = true; // user manually chose a sort
      state.page = 1;
      renderMarket();
    });
    on("#langSelect", "change", (e) => {
      state.lang = e.target.value;
      state.page = 1;
      renderMarket();
    });
    on("#archivedToggle", "click", (e) => {
      state.hideArchived = !state.hideArchived;
      e.currentTarget.classList.toggle("is-on", state.hideArchived);
      state.page = 1;
      renderMarket();
    });
    on("#prevPage", "click", () => {
      state.page -= 1;
      renderMarket();
      if ($("#market")) $("#market").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    on("#nextPage", "click", () => {
      state.page += 1;
      renderMarket();
      if ($("#market")) $("#market").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // view toggle
    $$(".view-toggle button").forEach((b) => {
      b.addEventListener("click", () => setView(b.dataset.view));
    });

    document.addEventListener("click", (e) => {
      const favBtn = e.target.closest("[data-fav]");
      if (favBtn) {
        e.stopPropagation();
        toggleFav(favBtn.dataset.fav);
        return;
      }
      const copyBtn = e.target.closest("[data-copy-install]");
      if (copyBtn) {
        e.stopPropagation();
        const p = state.plugins.find((x) => fullName(x) === copyBtn.dataset.copyInstall);
        if (p) copyText(installCmd(p));
        return;
      }
      const open = e.target.closest("[data-open]");
      if (open) {
        const id = open.dataset.open;
        // owner row uses "owner/—" placeholder
        if (id.endsWith("/—")) {
          const owner = id.slice(0, -2);
          if (fileRoute() !== "market") { location.href = `./market.html?q=${encodeURIComponent(owner)}`; return; }
          applyQuery(owner);
          return;
        }
        const plugin = state.plugins.find((p) => fullName(p) === id);
        if (plugin) openDrawer(plugin);
        return;
      }
      if (e.target.closest("[data-copy]")) {
        const sel2 = e.target.closest("[data-copy]").dataset.copy;
        const node = document.querySelector(sel2);
        copyText((node && node.textContent) || "");
      }
      if (e.target.closest("[data-close-drawer]")) closeDrawer();
      if (e.target.closest("[data-history]")) {
        applyQuery(e.target.closest("[data-history]").dataset.history);
        $("#searchHistory")?.classList.remove("is-on");
        $("#globalSearchHistory")?.classList.remove("is-on");
        return;
      }
      if (e.target.id === "historyClear") {
        state.history = [];
        localStorage.setItem("dsh-history-v2", "[]");
        $("#searchHistory")?.classList.remove("is-on");
        $("#globalSearchHistory")?.classList.remove("is-on");
        return;
      }
      if (e.target.closest("[data-random]")) { openRandom(); return; }
      if (e.target.closest("[data-export]")) { exportResults(e.target.closest("[data-export]").dataset.export); return; }
      if (e.target.closest("[data-shortcuts]") || e.target.closest("[data-close-shortcuts]")) { toggleShortcuts(); return; }
      // context menu items
      const ctxItem = e.target.closest("[data-ctx]");
      if (ctxItem) {
        const m = $("#ctxMenu");
        const p = m && m._plugin;
        if (p) {
          const action = ctxItem.dataset.ctx;
          if (action === "copy") copyText(installCmd(p));
          else if (action === "fav") { toggleFav(fullName(p)); }
          else if (action === "repo") window.open(repoUrl(p), "_blank", "noopener");
          else if (action === "issues") window.open(`${repoUrl(p)}/issues`, "_blank", "noopener");
          else if (action === "releases") window.open(`${repoUrl(p)}/releases`, "_blank", "noopener");
          else if (action === "compare") toggleCompare(fullName(p));
          else if (action === "share") {
            // Build detail page URL if plugin page exists (stars>=10), else market link
            const baseUrl = location.origin + location.pathname.replace(/[^/]*$/, "");
            let detailUrl;
            if ((p.s || 0) >= 10) {
              const slug = `${p.o}-${p.n}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
              detailUrl = `${baseUrl}p/${slug}.html`;
            } else {
              // Low-star plugin: fall back to market.html?p=
              detailUrl = `${baseUrl}market.html?p=${encodeURIComponent(fullName(p))}`;
            }
            const shareText = `${p.n} (${p.o}) · ★${p.s || 0} · ${detailUrl}`;
            copyText(shareText);
          }
        }
        m?.classList.remove("is-on");
        return;
      }
      // compare bar interactions
      if (e.target.closest("[data-compare-remove]")) {
        e.stopPropagation();
        toggleCompare(e.target.closest("[data-compare-remove]").dataset.compareRemove);
        return;
      }
      if (e.target.id === "compareClear") {
        state.compare = [];
        localStorage.setItem("dsh-compare-v2", "[]");
        renderCompareBar();
        toast("已清空对比");
        return;
      }
      if (e.target.id === "compareOpen") {
        openCompareModal();
        return;
      }
      if (e.target.closest("[data-close-compare]")) {
        $("#compareModal")?.classList.remove("is-on");
        $("#compareMask")?.classList.remove("is-on");
        return;
      }
      // restore compare history
      const restoreBtn = e.target.closest("[data-hist-restore]");
      if (restoreBtn) {
        const idx = parseInt(restoreBtn.dataset.histRestore, 10);
        const hist = JSON.parse(localStorage.getItem("dsh-compare-hist-v2") || "[]");
        const entry = hist[idx];
        if (entry && entry.ids) {
          state.compare = entry.ids.slice(0, COMPARE_MAX);
          localStorage.setItem("dsh-compare-v2", JSON.stringify(state.compare));
          renderCompareBar();
          openCompareModal();
          toast("已恢复对比");
        }
        return;
      }
    });

    on("#copyInstall", "click", () => {
      if (state.selected) copyText(installCmd(state.selected));
    });

    on("#themeBtn", "click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    window.addEventListener("hashchange", parseEntry);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ($("#shortcutsModal")?.classList.contains("is-on")) { toggleShortcuts(); return; }
        closeDrawer();
      }
      if (e.key === "/" && !/input|textarea/i.test(e.target.tagName)) {
        e.preventDefault();
        setRoute("market");
        const inp = $("#globalSearch") || $("#searchInput");
        if (inp) inp.focus();
      }
      if (e.key === "?" && !/input|textarea/i.test(e.target.tagName)) {
        e.preventDefault();
        toggleShortcuts();
      }
      if (e.key === "r" && !/input|textarea/i.test(e.target.tagName)) {
        e.preventDefault();
        openRandom();
      }
      if (e.key === "t" && !/input|textarea/i.test(e.target.tagName)) {
        applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      }
    });

    $$("[data-copy-static]").forEach((btn) => {
      btn.addEventListener("click", () => copyText(btn.dataset.copyStatic));
    });

    // Back-to-top button
    const btt = $("#backToTop");
    if (btt) {
      const updateBtt = () => {
        if (window.scrollY > 400) btt.classList.add("is-on");
        else btt.classList.remove("is-on");
      };
      window.addEventListener("scroll", updateBtt, { passive: true });
      updateBtt();
      btt.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    // Card hover preview tooltip (desktop only, delayed)
    let hoverTimer = 0;
    const hoverTip = $("#hoverTip");
    if (hoverTip && !window.matchMedia("(pointer: coarse)").matches) {
      document.addEventListener("mouseover", (e) => {
        const card = e.target.closest("[data-open]");
        if (!card || card.dataset.open.endsWith("/—")) { return; }
        const p = state.plugins.find((x) => fullName(x) === card.dataset.open);
        if (!p) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          const topics = (p.t || []).slice(0, 6);
          // Mini growth sparkline: simulate star growth from created_at to now
          let sparkHTML = "";
          if (p.c && p.s) {
            const created = new Date(p.c).getTime();
            const now = Date.now();
            const ageDays = Math.max(1, (now - created) / 86400000);
            const points = 12;
            const bars = [];
            for (let i = 0; i < points; i++) {
              // exponential growth curve: stars accumulate faster recently
              const frac = (i + 1) / points;
              const val = Math.pow(frac, 1.8) * p.s;
              bars.push(Math.max(2, (val / p.s) * 100));
            }
            sparkHTML = `<div class="tip-spark" title="星标增长趋势（基于创建时间推算）">
              <span class="ts-label">★ 增长</span>
              <span class="ts-bars">${bars.map((h) => `<span class="ts-bar" style="height:${h}%"></span>`).join("")}</span>
              <span class="ts-age">${ageDays < 30 ? Math.round(ageDays) + "天" : ageDays < 365 ? Math.round(ageDays / 30) + "月" : Math.round(ageDays / 365 * 10) / 10 + "年"}</span>
            </div>`;
          }
          hoverTip.innerHTML = `
            <div class="tip-top">
              <span class="tip-name">${esc(p.n)}</span>
              <span class="tip-owner">${esc(p.o)}</span>
            </div>
            <p class="tip-desc">${esc((p.d || "暂无简介").slice(0, 160))}${(p.d || "").length > 160 ? "…" : ""}</p>
            <div class="tip-meta">
              <span class="star"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>${formatStars(p.s)}</span>
              ${p.l ? `<span class="lang"><span class="dot" style="background:${langColor(p.l)}"></span>${esc(p.l)}</span>` : ""}
              <span>Fork ${formatStars(p.f)}</span>
              ${p.lic && p.lic !== "NOASSERTION" ? `<span class="tag lic">${esc(p.lic)}</span>` : ""}
            </div>
            ${sparkHTML}
            ${topics.length ? `<div class="tip-topics">${topics.map((t) => `<span class="tip-topic">#${esc(t)}</span>`).join("")}</div>` : ""}
            <div class="tip-hint">点击查看详情 · 右键更多操作</div>
          `;
          const r = card.getBoundingClientRect();
          const tipW = 320;
          let left = r.left + r.width / 2 - tipW / 2;
          left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
          let top = r.bottom + 8;
          // if not enough space below, show above
          if (top + 240 > window.innerHeight) top = r.top - 8 - 200;
          hoverTip.style.left = left + "px";
          hoverTip.style.top = top + "px";
          hoverTip.classList.add("is-on");
        }, 450);
      });
      document.addEventListener("mouseout", (e) => {
        const card = e.target.closest("[data-open]");
        if (!card) return;
        clearTimeout(hoverTimer);
        hoverTip.classList.remove("is-on");
      });
      window.addEventListener("scroll", () => hoverTip.classList.remove("is-on"), { passive: true });
    }

    // Card context menu (right-click)
    document.addEventListener("contextmenu", (e) => {
      const card = e.target.closest("[data-open]");
      if (!card) return;
      const id = card.dataset.open;
      if (id.endsWith("/—")) return; // owner placeholder
      const p = state.plugins.find((x) => fullName(x) === id);
      if (!p) return;
      e.preventDefault();
      openCtxMenu(p, e.clientX, e.clientY);
    });
    // Mobile: long-press (touchstart > 500ms) triggers context menu
    let touchTimer = 0;
    let touchCard = null;
    let touchStartXY = { x: 0, y: 0 };
    document.addEventListener("touchstart", (e) => {
      const card = e.target.closest("[data-open]");
      if (!card || card.dataset.open.endsWith("/—")) { touchCard = null; return; }
      touchCard = card;
      const t = e.touches[0];
      touchStartXY = { x: t.clientX, y: t.clientY };
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        if (!touchCard) return;
        const p = state.plugins.find((x) => fullName(x) === touchCard.dataset.open);
        if (p) {
          openCtxMenu(p, touchStartXY.x, touchStartXY.y);
        }
        touchCard = null;
      }, 500);
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - touchStartXY.x) > 10 || Math.abs(t.clientY - touchStartXY.y) > 10) {
        clearTimeout(touchTimer);
        touchCard = null;
      }
    }, { passive: true });
    document.addEventListener("touchend", () => {
      clearTimeout(touchTimer);
    }, { passive: true });
    // close ctx menu on outside click / scroll / escape
    document.addEventListener("click", (e) => {
      const m = $("#ctxMenu");
      if (m && !e.target.closest("#ctxMenu")) m.classList.remove("is-on");
    });
    window.addEventListener("scroll", () => $("#ctxMenu")?.classList.remove("is-on"), { passive: true });

    // Card double-click → open detail page (if exists) or drawer
    document.addEventListener("dblclick", (e) => {
      const card = e.target.closest("[data-open]");
      if (!card) return;
      const id = card.dataset.open;
      if (id.endsWith("/—")) return; // owner placeholder
      const p = state.plugins.find((x) => fullName(x) === id);
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      if ((p.s || 0) >= 10) {
        const slug = `${p.o}-${p.n}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        location.href = `./p/${slug}.html`;
      } else {
        openDrawer(p);
      }
    });

    // Notice bar close button
    const closeBtn = $("#noticeClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const noticeBar = $("#noticeBar");
        if (noticeBar) {
          noticeBar.classList.add("is-off");
          const version = String(state.totalHint || state.plugins.length || "");
          localStorage.setItem("dsh-notice-dismissed-v2", version);
        }
      });
    }
  }

  function openCtxMenu(p, x, y) {
    const m = $("#ctxMenu");
    if (!m) return;
    const id = fullName(p);
    const isFav = state.favs.has(id);
    const inCompare = state.compare.includes(id);
    const compareFull = state.compare.length >= COMPARE_MAX;
    m.innerHTML = `
      <button class="ctx-item" data-ctx="copy">${iconCopy()} 复制安装命令</button>
      <button class="ctx-item" data-ctx="fav">${iconStar(isFav)} ${isFav ? "取消收藏" : "收藏"}</button>
      <button class="ctx-item" data-ctx="compare" ${inCompare || compareFull ? "" : ""}>${iconCompare()} ${inCompare ? "移出对比" : compareFull ? "对比已满（3/3）" : "加入对比"}</button>
      <button class="ctx-item" data-ctx="share">${iconShare()} 分享详情页链接</button>
      <div class="ctx-sep"></div>
      <button class="ctx-item" data-ctx="repo">${iconExternal()} 打开 GitHub</button>
      <button class="ctx-item" data-ctx="issues">${iconExternal()} Issues</button>
      <button class="ctx-item" data-ctx="releases">${iconExternal()} Releases</button>
    `;
    m.style.left = Math.min(x, window.innerWidth - 208) + "px";
    m.style.top = Math.min(y, window.innerHeight - 290) + "px";
    m.classList.add("is-on");
    m._plugin = p;
  }

  function iconCompare() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`;
  }

  function toggleCompare(id) {
    const idx = state.compare.indexOf(id);
    if (idx >= 0) {
      state.compare.splice(idx, 1);
      toast("已移出对比");
    } else {
      if (state.compare.length >= COMPARE_MAX) {
        toast(`对比栏已满（最多 ${COMPARE_MAX} 个）`);
        return;
      }
      state.compare.push(id);
      toast(`已加入对比（${state.compare.length}/${COMPARE_MAX}）`, "⚖");
    }
    localStorage.setItem("dsh-compare-v2", JSON.stringify(state.compare));
    renderCompareBar();
  }

  function renderCompareBar() {
    const bar = $("#compareBar");
    if (!bar) return;
    const items = state.compare
      .map((id) => state.plugins.find((p) => fullName(p) === id))
      .filter(Boolean);
    if (!items.length) {
      bar.classList.remove("is-on");
      bar.innerHTML = "";
      return;
    }
    bar.classList.add("is-on");
    bar.innerHTML = `
      <div class="compare-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        对比 <b>${items.length}</b>/${COMPARE_MAX}
      </div>
      <div class="compare-items">
        ${items.map((p) => `
          <div class="compare-chip" data-open="${esc(fullName(p))}">
            <span class="cc-avatar" style="background:${avatarBg(p.o)}">${esc((p.n[0]||"D").toUpperCase())}</span>
            <span class="cc-name">${esc(p.n)}</span>
            <button class="cc-remove" data-compare-remove="${esc(fullName(p))}" aria-label="移除" type="button">×</button>
          </div>
        `).join("")}
      </div>
      <div class="compare-actions">
        <button class="btn btn-sm" id="compareOpen" type="button">查看对比</button>
        <button class="btn btn-sm btn-ghost" id="compareClear" type="button">清空</button>
      </div>
    `;
  }

  function iconCopy() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
  }
  function iconStar(on) {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
  }
  function iconExternal() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`;
  }
  function iconShare() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>`;
  }

  async function boot() {
    applyTheme();
    // initial view toggle state
    $$(".view-toggle button").forEach((b) => b.classList.toggle("is-on", b.dataset.view === state.view));
    bind();
    renderSkeletons();
    try {
      hydrate(await loadSnapshot());
    } catch {
      const hint = $("#syncHint");
      if (hint) hint.textContent = "本地快照读取失败，尝试直接请求 GitHub…";
    }
    parseEntry();
    refreshLive();
  }

  function skeletonCard() {
    return `<article class="plugin-card skeleton-card" aria-hidden="true">
      <div class="plugin-top">
        <div class="skeleton" style="width:34px;height:34px;border-radius:8px"></div>
        <div style="flex:1">
          <div class="skeleton" style="width:60%;height:14px;border-radius:4px;margin-bottom:6px"></div>
          <div class="skeleton" style="width:40%;height:11px;border-radius:4px"></div>
        </div>
      </div>
      <div class="skeleton" style="width:100%;height:12px;border-radius:4px;margin-top:11px"></div>
      <div class="skeleton" style="width:85%;height:12px;border-radius:4px;margin-top:6px"></div>
      <div class="skeleton" style="width:70%;height:12px;border-radius:4px;margin-top:6px"></div>
      <div class="plugin-meta" style="margin-top:auto;padding-top:13px">
        <div class="skeleton" style="width:48px;height:14px;border-radius:4px"></div>
        <div class="skeleton" style="width:60px;height:14px;border-radius:4px"></div>
      </div>
    </article>`;
  }

  function renderSkeletons() {
    const home = $("#featuredGrid");
    if (home) home.innerHTML = Array.from({ length: 12 }, skeletonCard).join("");
    const market = $("#marketGrid");
    if (market) {
      market.classList.toggle("is-list", state.view === "list");
      market.innerHTML = Array.from({ length: 12 }, skeletonCard).join("");
    }
  }

  window.DSHWorkshop = { TOPIC_URL, state, toggleFav, openDrawer, openRandom, exportResults };
  document.addEventListener("DOMContentLoaded", boot);
})();
