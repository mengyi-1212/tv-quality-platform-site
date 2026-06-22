(function () {
  "use strict";

  if (document.getElementById("platformAiAssistant")) {
    return;
  }

  const scriptUrl = new URL(document.currentScript.src, window.location.href);
  const platformRoot = new URL("../", scriptUrl);
  const currentPageTitle = document.title || "当前页面";
  let resultCache = [];
  let manifestFiles = (window.TV_RAW_DATA_MANIFEST && window.TV_RAW_DATA_MANIFEST.files) || [];

  const widget = document.createElement("aside");
  widget.className = "platform-ai-assistant is-collapsed";
  widget.id = "platformAiAssistant";
  widget.setAttribute("aria-label", "AI助手");
  widget.innerHTML = `
    <button class="platform-ai-trigger" id="platformAiTrigger" type="button" aria-label="唤醒AI助手" aria-expanded="false">
      <span class="platform-ai-bunny" aria-hidden="true">
        <span class="platform-ai-bunny-ear platform-ai-bunny-ear-left"><span></span></span>
        <span class="platform-ai-bunny-ear platform-ai-bunny-ear-right"><span></span></span>
        <span class="platform-ai-bunny-face">
          <span class="platform-ai-bunny-eye platform-ai-bunny-eye-left"></span>
          <span class="platform-ai-bunny-eye platform-ai-bunny-eye-right"></span>
          <span class="platform-ai-bunny-nose"></span>
          <span class="platform-ai-bunny-mouth"></span>
          <span class="platform-ai-bunny-cheek platform-ai-bunny-cheek-left"></span>
          <span class="platform-ai-bunny-cheek platform-ai-bunny-cheek-right"></span>
        </span>
        <span class="platform-ai-bunny-paw"></span>
      </span>
    </button>
    <div class="platform-ai-dialog" id="platformAiDialog" aria-hidden="true">
      <div class="platform-ai-head">
        <div>
          <span class="platform-ai-kicker">AI Assistant</span>
          <h2>AI助手</h2>
        </div>
        <button class="platform-ai-close" id="platformAiClose" type="button" aria-label="收起AI助手">×</button>
      </div>
      <label class="platform-ai-search">
        <span class="platform-ai-search-label">搜索平台资料或工具</span>
        <textarea class="platform-ai-query" id="platformAiQuery" rows="3" placeholder="例如：TCL75Q9M报告、刷新率、色域转换"></textarea>
      </label>
      <div class="platform-ai-scope">当前页面：<strong>${escapeHtml(currentPageTitle)}</strong></div>
      <div class="platform-ai-prompts" id="platformAiPrompts" aria-label="常用搜索"></div>
      <div class="platform-ai-answer" id="platformAiAnswer" aria-live="polite"></div>
      <div class="platform-ai-results" id="platformAiResults" aria-live="polite" aria-label="搜索结果"></div>
    </div>
  `;
  document.body.appendChild(widget);

  const trigger = document.getElementById("platformAiTrigger");
  const closeButton = document.getElementById("platformAiClose");
  const dialog = document.getElementById("platformAiDialog");
  const queryInput = document.getElementById("platformAiQuery");
  const prompts = document.getElementById("platformAiPrompts");
  const answer = document.getElementById("platformAiAnswer");
  const results = document.getElementById("platformAiResults");

  trigger.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));
  queryInput.addEventListener("input", render);
  widget.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      trigger.focus();
    }
  });
  prompts.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform-ai-prompt]");
    if (!button) {
      return;
    }
    queryInput.value = button.dataset.platformAiPrompt || "";
    render();
    queryInput.focus();
  });

  render();
  loadManifest();

  async function loadManifest() {
    if (manifestFiles.length) {
      return;
    }
    try {
      const response = await window.fetch(new URL("data/raw-manifest.js?v=20260618-all-pages-v3", platformRoot));
      if (!response.ok) {
        return;
      }
      const source = await response.text();
      const json = source
        .replace(/^\s*window\.TV_RAW_DATA_MANIFEST\s*=\s*/, "")
        .replace(/;\s*$/, "");
      const manifest = JSON.parse(json);
      manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
      render();
    } catch (error) {
      manifestFiles = [];
    }
  }

  function setOpen(isOpen) {
    widget.classList.toggle("is-collapsed", !isOpen);
    trigger.setAttribute("aria-expanded", String(isOpen));
    dialog.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      window.setTimeout(() => queryInput.focus(), 40);
    }
  }

  function render() {
    const query = queryInput.value.trim();
    const entries = buildEntries();
    const matches = query ? searchEntries(entries, query) : getDefaultEntries(entries);
    resultCache = matches.slice(0, 8);
    prompts.innerHTML = ["亮度数据", "硬件规格", "TCL75Q9M报告", "色域转换"]
      .map((prompt) => `<button type="button" data-platform-ai-prompt="${escapeAttr(prompt)}">${escapeHtml(prompt)}</button>`)
      .join("");
    answer.innerHTML = query
      ? `<strong>找到 ${matches.length} 个相关入口</strong><span>可直接打开平台中的资料、报告或工具。</span>`
      : `<strong>搜索整个画质平台</strong><span>当前工具页也可以检索全部平台资料。</span>`;
    results.innerHTML = resultCache.length
      ? resultCache.map(renderResult).join("")
      : `<div class="platform-ai-empty">没有找到匹配内容，请尝试机型、指标、报告或工具名称。</div>`;
  }

  function buildEntries() {
    const entries = [
      createEntry("客观数据分析", "亮度、颜色、屏对比度和硬件规格", "平台模块", "模块", "index.html#data", "客观 数据 亮度 颜色 对比度 硬件 规格"),
      createEntry("实验设计", "人眼舒适亮度与四色 B/C 应用", "平台模块", "模块", "index.html#lab", "实验 人眼 舒适亮度 四色 电流配比"),
      createEntry("画质调试转换工具", "色域转换、TXT 转 INI、1886 Gamma", "平台模块", "模块", "index.html#debug-converter", "调试 转换 色域 ini gamma 1886"),
      createEntry("竞品分析报告", "分析报告、输出报告和数据模板", "平台模块", "模块", "index.html#reports", "竞品 分析 输出 报告 ppt 模板"),
      createEntry("色域转换", "RGB / XYZ 色域矩阵与覆盖率计算", "调试工具", "工具", "tools/color-gamut-converter.html", "色域 RGB XYZ CIE 1931 1976 覆盖率"),
      createEntry("光影平衡调试", "TXT 转 INI 工具", "调试工具", "工具", "tools/txt-to-ini.html", "光影 平衡 txt ini"),
      createEntry("1886 Gamma 转换", "BT.1886 与 Gamma 曲线转换", "调试工具", "工具", "tools/bt1886-gamma.html", "1886 gamma BT1886 曲线"),
      createEntry("人眼舒适亮度模型", "环境光、APL 与观看舒适度模型", "实验工具", "工具", "tools/dynamic-comfort-brightness.html", "人眼 舒适亮度 环境光 APL"),
      createEntry("人眼舒适亮度模型项目汇报6.22", "打开浏览器汇报页，可全屏演示或下载 PPT", "实验设计", "文件/报告", "tools/comfort-brightness-presentation.html", "人眼 舒适亮度 项目 汇报 6.22 ppt 演示"),
      createEntry("海信四色 B/C 应用", "四色背光 B/C 波长调用逻辑", "实验工具", "工具", "tools/hisense-bc-application.html", "海信 四色 B C 波长 电流配比")
    ];

    manifestFiles.forEach((file) => {
      if (!file || !file.name || String(file.name).startsWith(".")) {
        return;
      }
      const extension = String(file.extension || "").toLowerCase();
      const isReport = file.kind === "document" || ["doc", "docx", "pdf", "ppt", "pptx", "pptm"].includes(extension);
      const targetPath = isReport && file.previewPath ? file.previewPath : file.path;
      entries.push(createEntry(
        file.name,
        `${isReport ? "分析报告" : "原始数据"} · ${formatBytes(file.size)}`,
        isReport ? "竞品分析报告" : "客观数据分析",
        isReport ? "文件/报告" : "原始数据",
        targetPath,
        [file.name, file.extension, file.kind, file.searchText, ...(file.preview || []).flat()].join(" "),
        true
      ));
    });
    return entries;
  }

  function createEntry(title, description, section, kind, path, keywords, newTab = false) {
    return {
      title,
      description,
      section,
      kind,
      href: new URL(path, platformRoot).href,
      keywords: [title, description, section, kind, keywords].join(" "),
      newTab
    };
  }

  function searchEntries(entries, query) {
    const tokens = tokenize(query);
    const genericTokens = new Set(["资料", "平台", "数据", "报告", "文件", "工具", "客观数据", "原始数据", "分析报告"]);
    const specificTokens = tokens.filter((token) => !genericTokens.has(token) && !/请|帮我|我要|查找|搜索|打开|查看|寻找|定位|给我/.test(token));
    return entries
      .map((entry) => ({ entry, score: scoreEntry(entry, tokens, query) }))
      .filter((item) => {
        if (item.score <= 0) {
          return false;
        }
        if (!specificTokens.length) {
          return true;
        }
        const haystack = normalize(item.entry.keywords);
        return specificTokens.some((token) => haystack.includes(token));
      })
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "zh-CN"))
      .map((item) => item.entry);
  }

  function scoreEntry(entry, tokens, query) {
    const title = normalize(entry.title);
    const haystack = normalize(entry.keywords);
    const normalizedQuery = normalize(query);
    let score = 0;
    tokens.forEach((token) => {
      if (title.includes(token)) {
        score += 16 + Math.min(token.length, 12);
      } else if (haystack.includes(token)) {
        score += 7;
      }
    });
    if (normalizedQuery.includes("报告") && entry.kind === "文件/报告") {
      score += 12;
    }
    if (normalizedQuery.includes("数据") && entry.kind === "原始数据") {
      score += 10;
    }
    if (normalizedQuery.includes("工具") && entry.kind === "工具") {
      score += 10;
    }
    return score;
  }

  function tokenize(query) {
    const normalized = normalize(query);
    const parts = String(query || "").toLowerCase().split(/[\s,，。/、;；:：|]+/).map(normalize).filter(Boolean);
    const alphanumeric = normalized.match(/[a-z0-9][a-z0-9.+-]{2,}/g) || [];
    const semanticTerms = ["客观数据", "原始数据", "分析报告", "报告", "工具", "亮度", "峰值", "颜色", "色域", "色准", "色温", "对比度", "硬件规格", "分区", "刷新率", "芯片", "屏体", "电流配比", "四色", "模板", "Real Scene"]
      .map(normalize)
      .filter((term) => normalized.includes(term));
    const cleaned = normalized.replace(/请|帮我|我要|我想要|查找|搜索|打开|查看|寻找|定位|平台上?的?|一下|有关|相关|关于|给我/g, "");
    const core = cleaned.replace(/客观数据|原始数据|分析报告|输出报告|硬件规格|报告|数据|文件|工具|资料/g, "");
    return Array.from(new Set([normalized, cleaned, core].concat(parts, alphanumeric, semanticTerms).filter((token) => token && token.length > 1)));
  }

  function getDefaultEntries(entries) {
    return entries.filter((entry) => entry.kind === "工具" || entry.kind === "模块").slice(0, 8);
  }

  function renderResult(entry) {
    const action = entry.kind === "模块" ? "进入" : "打开";
    const target = entry.newTab ? ` target="_blank" rel="noreferrer"` : "";
    const icon = entry.kind === "工具" ? "工具" : entry.kind === "模块" ? "模块" : entry.kind === "文件/报告" ? "报告" : "数据";
    return `
      <a class="platform-ai-result" href="${escapeAttr(entry.href)}"${target}>
        <span class="platform-ai-result-icon">${escapeHtml(icon)}</span>
        <span class="platform-ai-result-main">
          <strong>${escapeHtml(entry.title)}</strong>
          <em>${escapeHtml(`${entry.section} · ${entry.kind}`)}</em>
          <span>${escapeHtml(entry.description)}</span>
        </span>
        <span class="platform-ai-result-action">${action}</span>
      </a>
    `;
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()（）]/g, "");
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "未知大小";
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
