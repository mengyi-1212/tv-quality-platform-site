(function () {
  "use strict";

  const STORAGE_KEY = "tv-quality-platform-dataset-v1";
  const REPORT_BUILDER_STORAGE_KEY = "tv-quality-platform-report-builder-v1";

  const state = {
    dataset: loadDataset(),
    selectedIds: new Set(),
    activeRecordId: null,
    activeView: "home",
    activeAnalysisModule: "brightness",
    activeReportModule: "analysis",
    activeBrightnessMetric: "all",
    activeColorMetric: "all",
    activeContrastMetric: "all",
    brightnessSelectedKeys: new Set(),
    colorSelectedKeys: new Set(),
    contrastSelectedKeys: new Set(),
    reportBuilder: loadReportBuilderState(),
    experimentWeights: {
      "亮度": 18,
      "对比": 18,
      "色彩": 18,
      "运动": 14,
      "游戏": 14,
      "均匀性": 9,
      "处理": 9
    },
    activePreset: "均衡"
  };

  const presets = {
    "均衡": { "亮度": 18, "对比": 18, "色彩": 18, "运动": 14, "游戏": 14, "均匀性": 9, "处理": 9 },
    "电影暗室": { "亮度": 12, "对比": 24, "色彩": 24, "运动": 10, "游戏": 4, "均匀性": 12, "处理": 10 },
    "明亮客厅": { "亮度": 30, "对比": 14, "色彩": 14, "运动": 10, "游戏": 6, "均匀性": 10, "处理": 8 },
    "游戏": { "亮度": 15, "对比": 12, "色彩": 12, "运动": 20, "游戏": 30, "均匀性": 5, "处理": 6 },
    "参考调校": { "亮度": 8, "对比": 15, "色彩": 35, "运动": 8, "游戏": 4, "均匀性": 15, "处理": 15 }
  };

  const brightnessMetrics = [
    { key: "fullWhite", label: "全白场亮度", shortLabel: "全白场", unit: "nit", precision: 0, direction: "higher" },
    { key: "blackLevel", label: "黑场亮度", shortLabel: "黑场", unit: "nit", precision: 4, direction: "lower" },
    { key: "transientPeak", label: "瞬态峰值亮度", shortLabel: "瞬态峰值", unit: "nit", precision: 0, direction: "higher" },
    { key: "realScene", label: "Real Scene", shortLabel: "Real Scene", unit: "nit", precision: 0, direction: "higher" }
  ];

  const colorMetrics = [
    { key: "colorGamut", label: "色域", shortLabel: "色域", unit: "%", precision: 1, direction: "higher" },
    { key: "colorAccuracy", label: "色准", shortLabel: "色准", unit: "dE", precision: 1, direction: "lower" },
    { key: "colorTemperature", label: "色温", shortLabel: "色温", unit: "K", precision: 0, direction: "target", target: 6500 }
  ];

  const contrastMetrics = [
    { key: "nativeContrast", label: "屏本体对比度", shortLabel: "屏本体", unit: ":1", precision: 0, direction: "higher" },
    { key: "localDimmingContrast", label: "开LD后对比度", shortLabel: "开LD后", unit: ":1", precision: 0, direction: "higher" }
  ];

  const brightnessPriceRanges = [
    { key: "", label: "全部价格" },
    { key: "under-5000", label: "5000 元以下", min: 0, max: 4999 },
    { key: "5000-9999", label: "5000-9999 元", min: 5000, max: 9999 },
    { key: "10000-14999", label: "10000-14999 元", min: 10000, max: 14999 },
    { key: "15000-up", label: "15000 元以上", min: 15000, max: Number.POSITIVE_INFINITY },
    { key: "unknown", label: "未标价" }
  ];

  const brightnessModelMeta = {
    "海信85U7N": { price: 15000, priceNote: "DOCX 报告文本：售价 15000+" }
  };

  const reportAutoMappingRules = [
    { source: "TCL75Q9M", labels: ["品牌型号"] },
    { source: "TCLQ9M", labels: ["品牌型号"] },
    { source: "595.72", labels: ["全白场亮度"] },
    { source: "0.0822", labels: ["黑场亮度(关LD", "黑场亮度"] },
    { source: "800.73", labels: ["Real Scene"] },
    { source: "1833.44", labels: ["瞬态峰值亮度"] },
    { source: "1833.44（HDR20%窗口）", labels: ["瞬态峰值亮度"] }
  ];

  let reportTemplateBuffer = null;
  let aiAssistantResultsCache = [];

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    hydrateControls();
    bindEvents();
    renderAll();
    openInitialView();
    showNotice("已载入桌面原始测试数据清单；标准化记录区暂保留为示例结构。");
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function cacheElements() {
    Object.assign(els, {
      navItems: document.querySelectorAll(".nav-item"),
      portalCards: document.querySelectorAll("[data-view-target]"),
      panels: document.querySelectorAll(".view-panel"),
      converterToolList: document.getElementById("converterToolList"),
      aiAssistantPanel: document.getElementById("aiAssistantPanel"),
      aiAssistantToggle: document.getElementById("aiAssistantToggle"),
      aiAssistantDialog: document.getElementById("aiAssistantDialog"),
      aiAssistantClose: document.getElementById("aiAssistantClose"),
      aiAssistantScope: document.getElementById("aiAssistantScope"),
      aiAssistantInput: document.getElementById("aiAssistantInput"),
      aiQuickPrompts: document.getElementById("aiQuickPrompts"),
      aiAssistantAnswer: document.getElementById("aiAssistantAnswer"),
      aiAssistantResults: document.getElementById("aiAssistantResults"),
      datasetVersion: document.getElementById("datasetVersion"),
      storageState: document.getElementById("storageState"),
      searchInput: document.getElementById("searchInput"),
      machineCountPill: document.getElementById("machineCountPill"),
      analysisModuleCards: document.querySelectorAll("[data-analysis-module]"),
      activeAnalysisTitle: document.getElementById("activeAnalysisTitle"),
      activeAnalysisHint: document.getElementById("activeAnalysisHint"),
      reportModuleCards: document.querySelectorAll("[data-report-module]"),
      activeReportTitle: document.getElementById("activeReportTitle"),
      activeReportHint: document.getElementById("activeReportHint"),
      reportSearchField: document.getElementById("reportSearchField"),
      reportListPanel: document.getElementById("reportListPanel"),
      reportBuilderPanel: document.getElementById("reportBuilderPanel"),
      pptTemplateInput: document.getElementById("pptTemplateInput"),
      csvDataInput: document.getElementById("csvDataInput"),
      pptTemplateStatus: document.getElementById("pptTemplateStatus"),
      csvDataStatus: document.getElementById("csvDataStatus"),
      mappingStatus: document.getElementById("mappingStatus"),
      mappingSummary: document.getElementById("mappingSummary"),
      extractPptFieldsBtn: document.getElementById("extractPptFieldsBtn"),
      autoMapFieldsBtn: document.getElementById("autoMapFieldsBtn"),
      generatePptBtn: document.getElementById("generatePptBtn"),
      clearReportBuilderBtn: document.getElementById("clearReportBuilderBtn"),
      dataFieldNameInput: document.getElementById("dataFieldNameInput"),
      dataFieldValueInput: document.getElementById("dataFieldValueInput"),
      dataFieldNoteInput: document.getElementById("dataFieldNoteInput"),
      saveDataFieldBtn: document.getElementById("saveDataFieldBtn"),
      reportDataBody: document.getElementById("reportDataBody"),
      mappingSourceInput: document.getElementById("mappingSourceInput"),
      mappingDataSelect: document.getElementById("mappingDataSelect"),
      mappingFallbackInput: document.getElementById("mappingFallbackInput"),
      addMappingBtn: document.getElementById("addMappingBtn"),
      pptTextCandidates: document.getElementById("pptTextCandidates"),
      reportMappingBody: document.getElementById("reportMappingBody"),
      brandFilter: document.getElementById("brandFilter"),
      panelFilter: document.getElementById("panelFilter"),
      signalFilter: document.getElementById("signalFilter"),
      yearFilter: document.getElementById("yearFilter"),
      sortSelect: document.getElementById("sortSelect"),
      rawFileSearch: document.getElementById("rawFileSearch"),
      rawFilesBody: document.getElementById("rawFilesBody"),
      rawPreview: document.getElementById("rawPreview"),
      brightnessAnalysisPanel: document.getElementById("brightnessAnalysisPanel"),
      brightnessSizeFilter: document.getElementById("brightnessSizeFilter"),
      brightnessPriceFilter: document.getElementById("brightnessPriceFilter"),
      brightnessModelOptions: document.getElementById("brightnessModelOptions"),
      brightnessSelectionHint: document.getElementById("brightnessSelectionHint"),
      brightnessClearSelectionBtn: document.getElementById("brightnessClearSelectionBtn"),
      brightnessMetricTabs: document.querySelectorAll("[data-brightness-metric]"),
      brightnessMetricCards: document.getElementById("brightnessMetricCards"),
      brightnessChart: document.getElementById("brightnessChart"),
      brightnessTableBody: document.getElementById("brightnessTableBody"),
      colorAnalysisPanel: document.getElementById("colorAnalysisPanel"),
      colorSearchInput: document.getElementById("colorSearchInput"),
      colorSizeFilter: document.getElementById("colorSizeFilter"),
      colorPriceFilter: document.getElementById("colorPriceFilter"),
      colorModelOptions: document.getElementById("colorModelOptions"),
      colorSelectionHint: document.getElementById("colorSelectionHint"),
      colorClearSelectionBtn: document.getElementById("colorClearSelectionBtn"),
      colorMetricTabs: document.querySelectorAll("[data-color-metric]"),
      colorMetricCards: document.getElementById("colorMetricCards"),
      colorChart: document.getElementById("colorChart"),
      colorTableBody: document.getElementById("colorTableBody"),
      contrastAnalysisPanel: document.getElementById("contrastAnalysisPanel"),
      contrastSearchInput: document.getElementById("contrastSearchInput"),
      contrastSizeFilter: document.getElementById("contrastSizeFilter"),
      contrastPriceFilter: document.getElementById("contrastPriceFilter"),
      contrastModelOptions: document.getElementById("contrastModelOptions"),
      contrastSelectionHint: document.getElementById("contrastSelectionHint"),
      contrastClearSelectionBtn: document.getElementById("contrastClearSelectionBtn"),
      contrastMetricTabs: document.querySelectorAll("[data-contrast-metric]"),
      contrastMetricCards: document.getElementById("contrastMetricCards"),
      contrastChart: document.getElementById("contrastChart"),
      contrastTableBody: document.getElementById("contrastTableBody"),
      hardwareAnalysisPanel: document.getElementById("hardwareAnalysisPanel"),
      hardwareSearchInput: document.getElementById("hardwareSearchInput"),
      hardwareSizeFilter: document.getElementById("hardwareSizeFilter"),
      hardwareMetricCards: document.getElementById("hardwareMetricCards"),
      hardwareTableBody: document.getElementById("hardwareTableBody"),
      reportSearch: document.getElementById("reportSearch"),
      reportsBody: document.getElementById("reportsBody"),
      summaryCount: document.getElementById("summaryCount"),
      summaryScore: document.getElementById("summaryScore"),
      summaryHdr: document.getElementById("summaryHdr"),
      summaryLag: document.getElementById("summaryLag"),
      appNotice: document.getElementById("appNotice"),
      recordsBody: document.getElementById("recordsBody"),
      recordDetail: document.getElementById("recordDetail"),
      selectionPill: document.getElementById("selectionPill"),
      selectAllVisible: document.getElementById("selectAllVisible"),
      metricSelect: document.getElementById("metricSelect"),
      metricChart: document.getElementById("metricChart"),
      compareMatrix: document.getElementById("compareMatrix"),
      compareHeader: document.getElementById("compareHeader"),
      compareBody: document.getElementById("compareBody"),
      clearSelectionBtn: document.getElementById("clearSelectionBtn"),
      presetList: document.getElementById("presetList"),
      weightControls: document.getElementById("weightControls"),
      experimentChart: document.getElementById("experimentChart"),
      rankingList: document.getElementById("rankingList"),
      jsonInput: document.getElementById("jsonInput"),
      jsonFileInput: document.getElementById("jsonFileInput"),
      validateJsonBtn: document.getElementById("validateJsonBtn"),
      mergeJsonBtn: document.getElementById("mergeJsonBtn"),
      replaceJsonBtn: document.getElementById("replaceJsonBtn"),
      validationResult: document.getElementById("validationResult"),
      recordSchema: document.getElementById("recordSchema"),
      metricSchema: document.getElementById("metricSchema"),
      exportAllBtn: document.getElementById("exportAllBtn"),
      exportSelectedBtn: document.getElementById("exportSelectedBtn"),
      resetDataBtn: document.getElementById("resetDataBtn")
    });
  }

  function hydrateControls() {
    renderFilterOptions();
    renderMetricOptions();
    renderPresetButtons();
    renderWeightControls();
    renderBrightnessFilterOptions();
    renderColorFilterOptions();
    renderContrastFilterOptions();
    renderHardwareFilterOptions();
    syncJsonEditor();
  }

  function bindEvents() {
    els.navItems.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view, true));
    });

    els.portalCards.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewTarget, true));
    });

    if (els.aiAssistantInput) {
      els.aiAssistantInput.addEventListener("input", renderAiAssistant);
    }
    if (els.aiAssistantToggle) {
      els.aiAssistantToggle.addEventListener("click", () => setAiAssistantOpen(true));
    }
    if (els.aiAssistantClose) {
      els.aiAssistantClose.addEventListener("click", () => setAiAssistantOpen(false));
    }
    if (els.aiAssistantPanel) {
      els.aiAssistantPanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          setAiAssistantOpen(false);
          els.aiAssistantToggle?.focus();
        }
      });
    }
    if (els.aiQuickPrompts) {
      els.aiQuickPrompts.addEventListener("click", (event) => {
        const button = event.target.closest("[data-ai-prompt]");
        if (!button) {
          return;
        }
        els.aiAssistantInput.value = button.dataset.aiPrompt || "";
        renderAiAssistant();
      });
    }
    if (els.aiAssistantResults) {
      els.aiAssistantResults.addEventListener("click", handleAiAssistantResultClick);
    }

    els.analysisModuleCards.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeAnalysisModule = button.dataset.analysisModule;
        renderAnalysisModuleState();
        renderBrightnessAnalysis();
        renderColorAnalysis();
        renderContrastAnalysis();
        renderHardwareAnalysis();
        renderRawDataFiles();
      });
    });

    els.reportModuleCards.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeReportModule = button.dataset.reportModule;
        renderReportModuleState();
        renderReports();
      });
    });

    [els.searchInput, els.brandFilter, els.panelFilter, els.signalFilter, els.yearFilter, els.sortSelect].forEach((control) => {
      control.addEventListener("input", () => {
        renderDataViews();
        renderAnalysisViews();
      });
    });

    els.rawFileSearch.addEventListener("input", renderRawDataFiles);
    if (els.brightnessSizeFilter) {
      els.brightnessSizeFilter.addEventListener("input", () => {
        renderBrightnessAnalysis();
      });
    }
    if (els.brightnessPriceFilter) {
      els.brightnessPriceFilter.addEventListener("input", () => {
        renderBrightnessAnalysis();
      });
    }
    if (els.brightnessClearSelectionBtn) {
      els.brightnessClearSelectionBtn.addEventListener("click", () => {
        state.brightnessSelectedKeys.clear();
        renderBrightnessAnalysis();
      });
    }
    els.brightnessMetricTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeBrightnessMetric = button.dataset.brightnessMetric || "all";
        renderBrightnessAnalysis();
      });
    });
    if (els.colorSizeFilter) {
      els.colorSizeFilter.addEventListener("input", () => {
        renderColorAnalysis();
      });
    }
    if (els.colorSearchInput) {
      els.colorSearchInput.addEventListener("input", () => {
        renderColorAnalysis();
      });
    }
    if (els.colorPriceFilter) {
      els.colorPriceFilter.addEventListener("input", () => {
        renderColorAnalysis();
      });
    }
    if (els.colorClearSelectionBtn) {
      els.colorClearSelectionBtn.addEventListener("click", () => {
        state.colorSelectedKeys.clear();
        renderColorAnalysis();
      });
    }
    els.colorMetricTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeColorMetric = button.dataset.colorMetric || "all";
        renderColorAnalysis();
      });
    });
    if (els.contrastSizeFilter) {
      els.contrastSizeFilter.addEventListener("input", () => {
        renderContrastAnalysis();
      });
    }
    if (els.contrastSearchInput) {
      els.contrastSearchInput.addEventListener("input", () => {
        renderContrastAnalysis();
      });
    }
    if (els.contrastPriceFilter) {
      els.contrastPriceFilter.addEventListener("input", () => {
        renderContrastAnalysis();
      });
    }
    if (els.contrastClearSelectionBtn) {
      els.contrastClearSelectionBtn.addEventListener("click", () => {
        state.contrastSelectedKeys.clear();
        renderContrastAnalysis();
      });
    }
    els.contrastMetricTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeContrastMetric = button.dataset.contrastMetric || "all";
        renderContrastAnalysis();
      });
    });
    if (els.hardwareSearchInput) {
      els.hardwareSearchInput.addEventListener("input", renderHardwareAnalysis);
    }
    if (els.hardwareSizeFilter) {
      els.hardwareSizeFilter.addEventListener("input", renderHardwareAnalysis);
    }
    els.reportSearch.addEventListener("input", renderReports);
    if (els.pptTemplateInput) {
      els.pptTemplateInput.addEventListener("change", handlePptTemplateUpload);
    }
    if (els.csvDataInput) {
      els.csvDataInput.addEventListener("change", handleReportDataUpload);
    }
    if (els.extractPptFieldsBtn) {
      els.extractPptFieldsBtn.addEventListener("click", extractCurrentPptFields);
    }
    if (els.autoMapFieldsBtn) {
      els.autoMapFieldsBtn.addEventListener("click", () => {
        applyAutomaticReportMappings(true);
      });
    }
    if (els.generatePptBtn) {
      els.generatePptBtn.addEventListener("click", generateMappedPptReport);
    }
    if (els.clearReportBuilderBtn) {
      els.clearReportBuilderBtn.addEventListener("click", clearReportBuilderMappings);
    }
    if (els.saveDataFieldBtn) {
      els.saveDataFieldBtn.addEventListener("click", saveReportDataField);
    }
    if (els.addMappingBtn) {
      els.addMappingBtn.addEventListener("click", addReportMappingFromForm);
    }
    if (els.reportDataBody) {
      els.reportDataBody.addEventListener("click", handleReportDataTableClick);
    }
    if (els.reportMappingBody) {
      els.reportMappingBody.addEventListener("click", handleReportMappingTableClick);
      els.reportMappingBody.addEventListener("input", handleReportMappingTableInput);
      els.reportMappingBody.addEventListener("change", handleReportMappingTableInput);
    }

    els.recordsBody.addEventListener("click", (event) => {
      const checkbox = event.target.closest("input[type='checkbox']");
      const row = event.target.closest("tr[data-id]");
      if (!row) {
        return;
      }

      const recordId = row.dataset.id;
      if (checkbox) {
        setSelection(recordId, checkbox.checked);
        return;
      }

      state.activeRecordId = recordId;
      renderRecords();
      renderDetail();
    });

    els.selectAllVisible.addEventListener("change", () => {
      getFilteredRecords().forEach((record) => {
        setSelection(record.id, els.selectAllVisible.checked, false);
      });
      renderSelectionState();
      renderAnalysisViews();
    });

    if (els.metricSelect) {
      els.metricSelect.addEventListener("input", renderCompareView);
    }
    if (els.clearSelectionBtn) {
      els.clearSelectionBtn.addEventListener("click", () => {
        state.selectedIds.clear();
        renderAll();
      });
    }

    els.exportAllBtn.addEventListener("click", () => exportDataset(state.dataset, "tv-quality-all-data.json"));
    els.exportSelectedBtn.addEventListener("click", () => {
      const selected = getSelectedRecords();
      if (!selected.length) {
        showNotice("请先在测试记录表格中勾选需要导出的记录。", "warning");
        return;
      }
      exportDataset(
        {
          ...state.dataset,
          tests: selected,
          exportedAt: new Date().toISOString(),
          exportScope: "selected"
        },
        "tv-quality-selected-data.json"
      );
    });

    els.resetDataBtn.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      state.dataset = cloneDataset(window.TV_TEST_SAMPLE_DATA);
      state.selectedIds.clear();
      state.activeRecordId = null;
      hydrateControls();
      renderAll();
      showNotice("已恢复示例数据。");
    });

    els.jsonFileInput.addEventListener("change", handleFileInput);
    els.validateJsonBtn.addEventListener("click", () => {
      const result = parseAndValidateInput();
      renderValidation(result);
    });
    els.mergeJsonBtn.addEventListener("click", () => applyImportedData("merge"));
    els.replaceJsonBtn.addEventListener("click", () => applyImportedData("replace"));
  }

  function loadDataset() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return ensureDatasetDefaults(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Failed to load local dataset", error);
    }
    return ensureDatasetDefaults(cloneDataset(window.TV_TEST_SAMPLE_DATA || { version: "0.1.0", recordSchema: [], metricDefs: [], tests: [] }));
  }

  function loadReportBuilderState() {
    const fallback = {
      templateName: "",
      templateSize: 0,
      templateLoadedAt: "",
      dataFileName: "",
      dataUpdatedAt: "",
      dataFields: getDefaultReportDataFields(),
      pptTexts: [],
      placeholders: [],
      mappings: []
    };
    try {
      const stored = localStorage.getItem(REPORT_BUILDER_STORAGE_KEY);
      if (!stored) {
        return fallback;
      }
      const parsed = JSON.parse(stored);
      return {
        ...fallback,
        ...parsed,
        dataFields: Array.isArray(parsed.dataFields) ? parsed.dataFields : [],
        pptTexts: Array.isArray(parsed.pptTexts) ? parsed.pptTexts : [],
        placeholders: Array.isArray(parsed.placeholders) ? parsed.placeholders : [],
        mappings: Array.isArray(parsed.mappings) ? parsed.mappings : []
      };
    } catch (error) {
      console.warn("Failed to load report builder state", error);
      return fallback;
    }
  }

  function persistReportBuilderState() {
    const payload = {
      ...state.reportBuilder,
      templateReady: Boolean(reportTemplateBuffer)
    };
    localStorage.setItem(REPORT_BUILDER_STORAGE_KEY, JSON.stringify(payload));
  }

  function cloneDataset(dataset) {
    return JSON.parse(JSON.stringify(dataset));
  }

  function ensureDatasetDefaults(dataset) {
    if (!dataset || typeof dataset !== "object") {
      return { version: "0.1.0", recordSchema: [], metricDefs: [], tests: [] };
    }
    const defaultMetricDefs = ((window.TV_TEST_SAMPLE_DATA && window.TV_TEST_SAMPLE_DATA.metricDefs) || []).filter((metric) => metric.key === "colorTemperature");
    if (!defaultMetricDefs.length) {
      return dataset;
    }
    const metricDefs = new Map((dataset.metricDefs || []).map((metric) => [metric.key, metric]));
    defaultMetricDefs.forEach((metric) => {
      if (!metricDefs.has(metric.key)) {
        metricDefs.set(metric.key, metric);
      }
    });
    return {
      ...dataset,
      metricDefs: Array.from(metricDefs.values())
    };
  }

  function persistDataset() {
    state.dataset.updatedAt = today();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.dataset));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function setAiAssistantOpen(isOpen) {
    if (!els.aiAssistantPanel) {
      return;
    }

    els.aiAssistantPanel.classList.toggle("is-open", isOpen);
    els.aiAssistantPanel.classList.toggle("is-collapsed", !isOpen);
    els.aiAssistantToggle?.setAttribute("aria-expanded", String(isOpen));
    els.aiAssistantDialog?.setAttribute("aria-hidden", String(!isOpen));

    if (isOpen) {
      setTimeout(() => els.aiAssistantInput?.focus(), 80);
    } else {
      els.aiAssistantInput?.blur();
    }
  }

  function renderAll() {
    renderChrome();
    renderDataViews();
    renderAnalysisViews();
    renderReports();
    renderAiAssistant();
    renderSchema();
    syncJsonEditor();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderChrome() {
    document.body.dataset.activeView = state.activeView;
    const rawCount = ((window.TV_RAW_DATA_MANIFEST && window.TV_RAW_DATA_MANIFEST.files) || []).filter((file) => !isHiddenRawFile(file.name)).length;
    els.datasetVersion.textContent = `v${state.dataset.version || "0.1"}`;
    els.storageState.textContent = rawCount ? `原始文件 ${rawCount} 项` : localStorage.getItem(STORAGE_KEY) ? "本地保存" : "示例数据";
    if (els.machineCountPill) {
      els.machineCountPill.textContent = `测试机器 ${computeMachineCount()} 台`;
    }
  }

  function renderDataViews() {
    renderFilterOptions();
    renderSummary();
    renderAnalysisModuleState();
    renderRawDataFiles();
    renderBrightnessAnalysis();
    renderColorAnalysis();
    renderContrastAnalysis();
    renderHardwareAnalysis();
    renderRecords();
    renderDetail();
    renderSelectionState();
  }

  function renderAnalysisViews() {
    renderCompareView();
    renderExperimentView();
  }

  function switchView(viewName, syncUrl = false) {
    state.activeView = viewName;
    document.body.dataset.activeView = viewName;
    els.navItems.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    });
    els.panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.viewPanel === viewName);
    });
    if (syncUrl && window.location.hash !== `#${viewName}`) {
      window.history.replaceState(null, "", `#${viewName}`);
    }
    if (viewName === "data") {
      renderBrightnessAnalysis();
    }
    renderAnalysisViews();
    renderAiAssistant();
    setAiAssistantOpen(false);
  }

  function renderAiAssistant() {
    if (!els.aiAssistantPanel || !els.aiAssistantInput || !els.aiAssistantResults) {
      return;
    }
    const query = (els.aiAssistantInput.value || "").trim();
    const entries = buildAiAssistantIndex();
    const results = query ? searchAiEntries(entries, query) : getAiDefaultEntries(entries);
    aiAssistantResultsCache = results.slice(0, 8);

    const scope = getAiViewLabel(state.activeView);
    if (els.aiAssistantScope) {
      els.aiAssistantScope.textContent = scope;
    }
    if (els.aiQuickPrompts) {
      els.aiQuickPrompts.innerHTML = getAiPromptsForView(state.activeView)
        .map((prompt) => `<button type="button" data-ai-prompt="${escapeAttr(prompt)}">${escapeHtml(prompt)}</button>`)
        .join("");
    }
    if (els.aiAssistantAnswer) {
      els.aiAssistantAnswer.innerHTML = query
        ? `<strong>找到 ${results.length} 个相关入口</strong><span>优先展示当前模块内最匹配的工具、数据和报告。</span>`
        : `<strong>我可以帮你快速定位平台内容</strong><span>输入关键词，或点击下面的常用问题。</span>`;
    }
    els.aiAssistantResults.innerHTML = aiAssistantResultsCache.length
      ? aiAssistantResultsCache.map(renderAiResultCard).join("")
      : `<div class="ai-empty">没有找到匹配内容。可以换成机型、指标、工具名或报告关键词。</div>`;
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderAiResultCard(entry, index) {
    const meta = [entry.section, entry.kind].filter(Boolean).join(" · ");
    const actionLabel = entry.href ? "打开" : "定位";
    return `
      <button class="ai-result-card" type="button" data-ai-result="${index}">
        <span class="ai-result-icon"><i data-lucide="${escapeAttr(entry.icon || "search")}"></i></span>
        <span class="ai-result-main">
          <strong>${escapeHtml(entry.title)}</strong>
          <em>${escapeHtml(meta || "平台入口")}</em>
          ${entry.description ? `<span>${escapeHtml(truncate(entry.description, 96))}</span>` : ""}
        </span>
        <span class="ai-result-action">${actionLabel}</span>
      </button>
    `;
  }

  function handleAiAssistantResultClick(event) {
    const button = event.target.closest("[data-ai-result]");
    if (!button) {
      return;
    }
    const entry = aiAssistantResultsCache[Number(button.dataset.aiResult)];
    if (!entry) {
      return;
    }
    activateAiEntry(entry);
  }

  function activateAiEntry(entry) {
    if (entry.view) {
      switchView(entry.view, true);
    }
    if (entry.analysisModule) {
      state.activeAnalysisModule = entry.analysisModule;
      renderAnalysisModuleState();
      renderBrightnessAnalysis();
      renderColorAnalysis();
      renderContrastAnalysis();
      renderHardwareAnalysis();
      renderRawDataFiles();
    }
    if (entry.reportModule) {
      state.activeReportModule = entry.reportModule;
      renderReportModuleState();
      renderReports();
    }
    if (entry.fillSearch && els.rawFileSearch) {
      els.rawFileSearch.value = entry.fillSearch;
      renderRawDataFiles();
    }
    if (entry.fillReportSearch && els.reportSearch) {
      els.reportSearch.value = entry.fillReportSearch;
      renderReports();
    }
    if (entry.href) {
      window.open(entry.href, entry.external ? "_blank" : "_self", "noreferrer");
      return;
    }
    renderAiAssistant();
    showNotice(`已定位：${entry.title}`);
  }

  function buildAiAssistantIndex() {
    const entries = [
      createAiEntry("客观数据分析", "查看亮度、颜色、屏对比度和硬件规格，对比机型和原始文件", "模块入口", "模块", { view: "data", icon: "database", keywords: "亮度 颜色 色域 色准 色温 对比度 硬件 规格 分区 刷新率 芯片 屏体 原始数据 客观数据" }),
      createAiEntry("实验设计", "进入人眼舒适亮度、四色B/C应用和电流配比实验工具", "模块入口", "模块", { view: "lab", icon: "flask-conical", keywords: "实验 设计 人眼 舒适亮度 四色 B/C 电流配比" }),
      createAiEntry("画质调试转换工具", "打开色域转换、TXT转INI、BT.1886 gamma 等调试工具", "模块入口", "模块", { view: "debug-converter", icon: "sliders-horizontal", keywords: "调试 转换 色域 ini gamma 1886 工具" }),
      createAiEntry("竞品分析报告", "管理竞品报告、输出报告和数据模板映射生成", "模块入口", "模块", { view: "reports", icon: "file-text", keywords: "竞品 报告 ppt 模板 映射 输出 分析" }),
      createAiEntry("亮度客观数据", "峰值亮度、全白场、黑场亮度、Real Scene 对比", "客观数据分析", "子模块", { view: "data", analysisModule: "brightness", icon: "sun-medium", keywords: "亮度 峰值 全白 黑场 real scene nit" }),
      createAiEntry("颜色客观数据", "色域、色准、DeltaE、白平衡、色温数据对比", "客观数据分析", "子模块", { view: "data", analysisModule: "color", icon: "palette", keywords: "颜色 色域 色准 deltae 白平衡 色温" }),
      createAiEntry("屏对比度客观数据", "屏本体对比度、开 LD 后对比度数据", "客观数据分析", "子模块", { view: "data", analysisModule: "contrast", icon: "contrast", keywords: "对比度 屏本体 LD local dimming 黑位" }),
      createAiEntry("硬件规格", "背光分区、刷新率、芯片信息和屏体信息汇总", "客观数据分析", "子模块", { view: "data", analysisModule: "hardware", icon: "cpu", keywords: "硬件 规格 LD 背光 分区 刷新率 Hz 芯片 屏体 面板" }),
      createAiEntry("分析报告", "查看竞品分析过程文档、DOCX/PDF/PPT 报告", "竞品分析报告", "子模块", { view: "reports", reportModule: "analysis", icon: "file-search", keywords: "分析报告 过程文档 docx pdf ppt" }),
      createAiEntry("输出报告", "查看最终输出版本和交付报告文件", "竞品分析报告", "子模块", { view: "reports", reportModule: "output", icon: "file-output", keywords: "输出报告 最终 交付 导出 export output" }),
      createAiEntry("数据与模板映射", "维护 Excel/CSV 底层数据、PPT 字段映射并生成报告", "竞品分析报告", "子模块", { view: "reports", reportModule: "mapping", icon: "workflow", keywords: "数据 模板 映射 PPT 生成 生成PPT ppt生成 一键生成 Excel CSV 字段 替换" }),
      createAiEntry("人眼舒适亮度模型", "打开实验设计中的动态舒适亮度工具", "实验设计", "工具", { href: "tools/dynamic-comfort-brightness.html?v=20260612-eye-lr-system", icon: "sun-medium", keywords: "人眼 舒适亮度 dynamic comfort brightness" }),
      createAiEntry("人眼舒适亮度模型项目汇报6.22", "打开人眼舒适亮度模型项目汇报页面", "实验设计", "汇报PPT", { href: "tools/comfort-brightness-presentation.html", icon: "presentation", keywords: "人眼 舒适亮度 项目 汇报 6.22 ppt 演示" }),
      createAiEntry("海信四色B/C应用", "打开四色 B/C 应用工具", "实验设计", "工具", { href: "tools/hisense-bc-application.html?v=20260609-bc", icon: "blocks", keywords: "海信 四色 B/C Hisense" }),
      createAiEntry("色域转换", "RGB / XYZ 色域矩阵转换，CIE 1931 / CIE 1976 覆盖率计算", "画质调试转换工具", "工具", { href: "tools/color-gamut-converter.html?v=20260618-batch-xy-v2", icon: "palette", keywords: "色域 转换 RGB XYZ CIE 1931 1976 覆盖率" }),
      createAiEntry("光影平衡调试", "TXT 转 INI 工具", "画质调试转换工具", "工具", { href: "tools/txt-to-ini.html?v=20260609-back", icon: "file-cog", keywords: "光影 平衡 TXT INI 转换" }),
      createAiEntry("1886gamma转换", "BT.1886 / Gamma 曲线转换工具", "画质调试转换工具", "工具", { href: "tools/bt1886-gamma.html?v=20260609-backnav", icon: "line-chart", keywords: "1886 gamma BT1886 曲线 转换" })
    ];

    getVisibleRawFiles().forEach((file) => {
      const isReport = file.kind === "document" || ["doc", "docx", "pdf", "ppt", "pptx", "pptm"].includes(String(file.extension).toLowerCase());
      entries.push(createAiEntry(
        file.name,
        `${getRawKindLabel(file.kind)} · ${formatBytes(file.size)} · ${formatDateTime(file.modifiedAt)}`,
        isReport ? "竞品分析报告" : "客观数据分析",
        isReport ? "文件/报告" : "原始数据",
        {
          view: isReport ? "reports" : "data",
          reportModule: isReport && matchesReportModule(file, "output") ? "output" : isReport ? "analysis" : "",
          fillReportSearch: isReport ? file.name : "",
          fillSearch: isReport ? "" : normalizeMachineName(file.name),
          href: isReport ? getReportOpenHref(file, encodeFilePath(file.path)) : "",
          icon: isReport ? "file-text" : "database",
          keywords: [file.name, file.extension, file.kind, file.searchText].join(" ")
        }
      ));
    });

    state.reportBuilder.dataFields.forEach((field) => {
      entries.push(createAiEntry(field.label, field.value || "底层数据字段", "竞品分析报告", "底层数据字段", {
        view: "reports",
        reportModule: "mapping",
        icon: "table-properties",
        keywords: [field.label, field.value, field.source, field.note].join(" ")
      }));
    });

    (state.dataset.tests || []).forEach((record) => {
      entries.push(createAiEntry(`${record.brand} ${record.model}`, `${record.size}英寸 · ${record.mode} · 综合分 ${formatNumber(computeOverallScore(record), 1)}`, "客观数据分析", "测试记录", {
        view: "data",
        icon: "tv",
        keywords: [record.brand, record.model, record.size, record.mode, record.panel, record.tags && record.tags.join(" "), record.notes].join(" ")
      }));
    });

    getMetricDefs().forEach((metric) => {
      entries.push(createAiEntry(metric.label, `${metric.group} · ${metric.unit || "无单位"} · ${metric.direction}`, "客观数据分析", "指标字段", {
        view: "data",
        icon: "ruler",
        keywords: [metric.key, metric.label, metric.group, metric.unit, metric.direction].join(" ")
      }));
    });

    return entries;
  }

  function createAiEntry(title, description, section, kind, options = {}) {
    return {
      title,
      description,
      section,
      kind,
      view: options.view || "",
      analysisModule: options.analysisModule || "",
      reportModule: options.reportModule || "",
      fillSearch: options.fillSearch || "",
      fillReportSearch: options.fillReportSearch || "",
      href: options.href || "",
      external: Boolean(options.external),
      icon: options.icon || "search",
      keywords: [title, description, section, kind, options.keywords || ""].join(" ")
    };
  }

  function searchAiEntries(entries, query) {
    const tokens = tokenizeAiQuery(query);
    const genericTokens = new Set(["资料", "平台", "数据", "报告", "文件", "工具", "客观数据", "原始数据", "分析报告", "输出报告"]);
    const specificTokens = tokens.filter((token) => !genericTokens.has(token) && !/请|帮我|我要|我想要|查找|搜索|打开|查看|寻找|定位|给我/.test(token));
    return entries
      .map((entry) => ({ entry, score: scoreAiEntry(entry, tokens, query) }))
      .filter((item) => {
        if (item.score <= 0) {
          return false;
        }
        if (!specificTokens.length) {
          return true;
        }
        const haystack = normalizeReportText(item.entry.keywords);
        return specificTokens.some((token) => haystack.includes(token));
      })
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "zh-CN"))
      .map((item) => item.entry);
  }

  function scoreAiEntry(entry, tokens, query) {
    const haystack = normalizeReportText(entry.keywords);
    const title = normalizeReportText(entry.title);
    const normalizedQuery = normalizeReportText(query);
    let score = 0;
    tokens.forEach((token) => {
      if (!token) {
        return;
      }
      if (title.includes(token)) {
        score += 16 + Math.min(token.length, 12);
      } else if (haystack.includes(token)) {
        score += 7;
      }
    });
    if (!score) {
      return 0;
    }
    if (entry.view === state.activeView) {
      score += 8;
    }
    score += entry.kind === "子模块" ? 5 : entry.kind === "模块" ? 1 : 0;
    if (normalizedQuery.includes("报告")) {
      score += entry.kind === "文件/报告" ? 12 : entry.reportModule ? 3 : 0;
    }
    if (normalizedQuery.includes("数据")) {
      score += entry.kind === "原始数据" || entry.kind === "测试记录" ? 10 : 0;
    }
    if (normalizedQuery.includes("工具") && entry.kind === "工具") {
      score += 10;
    }
    return score;
  }

  function tokenizeAiQuery(query) {
    const normalized = normalizeReportText(query);
    const parts = String(query || "")
      .toLowerCase()
      .split(/[\s,，。/、;；:：|]+/)
      .map(normalizeReportText)
      .filter(Boolean);
    const alphanumeric = normalized.match(/[a-z0-9][a-z0-9.+-]{2,}/g) || [];
    const semanticTerms = [
      "客观数据", "原始数据", "分析报告", "输出报告", "报告", "文件", "工具", "亮度", "峰值", "黑场",
      "颜色", "色域", "色准", "色温", "对比度", "硬件规格", "硬件", "分区", "刷新率", "芯片", "屏体",
      "电流配比", "四色", "生成PPT", "模板", "Real Scene"
    ]
      .map(normalizeReportText)
      .filter((term) => normalized.includes(term));
    const cleaned = normalized.replace(/请|帮我|我要|我想要|查找|搜索|打开|查看|寻找|定位|平台上?的?|一下|有关|相关|关于|给我/g, "");
    const core = cleaned.replace(/客观数据|原始数据|分析报告|输出报告|硬件规格|报告|数据|文件|工具|资料/g, "");
    return Array.from(new Set([normalized, cleaned, core].concat(parts, alphanumeric, semanticTerms).filter((token) => token && token.length > 1)));
  }

  function getAiDefaultEntries(entries) {
    const preferred = entries.filter((entry) => entry.view === state.activeView && (entry.kind === "子模块" || entry.kind === "工具"));
    const fallback = entries.filter((entry) => entry.kind === "模块");
    return preferred.concat(fallback).slice(0, 8);
  }

  function getAiViewLabel(viewName) {
    const labels = {
      home: "分类入口",
      data: "客观数据分析",
      lab: "实验设计",
      reports: "竞品分析报告",
      "debug-converter": "调试转换工具",
      import: "数据导入",
      schema: "字段规范"
    };
    return labels[viewName] || "当前模块";
  }

  function getAiPromptsForView(viewName) {
    const prompts = {
      data: ["查找亮度数据", "Real Scene", "色域 色准", "屏对比度", "硬件规格"],
      lab: ["人眼舒适亮度", "四色B/C", "电流配比"],
      reports: ["生成PPT", "数据与模板映射", "查找分析报告", "输出报告"],
      "debug-converter": ["色域转换", "TXT转INI", "1886gamma"],
      home: ["打开竞品分析报告", "查找工具", "亮度数据", "生成PPT"]
    };
    return prompts[viewName] || ["查找工具", "查找报告", "查找数据"];
  }

  function openInitialView() {
    const view = (window.location.hash || "").replace("#", "");
    const viewMap = { compare: "lab", import: "data", schema: "data" };
    const normalizedView = viewMap[view] || view;
    const allowedViews = new Set(["home", "data", "lab", "reports", "debug-converter"]);
    const hasPanel = allowedViews.has(normalizedView) && Array.from(els.panels).some((panel) => panel.dataset.viewPanel === normalizedView);
    if (view && hasPanel) {
      switchView(normalizedView, false);
    }
  }

  function renderRawDataFiles() {
    const moduleKey = state.activeAnalysisModule;
    const files = getVisibleRawFiles().filter((file) => moduleKey === "hardware" || file.kind !== "document");
    const query = (els.rawFileSearch.value || "").trim().toLowerCase();
    const moduleMatches = files.filter((file) => matchesAnalysisModule(file, moduleKey));
    const baseFiles = query ? files : moduleMatches.length ? moduleMatches : files;
    const filtered = baseFiles.filter((file) => matchesRawFileQuery(file, query));

    if (!filtered.length) {
      els.rawFilesBody.innerHTML = `<tr><td colspan="5"><p class="empty-copy">没有匹配的原始文件。</p></td></tr>`;
      renderRawPreview(null);
      return;
    }

    els.rawFilesBody.innerHTML = filtered
      .map((file, index) => {
        const href = encodeURI(file.path);
        return `
          <tr data-raw-index="${index}">
            <td>
              <div class="tv-cell">
                <strong>${escapeHtml(file.name)}</strong>
                <span>${escapeHtml(getRawKindLabel(file.kind))}${file.encoding ? " · " + escapeHtml(file.encoding) : ""}</span>
              </div>
            </td>
            <td><span class="tag">${escapeHtml(file.extension.toUpperCase())}</span></td>
            <td>${formatBytes(file.size)}</td>
            <td>${escapeHtml(formatDateTime(file.modifiedAt))}</td>
            <td>
              <div class="raw-actions">
                <button class="icon-button ghost small" type="button" data-preview="${index}" title="预览文件">
                  <i data-lucide="eye"></i>
                  <span>预览</span>
                </button>
                <a class="icon-button ghost small raw-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer" title="打开文件">
                  <i data-lucide="external-link"></i>
                  <span>打开</span>
                </a>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    els.rawFilesBody.querySelectorAll("[data-preview]").forEach((button) => {
      button.addEventListener("click", () => {
        renderRawPreview(filtered[Number(button.dataset.preview)]);
      });
    });

    renderRawPreview(filtered[0]);
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderRawPreview(file) {
    if (!file) {
      els.rawPreview.innerHTML = `
        <div class="empty-state">
          <i data-lucide="file-search"></i>
          <strong>未选择原始文件</strong>
          <span>从左侧文件列表选择 CSV 预览</span>
        </div>
      `;
      if (window.lucide) {
        window.lucide.createIcons();
      }
      return;
    }

    const previewRows = file.preview || [];
    const previewTable = previewRows.length
      ? `
        <div class="table-wrap raw-preview-table-wrap">
          <table class="records-table compact-table raw-preview-table">
            <tbody>
              ${previewRows
                .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell || "")}</td>`).join("")}</tr>`)
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : `<p class="empty-copy">该文件不是 CSV，或暂不支持网页内预览。可点击“打开”查看原文件。</p>`;

    els.rawPreview.innerHTML = `
      <div class="detail-title">
        <div>
          <h3>${escapeHtml(file.name)}</h3>
          <div class="muted">${escapeHtml(getRawKindLabel(file.kind))} · ${formatBytes(file.size)}</div>
        </div>
        <a class="icon-button ghost small raw-link" href="${escapeAttr(encodeURI(file.path))}" target="_blank" rel="noreferrer" title="打开文件">
          <i data-lucide="external-link"></i>
          <span>打开</span>
        </a>
      </div>
      ${previewTable}
    `;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function getRawKindLabel(kind) {
    const labels = {
      csv: "CSV 原始数据",
      spreadsheet: "表格文件",
      document: "分析报告",
      file: "文件"
    };
    return labels[kind] || "文件";
  }

  function renderAnalysisModuleState() {
    const config = getAnalysisModuleConfig(state.activeAnalysisModule);
    els.analysisModuleCards.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.analysisModule === state.activeAnalysisModule);
    });
    if (els.brightnessAnalysisPanel) {
      els.brightnessAnalysisPanel.hidden = state.activeAnalysisModule !== "brightness";
    }
    if (els.colorAnalysisPanel) {
      els.colorAnalysisPanel.hidden = state.activeAnalysisModule !== "color";
    }
    if (els.contrastAnalysisPanel) {
      els.contrastAnalysisPanel.hidden = state.activeAnalysisModule !== "contrast";
    }
    if (els.hardwareAnalysisPanel) {
      els.hardwareAnalysisPanel.hidden = state.activeAnalysisModule !== "hardware";
    }
    els.activeAnalysisTitle.textContent = `${config.label}数据`;
    els.activeAnalysisHint.textContent = `${config.hint} · 来源：桌面 / 测试原始数据`;
  }

  function getAnalysisModuleConfig(key) {
    const configs = {
      brightness: {
        label: "亮度",
        hint: "优先展示包含亮度、Real Scene、全白场、黑场亮度等关键词的原始文件",
        keywords: ["亮度", "峰值", "real scene", "全白", "黑场亮度", "nit", "cd/m", "白场"]
      },
      color: {
        label: "颜色",
        hint: "优先展示包含颜色、色域、色准、白平衡、DeltaE 等关键词的原始文件",
        keywords: ["颜色", "色彩", "色域", "色准", "白平衡", "delta", "deltae", "Δe", "色温", "灰阶", "x y z", "x y", "cie", "p3", "ntsc", "gamut"]
      },
      contrast: {
        label: "屏对比度",
        hint: "优先展示包含屏本体对比度、开LD后对比度、黑位、ANSI 等关键词的原始文件",
        keywords: ["屏对比度", "对比度", "黑位", "黑场", "ansi", "local dimming", "ld", "开ld", "关ld"]
      },
      hardware: {
        label: "硬件规格",
        hint: "优先展示包含背光分区、刷新率、芯片信息、屏体信息等关键词的原始文件",
        keywords: ["硬件规格", "ld分区", "背光分区", "刷新率", "芯片信息", "画质芯片", "屏体信息", "屏幕信息", "面板信息"]
      }
    };
    return configs[key] || configs.brightness;
  }

  function matchesAnalysisModule(file, moduleKey) {
    if (moduleKey === "hardware") {
      return Boolean(parseHardwareFile(file));
    }
    const config = getAnalysisModuleConfig(moduleKey);
    const haystack = [
      file.name,
      file.extension,
      file.kind,
      file.searchText,
      ...(file.preview || []).flat()
    ]
      .join(" ")
      .toLowerCase();
    return config.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  }

  function matchesRawFileQuery(file, query) {
    if (!query) {
      return true;
    }
    const haystack = [
      file.name,
      file.extension,
      file.kind,
      file.searchText,
      ...(file.preview || []).flat()
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function isHiddenRawFile(name) {
    return String(name || "").startsWith(".") || String(name || "").startsWith("._");
  }

  function getVisibleRawFiles() {
    const manifest = window.TV_RAW_DATA_MANIFEST || { files: [] };
    return (manifest.files || []).filter((file) => !isHiddenRawFile(file.name));
  }

  function renderBrightnessFilterOptions() {
    if (!els.brightnessSizeFilter || !els.brightnessPriceFilter) {
      return;
    }
    const records = getBrightnessRecords();
    const currentSize = els.brightnessSizeFilter.value;
    const currentPrice = els.brightnessPriceFilter.value;
    const sizes = Array.from(new Set(records.map((record) => record.size).filter(Boolean))).sort((a, b) => a - b);
    els.brightnessSizeFilter.innerHTML = [`<option value="">全部尺寸</option>`]
      .concat(sizes.map((size) => `<option value="${size}">${size} 英寸</option>`))
      .join("");
    els.brightnessSizeFilter.value = sizes.map(String).includes(String(currentSize)) ? String(currentSize) : "";
    els.brightnessPriceFilter.innerHTML = brightnessPriceRanges
      .map((range) => `<option value="${escapeAttr(range.key)}">${escapeHtml(range.label)}</option>`)
      .join("");
    els.brightnessPriceFilter.value = brightnessPriceRanges.some((range) => range.key === currentPrice) ? currentPrice : "";
  }

  function renderBrightnessAnalysis() {
    if (!els.brightnessAnalysisPanel || !els.brightnessModelOptions || !els.brightnessChart || !els.brightnessTableBody) {
      return;
    }

    const allRecords = getBrightnessRecords();
    const filtered = filterBrightnessRecords(allRecords);
    pruneBrightnessSelection(filtered);
    const compareRecords = getBrightnessCompareRecords(filtered);

    els.brightnessAnalysisPanel.hidden = state.activeAnalysisModule !== "brightness";
    els.brightnessMetricTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.brightnessMetric === state.activeBrightnessMetric);
    });
    renderBrightnessModelOptions(filtered);
    renderBrightnessMetricCards(compareRecords);
    drawBrightnessChart(els.brightnessChart, compareRecords, state.activeBrightnessMetric);
    renderBrightnessTable(filtered);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function getBrightnessRecords() {
    const map = new Map();
    getVisibleRawFiles()
      .filter((file) => file.kind !== "document")
      .forEach((file) => {
        const parsed = parseBrightnessFile(file);
        if (!parsed || !hasBrightnessMetric(parsed.metrics)) {
          return;
        }
        const key = normalizeModelKey(parsed.model);
        const existing = map.get(key) || {
          key,
          model: parsed.model,
          brand: inferBrand(parsed.model),
          size: inferSize(parsed.model),
          price: null,
          priceNote: "",
          metrics: {},
          sources: []
        };
        const meta = getBrightnessMeta(parsed.model);
        existing.price = Number.isFinite(Number(meta.price)) ? Number(meta.price) : existing.price;
        existing.priceNote = meta.priceNote || existing.priceNote;
        existing.metrics = mergeBrightnessMetrics(existing.metrics, parsed.metrics);
        existing.sources.push(file);
        map.set(key, existing);
      });

    return Array.from(map.values()).sort((a, b) => {
      const sizeDiff = (a.size || 0) - (b.size || 0);
      return sizeDiff || a.model.localeCompare(b.model, "zh-CN");
    });
  }

  function parseBrightnessFile(file) {
    const rows = Array.isArray(file.preview) ? file.preview : [];
    const flatCells = rows.flat().map((cell) => String(cell || "").trim()).filter(Boolean);
    const searchText = String(file.searchText || "");
    const model = extractModelName(file, flatCells, searchText);
    if (!model) {
      return null;
    }

    const metrics = {};
    rows.forEach((row) => {
      row.forEach((cell, index) => {
        const label = String(cell || "").trim();
        if (!label) {
          return;
        }
        const metricKey = getBrightnessMetricKeyFromLabel(label);
        if (!metricKey) {
          return;
        }
        const value = findNumericCell(row.slice(index + 1));
        if (Number.isFinite(value)) {
          metrics[metricKey] = { value, source: "字段行" };
        }
      });
    });

    const textMetricMap = [
      { key: "fullWhite", pattern: /全白场亮度\s*([0-9]+(?:\.[0-9]+)?)/i },
      { key: "blackLevel", pattern: /黑场亮度(?:\([^)]*\)|（[^）]*）)?\s*([0-9]+(?:\.[0-9]+)?)/i },
      { key: "transientPeak", pattern: /瞬态峰值亮度(?:\([^)]*\)|（[^）]*）)?\s*([0-9]+(?:\.[0-9]+)?)/i },
      { key: "realScene", pattern: /Real\s*Scene\s*([0-9]+(?:\.[0-9]+)?)/i }
    ];
    textMetricMap.forEach((item) => {
      if (metrics[item.key] && Number.isFinite(metrics[item.key].value)) {
        return;
      }
      const match = searchText.match(item.pattern);
      const value = match ? Number(match[1]) : NaN;
      if (Number.isFinite(value)) {
        metrics[item.key] = { value, source: "文本提取" };
      }
    });

    const hasAplBrightnessTable = /(APL|Window（H）size|Window\(H\)size)/i.test(searchText) && /亮度/.test(searchText);
    const aplRows = hasAplBrightnessTable ? extractAplRows(rows) : [];
    if (aplRows.length) {
      const fullWhite = aplRows.find((item) => item.windowSize === 1);
      if (fullWhite && !metrics.fullWhite) {
        metrics.fullWhite = { value: fullWhite.brightness, source: "APL 100%" };
      }
      const peak = aplRows.reduce((best, item) => (!best || item.brightness > best.brightness ? item : best), null);
      if (peak && !metrics.transientPeak) {
        metrics.transientPeak = { value: peak.brightness, source: `${formatAplLabel(peak.windowSize)} 窗口` };
      }
    } else {
      const lvValues = extractLvValues(rows);
      if (lvValues.length && !metrics.transientPeak) {
        metrics.transientPeak = { value: Math.max(...lvValues), source: "Lv 最大值" };
      }
    }

    return { model, metrics };
  }

  function extractModelName(file, flatCells, searchText) {
    const cellCandidates = flatCells.filter((cell) => isPlausibleModelName(cell));
    const brandedCell = cellCandidates.find((cell) => /(?:TCL|海信|创维|Hisense|Skyworth)/i.test(cell));
    if (brandedCell) {
      return cleanModelName(brandedCell);
    }
    const fileModel = cleanModelName(file.name);
    if (isPlausibleModelName(fileModel)) {
      return fileModel;
    }
    const cellModel = cellCandidates[0];
    if (cellModel) {
      return cleanModelName(cellModel);
    }
    const textMatch = String(searchText || "").match(/(?:TCL|海信|创维|Hisense|Skyworth)?\s*\d{2,3}[A-Za-z][A-Za-z0-9\s-]*(?:Pro|Mini|Max)?/i);
    if (textMatch) {
      return cleanModelName(textMatch[0]);
    }
    return "";
  }

  function cleanModelName(value) {
    return String(value || "")
      .replace(/\.[^.]+$/g, "")
      .replace(/测试原数据|客观数据|电流配比数据|竞品分析报告|竞品分析|分析报告|报告|数据/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPlausibleModelName(value) {
    const text = cleanModelName(value);
    const compact = text.replace(/\s+/g, "");
    if (!compact || compact.length > 42 || /^[\d.%/]+$/.test(compact)) {
      return false;
    }
    if (/亮度|功率|窗口|测试|Window|https|颜色|红色|绿色|蓝色|品红|黄色|青色|白色|标准|模式|No\./i.test(text)) {
      return false;
    }
    return /(?:TCL|海信|创维|Hisense|Skyworth)/i.test(text) || /\d{2,3}[A-Za-z][A-Za-z0-9-]*/.test(compact);
  }

  function normalizeModelKey(value) {
    return cleanModelName(value).replace(/\s+/g, "").toUpperCase();
  }

  function inferBrand(model) {
    const text = String(model || "");
    if (/TCL/i.test(text)) {
      return "TCL";
    }
    if (text.includes("海信") || /Hisense/i.test(text)) {
      return "海信";
    }
    if (text.includes("创维") || /Skyworth/i.test(text)) {
      return "创维";
    }
    return "";
  }

  function inferSize(model) {
    const match = String(model || "").match(/(?:^|[^\d])(\d{2,3})(?=[A-Za-z\u4e00-\u9fa5])/);
    const size = match ? Number(match[1]) : NaN;
    return Number.isFinite(size) && size >= 32 && size <= 120 ? size : null;
  }

  function getBrightnessMeta(model) {
    const key = normalizeModelKey(model);
    const direct = brightnessModelMeta[model] || brightnessModelMeta[key];
    if (direct) {
      return direct;
    }
    const matchedKey = Object.keys(brightnessModelMeta).find((item) => normalizeModelKey(item) === key);
    return matchedKey ? brightnessModelMeta[matchedKey] : {};
  }

  function getBrightnessMetricKeyFromLabel(label) {
    const text = String(label || "").toLowerCase();
    if (text.includes("全白场")) {
      return "fullWhite";
    }
    if (text.includes("黑场亮度") || text.includes("黑位")) {
      return "blackLevel";
    }
    if (text.includes("瞬态峰值")) {
      return "transientPeak";
    }
    if (text.includes("real scene")) {
      return "realScene";
    }
    return "";
  }

  function findNumericCell(cells) {
    for (const cell of cells) {
      const value = parseNumericValue(cell);
      if (Number.isFinite(value)) {
        return value;
      }
    }
    return NaN;
  }

  function parseNumericValue(value) {
    const text = String(value || "").trim();
    const match = text.match(/[0-9]+(?:\.[0-9]+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function extractAplRows(rows) {
    return rows
      .map((row) => {
        const numbers = row.map(parseNumericValue);
        const windowSize = numbers.find((value) => Number.isFinite(value) && value > 0 && value <= 1);
        const brightness = numbers.find((value, index) => index > 0 && Number.isFinite(value) && value > 20);
        return Number.isFinite(windowSize) && Number.isFinite(brightness) ? { windowSize, brightness } : null;
      })
      .filter(Boolean);
  }

  function extractLvValues(rows) {
    if (!rows.length) {
      return [];
    }
    const header = rows[0].map((cell) => String(cell || "").toLowerCase());
    const lvIndex = header.findIndex((cell) => cell.includes("lv") || cell.includes("cd/m"));
    if (lvIndex < 0) {
      return [];
    }
    return rows
      .slice(1)
      .map((row) => parseNumericValue(row[lvIndex]))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  function mergeBrightnessMetrics(existing, incoming) {
    const merged = { ...existing };
    brightnessMetrics.forEach((metric) => {
      const current = merged[metric.key];
      const next = incoming[metric.key];
      if (!next || !Number.isFinite(next.value)) {
        return;
      }
      if (!current || !Number.isFinite(current.value)) {
        merged[metric.key] = next;
        return;
      }
      if (metric.direction === "lower") {
        merged[metric.key] = next.value < current.value ? next : current;
      } else {
        merged[metric.key] = next.value > current.value ? next : current;
      }
    });
    return merged;
  }

  function hasBrightnessMetric(metrics) {
    return brightnessMetrics.some((metric) => metrics[metric.key] && Number.isFinite(metrics[metric.key].value));
  }

  function filterBrightnessRecords(records) {
    const size = els.brightnessSizeFilter ? els.brightnessSizeFilter.value : "";
    const price = els.brightnessPriceFilter ? els.brightnessPriceFilter.value : "";
    const query = els.searchInput ? els.searchInput.value.trim().toLowerCase() : "";
    return records.filter((record) => {
      return (!size || String(record.size) === String(size)) && matchesBrightnessPrice(record, price) && matchesObjectiveQuery(record, query);
    });
  }

  function matchesObjectiveQuery(record, query) {
    if (!query) {
      return true;
    }
    return [record.brand, record.model, record.size, record.source]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function matchesBrightnessPrice(record, rangeKey) {
    if (!rangeKey) {
      return true;
    }
    if (rangeKey === "unknown") {
      return !Number.isFinite(Number(record.price));
    }
    const range = brightnessPriceRanges.find((item) => item.key === rangeKey);
    const price = Number(record.price);
    return range && Number.isFinite(price) && price >= range.min && price <= range.max;
  }

  function pruneBrightnessSelection(records) {
    const allowed = new Set(records.map((record) => record.key));
    Array.from(state.brightnessSelectedKeys).forEach((key) => {
      if (!allowed.has(key)) {
        state.brightnessSelectedKeys.delete(key);
      }
    });
  }

  function getBrightnessCompareRecords(records) {
    const selected = records.filter((record) => state.brightnessSelectedKeys.has(record.key));
    if (selected.length) {
      return selected;
    }
    return records
      .slice()
      .sort((a, b) => getBrightnessPrimaryValue(b) - getBrightnessPrimaryValue(a))
      .slice(0, 5);
  }

  function getBrightnessPrimaryValue(record) {
    const active = state.activeBrightnessMetric;
    if (active && active !== "all") {
      return Number(record.metrics[active] && record.metrics[active].value) || 0;
    }
    return Number(record.metrics.transientPeak && record.metrics.transientPeak.value) || Number(record.metrics.realScene && record.metrics.realScene.value) || 0;
  }

  function renderBrightnessModelOptions(records) {
    const selectedCount = state.brightnessSelectedKeys.size;
    if (els.brightnessSelectionHint) {
      els.brightnessSelectionHint.textContent = selectedCount ? `已选择 ${selectedCount} 个机型` : `默认展示前 ${Math.min(5, records.length)} 个机型`;
    }
    if (!records.length) {
      els.brightnessModelOptions.innerHTML = `<p class="empty-copy">没有匹配的亮度数据。</p>`;
      return;
    }
    els.brightnessModelOptions.innerHTML = records
      .map((record) => {
        const checked = state.brightnessSelectedKeys.has(record.key);
        return `
          <label class="brightness-model-option">
            <input type="checkbox" value="${escapeAttr(record.key)}" ${checked ? "checked" : ""} />
            <span>
              <strong>${escapeHtml(record.model)}</strong>
              <em>${escapeHtml(formatBrightnessMeta(record))}</em>
            </span>
          </label>
        `;
      })
      .join("");
    els.brightnessModelOptions.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) {
          state.brightnessSelectedKeys.add(input.value);
        } else {
          state.brightnessSelectedKeys.delete(input.value);
        }
        renderBrightnessAnalysis();
      });
    });
  }

  function renderBrightnessMetricCards(records) {
    if (!els.brightnessMetricCards) {
      return;
    }
    els.brightnessMetricCards.innerHTML = brightnessMetrics
      .map((metric) => {
        const best = getBestBrightnessRecord(records, metric);
        const value = best ? best.metrics[metric.key].value : NaN;
        return `
          <div class="brightness-metric-card">
            <span>${escapeHtml(metric.label)}</span>
            <strong>${formatBrightnessValue(value, metric)}</strong>
            <em>${best ? escapeHtml(best.model) : "无数据"}</em>
          </div>
        `;
      })
      .join("");
  }

  function getBestBrightnessRecord(records, metric) {
    return records
      .filter((record) => record.metrics[metric.key] && Number.isFinite(record.metrics[metric.key].value))
      .sort((a, b) => {
        const av = a.metrics[metric.key].value;
        const bv = b.metrics[metric.key].value;
        return metric.direction === "lower" ? av - bv : bv - av;
      })[0];
  }

  function renderBrightnessTable(records) {
    if (!records.length) {
      els.brightnessTableBody.innerHTML = `<tr><td colspan="8"><p class="empty-copy">没有匹配的亮度数据。</p></td></tr>`;
      return;
    }
    els.brightnessTableBody.innerHTML = records
      .map((record) => `
        <tr>
          <td>
            <div class="tv-cell">
              <strong>${escapeHtml(record.model)}</strong>
              <span>${escapeHtml(record.brand || "品牌待补充")}</span>
            </div>
          </td>
          <td>${record.size ? `${record.size} 英寸` : "-"}</td>
          <td>${escapeHtml(formatPriceRange(record))}</td>
          ${brightnessMetrics.map((metric) => `<td>${formatBrightnessValue(record.metrics[metric.key] && record.metrics[metric.key].value, metric)}</td>`).join("")}
          <td>${escapeHtml(formatBrightnessSources(record))}</td>
        </tr>
      `)
      .join("");
  }

  function drawBrightnessChart(canvas, records, metricKey) {
    const colors = getChartColors();
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width || 760;
    const height =
      metricKey === "all"
        ? Math.max(560, 120 + records.length * 96)
        : metricKey === "blackLevel"
          ? Math.max(440, 104 + records.length * 62)
          : Math.max(380, 92 + records.length * 48);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colors.ink;
    ctx.font = "700 16px Segoe UI, Microsoft YaHei, Arial";
    const title = metricKey === "all" ? "亮度指标对比" : `${getBrightnessMetric(metricKey).label} 对比`;
    ctx.fillText(title, 18, 26);

    if (!records.length) {
      ctx.fillStyle = colors.muted;
      ctx.font = "13px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText("没有可绘制的数据。", 18, 70);
      return;
    }

    if (metricKey === "all") {
      drawGroupedBrightnessChart(ctx, colors, records, width, height);
    } else {
      const metric = getBrightnessMetric(metricKey);
      const rows = records.map((record) => ({
        label: record.model,
        value: record.metrics[metric.key] ? record.metrics[metric.key].value : 0
      }));
      drawSingleBrightnessChart(ctx, colors, rows, metric, width, height);
    }
  }

  function drawGroupedBrightnessChart(ctx, colors, records, width, height) {
    const chartTop = 72;
    const chartLeft = 142;
    const chartRight = 22;
    const valueColumnWidth = 112;
    const groupHeight = Math.max(92, (height - chartTop - 36) / records.length);
    const barHeight = 12;
    const maxNit = Math.max(
      ...records.flatMap((record) => ["fullWhite", "transientPeak", "realScene"].map((key) => Number(record.metrics[key] && record.metrics[key].value) || 0)),
      1
    );
    const blackValues = records.map((record) => Number(record.metrics.blackLevel && record.metrics.blackLevel.value)).filter((value) => Number.isFinite(value) && value > 0);
    const blackMax = Math.max(...blackValues, 0.001);
    const blackMin = Math.min(...blackValues, blackMax);
    const barMax = Math.max(width - chartLeft - chartRight - valueColumnWidth, 120);
    records.forEach((record, recordIndex) => {
      const baseY = chartTop + recordIndex * groupHeight;
      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(record.model, 16), 18, baseY + 18);
      ["fullWhite", "transientPeak", "realScene"].forEach((key, metricIndex) => {
        const metric = getBrightnessMetric(key);
        const value = Number(record.metrics[key] && record.metrics[key].value) || 0;
        const y = baseY + metricIndex * 22 + 6;
        const barWidth = value ? Math.max(4, (value / maxNit) * barMax) : 0;
        ctx.fillStyle = colors.track;
        roundRect(ctx, chartLeft, y, barMax, barHeight, 6);
        ctx.fill();
        if (barWidth) {
          ctx.fillStyle = colors.palette[metricIndex % colors.palette.length];
          roundRect(ctx, chartLeft, y, barWidth, barHeight, 6);
          ctx.fill();
        }
        ctx.fillStyle = colors.ink;
        ctx.font = "700 11px Segoe UI, Microsoft YaHei, Arial";
        ctx.fillText(metric.shortLabel, chartLeft + 8, y + 10);
        ctx.fillText(value ? formatNumber(value, metric.precision) : "-", chartLeft + barMax + 12, y + 10);
      });
      const blackValue = record.metrics.blackLevel && Number(record.metrics.blackLevel.value);
      const blackY = baseY + 78;
      const blackWidth = Number.isFinite(blackValue) && blackValue > 0 ? barMax * getLowerIsBetterLogScore(blackValue, blackMin, blackMax) : 0;
      ctx.fillStyle = colors.track;
      roundRect(ctx, chartLeft, blackY - 10, barMax, 12, 6);
      ctx.fill();
      if (blackWidth) {
        ctx.fillStyle = "#334155";
        roundRect(ctx, chartLeft, blackY - 10, Math.max(8, blackWidth), 12, 6);
        ctx.fill();
      }
      ctx.fillStyle = colors.ink;
      ctx.font = "700 11px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText("黑场", chartLeft + 8, blackY);
      ctx.fillText(Number.isFinite(blackValue) ? `${formatNumber(blackValue, 4)} nit` : "-", chartLeft + barMax + 12, blackY);
    });
  }

  function drawSingleBrightnessChart(ctx, colors, rows, metric, width, height) {
    if (metric.key === "blackLevel") {
      drawBlackLevelChart(ctx, colors, rows, metric, width, height);
      return;
    }
    const chartTop = 54;
    const chartLeft = 170;
    const chartRight = 24;
    const rowHeight = Math.min(44, Math.max(30, (height - chartTop - 24) / rows.length));
    const values = rows.map((row) => Number(row.value) || 0);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values.filter((value) => value > 0), maxValue);
    const barMax = Math.max(width - chartLeft - chartRight, 100);
    rows.forEach((row, index) => {
      const y = chartTop + index * rowHeight;
      const value = Number(row.value) || 0;
      const normalized = metric.direction === "lower" && value > 0 ? minValue / value : value / maxValue;
      const barWidth = value ? Math.max(4, barMax * clamp(normalized, 0.04, 1)) : 0;
      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(row.label, 20), 18, y + 20);
      ctx.fillStyle = colors.track;
      roundRect(ctx, chartLeft, y + 6, barMax, 18, 8);
      ctx.fill();
      if (barWidth) {
        ctx.fillStyle = colors.palette[index % colors.palette.length];
        roundRect(ctx, chartLeft, y + 6, barWidth, 18, 8);
        ctx.fill();
      }
      ctx.fillStyle = colors.ink;
      ctx.font = "700 12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(formatBrightnessValue(value, metric), chartLeft + Math.min(barWidth + 8, barMax - 82), y + 20);
    });
  }

  function drawBlackLevelChart(ctx, colors, rows, metric, width, height) {
    const chartTop = 70;
    const chartLeft = 170;
    const valueColumnWidth = 116;
    const chartRight = 20;
    const rowHeight = Math.max(56, (height - chartTop - 34) / rows.length);
    const values = rows.map((row) => Number(row.value)).filter((value) => Number.isFinite(value) && value > 0);
    const maxValue = Math.max(...values, 0.001);
    const minValue = Math.min(...values, maxValue);
    const barMax = Math.max(width - chartLeft - chartRight - valueColumnWidth, 110);

    ctx.fillStyle = colors.muted;
    ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
    ctx.fillText("黑场亮度数值越低越好，条形长度表示相对优势", chartLeft, 52);

    rows.forEach((row, index) => {
      const y = chartTop + index * rowHeight;
      const value = Number(row.value);
      const scoreWidth = Number.isFinite(value) && value > 0 ? barMax * getLowerIsBetterLogScore(value, minValue, maxValue) : 0;

      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(row.label, 20), 18, y + 20);

      ctx.fillStyle = colors.track;
      roundRect(ctx, chartLeft, y + 6, barMax, 18, 8);
      ctx.fill();

      if (scoreWidth) {
        ctx.fillStyle = "#334155";
        roundRect(ctx, chartLeft, y + 6, Math.max(8, scoreWidth), 18, 8);
        ctx.fill();
      }

      ctx.fillStyle = colors.ink;
      ctx.font = "700 12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(Number.isFinite(value) && value > 0 ? formatBrightnessValue(value, metric) : "-", chartLeft + barMax + 12, y + 20);
    });
  }

  function getLowerIsBetterLogScore(value, minValue, maxValue) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue <= minValue) {
      return 1;
    }
    const minLog = Math.log10(minValue);
    const maxLog = Math.log10(maxValue);
    const valueLog = Math.log10(value);
    return clamp(1 - (valueLog - minLog) / (maxLog - minLog), 0.12, 1);
  }

  function getBrightnessMetric(key) {
    return brightnessMetrics.find((metric) => metric.key === key) || brightnessMetrics[0];
  }

  function formatBrightnessValue(value, metric) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return "-";
    }
    return `${formatNumber(number, metric.precision)} ${metric.unit}`;
  }

  function formatAplLabel(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "未知";
    }
    return `${formatNumber(number * 100, number * 100 % 1 === 0 ? 0 : 1)}%`;
  }

  function formatBrightnessMeta(record) {
    const size = record.size ? `${record.size} 英寸` : "尺寸待补充";
    return `${size} · ${formatPriceRange(record)}`;
  }

  function formatPriceRange(record) {
    const price = Number(record.price);
    if (!Number.isFinite(price)) {
      return "未标价";
    }
    const range = brightnessPriceRanges.find((item) => item.key && item.key !== "unknown" && price >= item.min && price <= item.max);
    return range ? range.label : `${formatNumber(price, 0)} 元`;
  }

  function formatBrightnessSources(record) {
    const names = Array.from(new Set((record.sources || []).map((file) => file.name))).slice(0, 2);
    const suffix = record.sources && record.sources.length > 2 ? ` 等 ${record.sources.length} 个` : "";
    return names.length ? names.join("、") + suffix : "-";
  }

  function renderColorFilterOptions() {
    if (!els.colorSizeFilter || !els.colorPriceFilter) {
      return;
    }
    const records = getColorRecords();
    const currentSize = els.colorSizeFilter.value;
    const currentPrice = els.colorPriceFilter.value;
    const sizes = Array.from(new Set(records.map((record) => record.size).filter(Boolean))).sort((a, b) => a - b);
    els.colorSizeFilter.innerHTML = [`<option value="">全部尺寸</option>`]
      .concat(sizes.map((size) => `<option value="${size}">${size} 英寸</option>`))
      .join("");
    els.colorSizeFilter.value = sizes.map(String).includes(String(currentSize)) ? String(currentSize) : "";
    els.colorPriceFilter.innerHTML = brightnessPriceRanges
      .map((range) => `<option value="${escapeAttr(range.key)}">${escapeHtml(range.label)}</option>`)
      .join("");
    els.colorPriceFilter.value = brightnessPriceRanges.some((range) => range.key === currentPrice) ? currentPrice : "";
  }

  function renderColorAnalysis() {
    if (!els.colorAnalysisPanel || !els.colorModelOptions || !els.colorChart || !els.colorTableBody) {
      return;
    }

    const allRecords = getColorRecords();
    const filtered = filterColorRecords(allRecords);
    pruneColorSelection(filtered);
    const compareRecords = getColorCompareRecords(filtered);

    els.colorAnalysisPanel.hidden = state.activeAnalysisModule !== "color";
    els.colorMetricTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.colorMetric === state.activeColorMetric);
    });
    renderColorModelOptions(filtered);
    renderColorMetricCards(compareRecords);
    drawColorChart(els.colorChart, compareRecords, state.activeColorMetric);
    renderColorTable(filtered);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function getColorRecords() {
    const colorMetricMap = new Map();

    (state.dataset.tests || []).forEach((record) => {
      const parsed = parseColorDatasetRecord(record);
      if (parsed) {
        mergeColorRecord(colorMetricMap, parsed);
      }
    });

    getVisibleRawFiles()
      .filter((file) => file.kind !== "document")
      .forEach((file) => {
        const parsed = parseColorFile(file);
        if (parsed) {
          mergeColorRecord(colorMetricMap, parsed);
        }
      });

    const brightnessRecords = getBrightnessRecords();
    if (!brightnessRecords.length) {
      return Array.from(colorMetricMap.values()).sort((a, b) => {
        const sizeDiff = (a.size || 0) - (b.size || 0);
        return sizeDiff || a.model.localeCompare(b.model, "zh-CN");
      });
    }

    return brightnessRecords.map((brightnessRecord) => {
      const colorRecord = colorMetricMap.get(brightnessRecord.key);
      return {
        key: brightnessRecord.key,
        model: brightnessRecord.model,
        brand: brightnessRecord.brand,
        size: brightnessRecord.size,
        price: brightnessRecord.price,
        priceNote: brightnessRecord.priceNote,
        metrics: colorRecord ? colorRecord.metrics : {},
        sources: colorRecord ? colorRecord.sources : brightnessRecord.sources
      };
    });
  }

  function parseColorDatasetRecord(record) {
    const model = `${record.brand || ""} ${record.model || ""}`.trim();
    if (!model) {
      return null;
    }

    const metrics = {};
    const gamut = getFirstRecordMetric(record, ["colorGamutP3", "colorGamut", "dciP3Coverage", "p3Coverage"]);
    const accuracy = getFirstRecordMetric(record, ["colorCheckerDeltaE", "colorAccuracy", "grayDeltaE"]);
    const temperature = getFirstRecordMetric(record, ["colorTemperature", "whitePointCct", "cct"]);

    if (gamut) {
      metrics.colorGamut = { value: gamut.value, unit: gamut.unit || "%", source: gamut.label || "标准化指标" };
    }
    if (accuracy) {
      metrics.colorAccuracy = { value: accuracy.value, unit: accuracy.unit || "dE", source: accuracy.label || "标准化指标" };
    }
    if (temperature) {
      metrics.colorTemperature = { value: temperature.value, unit: temperature.unit || "K", source: temperature.label || "标准化指标" };
    }

    if (!hasColorMetric(metrics)) {
      return null;
    }

    return {
      model,
      brand: record.brand || inferBrand(model),
      size: Number(record.size) || inferSize(model),
      price: Number(record.price),
      metrics,
      sources: [{ name: record.source || "标准化测试记录" }]
    };
  }

  function parseColorFile(file) {
    const rows = Array.isArray(file.preview) ? file.preview : [];
    const flatCells = rows.flat().map((cell) => String(cell || "").trim()).filter(Boolean);
    const searchText = String(file.searchText || "");
    const model = extractModelName(file, flatCells, searchText);
    if (!model) {
      return null;
    }

    const metrics = {};
    const textMetricMap = [
      { key: "colorGamut", unit: "%", source: "文本提取", pattern: /(?:DCI[-\s]?P3|P3|色域|覆盖率|覆盖)[^0-9]{0,16}([0-9]{2,3}(?:\.[0-9]+)?)\s*%/i },
      { key: "colorAccuracy", unit: "dE", source: "文本提取", pattern: /(?:ColorChecker|色准|Delta\s*E|DeltaE|ΔE)[^0-9]{0,16}([0-9]+(?:\.[0-9]+)?)/i },
      { key: "colorTemperature", unit: "K", source: "文本提取", pattern: /(?:色温|CCT|白点色温)[^0-9]{0,16}([0-9]{4,5})\s*K?/i }
    ];
    textMetricMap.forEach((item) => {
      const match = searchText.match(item.pattern);
      const value = match ? Number(match[1]) : NaN;
      if (Number.isFinite(value)) {
        metrics[item.key] = { value, unit: item.unit, source: item.source };
      }
    });

    const points = extractColorXyPoints(rows, searchText);
    if (points.white && !metrics.colorTemperature) {
      const cct = estimateCctFromXy(points.white.x, points.white.y);
      if (Number.isFinite(cct)) {
        metrics.colorTemperature = { value: cct, unit: "K", source: "白点 xy 估算" };
      }
    }
    if (points.red && points.green && points.blue && !metrics.colorGamut) {
      const gamut = estimateP3GamutFromRgb(points.red, points.green, points.blue);
      if (Number.isFinite(gamut)) {
        metrics.colorGamut = { value: gamut, unit: "%", source: "RGB xy 估算" };
      }
    }

    if (!hasColorMetric(metrics)) {
      return null;
    }

    return {
      model,
      brand: inferBrand(model),
      size: inferSize(model),
      metrics,
      sources: [file]
    };
  }

  function getFirstRecordMetric(record, keys) {
    for (const key of keys) {
      const item = record.metrics && record.metrics[key];
      const value = item ? Number(item.value) : NaN;
      if (Number.isFinite(value) && value > 0) {
        const metricDef = getMetricDef(key);
        return {
          value,
          unit: item.unit || metricDef.unit,
          label: metricDef.label
        };
      }
    }
    return null;
  }

  function mergeColorRecord(map, parsed) {
    const key = normalizeModelKey(parsed.model);
    const existing = map.get(key) || {
      key,
      model: parsed.model,
      brand: parsed.brand || inferBrand(parsed.model),
      size: parsed.size || inferSize(parsed.model),
      metrics: {},
      sources: []
    };
    existing.brand = existing.brand || parsed.brand;
    existing.size = existing.size || parsed.size;
    existing.price = Number.isFinite(Number(existing.price)) ? existing.price : parsed.price;
    existing.priceNote = existing.priceNote || parsed.priceNote;
    existing.metrics = mergeColorMetrics(existing.metrics, parsed.metrics);
    existing.sources.push(...(parsed.sources || []));
    map.set(key, existing);
  }

  function mergeColorMetrics(existing, incoming) {
    const merged = { ...existing };
    colorMetrics.forEach((metric) => {
      const current = merged[metric.key];
      const next = incoming[metric.key];
      if (!next || !Number.isFinite(next.value)) {
        return;
      }
      if (!current || !Number.isFinite(current.value)) {
        merged[metric.key] = next;
        return;
      }
      if (metric.direction === "lower") {
        merged[metric.key] = next.value < current.value ? next : current;
        return;
      }
      if (metric.direction === "target") {
        merged[metric.key] = Math.abs(next.value - metric.target) < Math.abs(current.value - metric.target) ? next : current;
        return;
      }
      merged[metric.key] = next.value > current.value ? next : current;
    });
    return merged;
  }

  function hasColorMetric(metrics) {
    return colorMetrics.some((metric) => metrics[metric.key] && Number.isFinite(metrics[metric.key].value));
  }

  function filterColorRecords(records) {
    const size = els.colorSizeFilter ? els.colorSizeFilter.value : "";
    const price = els.colorPriceFilter ? els.colorPriceFilter.value : "";
    const query = els.colorSearchInput ? els.colorSearchInput.value.trim().toLowerCase() : "";
    return records.filter((record) => {
      return (!size || String(record.size) === String(size)) && matchesBrightnessPrice(record, price) && matchesObjectiveQuery(record, query);
    });
  }

  function pruneColorSelection(records) {
    const allowed = new Set(records.map((record) => record.key));
    Array.from(state.colorSelectedKeys).forEach((key) => {
      if (!allowed.has(key)) {
        state.colorSelectedKeys.delete(key);
      }
    });
  }

  function getColorCompareRecords(records) {
    const selected = records.filter((record) => state.colorSelectedKeys.has(record.key));
    if (selected.length) {
      return selected;
    }
    return records
      .slice()
      .sort((a, b) => getColorRecordSortValue(b, state.activeColorMetric) - getColorRecordSortValue(a, state.activeColorMetric))
      .slice(0, 5);
  }

  function getColorRecordSortValue(record, metricKey) {
    if (!metricKey || metricKey === "all") {
      const values = colorMetrics
        .map((metric) => getColorRecordSortValue(record, metric.key))
        .filter((value) => Number.isFinite(value) && value > 0);
      return values.length ? avg(values) : 0;
    }
    const metric = getColorMetric(metricKey);
    const item = record.metrics[metric.key];
    if (!item || !Number.isFinite(item.value)) {
      return 0;
    }
    if (metric.direction === "lower") {
      const unit = item.unit || metric.unit;
      const scale = unit === "xyΔ" ? 0.08 : 5;
      return clamp(100 - (item.value / scale) * 100, 0, 100);
    }
    if (metric.direction === "target") {
      return clamp(100 - (Math.abs(item.value - metric.target) / 3500) * 100, 0, 100);
    }
    return clamp((item.value / 100) * 100, 0, 100);
  }

  function renderColorModelOptions(records) {
    const selectedCount = state.colorSelectedKeys.size;
    if (els.colorSelectionHint) {
      els.colorSelectionHint.textContent = selectedCount ? `已选择 ${selectedCount} 个机型` : `默认展示前 ${Math.min(5, records.length)} 个机型`;
    }
    if (!records.length) {
      els.colorModelOptions.innerHTML = `<p class="empty-copy">没有匹配的颜色数据。</p>`;
      return;
    }
    els.colorModelOptions.innerHTML = records
      .map((record) => {
        const checked = state.colorSelectedKeys.has(record.key);
        return `
          <label class="brightness-model-option">
            <input type="checkbox" value="${escapeAttr(record.key)}" ${checked ? "checked" : ""} />
            <span>
              <strong>${escapeHtml(record.model)}</strong>
              <em>${escapeHtml(formatColorMeta(record))}</em>
            </span>
          </label>
        `;
      })
      .join("");
    els.colorModelOptions.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) {
          state.colorSelectedKeys.add(input.value);
        } else {
          state.colorSelectedKeys.delete(input.value);
        }
        renderColorAnalysis();
      });
    });
  }

  function renderColorMetricCards(records) {
    if (!els.colorMetricCards) {
      return;
    }
    els.colorMetricCards.innerHTML = colorMetrics
      .map((metric) => {
        const best = getBestColorRecord(records, metric);
        const item = best ? best.metrics[metric.key] : null;
        return `
          <div class="brightness-metric-card">
            <span>${escapeHtml(metric.label)}</span>
            <strong>${formatColorValue(item, metric)}</strong>
            <em>${best ? escapeHtml(best.model) : "无数据"}</em>
          </div>
        `;
      })
      .join("");
  }

  function getBestColorRecord(records, metric) {
    return records
      .filter((record) => record.metrics[metric.key] && Number.isFinite(record.metrics[metric.key].value))
      .sort((a, b) => {
        const av = a.metrics[metric.key].value;
        const bv = b.metrics[metric.key].value;
        if (metric.direction === "lower") {
          return av - bv;
        }
        if (metric.direction === "target") {
          return Math.abs(av - metric.target) - Math.abs(bv - metric.target);
        }
        return bv - av;
      })[0];
  }

  function renderColorTable(records) {
    if (!records.length) {
      els.colorTableBody.innerHTML = `<tr><td colspan="6"><p class="empty-copy">没有匹配的颜色数据。</p></td></tr>`;
      return;
    }
    els.colorTableBody.innerHTML = records
      .map((record) => `
        <tr>
          <td>
            <div class="tv-cell">
              <strong>${escapeHtml(record.model)}</strong>
              <span>${escapeHtml(record.brand || "品牌待补充")}</span>
            </div>
          </td>
          <td>${record.size ? `${record.size} 英寸` : "-"}</td>
          ${colorMetrics.map((metric) => `<td>${formatColorValue(record.metrics[metric.key], metric)}</td>`).join("")}
          <td>${escapeHtml(formatColorSources(record))}</td>
        </tr>
      `)
      .join("");
  }

  function drawColorChart(canvas, records, metricKey) {
    const colors = getChartColors();
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width || 760;
    const height = metricKey === "all" ? Math.max(420, 102 + records.length * 78) : Math.max(360, 92 + records.length * 48);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colors.ink;
    ctx.font = "700 16px Segoe UI, Microsoft YaHei, Arial";
    const title = metricKey === "all" ? "颜色指标对比" : `${getColorMetric(metricKey).label} 对比`;
    ctx.fillText(title, 18, 26);

    if (!records.length) {
      ctx.fillStyle = colors.muted;
      ctx.font = "13px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText("没有可绘制的数据。", 18, 70);
      return;
    }

    if (metricKey === "all") {
      drawGroupedColorChart(ctx, colors, records, width, height);
      return;
    }

    const metric = getColorMetric(metricKey);
    const stats = buildColorMetricStats(records)[metric.key];
    const rows = records.map((record) => ({
      label: record.model,
      item: record.metrics[metric.key],
      score: getColorChartScore(record.metrics[metric.key], metric, stats)
    }));
    drawSingleColorChart(ctx, colors, rows, metric, width, height);
  }

  function drawGroupedColorChart(ctx, colors, records, width, height) {
    const chartTop = 66;
    const chartLeft = 142;
    const chartRight = 22;
    const valueColumnWidth = 112;
    const groupHeight = Math.max(72, (height - chartTop - 34) / records.length);
    const barHeight = 12;
    const barMax = Math.max(width - chartLeft - chartRight - valueColumnWidth, 120);
    const stats = buildColorMetricStats(records);

    records.forEach((record, recordIndex) => {
      const baseY = chartTop + recordIndex * groupHeight;
      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(record.model, 16), 18, baseY + 18);

      colorMetrics.forEach((metric, metricIndex) => {
        const item = record.metrics[metric.key];
        const score = getColorChartScore(item, metric, stats[metric.key]);
        const y = baseY + metricIndex * 21 + 6;
        const barWidth = score ? Math.max(4, score * barMax) : 0;
        ctx.fillStyle = colors.track;
        roundRect(ctx, chartLeft, y, barMax, barHeight, 6);
        ctx.fill();
        if (barWidth) {
          ctx.fillStyle = colors.palette[(metricIndex + 4) % colors.palette.length];
          roundRect(ctx, chartLeft, y, barWidth, barHeight, 6);
          ctx.fill();
        }
        ctx.fillStyle = colors.ink;
        ctx.font = "700 11px Segoe UI, Microsoft YaHei, Arial";
        ctx.fillText(metric.shortLabel, chartLeft + 8, y + 10);
        ctx.fillText(formatColorValue(item, metric), chartLeft + barMax + 12, y + 10);
      });
    });
  }

  function drawSingleColorChart(ctx, colors, rows, metric, width, height) {
    const chartTop = 54;
    const chartLeft = 170;
    const chartRight = 24;
    const rowHeight = Math.min(44, Math.max(30, (height - chartTop - 24) / rows.length));
    const barMax = Math.max(width - chartLeft - chartRight, 100);
    rows.forEach((row, index) => {
      const y = chartTop + index * rowHeight;
      const barWidth = row.score ? Math.max(4, barMax * row.score) : 0;
      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(row.label, 20), 18, y + 20);
      ctx.fillStyle = colors.track;
      roundRect(ctx, chartLeft, y + 6, barMax, 18, 8);
      ctx.fill();
      if (barWidth) {
        ctx.fillStyle = colors.palette[(index + 4) % colors.palette.length];
        roundRect(ctx, chartLeft, y + 6, barWidth, 18, 8);
        ctx.fill();
      }
      ctx.fillStyle = colors.ink;
      ctx.font = "700 12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(formatColorValue(row.item, metric), chartLeft + Math.min(barWidth + 8, barMax - 92), y + 20);
    });
  }

  function buildColorMetricStats(records) {
    const stats = {};
    colorMetrics.forEach((metric) => {
      const values = records
        .map((record) => record.metrics[metric.key] && Number(record.metrics[metric.key].value))
        .filter((value) => Number.isFinite(value) && value > 0);
      stats[metric.key] = {
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 0
      };
    });
    return stats;
  }

  function getColorChartScore(item, metric, stats) {
    const value = item && Number(item.value);
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }
    if (metric.direction === "target") {
      return clamp(1 - Math.abs(value - metric.target) / 3500, 0.04, 1);
    }
    if (metric.direction === "lower") {
      if (!stats || stats.max <= stats.min) {
        return 1;
      }
      return clamp(1 - (value - stats.min) / (stats.max - stats.min), 0.04, 1);
    }
    const max = metric.unit === "%" ? Math.max(100, stats ? stats.max : 0) : (stats && stats.max) || value;
    return clamp(value / max, 0.04, 1);
  }

  function getColorMetric(key) {
    return colorMetrics.find((metric) => metric.key === key) || colorMetrics[0];
  }

  function formatColorValue(item, metric) {
    if (!item || !Number.isFinite(Number(item.value)) || Number(item.value) <= 0) {
      return "-";
    }
    const unit = item.unit || metric.unit || "";
    const precision = unit === "xyΔ" ? 3 : metric.precision;
    return `${formatNumber(Number(item.value), precision)}${unit ? " " + unit : ""}`;
  }

  function formatColorMeta(record) {
    const size = record.size ? `${record.size} 英寸` : "尺寸待补充";
    return `${size} · ${record.brand || "品牌待补充"}`;
  }

  function formatColorSources(record) {
    const names = Array.from(new Set((record.sources || []).map((file) => file.name))).slice(0, 2);
    const suffix = record.sources && record.sources.length > 2 ? ` 等 ${record.sources.length} 个` : "";
    return names.length ? names.join("、") + suffix : "-";
  }

  function extractColorXyPoints(rows, searchText) {
    const fromText = extractColorXyPointsFromText(searchText);
    if (fromText.white || (fromText.red && fromText.green && fromText.blue)) {
      return fromText;
    }
    return extractColorXyPointsFromRows(rows);
  }

  function extractColorXyPointsFromText(searchText) {
    const text = String(searchText || "").replace(/\s+/g, " ").trim();
    const firstSection = text.split(/\s品红\s/)[0] || text;
    const matches = [];
    const pattern = /100%\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+[0-9]+(?:\.[0-9]+)?/g;
    let match;
    while ((match = pattern.exec(firstSection)) && matches.length < 4) {
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (isValidXyPoint(x, y)) {
        matches.push({ x, y });
      }
    }
    return assignColorPoints(matches);
  }

  function extractColorXyPointsFromRows(rows) {
    const row = (rows || []).find((item) => item.some((cell) => String(cell || "").trim() === "100%"));
    if (!row) {
      return {};
    }
    const matches = [];
    row.forEach((cell, index) => {
      if (String(cell || "").trim() !== "100%") {
        return;
      }
      const x = parseNumericValue(row[index + 1]);
      const y = parseNumericValue(row[index + 2]);
      if (isValidXyPoint(x, y)) {
        matches.push({ x, y });
      }
    });
    return assignColorPoints(matches);
  }

  function assignColorPoints(points) {
    const labels = ["white", "red", "green", "blue"];
    return points.reduce((result, point, index) => {
      if (labels[index]) {
        result[labels[index]] = point;
      }
      return result;
    }, {});
  }

  function isValidXyPoint(x, y) {
    return Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 && x < 1 && y < 1;
  }

  function estimateCctFromXy(x, y) {
    if (!isValidXyPoint(x, y) || y === 0.1858) {
      return NaN;
    }
    const n = (x - 0.332) / (0.1858 - y);
    const cct = -449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) - 6823.3 * n + 5520.33;
    return Number.isFinite(cct) && cct > 1000 && cct < 40000 ? cct : NaN;
  }

  function estimateP3GamutFromRgb(red, green, blue) {
    const p3Red = { x: 0.68, y: 0.32 };
    const p3Green = { x: 0.265, y: 0.69 };
    const p3Blue = { x: 0.15, y: 0.06 };
    const measuredArea = triangleArea(red, green, blue);
    const p3Area = triangleArea(p3Red, p3Green, p3Blue);
    if (!Number.isFinite(measuredArea) || !Number.isFinite(p3Area) || p3Area <= 0) {
      return NaN;
    }
    return clamp((measuredArea / p3Area) * 100, 0, 140);
  }

  function triangleArea(a, b, c) {
    return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
  }

  function renderContrastFilterOptions() {
    if (!els.contrastSizeFilter || !els.contrastPriceFilter) {
      return;
    }
    const records = getContrastRecords();
    const currentSize = els.contrastSizeFilter.value;
    const currentPrice = els.contrastPriceFilter.value;
    const sizes = Array.from(new Set(records.map((record) => record.size).filter(Boolean))).sort((a, b) => a - b);
    els.contrastSizeFilter.innerHTML = [`<option value="">全部尺寸</option>`]
      .concat(sizes.map((size) => `<option value="${size}">${size} 英寸</option>`))
      .join("");
    els.contrastSizeFilter.value = sizes.map(String).includes(String(currentSize)) ? String(currentSize) : "";
    els.contrastPriceFilter.innerHTML = brightnessPriceRanges
      .map((range) => `<option value="${escapeAttr(range.key)}">${escapeHtml(range.label)}</option>`)
      .join("");
    els.contrastPriceFilter.value = brightnessPriceRanges.some((range) => range.key === currentPrice) ? currentPrice : "";
  }

  function renderContrastAnalysis() {
    if (!els.contrastAnalysisPanel || !els.contrastModelOptions || !els.contrastChart || !els.contrastTableBody) {
      return;
    }

    const allRecords = getContrastRecords();
    const filtered = filterContrastRecords(allRecords);
    pruneContrastSelection(filtered);
    const compareRecords = getContrastCompareRecords(filtered);

    els.contrastAnalysisPanel.hidden = state.activeAnalysisModule !== "contrast";
    els.contrastMetricTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.contrastMetric === state.activeContrastMetric);
    });
    renderContrastModelOptions(filtered);
    renderContrastMetricCards(compareRecords);
    drawContrastChart(els.contrastChart, compareRecords, state.activeContrastMetric);
    renderContrastTable(filtered);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function getContrastRecords() {
    const contrastMetricMap = new Map();

    (state.dataset.tests || []).forEach((record) => {
      const parsed = parseContrastDatasetRecord(record);
      if (parsed) {
        mergeContrastRecord(contrastMetricMap, parsed);
      }
    });

    getVisibleRawFiles()
      .filter((file) => file.kind !== "document")
      .forEach((file) => {
        const parsed = parseContrastFile(file);
        if (parsed) {
          mergeContrastRecord(contrastMetricMap, parsed);
        }
      });

    const brightnessRecords = getBrightnessRecords();
    if (!brightnessRecords.length) {
      return Array.from(contrastMetricMap.values()).sort((a, b) => {
        const sizeDiff = (a.size || 0) - (b.size || 0);
        return sizeDiff || a.model.localeCompare(b.model, "zh-CN");
      });
    }

    return brightnessRecords.map((brightnessRecord) => {
      const contrastRecord = contrastMetricMap.get(brightnessRecord.key);
      return {
        key: brightnessRecord.key,
        model: brightnessRecord.model,
        brand: brightnessRecord.brand,
        size: brightnessRecord.size,
        price: brightnessRecord.price,
        priceNote: brightnessRecord.priceNote,
        metrics: contrastRecord ? contrastRecord.metrics : {},
        sources: contrastRecord ? contrastRecord.sources : brightnessRecord.sources
      };
    });
  }

  function parseContrastDatasetRecord(record) {
    const model = `${record.brand || ""} ${record.model || ""}`.trim();
    if (!model) {
      return null;
    }

    const metrics = {};
    const native = getFirstRecordMetric(record, ["nativeContrast", "panelNativeContrast", "screenNativeContrast", "ansiContrast"]);
    const ld = getFirstRecordMetric(record, ["localDimmingContrast", "openLdContrast", "ldContrast", "contrastWithLd"]);

    if (native) {
      metrics.nativeContrast = { value: native.value, unit: native.unit || ":1", source: native.label || "标准化指标" };
    }
    if (ld) {
      metrics.localDimmingContrast = { value: ld.value, unit: ld.unit || ":1", source: ld.label || "标准化指标" };
    }

    if (!hasContrastMetric(metrics)) {
      return null;
    }

    return {
      model,
      brand: record.brand || inferBrand(model),
      size: Number(record.size) || inferSize(model),
      price: Number(record.price),
      metrics,
      sources: [{ name: record.source || "标准化测试记录" }]
    };
  }

  function parseContrastFile(file) {
    const rows = Array.isArray(file.preview) ? file.preview : [];
    const flatCells = rows.flat().map((cell) => String(cell || "").trim()).filter(Boolean);
    const searchText = String(file.searchText || "");
    const model = extractModelName(file, flatCells, searchText);
    if (!model) {
      return null;
    }

    const metrics = {};
    const tableMetrics = extractContrastTableMetrics(rows);
    Object.assign(metrics, tableMetrics);

    const textMetricMap = [
      { key: "nativeContrast", source: "文本提取", pattern: /(?:屏本体对比度|本体对比度|关LD[^0-9]{0,12}对比度|ANSI\s*对比度|对比度\(关LD\)|对比度（关LD）)[^0-9]{0,16}([0-9]+(?:\.[0-9]+)?)/i },
      { key: "localDimmingContrast", source: "文本提取", pattern: /(?:开LD后对比度|开LD[^0-9]{0,12}对比度|Local\s*Dimming[^0-9]{0,12}Contrast|对比度\(开LD\)|对比度（开LD）)[^0-9]{0,16}([0-9]+(?:\.[0-9]+)?)/i }
    ];
    textMetricMap.forEach((item) => {
      if (metrics[item.key] && Number.isFinite(metrics[item.key].value)) {
        return;
      }
      const match = searchText.match(item.pattern);
      const value = match ? Number(match[1]) : NaN;
      if (Number.isFinite(value) && value > 0) {
        metrics[item.key] = { value, unit: ":1", source: item.source };
      }
    });

    if (!metrics.nativeContrast) {
      const parsedBrightness = parseBrightnessFile(file);
      const fullWhite = parsedBrightness && parsedBrightness.metrics.fullWhite && Number(parsedBrightness.metrics.fullWhite.value);
      const blackLevel = parsedBrightness && parsedBrightness.metrics.blackLevel && Number(parsedBrightness.metrics.blackLevel.value);
      if (Number.isFinite(fullWhite) && Number.isFinite(blackLevel) && fullWhite > 0 && blackLevel > 0) {
        metrics.nativeContrast = { value: fullWhite / blackLevel, unit: ":1", source: "全白场 / 关LD黑场推导" };
      }
    }

    if (!hasContrastMetric(metrics)) {
      return null;
    }

    return {
      model,
      brand: inferBrand(model),
      size: inferSize(model),
      metrics,
      sources: [file]
    };
  }

  function extractContrastTableMetrics(rows) {
    const metrics = {};
    const headerIndex = (rows || []).findIndex((row) => row.some((cell) => /开LD|关LD/i.test(String(cell || ""))));
    if (headerIndex < 0) {
      return metrics;
    }

    const header = rows[headerIndex];
    const valueRows = rows
      .slice(headerIndex + 1)
      .map((row) => row.map(parseNumericValue))
      .filter((row) => row.some((value) => Number.isFinite(value) && value >= 100));
    const ratioRow = valueRows[valueRows.length - 1];
    if (!ratioRow) {
      return metrics;
    }

    const openValues = [];
    const closedValues = [];
    header.forEach((cell, index) => {
      const label = String(cell || "");
      const value = Number(ratioRow[index]);
      if (!Number.isFinite(value) || value <= 0) {
        return;
      }
      if (/开LD/i.test(label)) {
        openValues.push(value);
      }
      if (/关LD/i.test(label)) {
        closedValues.push(value);
      }
    });

    if (closedValues.length) {
      metrics.nativeContrast = { value: Math.max(...closedValues), unit: ":1", source: "关LD屏对比度表" };
    }
    if (openValues.length) {
      metrics.localDimmingContrast = { value: Math.max(...openValues), unit: ":1", source: "开LD屏对比度表" };
    }

    return metrics;
  }

  function mergeContrastRecord(map, parsed) {
    const key = normalizeModelKey(parsed.model);
    const existing = map.get(key) || {
      key,
      model: parsed.model,
      brand: parsed.brand || inferBrand(parsed.model),
      size: parsed.size || inferSize(parsed.model),
      metrics: {},
      sources: []
    };
    existing.brand = existing.brand || parsed.brand;
    existing.size = existing.size || parsed.size;
    existing.price = Number.isFinite(Number(existing.price)) ? existing.price : parsed.price;
    existing.priceNote = existing.priceNote || parsed.priceNote;
    existing.metrics = mergeContrastMetrics(existing.metrics, parsed.metrics);
    existing.sources.push(...(parsed.sources || []));
    map.set(key, existing);
  }

  function mergeContrastMetrics(existing, incoming) {
    const merged = { ...existing };
    contrastMetrics.forEach((metric) => {
      const current = merged[metric.key];
      const next = incoming[metric.key];
      if (!next || !Number.isFinite(next.value)) {
        return;
      }
      if (!current || !Number.isFinite(current.value) || next.value > current.value) {
        merged[metric.key] = next;
      }
    });
    return merged;
  }

  function hasContrastMetric(metrics) {
    return contrastMetrics.some((metric) => metrics[metric.key] && Number.isFinite(metrics[metric.key].value));
  }

  function filterContrastRecords(records) {
    const size = els.contrastSizeFilter ? els.contrastSizeFilter.value : "";
    const price = els.contrastPriceFilter ? els.contrastPriceFilter.value : "";
    const query = els.contrastSearchInput ? els.contrastSearchInput.value.trim().toLowerCase() : "";
    return records.filter((record) => {
      return (!size || String(record.size) === String(size)) && matchesBrightnessPrice(record, price) && matchesObjectiveQuery(record, query);
    });
  }

  function pruneContrastSelection(records) {
    const allowed = new Set(records.map((record) => record.key));
    Array.from(state.contrastSelectedKeys).forEach((key) => {
      if (!allowed.has(key)) {
        state.contrastSelectedKeys.delete(key);
      }
    });
  }

  function getContrastCompareRecords(records) {
    const selected = records.filter((record) => state.contrastSelectedKeys.has(record.key));
    if (selected.length) {
      return selected;
    }
    return records
      .slice()
      .sort((a, b) => getContrastRecordSortValue(b, state.activeContrastMetric) - getContrastRecordSortValue(a, state.activeContrastMetric))
      .slice(0, 5);
  }

  function getContrastRecordSortValue(record, metricKey) {
    if (!metricKey || metricKey === "all") {
      const values = contrastMetrics
        .map((metric) => Number(record.metrics[metric.key] && record.metrics[metric.key].value))
        .filter((value) => Number.isFinite(value) && value > 0);
      return values.length ? Math.max(...values) : 0;
    }
    const item = record.metrics[metricKey];
    return item && Number.isFinite(item.value) ? Number(item.value) : 0;
  }

  function renderContrastModelOptions(records) {
    const selectedCount = state.contrastSelectedKeys.size;
    if (els.contrastSelectionHint) {
      els.contrastSelectionHint.textContent = selectedCount ? `已选择 ${selectedCount} 个机型` : `默认展示前 ${Math.min(5, records.length)} 个机型`;
    }
    if (!records.length) {
      els.contrastModelOptions.innerHTML = `<p class="empty-copy">没有匹配的屏对比度数据。</p>`;
      return;
    }
    els.contrastModelOptions.innerHTML = records
      .map((record) => {
        const checked = state.contrastSelectedKeys.has(record.key);
        return `
          <label class="brightness-model-option">
            <input type="checkbox" value="${escapeAttr(record.key)}" ${checked ? "checked" : ""} />
            <span>
              <strong>${escapeHtml(record.model)}</strong>
              <em>${escapeHtml(formatContrastMeta(record))}</em>
            </span>
          </label>
        `;
      })
      .join("");
    els.contrastModelOptions.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) {
          state.contrastSelectedKeys.add(input.value);
        } else {
          state.contrastSelectedKeys.delete(input.value);
        }
        renderContrastAnalysis();
      });
    });
  }

  function renderContrastMetricCards(records) {
    if (!els.contrastMetricCards) {
      return;
    }
    els.contrastMetricCards.innerHTML = contrastMetrics
      .map((metric) => {
        const best = getBestContrastRecord(records, metric);
        const item = best ? best.metrics[metric.key] : null;
        return `
          <div class="brightness-metric-card">
            <span>${escapeHtml(metric.label)}</span>
            <strong>${formatContrastValue(item, metric)}</strong>
            <em>${best ? escapeHtml(best.model) : "无数据"}</em>
          </div>
        `;
      })
      .join("");
  }

  function getBestContrastRecord(records, metric) {
    return records
      .filter((record) => record.metrics[metric.key] && Number.isFinite(record.metrics[metric.key].value))
      .sort((a, b) => b.metrics[metric.key].value - a.metrics[metric.key].value)[0];
  }

  function renderContrastTable(records) {
    if (!records.length) {
      els.contrastTableBody.innerHTML = `<tr><td colspan="5"><p class="empty-copy">没有匹配的屏对比度数据。</p></td></tr>`;
      return;
    }
    els.contrastTableBody.innerHTML = records
      .map((record) => `
        <tr>
          <td>
            <div class="tv-cell">
              <strong>${escapeHtml(record.model)}</strong>
              <span>${escapeHtml(record.brand || "品牌待补充")}</span>
            </div>
          </td>
          <td>${record.size ? `${record.size} 英寸` : "-"}</td>
          ${contrastMetrics.map((metric) => `<td>${formatContrastValue(record.metrics[metric.key], metric)}</td>`).join("")}
          <td>${escapeHtml(formatContrastSources(record))}</td>
        </tr>
      `)
      .join("");
  }

  function drawContrastChart(canvas, records, metricKey) {
    const colors = getChartColors();
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width || 760;
    const height = metricKey === "all" ? Math.max(380, 92 + records.length * 58) : Math.max(360, 92 + records.length * 48);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colors.ink;
    ctx.font = "700 16px Segoe UI, Microsoft YaHei, Arial";
    const title = metricKey === "all" ? "屏对比度指标对比" : `${getContrastMetric(metricKey).label} 对比`;
    ctx.fillText(title, 18, 26);

    if (!records.length) {
      ctx.fillStyle = colors.muted;
      ctx.font = "13px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText("没有可绘制的数据。", 18, 70);
      return;
    }

    const rows = metricKey === "all"
      ? records.flatMap((record) => contrastMetrics.map((metric) => ({ record, metric, item: record.metrics[metric.key] })))
      : records.map((record) => ({ record, metric: getContrastMetric(metricKey), item: record.metrics[metricKey] }));
    drawContrastRows(ctx, colors, rows, width, height, metricKey === "all");
  }

  function drawContrastRows(ctx, colors, rows, width, height, grouped) {
    const chartTop = 54;
    const chartLeft = 174;
    const chartRight = 24;
    const rowHeight = grouped ? 26 : Math.min(44, Math.max(30, (height - chartTop - 24) / rows.length));
    const values = rows.map((row) => Number(row.item && row.item.value)).filter((value) => Number.isFinite(value) && value > 0);
    const maxValue = Math.max(...values, 1);
    const barMax = Math.max(width - chartLeft - chartRight, 100);

    rows.forEach((row, index) => {
      const y = chartTop + index * rowHeight;
      const value = Number(row.item && row.item.value);
      const normalized = Number.isFinite(value) && value > 0 ? value / maxValue : 0;
      const barWidth = normalized ? Math.max(4, barMax * clamp(normalized, 0.04, 1)) : 0;
      const label = grouped ? `${truncate(row.record.model, 13)} · ${row.metric.shortLabel}` : row.record.model;

      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(label, 22), 18, y + 20);
      ctx.fillStyle = colors.track;
      roundRect(ctx, chartLeft, y + 6, barMax, 18, 8);
      ctx.fill();
      if (barWidth) {
        ctx.fillStyle = colors.palette[(index + 2) % colors.palette.length];
        roundRect(ctx, chartLeft, y + 6, barWidth, 18, 8);
        ctx.fill();
      }
      ctx.fillStyle = colors.ink;
      ctx.font = "700 12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(formatContrastValue(row.item, row.metric), chartLeft + Math.min(barWidth + 8, barMax - 88), y + 20);
    });
  }

  function getContrastMetric(key) {
    return contrastMetrics.find((metric) => metric.key === key) || contrastMetrics[0];
  }

  function formatContrastValue(item, metric) {
    if (!item || !Number.isFinite(Number(item.value)) || Number(item.value) <= 0) {
      return "-";
    }
    return `${formatNumber(Number(item.value), metric.precision)}:1`;
  }

  function formatContrastMeta(record) {
    const size = record.size ? `${record.size} 英寸` : "尺寸待补充";
    return `${size} · ${record.brand || "品牌待补充"}`;
  }

  function formatContrastSources(record) {
    const names = Array.from(new Set((record.sources || []).map((file) => file.name))).slice(0, 2);
    const suffix = record.sources && record.sources.length > 2 ? ` 等 ${record.sources.length} 个` : "";
    return names.length ? names.join("、") + suffix : "-";
  }

  function renderHardwareFilterOptions() {
    if (!els.hardwareSizeFilter) {
      return;
    }
    const currentSize = els.hardwareSizeFilter.value;
    const sizes = Array.from(new Set(getHardwareRecords().map((record) => record.size).filter(Boolean))).sort((a, b) => a - b);
    els.hardwareSizeFilter.innerHTML = [`<option value="">全部尺寸</option>`]
      .concat(sizes.map((size) => `<option value="${size}">${size} 英寸</option>`))
      .join("");
    els.hardwareSizeFilter.value = sizes.map(String).includes(String(currentSize)) ? String(currentSize) : "";
  }

  function renderHardwareAnalysis() {
    if (!els.hardwareAnalysisPanel || !els.hardwareMetricCards || !els.hardwareTableBody) {
      return;
    }
    const records = filterHardwareRecords(getHardwareRecords());
    els.hardwareAnalysisPanel.hidden = state.activeAnalysisModule !== "hardware";
    renderHardwareMetricCards(records);
    renderHardwareTable(records);
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function getHardwareRecords() {
    return getVisibleRawFiles()
      .map(parseHardwareFile)
      .filter(Boolean)
      .sort((a, b) => {
        const sizeDiff = (a.size || 0) - (b.size || 0);
        return sizeDiff || a.model.localeCompare(b.model, "zh-CN");
      });
  }

  function parseHardwareFile(file) {
    const searchText = String(file.searchText || "");
    const labelMatches = searchText.match(/LD分区|背光分区|刷新率|芯片信息|芯片型号|画质芯片|屏体信息|屏幕信息|面板信息/gi) || [];
    if (new Set(labelMatches.map((label) => label.toLowerCase())).size < 2) {
      return null;
    }

    const specs = {
      localDimmingZones: extractHardwareSpecValue(searchText, ["LD分区", "背光分区"]),
      refreshRate: extractHardwareSpecValue(searchText, ["刷新率"]),
      chipset: extractHardwareSpecValue(searchText, ["芯片信息", "芯片型号", "画质芯片"]),
      panel: extractHardwareSpecValue(searchText, ["屏体信息", "屏幕信息", "面板信息"])
    };
    if (Object.values(specs).filter(Boolean).length < 2) {
      return null;
    }

    const model = cleanModelName(file.name);
    return {
      key: normalizeModelKey(model),
      model,
      brand: inferBrand(model),
      size: inferSize(model),
      specs,
      source: file
    };
  }

  function extractHardwareSpecValue(text, labels) {
    const labelPattern = labels.join("|");
    const stopPattern = "LD分区|背光分区|刷新率|芯片信息|芯片型号|画质芯片|屏体信息|屏幕信息|面板信息|亮度|对比度|色域|色准|白平衡|客观数据";
    const pattern = new RegExp(`(?:${labelPattern})\\s*[:：]?\\s*([\\s\\S]{0,120}?)(?=\\s*(?:${stopPattern})|$)`, "i");
    const match = String(text || "").match(pattern);
    if (!match) {
      return "";
    }
    const value = match[1]
      .replace(/\s+/g, " ")
      .replace(/^[：:、,，;；\s]+|[：:、,，;；\s]+$/g, "")
      .trim();
    if (!value || /^[-—/]+$/.test(value)) {
      return "";
    }
    return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  }

  function filterHardwareRecords(records) {
    const size = els.hardwareSizeFilter ? els.hardwareSizeFilter.value : "";
    const query = els.hardwareSearchInput ? els.hardwareSearchInput.value.trim().toLowerCase() : "";
    return records.filter((record) => {
      const matchesSize = !size || String(record.size) === String(size);
      const haystack = [record.model, record.brand, record.size, record.source && record.source.name, ...Object.values(record.specs)].join(" ").toLowerCase();
      return matchesSize && (!query || haystack.includes(query));
    });
  }

  function renderHardwareMetricCards(records) {
    const zoneCount = records.filter((record) => record.specs.localDimmingZones).length;
    const panelCount = records.filter((record) => record.specs.panel).length;
    const maxRefresh = getHardwareMaxRefresh(records);
    const cards = [
      { label: "规格记录", value: `${records.length} 份`, note: "匹配当前筛选" },
      { label: "分区资料", value: `${zoneCount} 份`, note: "背光 / LD 分区" },
      { label: "最高刷新率", value: maxRefresh ? `${maxRefresh} Hz` : "-", note: "按报告标称值" },
      { label: "屏体资料", value: `${panelCount} 份`, note: "屏体 / 面板信息" }
    ];
    els.hardwareMetricCards.innerHTML = cards
      .map((card) => `
        <div class="brightness-metric-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <em>${escapeHtml(card.note)}</em>
        </div>
      `)
      .join("");
  }

  function getHardwareMaxRefresh(records) {
    let maximum = 0;
    records.forEach((record) => {
      const pattern = /([0-9]+(?:\.[0-9]+)?)\s*Hz/gi;
      let match = pattern.exec(record.specs.refreshRate || "");
      while (match) {
        maximum = Math.max(maximum, Number(match[1]) || 0);
        match = pattern.exec(record.specs.refreshRate || "");
      }
    });
    return maximum;
  }

  function renderHardwareTable(records) {
    if (!records.length) {
      els.hardwareTableBody.innerHTML = `<tr><td colspan="7"><p class="empty-copy">没有匹配的硬件规格数据。</p></td></tr>`;
      return;
    }
    els.hardwareTableBody.innerHTML = records
      .map((record) => {
        const source = record.source || {};
        const href = encodeFilePath(source.previewPath || source.path || "");
        return `
          <tr>
            <td>
              <div class="tv-cell">
                <strong>${escapeHtml(record.model)}</strong>
                <span>${escapeHtml(record.brand || "品牌待补充")}</span>
              </div>
            </td>
            <td>${record.size ? `${record.size} 英寸` : "-"}</td>
            <td class="hardware-spec-value">${formatHardwareValue(record.specs.localDimmingZones)}</td>
            <td class="hardware-spec-value">${formatHardwareValue(record.specs.refreshRate)}</td>
            <td class="hardware-spec-value">${formatHardwareValue(record.specs.chipset)}</td>
            <td class="hardware-spec-value">${formatHardwareValue(record.specs.panel)}</td>
            <td>${href ? `<a class="raw-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHtml(source.name || "打开来源")}</a>` : "-"}</td>
          </tr>
        `;
      })
      .join("");
  }

  function formatHardwareValue(value) {
    return value ? escapeHtml(value) : "-";
  }

  function computeMachineCount() {
    const machineNames = getVisibleRawFiles()
      .filter((file) => file.kind !== "document")
      .map((file) => normalizeMachineName(file.name))
      .filter(Boolean);
    return new Set(machineNames).size;
  }

  function normalizeMachineName(name) {
    return String(name || "")
      .replace(/\.[^.]+$/g, "")
      .replace(/\s+/g, "")
      .replace(/测试原数据|客观数据|电流配比数据|竞品分析报告|竞品分析|分析报告|报告|数据/gi, "")
      .replace(/[()（）【】\[\]_-]/g, "")
      .trim()
      .toUpperCase();
  }

  function renderReports() {
    renderReportModuleState();
    if (state.activeReportModule === "mapping") {
      renderReportBuilder();
      return;
    }
    const query = (els.reportSearch.value || "").trim().toLowerCase();
    const moduleKey = state.activeReportModule;
    const reports = getVisibleRawFiles()
      .filter((file) => file.kind === "document" || ["doc", "docx", "pdf", "ppt", "pptx", "pptm"].includes(String(file.extension).toLowerCase()))
      .filter((file) => matchesReportModule(file, moduleKey))
      .filter((file) => [file.name, file.extension, file.kind].join(" ").toLowerCase().includes(query));

    if (!reports.length) {
      const config = getReportModuleConfig(moduleKey);
      els.reportsBody.innerHTML = `<tr><td colspan="5"><p class="empty-copy">没有匹配的${config.label}。</p></td></tr>`;
      return;
    }

    els.reportsBody.innerHTML = reports
      .map((file) => {
        const href = encodeFilePath(file.path);
        const openHref = getReportOpenHref(file, href);
        return `
          <tr>
            <td>
              <div class="tv-cell">
                <strong>${escapeHtml(file.name)}</strong>
                <span>${escapeHtml(getRawKindLabel(file.kind))}</span>
              </div>
            </td>
            <td><span class="tag">${escapeHtml(file.extension.toUpperCase())}</span></td>
            <td>${formatBytes(file.size)}</td>
            <td>${escapeHtml(formatDateTime(file.modifiedAt))}</td>
            <td>
              <div class="raw-actions report-actions">
                <a class="icon-button ghost small raw-link" href="${escapeAttr(openHref)}" target="_blank" rel="noreferrer" title="打开报告">
                  <i data-lucide="external-link"></i>
                  <span>打开</span>
                </a>
                <a class="icon-button ghost small raw-link" href="${escapeAttr(href)}" download="${escapeAttr(file.name)}" title="下载报告">
                  <i data-lucide="download"></i>
                  <span>下载</span>
                </a>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function encodeFilePath(path) {
    return String(path || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function getReportOpenHref(file, encodedPath) {
    return file.previewPath ? encodeFilePath(file.previewPath) : encodedPath;
  }

  function renderReportModuleState() {
    const config = getReportModuleConfig(state.activeReportModule);
    els.reportModuleCards.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.reportModule === state.activeReportModule);
    });
    const isBuilder = state.activeReportModule === "mapping";
    if (els.reportSearchField) {
      els.reportSearchField.hidden = isBuilder;
    }
    if (els.reportListPanel) {
      els.reportListPanel.hidden = isBuilder;
    }
    if (els.reportBuilderPanel) {
      els.reportBuilderPanel.hidden = !isBuilder;
    }
    if (els.activeReportTitle) {
      els.activeReportTitle.textContent = config.label;
    }
    if (els.activeReportHint) {
      els.activeReportHint.textContent = config.hint;
    }
  }

  function getReportModuleConfig(key) {
    const configs = {
      analysis: {
        label: "分析报告",
        hint: "来源：桌面 / 测试原始数据 / 竞品分析过程文档"
      },
      output: {
        label: "输出报告",
        hint: "来源：后续输出目录 / 最终交付报告文件"
      },
      mapping: {
        label: "数据与模板映射",
        hint: "上传 PPT 模板和底层数据，维护映射后一键生成报告"
      }
    };
    return configs[key] || configs.analysis;
  }

  function matchesReportModule(file, moduleKey) {
    const name = String(file.name || "").toLowerCase();
    const outputKeywords = ["输出", "导出", "生成", "交付", "最终", "final", "output", "export"];
    const isOutputReport = outputKeywords.some((keyword) => name.includes(keyword.toLowerCase()));
    return moduleKey === "output" ? isOutputReport : !isOutputReport;
  }

  function renderReportBuilder() {
    const builder = state.reportBuilder;
    const templateText = reportTemplateBuffer
      ? `${builder.templateName || "已上传模板"} · ${formatBytes(builder.templateSize)}`
      : builder.templateName
        ? `${builder.templateName} · 需重新上传`
        : "未上传";
    const dataText = builder.dataFileName
      ? `${builder.dataFileName} · ${builder.dataFields.length} 个字段`
      : `${builder.dataFields.length} 个示例字段`;
    if (els.pptTemplateStatus) {
      els.pptTemplateStatus.textContent = templateText;
    }
    if (els.csvDataStatus) {
      els.csvDataStatus.textContent = dataText;
    }
    if (els.mappingStatus) {
      els.mappingStatus.textContent = builder.mappings.length ? `${builder.mappings.length} 条映射` : "待维护";
    }
    if (els.mappingSummary) {
      els.mappingSummary.textContent = `底层字段 ${builder.dataFields.length} 个 · PPT 文本候选 ${builder.pptTexts.length} 个`;
    }

    renderPptTextCandidates();
    renderReportDataSelect(els.mappingDataSelect);
    renderReportDataFields();
    renderReportMappings();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderPptTextCandidates() {
    if (!els.pptTextCandidates) {
      return;
    }
    const candidates = state.reportBuilder.pptTexts.slice(0, 160);
    els.pptTextCandidates.innerHTML = candidates
      .map((text) => `<option value="${escapeAttr(text)}"></option>`)
      .join("");
  }

  function renderReportDataSelect(select, selectedId = "") {
    if (!select) {
      return;
    }
    const options = [`<option value="">不绑定字段</option>`].concat(
      state.reportBuilder.dataFields.map((field) => {
        const selected = field.id === selectedId ? " selected" : "";
        return `<option value="${escapeAttr(field.id)}"${selected}>${escapeHtml(field.label)}</option>`;
      })
    );
    select.innerHTML = options.join("");
  }

  function getReportFieldOptionsHtml(selectedId = "") {
    return [`<option value="">不绑定字段</option>`].concat(
      state.reportBuilder.dataFields.map((field) => {
        const selected = field.id === selectedId ? " selected" : "";
        return `<option value="${escapeAttr(field.id)}"${selected}>${escapeHtml(field.label)}</option>`;
      })
    ).join("");
  }

  function renderReportDataFields() {
    if (!els.reportDataBody) {
      return;
    }
    const fields = state.reportBuilder.dataFields;
    if (!fields.length) {
      els.reportDataBody.innerHTML = `<tr><td colspan="4"><p class="empty-copy">暂无底层数据字段，请上传 Excel/CSV 或手动新增字段。</p></td></tr>`;
      return;
    }
    els.reportDataBody.innerHTML = fields
      .map((field) => `
        <tr data-field-id="${escapeAttr(field.id)}">
          <td>
            <div class="tv-cell">
              <strong>${escapeHtml(field.label)}</strong>
              ${field.note ? `<span>${escapeHtml(field.note)}</span>` : ""}
            </div>
          </td>
          <td>${escapeHtml(field.value || "-")}</td>
          <td>${escapeHtml(field.source || "-")}</td>
          <td>
            <div class="raw-actions">
              <button class="icon-button ghost small" type="button" data-edit-field="${escapeAttr(field.id)}">
                <i data-lucide="pencil"></i>
                <span>编辑</span>
              </button>
              <button class="icon-button ghost small" type="button" data-delete-field="${escapeAttr(field.id)}">
                <i data-lucide="trash-2"></i>
                <span>删除</span>
              </button>
            </div>
          </td>
        </tr>
      `)
      .join("");
  }

  function renderReportMappings() {
    if (!els.reportMappingBody) {
      return;
    }
    const mappings = state.reportBuilder.mappings;
    if (!mappings.length) {
      els.reportMappingBody.innerHTML = `<tr><td colspan="5"><p class="empty-copy">暂无映射。上传 PPT 和 Excel/CSV 后点击“自动匹配”，或手动添加映射。</p></td></tr>`;
      return;
    }
    els.reportMappingBody.innerHTML = mappings
      .map((mapping) => `
        <tr data-mapping-id="${escapeAttr(mapping.id)}">
          <td>
            <input class="table-inline-input" type="text" list="pptTextCandidates" value="${escapeAttr(mapping.source)}" data-mapping-source />
          </td>
          <td>
            <select class="table-inline-input" data-mapping-field>
              ${getReportFieldOptionsHtml(mapping.fieldId)}
            </select>
          </td>
          <td><span class="mapping-preview" data-mapping-preview>${escapeHtml(getReportMappingValue(mapping) || "-")}</span></td>
          <td>
            <input class="table-inline-input" type="text" value="${escapeAttr(mapping.fallback || "")}" data-mapping-fallback />
          </td>
          <td>
            <button class="icon-button ghost small" type="button" data-delete-mapping="${escapeAttr(mapping.id)}">
              <i data-lucide="trash-2"></i>
              <span>删除</span>
            </button>
          </td>
        </tr>
      `)
      .join("");
  }

  async function handlePptTemplateUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    if (!/\.(pptx|pptm)$/i.test(file.name)) {
      showNotice("请上传 PPTX/PPTM 模板；旧版 .ppt 暂不支持直接生成。", "warning");
      return;
    }
    if (!window.JSZip) {
      showNotice("PPT 生成组件未加载，请刷新页面后重试。", "warning");
      return;
    }
    try {
      reportTemplateBuffer = await file.arrayBuffer();
      state.reportBuilder.templateName = file.name;
      state.reportBuilder.templateSize = file.size;
      state.reportBuilder.templateLoadedAt = new Date().toISOString();
      await extractPptTextFromTemplate();
      applyAutomaticReportMappings(false);
      persistReportBuilderState();
      renderReportBuilder();
      showNotice(`已读取 PPT 模板：${file.name}`);
    } catch (error) {
      console.error(error);
      reportTemplateBuffer = null;
      showNotice("PPT 模板读取失败，请确认文件为有效的 PPTX/PPTM。", "warning");
      renderReportBuilder();
    }
  }

  async function handleReportDataUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsedFields = await parseReportDataFields(buffer, file);
      if (!parsedFields.length) {
        showNotice("未从 Excel/CSV 中识别到底层数据字段，请检查表格格式。", "warning");
        return;
      }
      const manualFields = state.reportBuilder.dataFields.filter((field) => field.source === "手动维护");
      state.reportBuilder.dataFields = mergeReportDataFields(parsedFields.concat(manualFields));
      state.reportBuilder.dataFileName = file.name;
      state.reportBuilder.dataUpdatedAt = new Date().toISOString();
      applyAutomaticReportMappings(false);
      persistReportBuilderState();
      renderReportBuilder();
      showNotice(`已解析底层数据：${file.name}，识别 ${parsedFields.length} 个字段。`);
    } catch (error) {
      console.error(error);
      showNotice(error.message || "Excel/CSV 解析失败，请确认文件格式。", "warning");
    }
  }

  async function extractCurrentPptFields() {
    if (!reportTemplateBuffer) {
      showNotice("请先上传 PPT 模板。", "warning");
      return;
    }
    try {
      await extractPptTextFromTemplate();
      persistReportBuilderState();
      renderReportBuilder();
      showNotice(`已重新提取 ${state.reportBuilder.pptTexts.length} 个 PPT 文本候选。`);
    } catch (error) {
      console.error(error);
      showNotice("PPT 文本提取失败，请检查模板文件。", "warning");
    }
  }

  async function extractPptTextFromTemplate() {
    const zip = await window.JSZip.loadAsync(reportTemplateBuffer.slice(0));
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const texts = [];
    for (const name of slideNames) {
      const file = zip.file(name);
      if (!file) {
        continue;
      }
      const xml = await file.async("string");
      texts.push(...extractXmlTextNodes(xml));
    }
    const cleanTexts = Array.from(new Set(texts.map((text) => text.trim()).filter(Boolean)))
      .filter((text) => text.length <= 120)
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
    state.reportBuilder.pptTexts = cleanTexts;
    state.reportBuilder.placeholders = cleanTexts.filter((text) => /^\{[^{}]+\}$/.test(text));
  }

  function applyAutomaticReportMappings(showFeedback) {
    const fields = state.reportBuilder.dataFields;
    if (!fields.length) {
      if (showFeedback) {
        showNotice("请先上传或维护底层数据字段。", "warning");
      }
      return;
    }
    const existing = new Map(state.reportBuilder.mappings.map((mapping) => [mapping.source, mapping]));
    let added = 0;

    state.reportBuilder.placeholders.forEach((placeholder) => {
      const key = placeholder.replace(/[{}]/g, "");
      const field = findReportFieldByLabels([key]);
      if (field && !existing.has(placeholder)) {
        const mapping = createReportMapping(placeholder, field.id);
        existing.set(placeholder, mapping);
        added += 1;
      }
    });

    reportAutoMappingRules.forEach((rule) => {
      const field = findReportFieldByLabels(rule.labels);
      if (!field || existing.has(rule.source)) {
        return;
      }
      const hasTemplateText = !state.reportBuilder.pptTexts.length || state.reportBuilder.pptTexts.some((text) => text.includes(rule.source));
      if (!hasTemplateText) {
        return;
      }
      const mapping = createReportMapping(rule.source, field.id);
      existing.set(rule.source, mapping);
      added += 1;
    });

    state.reportBuilder.mappings = Array.from(existing.values());
    persistReportBuilderState();
    renderReportBuilder();
    if (showFeedback) {
      showNotice(added ? `已新增 ${added} 条自动映射。` : "没有发现新的可自动匹配字段。");
    }
  }

  function saveReportDataField() {
    const label = (els.dataFieldNameInput.value || "").trim();
    const value = (els.dataFieldValueInput.value || "").trim();
    const note = (els.dataFieldNoteInput.value || "").trim();
    if (!label) {
      showNotice("请填写字段名称。", "warning");
      return;
    }
    const field = createReportDataField(label, value, "手动维护", note);
    const fields = state.reportBuilder.dataFields.filter((item) => item.id !== field.id);
    fields.push(field);
    state.reportBuilder.dataFields = mergeReportDataFields(fields);
    els.dataFieldNameInput.value = "";
    els.dataFieldValueInput.value = "";
    els.dataFieldNoteInput.value = "";
    persistReportBuilderState();
    renderReportBuilder();
    showNotice(`已保存底层字段：${label}`);
  }

  function addReportMappingFromForm() {
    const source = (els.mappingSourceInput.value || "").trim();
    const fieldId = els.mappingDataSelect.value || "";
    const fallback = (els.mappingFallbackInput.value || "").trim();
    if (!source) {
      showNotice("请填写 PPT 目标文本。", "warning");
      return;
    }
    if (!fieldId && !fallback) {
      showNotice("请绑定底层数据字段，或填写默认值。", "warning");
      return;
    }
    const existing = state.reportBuilder.mappings.find((mapping) => mapping.source === source);
    if (existing) {
      existing.fieldId = fieldId;
      existing.fallback = fallback;
    } else {
      state.reportBuilder.mappings.push(createReportMapping(source, fieldId, fallback));
    }
    els.mappingSourceInput.value = "";
    els.mappingFallbackInput.value = "";
    renderReportDataSelect(els.mappingDataSelect);
    persistReportBuilderState();
    renderReportBuilder();
    showNotice(`已保存映射：${source}`);
  }

  function handleReportDataTableClick(event) {
    const editButton = event.target.closest("[data-edit-field]");
    const deleteButton = event.target.closest("[data-delete-field]");
    if (editButton) {
      const field = getReportDataField(editButton.dataset.editField);
      if (!field) {
        return;
      }
      els.dataFieldNameInput.value = field.label;
      els.dataFieldValueInput.value = field.value || "";
      els.dataFieldNoteInput.value = field.note || "";
      return;
    }
    if (deleteButton) {
      const fieldId = deleteButton.dataset.deleteField;
      state.reportBuilder.dataFields = state.reportBuilder.dataFields.filter((field) => field.id !== fieldId);
      state.reportBuilder.mappings.forEach((mapping) => {
        if (mapping.fieldId === fieldId) {
          mapping.fieldId = "";
        }
      });
      persistReportBuilderState();
      renderReportBuilder();
      showNotice("已删除底层字段。");
    }
  }

  function handleReportMappingTableClick(event) {
    const deleteButton = event.target.closest("[data-delete-mapping]");
    if (!deleteButton) {
      return;
    }
    state.reportBuilder.mappings = state.reportBuilder.mappings.filter((mapping) => mapping.id !== deleteButton.dataset.deleteMapping);
    persistReportBuilderState();
    renderReportBuilder();
    showNotice("已删除映射。");
  }

  function handleReportMappingTableInput(event) {
    const row = event.target.closest("[data-mapping-id]");
    if (!row) {
      return;
    }
    const mapping = state.reportBuilder.mappings.find((item) => item.id === row.dataset.mappingId);
    if (!mapping) {
      return;
    }
    if (event.target.matches("[data-mapping-source]")) {
      mapping.source = event.target.value.trim();
    }
    if (event.target.matches("[data-mapping-field]")) {
      mapping.fieldId = event.target.value;
    }
    if (event.target.matches("[data-mapping-fallback]")) {
      mapping.fallback = event.target.value;
    }
    persistReportBuilderState();
    const preview = row.querySelector("[data-mapping-preview]");
    if (preview) {
      preview.textContent = getReportMappingValue(mapping) || "-";
    }
  }

  function clearReportBuilderMappings() {
    state.reportBuilder.mappings = [];
    persistReportBuilderState();
    renderReportBuilder();
    showNotice("已清空 PPT 字段映射，底层数据字段保留。");
  }

  async function generateMappedPptReport() {
    if (!window.JSZip) {
      showNotice("PPT 生成组件未加载，请刷新页面后重试。", "warning");
      return;
    }
    if (!reportTemplateBuffer) {
      showNotice("请先上传 PPT 模板。", "warning");
      return;
    }
    const mappings = state.reportBuilder.mappings.filter((mapping) => mapping.source && (mapping.fieldId || mapping.fallback));
    if (!mappings.length) {
      showNotice("请先维护至少一条 PPT 字段映射。", "warning");
      return;
    }
    try {
      const zip = await window.JSZip.loadAsync(reportTemplateBuffer.slice(0));
      const xmlNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
      let replacementCount = 0;
      for (const name of xmlNames) {
        const file = zip.file(name);
        if (!file) {
          continue;
        }
        let xml = await file.async("string");
        mappings.forEach((mapping) => {
          const result = replaceXmlText(xml, mapping.source, getReportMappingValue(mapping));
          xml = result.text;
          replacementCount += result.count;
        });
        zip.file(name, xml);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const model = getReportDataFieldValueByLabel("品牌型号") || "竞品分析";
      const filename = sanitizeFilename(`${stripExtension(state.reportBuilder.templateName || "竞品分析报告")}_${model}_生成报告.pptx`);
      downloadBlob(blob, filename);
      showNotice(replacementCount ? `已生成 PPT，完成 ${replacementCount} 处文本替换。` : "已生成 PPT，但没有找到匹配的目标文本，请检查映射。", replacementCount ? undefined : "warning");
    } catch (error) {
      console.error(error);
      showNotice("生成 PPT 失败，请检查模板和映射内容。", "warning");
    }
  }

  function decodeCsvBuffer(buffer) {
    const decoders = [
      () => new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      () => new TextDecoder("gb18030").decode(buffer),
      () => new TextDecoder("utf-8").decode(buffer)
    ];
    for (const decode of decoders) {
      try {
        return decode();
      } catch (error) {
        // Try the next decoder.
      }
    }
    return "";
  }

  async function parseReportDataFields(buffer, file) {
    const name = file.name || "";
    if (/\.(xlsx|xlsm)$/i.test(name)) {
      const sheets = await parseXlsxSheets(buffer);
      return extractReportDataFieldsFromSheets(sheets, name);
    }
    if (/\.csv$/i.test(name) || file.type === "text/csv") {
      const text = decodeCsvBuffer(buffer);
      const rows = parseCsvRows(text);
      return extractReportDataFieldsFromRows(rows, {
        fileName: name,
        sourceType: "CSV",
        includeMeta: true
      });
    }
    if (/\.xls$/i.test(name)) {
      throw new Error("暂不支持旧版 .xls 二进制格式，请另存为 .xlsx 后上传。");
    }
    throw new Error("请上传 .xlsx/.xlsm 或 .csv 底层数据文件。");
  }

  async function parseXlsxSheets(buffer) {
    if (!window.JSZip) {
      throw new Error("Excel 解析组件未加载，请刷新页面后重试。");
    }
    const zip = await window.JSZip.loadAsync(buffer.slice(0));
    const workbookFile = zip.file("xl/workbook.xml");
    const relsFile = zip.file("xl/_rels/workbook.xml.rels");
    if (!workbookFile || !relsFile) {
      throw new Error("未找到 Excel 工作簿结构，请确认文件为有效的 .xlsx/.xlsm。");
    }

    const workbookDoc = parseXmlDocument(await workbookFile.async("string"));
    const relsDoc = parseXmlDocument(await relsFile.async("string"));
    const relationships = new Map(
      Array.from(relsDoc.getElementsByTagNameNS("*", "Relationship")).map((rel) => [rel.getAttribute("Id"), rel.getAttribute("Target")])
    );
    const sharedStrings = await readSharedStrings(zip);
    const sheetNodes = Array.from(workbookDoc.getElementsByTagNameNS("*", "sheet"));
    const sheets = [];

    for (let index = 0; index < sheetNodes.length; index += 1) {
      const sheetNode = sheetNodes[index];
      const sheetName = sheetNode.getAttribute("name") || `Sheet${index + 1}`;
      const relationId = sheetNode.getAttribute("r:id") || sheetNode.getAttribute("id");
      const target = relationships.get(relationId) || `worksheets/sheet${index + 1}.xml`;
      const sheetPath = normalizeXlsxTargetPath(target);
      const sheetFile = zip.file(sheetPath);
      if (!sheetFile) {
        continue;
      }
      const rows = readWorksheetRows(parseXmlDocument(await sheetFile.async("string")), sharedStrings);
      if (rows.some((row) => row.some((cell) => String(cell || "").trim()))) {
        sheets.push({ name: sheetName, rows });
      }
    }
    return sheets;
  }

  async function readSharedStrings(zip) {
    const file = zip.file("xl/sharedStrings.xml");
    if (!file) {
      return [];
    }
    const doc = parseXmlDocument(await file.async("string"));
    return Array.from(doc.getElementsByTagNameNS("*", "si")).map((item) => {
      return Array.from(item.getElementsByTagNameNS("*", "t"))
        .map((node) => node.textContent || "")
        .join("");
    });
  }

  function readWorksheetRows(sheetDoc, sharedStrings) {
    return Array.from(sheetDoc.getElementsByTagNameNS("*", "row"))
      .map((rowNode) => {
        const row = [];
        Array.from(rowNode.getElementsByTagNameNS("*", "c")).forEach((cellNode) => {
          const ref = cellNode.getAttribute("r") || "";
          const columnIndex = getExcelColumnIndex(ref) ?? row.length;
          row[columnIndex] = readWorksheetCell(cellNode, sharedStrings);
        });
        return row.map((cell) => String(cell ?? "").trim());
      })
      .filter((row) => row.some(Boolean));
  }

  function readWorksheetCell(cellNode, sharedStrings) {
    const type = cellNode.getAttribute("t");
    if (type === "inlineStr") {
      return Array.from(cellNode.getElementsByTagNameNS("*", "t"))
        .map((node) => node.textContent || "")
        .join("");
    }
    const valueNode = cellNode.getElementsByTagNameNS("*", "v")[0];
    const rawValue = valueNode ? valueNode.textContent || "" : "";
    if (type === "s") {
      return sharedStrings[Number(rawValue)] || "";
    }
    return rawValue;
  }

  function parseXmlDocument(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      throw new Error("Excel XML 解析失败，请检查文件是否损坏。");
    }
    return doc;
  }

  function normalizeXlsxTargetPath(target) {
    const value = String(target || "").replace(/^\/+/, "");
    if (value.startsWith("xl/")) {
      return value;
    }
    return `xl/${value.replace(/^\.\//, "")}`;
  }

  function getExcelColumnIndex(ref) {
    const match = String(ref || "").match(/^[A-Z]+/i);
    if (!match) {
      return null;
    }
    return match[0].toUpperCase().split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }
      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") {
          index += 1;
        }
        row.push(cell);
        if (row.some((value) => value.trim())) {
          rows.push(row);
        }
        row = [];
        cell = "";
        continue;
      }
      cell += char;
    }
    row.push(cell);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
    return rows;
  }

  function extractReportDataFieldsFromSheets(sheets, fileName) {
    if (!sheets.length) {
      return [];
    }
    const allRows = sheets.flatMap((sheet) => sheet.rows);
    const model = findReportModelFromRows(allRows) || stripExtension(fileName);
    const fields = [];
    fields.push(createReportDataField("品牌型号", model, "Excel 识别", fileName));
    fields.push(createReportDataField("数据文件名", fileName, "Excel 识别", ""));
    fields.push(createReportDataField("工作表数量", sheets.length, "Excel 识别", ""));
    fields.push(createReportDataField("工作表名称", sheets.map((sheet) => sheet.name).join("、"), "Excel 识别", ""));
    fields.push(createReportDataField("报告日期", new Date().toLocaleDateString("zh-CN"), "系统生成", ""));

    sheets.forEach((sheet) => {
      fields.push(...extractReportDataFieldsFromRows(sheet.rows, {
        fileName,
        sourceType: "Excel",
        sheetName: sheet.name,
        labelPrefix: sheet.name,
        includeMeta: false
      }));
    });

    return mergeReportDataFields(fields);
  }

  function extractReportDataFieldsFromRows(rows, options = {}) {
    const fileName = options.fileName || "";
    const sourceType = options.sourceType || "CSV";
    const labelPrefix = options.labelPrefix || "";
    const includeMeta = options.includeMeta !== false;
    const fields = [];
    let section = "";
    let headerRow = [];

    if (includeMeta) {
      const model = findReportModelFromRows(rows) || stripExtension(fileName);
      fields.push(createReportDataField("品牌型号", model, `${sourceType} 识别`, fileName));
      fields.push(createReportDataField("数据文件名", fileName, `${sourceType} 识别`, ""));
      fields.push(createReportDataField("报告日期", new Date().toLocaleDateString("zh-CN"), "系统生成", ""));
    }

    rows.forEach((rawRow, index) => {
      const row = rawRow.map((cell) => String(cell || "").trim());
      const nonEmpty = row.filter(Boolean);
      if (!nonEmpty.length) {
        return;
      }
      const first = row[0] || "";
      const second = row[1] || "";
      const third = row[2] || "";
      const fourth = row[3] || "";
      if (nonEmpty.length === 1) {
        section = nonEmpty[0];
        return;
      }
      if (isReportHeaderRow(row)) {
        if (first) {
          section = first;
        }
        headerRow = mergeReportHeaderRows(headerRow, row);
        return;
      }
      let label = "";
      let value = "";
      let note = fourth;
      if (first && second && third) {
        section = first;
        label = `${section} / ${second}`;
        value = third;
      } else if (!first && second && third) {
        label = section ? `${section} / ${second}` : second;
        value = third;
      } else if (first && second && !third) {
        label = section ? `${section} / ${first}` : first;
        value = second;
        note = row[2] || "";
      }
      if (!label || !value || label === "测试内容") {
        label = "";
        value = "";
      }
      if (label && value) {
        const scopedLabel = labelPrefix ? `${labelPrefix} / ${label}` : label;
        const source = options.sheetName ? `${sourceType}：${options.sheetName} 第 ${index + 1} 行` : `${sourceType} 第 ${index + 1} 行`;
        fields.push(createReportDataField(scopedLabel, value, source, note));
      }

      if (headerRow.length && row.length > 3) {
        const source = options.sheetName ? `${sourceType}：${options.sheetName} 第 ${index + 1} 行` : `${sourceType} 第 ${index + 1} 行`;
        extractWideReportFields(row, headerRow, section).forEach((field) => {
          const scopedLabel = labelPrefix ? `${labelPrefix} / ${field.label}` : field.label;
          fields.push(createReportDataField(scopedLabel, field.value, source, note));
        });
      }
    });

    return mergeReportDataFields(fields);
  }

  function isReportHeaderRow(row) {
    const nonEmpty = row.filter(Boolean);
    if (nonEmpty.length < 2) {
      return false;
    }
    return nonEmpty.every((cell) => !/\d/.test(cell));
  }

  function mergeReportHeaderRows(previous, current) {
    const normalized = [];
    let carry = "";
    const maxLength = Math.max(previous.length, current.length);
    for (let index = 0; index < maxLength; index += 1) {
      const currentCell = current[index] || "";
      if (currentCell) {
        carry = currentCell;
      }
      const local = currentCell || carry;
      const parent = previous[index] || "";
      normalized[index] = parent && local && parent !== local ? `${parent} ${local}` : local || parent;
    }
    return normalized;
  }

  function extractWideReportFields(row, headerRow, section) {
    const rowKey = row.slice(0, 2).filter(Boolean).join(" / ") || row[0] || row[1] || "";
    if (!rowKey) {
      return [];
    }
    return row
      .map((value, index) => {
        if (index < 2 || !value) {
          return null;
        }
        const header = headerRow[index] || `列${index + 1}`;
        if (!header || header === value) {
          return null;
        }
        const parts = [];
        if (section && !normalizeReportText(rowKey).includes(normalizeReportText(section))) {
          parts.push(section);
        }
        parts.push(rowKey, header);
        return {
          label: parts.filter(Boolean).join(" / "),
          value
        };
      })
      .filter(Boolean);
  }

  function findReportModelFromRows(rows) {
    for (const row of rows.slice(0, 6)) {
      const values = row.map((cell) => String(cell || "").trim()).filter(Boolean);
      const candidate = values.find((value) => value !== "测试内容" && !value.includes("亮度"));
      if (candidate) {
        return candidate;
      }
    }
    return "";
  }

  function extractXmlTextNodes(xml) {
    const texts = [];
    const pattern = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    let match = pattern.exec(xml);
    while (match) {
      texts.push(decodeXmlText(match[1]));
      match = pattern.exec(xml);
    }
    return texts;
  }

  function replaceXmlText(xml, source, replacement) {
    const target = encodeXmlText(source);
    const value = encodeXmlText(replacement);
    if (!target) {
      return { text: xml, count: 0 };
    }
    const count = xml.split(target).length - 1;
    return {
      text: count ? xml.split(target).join(value) : xml,
      count
    };
  }

  function createReportDataField(label, value, source, note = "") {
    return {
      id: reportFieldId(label),
      label,
      value: String(value ?? ""),
      source,
      note
    };
  }

  function getDefaultReportDataFields() {
    return [
      createReportDataField("品牌型号", "创维85A7HP", "底层数据示例", "创维85A7HP客观数据0614.csv"),
      createReportDataField("亮度（标准模式） / 全白场亮度", "799.12", "底层数据示例", ""),
      createReportDataField("亮度（标准模式） / 黑场亮度(关LD）", "0.2318", "底层数据示例", ""),
      createReportDataField("亮度（标准模式） / 黑场亮度(开LD）", "0.0004", "底层数据示例", ""),
      createReportDataField("亮度（标准模式） / 瞬态峰值亮度()", "3419", "底层数据示例", ""),
      createReportDataField("亮度（标准模式） / Real Scene", "892.4", "底层数据示例", "Rtings 测试视频")
    ];
  }

  function mergeReportDataFields(fields) {
    const map = new Map();
    fields.forEach((field) => {
      if (field && field.id && field.label) {
        map.set(field.id, field);
      }
    });
    return Array.from(map.values());
  }

  function createReportMapping(source, fieldId, fallback = "") {
    return {
      id: `mapping-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source,
      fieldId,
      fallback
    };
  }

  function getReportDataField(fieldId) {
    return state.reportBuilder.dataFields.find((field) => field.id === fieldId);
  }

  function getReportMappingValue(mapping) {
    const field = getReportDataField(mapping.fieldId);
    const value = field && field.value !== undefined ? String(field.value) : "";
    return value || mapping.fallback || "";
  }

  function getReportDataFieldValueByLabel(label) {
    const field = findReportFieldByLabels([label]);
    return field ? field.value : "";
  }

  function findReportFieldByLabels(labels) {
    const normalizedLabels = labels.map(normalizeReportText).filter(Boolean);
    return state.reportBuilder.dataFields.find((field) => {
      const label = normalizeReportText(field.label);
      return normalizedLabels.some((item) => label.includes(item));
    });
  }

  function reportFieldId(label) {
    let hash = 0;
    String(label).split("").forEach((char) => {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    });
    return `field-${Math.abs(hash)}`;
  }

  function normalizeReportText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[()（）]/g, "");
  }

  function encodeXmlText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function decodeXmlText(value) {
    return String(value ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, "\"")
      .replace(/&amp;/g, "&");
  }

  function stripExtension(filename) {
    return String(filename || "").replace(/\.[^.]+$/, "");
  }

  function sanitizeFilename(filename) {
    return String(filename || "report.pptx")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderFilterOptions() {
    const current = {
      brand: els.brandFilter.value,
      panel: els.panelFilter.value,
      signal: els.signalFilter.value,
      year: els.yearFilter.value
    };
    fillSelect(els.brandFilter, "全部品牌", uniqueValues("brand"), current.brand);
    fillSelect(els.panelFilter, "全部面板", uniqueValues("panel"), current.panel);
    fillSelect(els.signalFilter, "全部信号", uniqueValues("signal"), uniqueValues("signal").includes(current.signal) ? current.signal : "");
    fillSelect(els.yearFilter, "全部年份", uniqueValues("year").sort((a, b) => b - a), current.year);
  }

  function fillSelect(select, allLabel, values, currentValue) {
    const options = [`<option value="">${escapeHtml(allLabel)}</option>`].concat(
      values.map((value) => `<option value="${escapeHtml(String(value))}">${escapeHtml(String(value))}</option>`)
    );
    select.innerHTML = options.join("");
    select.value = values.map(String).includes(String(currentValue)) ? String(currentValue) : "";
  }

  function uniqueValues(key) {
    return Array.from(new Set((state.dataset.tests || []).map((record) => record[key]).filter((value) => value !== undefined && value !== null && value !== ""))).sort();
  }

  function renderMetricOptions() {
    if (!els.metricSelect) {
      return;
    }
    const options = [`<option value="overall">综合分</option>`].concat(
      getMetricDefs().map((metric) => `<option value="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</option>`)
    );
    els.metricSelect.innerHTML = options.join("");
    if (!els.metricSelect.value) {
      els.metricSelect.value = "overall";
    }
  }

  function renderPresetButtons() {
    if (!els.presetList) {
      return;
    }
    els.presetList.innerHTML = Object.keys(presets)
      .map((name) => `<button class="preset-button${name === state.activePreset ? " is-active" : ""}" type="button" data-preset="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
      .join("");

    els.presetList.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.activePreset = button.dataset.preset;
        state.experimentWeights = { ...presets[state.activePreset] };
        renderPresetButtons();
        renderWeightControls();
        renderExperimentView();
      });
    });
  }

  function renderWeightControls() {
    if (!els.weightControls) {
      return;
    }
    const groups = getMetricGroups();
    els.weightControls.innerHTML = groups
      .map((group) => {
        const value = state.experimentWeights[group] ?? 0;
        return `
          <label class="weight-row">
            <header>
              <span>${escapeHtml(group)}</span>
              <strong>${value}</strong>
            </header>
            <input type="range" min="0" max="40" step="1" value="${value}" data-group="${escapeAttr(group)}" />
          </label>
        `;
      })
      .join("");

    els.weightControls.querySelectorAll("input[type='range']").forEach((input) => {
      input.addEventListener("input", () => {
        const group = input.dataset.group;
        state.experimentWeights[group] = Number(input.value);
        state.activePreset = "自定义";
        const label = input.closest(".weight-row").querySelector("strong");
        if (label) {
          label.textContent = input.value;
        }
        renderPresetButtons();
        renderExperimentView();
      });
    });
  }

  function getFilteredRecords() {
    const query = els.searchInput.value.trim().toLowerCase();
    const brand = els.brandFilter.value;
    const panel = els.panelFilter.value;
    const signal = els.signalFilter.value;
    const year = els.yearFilter.value;
    const sort = els.sortSelect.value;

    const filtered = (state.dataset.tests || []).filter((record) => {
      const haystack = [
        record.brand,
        record.model,
        record.size,
        record.year,
        record.panel,
        record.firmware,
        record.mode,
        record.signal,
        record.source,
        record.notes,
        ...(record.tags || [])
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || haystack.includes(query)) &&
        (!brand || record.brand === brand) &&
        (!panel || record.panel === panel) &&
        (!signal || record.signal === signal) &&
        (!year || String(record.year) === year)
      );
    });

    return filtered.sort((a, b) => compareRecords(a, b, sort));
  }

  function compareRecords(a, b, sort) {
    if (sort === "score-desc") {
      return computeOverallScore(b) - computeOverallScore(a);
    }
    if (sort === "date-desc") {
      return String(b.date || "").localeCompare(String(a.date || ""));
    }

    const [metricKey, direction] = sort.split("-");
    const metricDef = getMetricDef(metricKey);
    const av = getSortableMetricValue(a, metricKey, metricDef);
    const bv = getSortableMetricValue(b, metricKey, metricDef);
    return direction === "asc" ? av - bv : bv - av;
  }

  function getSortableMetricValue(record, metricKey, metricDef) {
    const metric = record.metrics && record.metrics[metricKey];
    if (!metric || !Number.isFinite(Number(metric.value))) {
      return metricDef && metricDef.direction === "lower" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }
    if (metricDef && metricDef.direction === "lower" && Number(metric.value) === 0 && Number(metric.score) === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Number(metric.value);
  }

  function renderSummary() {
    if (!els.summaryCount || !els.summaryScore || !els.summaryHdr || !els.summaryLag) {
      return;
    }
    const records = getFilteredRecords();
    const scores = records.map((record) => computeOverallScore(record)).filter(Number.isFinite);
    const hdrValues = records.map((record) => getMetricValue(record, "hdrPeak10")).filter((value) => value > 0);
    const lagValues = records.map((record) => getMetricValue(record, "inputLag4k120")).filter((value) => value > 0);

    els.summaryCount.textContent = records.length;
    els.summaryScore.textContent = scores.length ? formatNumber(avg(scores), 1) : "0";
    els.summaryHdr.textContent = hdrValues.length ? `${formatNumber(Math.max(...hdrValues), 0)} nit` : "-";
    els.summaryLag.textContent = lagValues.length ? `${formatNumber(Math.min(...lagValues), 1)} ms` : "-";
  }

  function renderRecords() {
    const records = getFilteredRecords();
    if (!records.length) {
      els.recordsBody.innerHTML = `<tr><td colspan="9"><p class="empty-copy">没有匹配的测试记录。</p></td></tr>`;
      return;
    }

    els.recordsBody.innerHTML = records
      .map((record) => {
        const selected = state.selectedIds.has(record.id);
        const active = state.activeRecordId === record.id;
        return `
          <tr data-id="${escapeAttr(record.id)}" class="${active ? "is-open" : ""}">
            <td class="checkbox-cell">
              <input type="checkbox" ${selected ? "checked" : ""} aria-label="选择 ${escapeAttr(record.brand)} ${escapeAttr(record.model)}" />
            </td>
            <td>
              <div class="tv-cell">
                <strong>${escapeHtml(record.brand)} ${escapeHtml(record.model)}</strong>
                <span>${escapeHtml(record.size)} 英寸 · ${escapeHtml(record.year)}</span>
                <div class="tag-list">${renderTags(record.tags)}</div>
              </div>
            </td>
            <td>
              <strong>${escapeHtml(record.mode)}</strong>
              <div class="muted">${escapeHtml(record.signal)}</div>
            </td>
            <td>${escapeHtml(record.panel)}</td>
            <td>${formatMetric(record, "hdrPeak10")}</td>
            <td>${formatMetric(record, "colorCheckerDeltaE")}</td>
            <td>${formatMetric(record, "inputLag4k120")}</td>
            <td><span class="score-chip">${formatNumber(computeOverallScore(record), 1)}</span></td>
            <td>${escapeHtml(record.date || "-")}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderTags(tags) {
    return (tags || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  }

  function renderDetail() {
    const record = findRecord(state.activeRecordId);
    if (!record) {
      els.recordDetail.innerHTML = `
        <div class="empty-state">
          <i data-lucide="panel-right-open"></i>
          <strong>未选中记录</strong>
          <span>从左侧表格打开单条详情</span>
        </div>
      `;
      if (window.lucide) {
        window.lucide.createIcons();
      }
      return;
    }

    const selected = state.selectedIds.has(record.id);
    const conditionItems = Object.entries(record.conditions || {})
      .map(([key, value]) => `<div class="meta-item"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join("");

    els.recordDetail.innerHTML = `
      <div class="detail-title">
        <div>
          <h3>${escapeHtml(record.brand)} ${escapeHtml(record.model)}</h3>
          <div class="muted">${escapeHtml(record.mode)} · ${escapeHtml(record.signal)}</div>
        </div>
        <div class="detail-actions">
          <button class="icon-button small ${selected ? "primary" : "ghost"}" type="button" id="detailSelectBtn" title="加入对比">
            <i data-lucide="${selected ? "check" : "plus"}"></i>
            <span>${selected ? "已选" : "对比"}</span>
          </button>
        </div>
      </div>
      <div class="tag-list">${renderTags(record.tags)}</div>
      <div class="meta-grid">
        <div class="meta-item"><span>综合分</span><strong>${formatNumber(computeOverallScore(record), 1)}</strong></div>
        <div class="meta-item"><span>面板</span><strong>${escapeHtml(record.panel)}</strong></div>
        <div class="meta-item"><span>固件</span><strong>${escapeHtml(record.firmware || "-")}</strong></div>
        <div class="meta-item"><span>日期</span><strong>${escapeHtml(record.date || "-")}</strong></div>
        ${conditionItems}
      </div>
      <h3>核心指标</h3>
      <div class="metric-list">
        ${getMetricDefs()
          .map((metric) => renderMetricRow(record, metric))
          .join("")}
      </div>
      ${record.notes ? `<div class="detail-notes"><h3>备注</h3><p class="empty-copy">${escapeHtml(record.notes)}</p></div>` : ""}
    `;

    document.getElementById("detailSelectBtn").addEventListener("click", () => {
      setSelection(record.id, !state.selectedIds.has(record.id));
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderMetricRow(record, metric) {
    const item = record.metrics && record.metrics[metric.key];
    if (!item) {
      return "";
    }
    const score = clamp(Number(item.score) || 0, 0, 100);
    return `
      <div class="metric-row">
        <div>
          <strong>${escapeHtml(metric.label)}</strong>
          <div class="meter" style="--value:${score}%"><span></span></div>
        </div>
        <span>${formatMetric(record, metric.key)}</span>
      </div>
    `;
  }

  function renderSelectionState() {
    const count = state.selectedIds.size;
    els.selectionPill.textContent = `已选 ${count} 项`;
    const visible = getFilteredRecords();
    const allVisibleSelected = visible.length > 0 && visible.every((record) => state.selectedIds.has(record.id));
    els.selectAllVisible.checked = allVisibleSelected;
    els.selectAllVisible.indeterminate = !allVisibleSelected && visible.some((record) => state.selectedIds.has(record.id));
  }

  function setSelection(recordId, selected, shouldRender = true) {
    if (selected) {
      state.selectedIds.add(recordId);
    } else {
      state.selectedIds.delete(recordId);
    }

    if (shouldRender) {
      renderRecords();
      renderDetail();
      renderSelectionState();
      renderAnalysisViews();
    }
  }

  function renderCompareView() {
    if (!els.metricSelect || !els.metricChart || !els.compareMatrix || !els.compareHeader || !els.compareBody) {
      return;
    }
    const records = getCompareRecords();
    const metricKey = els.metricSelect.value || "overall";
    drawMetricChart(els.metricChart, records, metricKey);
    renderCompareMatrix(records);
    renderCompareTable(records);
  }

  function getCompareRecords() {
    const selected = getSelectedRecords();
    if (selected.length) {
      return selected;
    }
    return getFilteredRecords().slice(0, 3);
  }

  function getSelectedRecords() {
    return (state.dataset.tests || []).filter((record) => state.selectedIds.has(record.id));
  }

  function renderCompareMatrix(records) {
    if (!els.compareMatrix) {
      return;
    }
    if (!records.length) {
      els.compareMatrix.innerHTML = `<p class="empty-copy">没有可对比的记录。</p>`;
      return;
    }

    const groups = getMetricGroups();
    els.compareMatrix.innerHTML = groups
      .map((group) => {
        const best = records
          .map((record) => ({ record, score: computeGroupScore(record, group) }))
          .sort((a, b) => b.score - a.score)[0];
        return `
          <div class="matrix-item">
            <header>
              <span>${escapeHtml(group)}</span>
              <strong>${best ? escapeHtml(best.record.brand + " " + best.record.model) : "-"}</strong>
            </header>
            <div class="meter" style="--value:${best ? clamp(best.score, 0, 100) : 0}%"><span></span></div>
          </div>
        `;
      })
      .join("");
  }

  function renderCompareTable(records) {
    if (!els.compareHeader || !els.compareBody) {
      return;
    }
    if (!records.length) {
      els.compareHeader.innerHTML = "";
      els.compareBody.innerHTML = `<tr><td>没有可对比的记录。</td></tr>`;
      return;
    }

    els.compareHeader.innerHTML = ["指标"].concat(records.map((record) => `${record.brand} ${record.model}`)).map((label) => `<th>${escapeHtml(label)}</th>`).join("");
    const rows = [
      { key: "overall", label: "综合分" },
      ...getMetricDefs().map((metric) => ({ key: metric.key, label: metric.label }))
    ];
    els.compareBody.innerHTML = rows
      .map((row) => {
        const cells = records.map((record) => {
          const value = row.key === "overall" ? formatNumber(computeOverallScore(record), 1) : formatMetric(record, row.key);
          return `<td>${value}</td>`;
        });
        return `<tr><td><strong>${escapeHtml(row.label)}</strong></td>${cells.join("")}</tr>`;
      })
      .join("");
  }

  function renderExperimentView() {
    if (!els.experimentChart || !els.rankingList) {
      return;
    }
    const ranked = getFilteredRecords()
      .map((record) => ({
        record,
        score: computeOverallScore(record, state.experimentWeights)
      }))
      .sort((a, b) => b.score - a.score);

    drawExperimentChart(els.experimentChart, ranked.slice(0, 8));
    els.rankingList.innerHTML = ranked.length
      ? ranked
          .slice(0, 10)
          .map(
            (item, index) => `
              <div class="rank-item">
                <span class="rank-index">${index + 1}</span>
                <div class="rank-name">
                  <strong>${escapeHtml(item.record.brand)} ${escapeHtml(item.record.model)}</strong>
                  <span>${escapeHtml(item.record.mode)} · ${escapeHtml(item.record.panel)}</span>
                </div>
                <span class="rank-score">${formatNumber(item.score, 1)}</span>
              </div>
            `
          )
          .join("")
      : `<p class="empty-copy">没有可参与评分的记录。</p>`;
  }

  function renderSchema() {
    els.recordSchema.innerHTML = (state.dataset.recordSchema || [])
      .map(
        (item) => `
          <div class="schema-item">
            <code>${escapeHtml(item.key)}</code>
            <span>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.required ? " · 必填" : ""}</span>
          </div>
        `
      )
      .join("");

    els.metricSchema.innerHTML = getMetricDefs()
      .map(
        (metric) => `
          <tr>
            <td><code>${escapeHtml(metric.key)}</code></td>
            <td>${escapeHtml(metric.label)}</td>
            <td>${escapeHtml(metric.group)}</td>
            <td>${escapeHtml(metric.unit)}</td>
            <td>${formatMetricDirection(metric)}</td>
          </tr>
        `
      )
      .join("");
  }

  function formatMetricDirection(metric) {
    if (metric.direction === "lower") {
      return "越低越好";
    }
    if (metric.direction === "target") {
      return `越接近 ${formatNumber(metric.target || 0, 0)}${metric.unit || ""} 越好`;
    }
    return "越高越好";
  }

  function drawMetricChart(canvas, records, metricKey) {
    const metric = metricKey === "overall" ? { label: "综合分", unit: "score", direction: "higher" } : getMetricDef(metricKey);
    const rows = records.map((record) => ({
      label: `${record.brand} ${record.model}`,
      value: metricKey === "overall" ? computeOverallScore(record) : getMetricValue(record, metricKey),
      score: metricKey === "overall" ? computeOverallScore(record) : getMetricScore(record, metricKey)
    }));
    drawBarChart(canvas, rows, `${metric.label}${metric.unit && metric.unit !== "score" ? " (" + metric.unit + ")" : ""}`, metric.direction === "lower");
  }

  function drawExperimentChart(canvas, ranked) {
    const rows = ranked.map((item) => ({
      label: `${item.record.brand} ${item.record.model}`,
      value: item.score,
      score: item.score
    }));
    drawBarChart(canvas, rows, "实验综合分", false);
  }

  function drawBarChart(canvas, rows, title, lowerIsBetter) {
    const ctx = canvas.getContext("2d");
    const colors = getChartColors();
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width;
    const height = 360;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colors.ink;
    ctx.font = "700 16px Segoe UI, Microsoft YaHei, Arial";
    ctx.fillText(title, 18, 26);

    if (!rows.length) {
      ctx.fillStyle = colors.muted;
      ctx.font = "13px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText("没有可绘制的数据。", 18, 70);
      return;
    }

    const chartTop = 48;
    const chartLeft = 190;
    const chartRight = 24;
    const rowHeight = Math.min(42, Math.max(28, (height - chartTop - 24) / rows.length));
    const maxValue = Math.max(...rows.map((row) => Math.max(Number(row.value) || 0, 0)), 1);
    const palette = colors.palette;

    rows.forEach((row, index) => {
      const y = chartTop + index * rowHeight;
      const barMax = Math.max(width - chartLeft - chartRight, 80);
      const normalized = lowerIsBetter && row.value > 0 ? 1 - row.value / maxValue : row.value / maxValue;
      const barWidth = Math.max(4, barMax * clamp(normalized, 0.04, 1));

      ctx.fillStyle = colors.muted;
      ctx.font = "12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(truncate(row.label, 24), 18, y + 19);

      ctx.fillStyle = colors.track;
      roundRect(ctx, chartLeft, y + 6, barMax, 18, 8);
      ctx.fill();

      ctx.fillStyle = palette[index % palette.length];
      roundRect(ctx, chartLeft, y + 6, barWidth, 18, 8);
      ctx.fill();

      ctx.fillStyle = colors.ink;
      ctx.font = "700 12px Segoe UI, Microsoft YaHei, Arial";
      ctx.fillText(formatNumber(row.value, Number(row.value) % 1 === 0 ? 0 : 1), chartLeft + Math.min(barWidth + 8, barMax - 44), y + 19);
    });
  }

  function getChartColors() {
    const root = getComputedStyle(document.documentElement);
    const css = (name, fallback) => root.getPropertyValue(name).trim() || fallback;
    return {
      background: css("--panel", "#243142"),
      ink: css("--ink", "#eef4fb"),
      muted: css("--muted", "#91a0b2"),
      track: css("--chart-track", "#182333"),
      palette: ["#4a93ff", "#9ca8ff", "#f2b35f", "#67d28b", "#71d6d1", "#bf9dff", "#e4c46f", "#ff7a77"]
    };
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  }

  function syncJsonEditor() {
    els.jsonInput.value = JSON.stringify(state.dataset, null, 2);
  }

  function handleFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      els.jsonInput.value = String(reader.result || "");
      renderValidation(parseAndValidateInput());
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  function parseAndValidateInput() {
    try {
      const parsed = JSON.parse(els.jsonInput.value);
      const normalized = normalizeIncomingData(parsed);
      return validateDataset(normalized);
    } catch (error) {
      return {
        ok: false,
        data: null,
        messages: [`JSON 解析失败：${error.message}`]
      };
    }
  }

  function normalizeIncomingData(parsed) {
    if (Array.isArray(parsed)) {
      return {
        version: state.dataset.version || "0.1.0",
        updatedAt: today(),
        recordSchema: state.dataset.recordSchema || [],
        metricDefs: state.dataset.metricDefs || [],
        tests: parsed
      };
    }
    return {
      version: parsed.version || state.dataset.version || "0.1.0",
      updatedAt: parsed.updatedAt || today(),
      recordSchema: parsed.recordSchema || state.dataset.recordSchema || [],
      metricDefs: parsed.metricDefs || state.dataset.metricDefs || [],
      tests: parsed.tests || []
    };
  }

  function validateDataset(dataset) {
    const messages = [];
    const requiredRecordFields = ["id", "brand", "model", "year", "panel", "date", "mode", "signal", "metrics"];
    const ids = new Set();

    if (!Array.isArray(dataset.tests)) {
      messages.push("tests 必须是数组。");
    }
    if (!Array.isArray(dataset.metricDefs) || !dataset.metricDefs.length) {
      messages.push("metricDefs 缺失，将无法显示指标规范。");
    }

    (dataset.tests || []).forEach((record, index) => {
      requiredRecordFields.forEach((field) => {
        if (record[field] === undefined || record[field] === null || record[field] === "") {
          messages.push(`第 ${index + 1} 条记录缺少 ${field}。`);
        }
      });
      if (ids.has(record.id)) {
        messages.push(`记录 id 重复：${record.id}`);
      }
      ids.add(record.id);

      Object.entries(record.metrics || {}).forEach(([key, metric]) => {
        if (!Number.isFinite(Number(metric.value))) {
          messages.push(`${record.id} 的 ${key}.value 不是数字。`);
        }
        if (!Number.isFinite(Number(metric.score)) || Number(metric.score) < 0 || Number(metric.score) > 100) {
          messages.push(`${record.id} 的 ${key}.score 必须是 0-100。`);
        }
      });
    });

    if (!(dataset.tests || []).length) {
      messages.push("至少需要一条 tests 记录。");
    }

    return {
      ok: messages.length === 0,
      data: dataset,
      messages: messages.length ? messages : [`校验通过：${dataset.tests.length} 条记录，${dataset.metricDefs.length} 个指标定义。`]
    };
  }

  function renderValidation(result) {
    els.validationResult.innerHTML = result.messages
      .map((message) => `<div class="validation-item ${result.ok ? "ok" : "bad"}">${escapeHtml(message)}</div>`)
      .join("");
  }

  function applyImportedData(mode) {
    const result = parseAndValidateInput();
    renderValidation(result);
    if (!result.ok) {
      showNotice("导入数据未通过校验，已保留当前数据。", "warning");
      return;
    }

    if (mode === "replace") {
      state.dataset = result.data;
      state.selectedIds.clear();
      state.activeRecordId = null;
      showNotice(`已替换为 ${result.data.tests.length} 条测试记录。`);
    } else {
      const mergedTests = new Map((state.dataset.tests || []).map((record) => [record.id, record]));
      result.data.tests.forEach((record) => mergedTests.set(record.id, record));

      const mergedMetricDefs = new Map((state.dataset.metricDefs || []).map((metric) => [metric.key, metric]));
      (result.data.metricDefs || []).forEach((metric) => mergedMetricDefs.set(metric.key, metric));

      state.dataset = {
        ...state.dataset,
        version: result.data.version || state.dataset.version,
        updatedAt: today(),
        recordSchema: result.data.recordSchema && result.data.recordSchema.length ? result.data.recordSchema : state.dataset.recordSchema,
        metricDefs: Array.from(mergedMetricDefs.values()),
        tests: Array.from(mergedTests.values())
      };
      showNotice(`已合并数据，目前共 ${state.dataset.tests.length} 条测试记录。`);
    }

    persistDataset();
    hydrateControls();
    renderAll();
  }

  function exportDataset(dataset, filename) {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    downloadBlob(blob, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function showNotice(message, type) {
    els.appNotice.hidden = false;
    els.appNotice.textContent = message;
    els.appNotice.style.borderColor = type === "warning" ? "rgba(180, 81, 76, 0.32)" : "";
    els.appNotice.style.background = type === "warning" ? "#fff2f1" : "";
    els.appNotice.style.color = type === "warning" ? "#b4514c" : "";
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => {
      els.appNotice.hidden = true;
    }, 5200);
  }

  function computeOverallScore(record, weights = presets["均衡"]) {
    const groups = getMetricGroups();
    let total = 0;
    let weightTotal = 0;
    groups.forEach((group) => {
      const groupScore = computeGroupScore(record, group);
      const weight = Number(weights[group]) || 0;
      if (Number.isFinite(groupScore) && weight > 0) {
        total += groupScore * weight;
        weightTotal += weight;
      }
    });
    return weightTotal ? total / weightTotal : 0;
  }

  function computeGroupScore(record, group) {
    const scores = getMetricDefs()
      .filter((metric) => metric.group === group)
      .map((metric) => getMetricScore(record, metric.key))
      .filter((score) => Number.isFinite(score) && score > 0);
    return scores.length ? avg(scores) : 0;
  }

  function getMetricGroups() {
    return Array.from(new Set(getMetricDefs().map((metric) => metric.group).filter(Boolean)));
  }

  function getMetricDefs() {
    return state.dataset.metricDefs || [];
  }

  function getMetricDef(metricKey) {
    return getMetricDefs().find((metric) => metric.key === metricKey) || { key: metricKey, label: metricKey, unit: "", direction: "higher" };
  }

  function getMetricValue(record, metricKey) {
    const metric = record.metrics && record.metrics[metricKey];
    return metric ? Number(metric.value) : 0;
  }

  function getMetricScore(record, metricKey) {
    const metric = record.metrics && record.metrics[metricKey];
    return metric ? Number(metric.score) : 0;
  }

  function formatMetric(record, metricKey) {
    const metricDef = getMetricDef(metricKey);
    const metric = record.metrics && record.metrics[metricKey];
    if (!metric || (Number(metric.value) === 0 && Number(metric.score) === 0)) {
      return "-";
    }
    const precision = metricDef.precision ?? (Number(metric.value) % 1 === 0 ? 0 : 1);
    const unit = metric.unit || metricDef.unit || "";
    return `${formatNumber(Number(metric.value), precision)}${unit === ":1" ? ":1" : unit ? " " + unit : ""}`;
  }

  function findRecord(recordId) {
    return (state.dataset.tests || []).find((record) => record.id === recordId);
  }

  function avg(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, precision) {
    if (!Number.isFinite(Number(value))) {
      return "-";
    }
    return Number(value).toLocaleString("zh-CN", {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision
    });
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) {
      return `${formatNumber(value / (1024 * 1024), 1)} MB`;
    }
    if (value >= 1024) {
      return `${formatNumber(value / 1024, 1)} KB`;
    }
    return `${value} B`;
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function truncate(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function cssId(value) {
    return String(value).replace(/[^\w-]/g, "_");
  }

  function escapeAttr(value) {
    return escapeHtml(String(value)).replace(/"/g, "&quot;");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
