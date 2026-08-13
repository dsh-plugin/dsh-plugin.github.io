# DSH 创意工坊 · DeepSeek Harness 插件目录

> 面向中文开发者的 DeepSeek Harness（DSH）社区插件目录。纯静态站点，数据来自 GitHub topic [dsh-plugin](https://github.com/topics/dsh-plugin)。
>
> Fork 后推送到名为 `你的用户名.github.io` 的仓库，即可在 `https://你的用户名.github.io/` 访问。

## 快速部署到 GitHub Pages

1. **Fork 或新建仓库**：仓库名必须为 `你的用户名.github.io`（例如 `dsh-plugin.github.io`）。
2. **推送文件**：将本压缩包内**根目录的所有文件**推送到仓库 `main` 分支。
3. **启用 Pages**：仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支选 `main` / `/ (root)`。
4. **等待构建**：1-2 分钟后访问 `https://你的用户名.github.io/` 即可。

> ⚠️ `.nojekyll` 文件必须保留在根目录，否则 GitHub Pages 会用 Jekyll 处理，导致 `assets/` 等目录被忽略。

## 自动同步数据（可选）

仓库已内置 GitHub Actions 工作流（`.github/workflows/sync-plugins.yml`），每 6 小时自动：
1. 从 GitHub topic `dsh-plugin` 拉取最新插件快照
2. 用 `scripts/build-seo.py` 重新生成全部页面（含 sitemap、feed、73 个插件详情页）
3. 自动提交变更

启用方法：仓库 Settings → Actions → 允许 Actions 读写仓库。

## 目录结构

```
├── index.html          # 概览页（首页）
├── market.html         # 插件目录（检索/筛选/收藏/对比/导出）
├── insights.html       # 数据洞察（语言/分类/星标/作者排行榜/趋势图）
├── favorites.html      # 我的收藏（localStorage 持久化）
├── guide.html          # 上手手册
├── publish.html        # 入驻指南
├── directory.html      # 全部 609 个插件静态列表（SEO）
├── p/                  # 73 个插件详情页（stars≥10，独立 SEO 路由）
├── assets/             # CSS / JS / 图标 / OG 图
│   ├── app.css         # 设计系统（浅色/深色主题）
│   ├── app.js          # 全部前端逻辑
│   ├── favicon.svg
│   ├── apple-touch-icon.png
│   └── og.jpg
├── data/
│   ├── plugins.json    # 插件快照（609 个）
│   └── site.json       # 站点配置
├── scripts/
│   ├── sync-plugins.py # 从 GitHub topic 同步数据
│   └── build-seo.py   # 生成全部页面 / sitemap / feed
├── templates/
│   └── app.html        # 主页面模板
├── .github/workflows/  # GitHub Actions 自动同步
├── .nojekyll           # 禁用 Jekyll
├── feed.xml            # RSS 订阅
├── sitemap.xml         # 主站点地图
├── sitemap-plugins.xml # 插件详情页站点地图
├── robots.txt          # 爬虫规则
├── site.webmanifest    # PWA 清单
└── llms.txt            # 给大模型阅读的站点说明
```

## 功能清单

### 检索与浏览
- 🔍 全局搜索 + 相关度排序（名称权重 > 作者 > 简介 > topic）
- 🏷️ 12 个分类筛选 + 语言筛选 + 5 种排序（星标/Fork/更新/创建/名称）
- 📋 网格/列表视图切换
- 🗂️ 搜索历史（localStorage，聚焦+空时下拉）
- 💡 拼写建议（无结果时推荐相似词）
- 🎲 随机发现插件

### 插件卡片
- ⭐ 星标等级徽章（🔥10k+ / ⭐1k+ / ✦100+）
- 🆕 新插件 NEW 徽章（近 7 日创建）
- 🎨 语言色点（GitHub 配色）
- 📊 悬停预览（描述 + 星标 + 语言 + topics + 成长趋势 sparkline）
- 🖱️ 右键菜单（复制安装/收藏/对比/分享/GitHub/Issues/Releases）
- 🖱️ 双击打开详情页（高星→独立页，低星→抽屉）
- 📱 移动端长按触发右键菜单

### 收藏与对比
- ★ 收藏功能（localStorage 持久化，独立 favorites.html 页面）
- ⚖️ 插件对比（最多 3 个，浮动对比栏 + 模态表格 + 最大值高亮 + 导出 Markdown）
- 📜 对比历史记录（最近 5 次，可恢复）

### 数据洞察
- 📊 语言分布条形图（Top 12）
- 📊 高星贡献者（Top 10）
- 🍩 许可证分布甜甜圈
- 📈 创建趋势热力图（近 6 月）
- 📊 星标区间分桶
- 📊 分类分布甜甜圈
- 📊 语言趋势堆叠图（近 6 月 × Top 5）
- 📊 分类趋势堆叠图（近 6 月 × Top 6）
- 🏆 作者活跃度排行榜（Top 20，4 列可排序）
- ☁️ 热门 Topic 云（Top 40）

### 插件详情
- 73 个独立 SEO 页面（`p/owner-name.html`）
- 安装统计预估（Fork / 预估安装 / 星标比 / 活跃度）
- 同类插件推荐
- JSON-LD 结构化数据（SoftwareApplication + BreadcrumbList）

### 体验细节
- 🌙 浅色/深色主题切换（T 键）
- ⌨️ 键盘快捷键（/ 搜索 / R 随机 / T 主题 / ? 帮助）
- 📣 通知栏多消息轮播（5 秒切换 + 悬停暂停）
- ⬆️ 返回顶部浮动按钮
- 🦴 骨架屏加载动画
- ✨ 卡片入场错位动画 + 光泽扫光
- 📱 响应式设计（移动端底部 5 列 tabbar）

### SEO
- ✅ RSS feed.xml（近 40 个活跃插件）
- ✅ sitemap.xml + sitemap-plugins.xml（73 个详情页）
- ✅ JSON-LD 结构化数据（WebSite / SoftwareApplication / ItemList / FAQPage / BreadcrumbList）
- ✅ og:image / twitter:card 社交分享
- ✅ robots.txt 允许主流爬虫
- ✅ llms.txt 给大模型阅读

## 技术栈

纯静态，无框架、无构建步骤、无后端：

| 技术 | 用途 |
|------|------|
| HTML | 页面结构 |
| CSS | 设计系统（CSS 变量 + 媒体查询） |
| 原生 JS | 全部前端逻辑（无框架） |
| Python 3 | 构建脚本（数据同步 + 页面生成） |
| GitHub Actions | 自动同步数据 |

## 本地预览

```bash
# 方式一：Python 内置服务器
cd dsh-plugin-release
python3 -m http.server 3000
# 访问 http://localhost:3000/

# 方式二：bun
bun install
bun run dev
```

## 重新生成页面

修改 `templates/app.html` 后运行：

```bash
python3 scripts/build-seo.py --base-url "https://你的用户名.github.io/"
```

## 数据来源

插件列表来自 GitHub topic [dsh-plugin](https://github.com/topics/dsh-plugin)，快照见 `data/plugins.json`。

**DSH 创意工坊** · 社区目录 · 非官方 · 数据来自 GitHub topic dsh-plugin
