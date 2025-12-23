// ==UserScript==
// @name         Steam-Discount-Filter
// @namespace    https://github.com/LWZsama
// @author       Wenze(Lucas) Luo
// @license      MIT
// @version      1.0.1
// @description  Adds a Steam-styled discount range slider to Steam search for discount filtering.
// @match        https://store.steampowered.com/search*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://github.com/LWZsama/Steam-Discount-Filter/raw/refs/heads/main/Steam-Discount-Filter.user.js
// @updateURL    https://github.com/LWZsama/Steam-Discount-Filter/raw/refs/heads/main/Steam-Discount-Filter.user.js
// ==/UserScript==

(() => {
  "use strict";

  const WRAPPER_ID = "discount_filter_wrapper";

  // 固定折扣范围边界
  const MIN_PERCENTAGE = 50;
  const MAX_PERCENTAGE = 100;

  // 存储配置键名
  const STORAGE_KEY = "tmdf";
  const DEFAULT_SETTINGS = { min: 50, max: 100, enabled: true };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadSettings() {
    try {
      const storedJson = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      // 合并默认设置与存储的设置
      const settings = Object.assign({}, DEFAULT_SETTINGS, storedJson || {});

      // 确保数值在有效范围内
      settings.min = clamp(settings.min, MIN_PERCENTAGE, MAX_PERCENTAGE);
      settings.max = clamp(settings.max, MIN_PERCENTAGE, MAX_PERCENTAGE);
      settings.enabled = !!settings.enabled;
      return settings;
    } catch (error) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  // 初始化设置
  let currentSettings = loadSettings();

  // 从每一行读取折扣信息
  function getDiscountPercentage(row) {
    // 尝试从 search_discount_block 获取
    const discountBlock = row.querySelector(".discount_block.search_discount_block");
    if (discountBlock) {
      const discountValue = parseInt(discountBlock.getAttribute("data-discount"), 10);
      if (Number.isFinite(discountValue)) {
        return clamp(Math.abs(discountValue), 0, 100);
      }
    }

    // 尝试从 discount_pct 获取
    const percentageElement = row.querySelector(".discount_pct");
    if (percentageElement) {
      const matchResult = String(percentageElement.textContent || "").match(/-?\d+/);
      if (matchResult) {
        return clamp(Math.abs(parseInt(matchResult[0], 10)), 0, 100);
      }
    }
    return null;
  }

  // 执行过滤逻辑
  function applyFilter() {
    const resultRows = document.querySelectorAll("a.search_result_row");
    const currentMin = Math.min(currentSettings.min, currentSettings.max);
    const currentMax = Math.max(currentSettings.min, currentSettings.max);

    let countShown = 0;
    let countHidden = 0;

    resultRows.forEach((row) => {
      const percentage = getDiscountPercentage(row);
      let shouldShow = true;

      if (currentSettings.enabled) {
        // 只筛选有折扣的条目
        const isInRange = percentage >= currentMin && percentage <= currentMax;
        shouldShow = percentage !== null && isInRange;
      }

      row.style.display = shouldShow ? "" : "none";
      if (shouldShow) {
        countShown++;
      } else {
        countHidden++;
      }
    });

    // 更新 UI 显示状态
    const displayLabel = document.getElementById("tmdf_range_display");
    const statusLabel = document.getElementById("tmdf_stat");

    if (displayLabel) {
      displayLabel.textContent = `${currentMin}% — ${currentMax}%`;
    }
    if (statusLabel) {
      statusLabel.textContent = currentSettings.enabled ? `Showing: ${countShown}  Hidden: ${countHidden}` : "Disabled (Show All)";
    }
  }

  // 更新原生滑块轨道渐变
  function updateTrackGradient() {
    const minInput = document.getElementById("tmdf_min");
    const maxInput = document.getElementById("tmdf_max");
    const trackInner = document.getElementById("tmdf_inner");

    if (!minInput || !maxInput || !trackInner) return;

    const currentMin = Math.min(+minInput.value, +maxInput.value);
    const currentMax = Math.max(+minInput.value, +maxInput.value);

    const totalSpan = MAX_PERCENTAGE - MIN_PERCENTAGE || 1;
    const leftPercentage = ((currentMin - MIN_PERCENTAGE) / totalSpan) * 100;
    const rightPercentage = ((currentMax - MIN_PERCENTAGE) / totalSpan) * 100;

    trackInner.style.setProperty("--tmdf_left", `${leftPercentage}%`);
    trackInner.style.setProperty("--tmdf_right", `${rightPercentage}%`);
  }

  // 确保 UI 操作在浏览器渲染帧时进行
  let Scheduled = false;
  function scheduleUpdate() {
    if (Scheduled) return;
    Scheduled = true;
    requestAnimationFrame(() => {
      Scheduled = false;
      updateTrackGradient();
      applyFilter();
    });
  }

  // 注入 CSS 样式
  function injectStyles() {
    if (document.getElementById("tmdf_style")) return;

    const styleElement = document.createElement("style");
    styleElement.id = "tmdf_style";
    styleElement.textContent = `
      #tmdf_range_container { margin-top: 8px; }

      #tmdf_range_container .range_container_inner {
        position: relative;
      }

      #tmdf_range_container .range_input.tmdf_min,
      #tmdf_range_container .range_input.tmdf_max {
        position: absolute;
        left: 0; top: 0;
        width: 100%;
        margin: 0;
        background: transparent;
        pointer-events: none;
      }
      #tmdf_range_container .range_input.tmdf_min::-webkit-slider-thumb,
      #tmdf_range_container .range_input.tmdf_max::-webkit-slider-thumb { pointer-events: auto; }
      #tmdf_range_container .range_input.tmdf_min::-moz-range-thumb,
      #tmdf_range_container .range_input.tmdf_max::-moz-range-thumb { pointer-events: auto; }

      #tmdf_inner {
        --tmdf_left: 0%;
        --tmdf_right: 100%;
        --tmdf_track_grey: rgba(255,255,255,0.14);
        --tmdf_track_blue: rgba(102,192,244,0.95);
      }

      #tmdf_min::-webkit-slider-runnable-track {
        background: linear-gradient(to right,
          var(--tmdf_track_grey) 0%,
          var(--tmdf_track_grey) var(--tmdf_left),
          var(--tmdf_track_blue) var(--tmdf_left),
          var(--tmdf_track_blue) var(--tmdf_right),
          var(--tmdf_track_grey) var(--tmdf_right),
          var(--tmdf_track_grey) 100%
        ) !important;
        border: none !important;
        height: 4px;
        border-radius: 2px;
      }

      #tmdf_min::-moz-range-track {
        background: linear-gradient(to right,
          var(--tmdf_track_grey) 0%,
          var(--tmdf_track_grey) var(--tmdf_left),
          var(--tmdf_track_blue) var(--tmdf_left),
          var(--tmdf_track_blue) var(--tmdf_right),
          var(--tmdf_track_grey) var(--tmdf_right),
          var(--tmdf_track_grey) 100%
        ) !important;
        border: none !important;
        height: 4px;
        border-radius: 2px;
      }

      #tmdf_max::-webkit-slider-runnable-track {
        background: transparent !important;
        border: none !important;
      }
      #tmdf_max::-moz-range-track {
        background: transparent !important;
        border: none !important;
      }

      #tmdf_range_display {
        margin-top: 8px !important;
        line-height: 18px;
      }

      #tmdf_header_row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 10px;
      }
      #tmdf_title {
        font-size: 14px;
        font-weight: 700;
        opacity: .95;
      }
      #tmdf_enable_wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        user-select: none;
        cursor: pointer;
        opacity: .95;
      }
      #tmdf_enable_wrap input { cursor: pointer; }
      #tmdf_stat { margin-top: 8px; opacity: .75; }
    `;
    document.head.appendChild(styleElement);
  }

  // DOM 定位辅助函数
  function findPriceRangeContainer() {
    const priceInput = document.getElementById("price_range");
    if (!priceInput) return null;
    return priceInput.closest(".range_container");
  }

  function findBlockContentInner() {
    return document.querySelector(".block_content.block_content_inner") || document.querySelector(".block_content_inner") || null;
  }

  // 构建并插入 UI 区块
  function inject() {
    injectStyles();

    // 如果已存在则不重复插入
    if (document.getElementById("tmdf_range_container")) return true;

    const priceRangeContainer = findPriceRangeContainer();
    const blockInner = findBlockContentInner();

    if (!blockInner || !priceRangeContainer) return false;

    const firstRuleAfterPrice = (() => {
      const rule = priceRangeContainer.nextElementSibling;
      return rule && rule.classList && rule.classList.contains("block_rule") ? rule : null;
    })();

    // 创建容器 Wrapper
    const wrapper = document.createElement("div");
    wrapper.id = WRAPPER_ID;

    wrapper.innerHTML = `
      <div id="tmdf_header_row">
        <div id="tmdf_title">Discount Range</div>
        <label id="tmdf_enable_wrap">
          <input id="tmdf_enabled" type="checkbox" />
          <span>Enable</span>
        </label>
      </div>

      <div class="range_container" id="tmdf_range_container" style="margin-top: 8px;">
        <div class="range_container_inner" id="tmdf_inner">
          <input class="range_input tmdf_min" type="range" id="tmdf_min" min="${MIN_PERCENTAGE}" max="${MAX_PERCENTAGE}" step="1" value="${DEFAULT_SETTINGS.min}">
          <input class="range_input tmdf_max" type="range" id="tmdf_max" min="${MIN_PERCENTAGE}" max="${MAX_PERCENTAGE}" step="1" value="${DEFAULT_SETTINGS.max}">
        </div>
        <div class="range_display" id="tmdf_range_display">${currentSettings.min}% — ${currentSettings.max}%</div>
      </div>

      <div id="tmdf_stat"></div>
    `;

    // 插入到 DOM 中
    if (firstRuleAfterPrice && firstRuleAfterPrice.parentElement) {
      firstRuleAfterPrice.parentElement.insertBefore(wrapper, firstRuleAfterPrice.nextSibling);
      const extraRule = document.createElement("div");
      extraRule.className = "block_rule";
      wrapper.parentElement.insertBefore(extraRule, wrapper.nextSibling);
    } else {
      blockInner.appendChild(wrapper);
      const extraRule = document.createElement("div");
      extraRule.className = "block_rule";
      blockInner.appendChild(extraRule);
    }

    // 绑定事件监听
    const enableCheckbox = document.getElementById("tmdf_enabled");
    const minInput = document.getElementById("tmdf_min");
    const maxInput = document.getElementById("tmdf_max");

    // 从设置初始化 UI 值
    enableCheckbox.checked = !!currentSettings.enabled;
    minInput.value = String(clamp(currentSettings.min, MIN_PERCENTAGE, MAX_PERCENTAGE));
    maxInput.value = String(clamp(currentSettings.max, MIN_PERCENTAGE, MAX_PERCENTAGE));

    updateTrackGradient();
    applyFilter();

    const commitChanges = () => {
      currentSettings.enabled = !!enableCheckbox.checked;
      currentSettings.min = clamp(parseInt(minInput.value, 10), MIN_PERCENTAGE, MAX_PERCENTAGE);
      currentSettings.max = clamp(parseInt(maxInput.value, 10), MIN_PERCENTAGE, MAX_PERCENTAGE);
      saveSettings(currentSettings);
    };

    const onSliderInput = () => {
      let valMin = +minInput.value;
      let valMax = +maxInput.value;

      // 防止滑块交叉
      if (valMin > valMax) {
        if (document.activeElement === minInput) {
          maxInput.value = String(valMin);
        } else {
          minInput.value = String(valMax);
        }
      }
      commitChanges();
      scheduleUpdate();
    };

    minInput.addEventListener("input", onSliderInput);
    maxInput.addEventListener("input", onSliderInput);
    enableCheckbox.addEventListener("change", () => {
      commitChanges();
      scheduleUpdate();
    });

    return true;
  }

  // 观察页面动态加载
  function attachObservers() {
    const searchResultsRoot = document.getElementById("search_results") || document.body;

    const resultObserver = new MutationObserver(() => scheduleUpdate());
    resultObserver.observe(searchResultsRoot, { childList: true, subtree: true });

    // 防止页面重绘导致控件丢失
    const uiObserver = new MutationObserver(() => {
      if (!document.getElementById("tmdf_range_container")) {
        inject();
      }
    });
    uiObserver.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    inject();
    scheduleUpdate();
    attachObservers();
  }

  // 确保在页面加载完成后启动
  if (document.readyState === "complete" || document.readyState === "interactive") {
    boot();
  } else {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  }
})();
