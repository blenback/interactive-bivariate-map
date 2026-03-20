/**
 * js/main.js — Bivariate raster map
 *
 * Loads pre-classified TIFs (pixel values 1–9) and palette JSONs from R.
 * Three groups: ES | BD | BD-ES — no scaling/classification selectors.
 * All groups are lazily loaded and cached after first selection.
 */

import { drawLegend } from "./legend.js";
import { initTooltip, showTooltip, hideTooltip } from "./tooltip.js";

const { fromArrayBuffer } = window.GeoTIFF;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const GROUPS = [
  { id: "ES", label: "ES", tifUrl: "data/ES.tif", jsonUrl: "data/ES_palette_info.json" },
  { id: "BD", label: "BD", tifUrl: "data/BD.tif", jsonUrl: "data/BD_palette_info.json" },
  { id: "BD-ES", label: "BD-ES", tifUrl: "data/BD-ES.tif", jsonUrl: "data/BD-ES_palette_info.json" }
];

const CONFIG = {
  mapSelector: "#map",
  legendSelector: "#legend",
  insightSelector: "#insight"
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentGroup = GROUPS[0].id;
let currentSvg = null;

// Cache: groupId → { pixels, width, height, palette }
const cache = new Map();

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function init() {
  buildGroupToggle();
  initTooltip();
  await loadAndRender();
}

// ---------------------------------------------------------------------------
// Load (if not cached) + render
// ---------------------------------------------------------------------------
async function loadAndRender() {
  setText(CONFIG.insightSelector, "Loading…");

  try {
    if (!cache.has(currentGroup)) {
      await loadGroup(currentGroup);
    }
    render(currentGroup);
  } catch (err) {
    console.error(`[${currentGroup}] Error:`, err);
    setHTML(CONFIG.mapSelector, `<p class="error">Error loading ${currentGroup}: ${err.message}</p>`);
  }
}

// ---------------------------------------------------------------------------
// Fetch + cache one group
// ---------------------------------------------------------------------------
async function loadGroup(groupId) {
  const group = GROUPS.find(g => g.id === groupId);
  console.log(`[${groupId}] Fetching…`);

  const [tifData, paletteJson] = await Promise.all([
    loadClassifiedTif(group.tifUrl),
    loadPaletteJson(group.jsonUrl)
  ]);

  // Build 3×3 colour matrix from R's JSON
  // Keys "x-y": x = perf class (1–3, rows), y = var class (1–3, cols)
  // palette[x-1][y-1] → palette[perfIdx][varIdx]
  const palette = [["","",""],["","",""],["","",""]];
  for (const [classKey, val] of Object.entries(paletteJson)) {
    const [x, y] = classKey.split("-").map(Number);
    palette[x - 1][y - 1] = val.color;
  }

  cache.set(groupId, { ...tifData, palette });
  console.log(`[${groupId}] Cached — ${tifData.width}×${tifData.height}, ${tifData.validCount} valid pixels`);
}

// ---------------------------------------------------------------------------
// Render from cache
// ---------------------------------------------------------------------------
function render(groupId) {
  const entry = cache.get(groupId);
  if (!entry) return;

  const { pixels, width, height, palette } = entry;
  const mapEl = document.querySelector(CONFIG.mapSelector);
  if (!mapEl) return;
  mapEl.innerHTML = "";

  // Re-draw legend with this group's exact palette
  setHTML(CONFIG.legendSelector, "");
  drawLegend(CONFIG.legendSelector, {
    labelA: "Performance",
    labelB: "Variation",
    numClasses: 3,
    colors: palette,
    onCellHover: (classA, classB) => highlightClass(groupId, classA, classB),
    onCellLeave: () => highlightClass(groupId, null, null)
  });

  // Build canvas + SVG
  const { canvas, pixelSize } = buildCanvas(pixels, width, height, palette, null);
  currentSvg = buildSvg(canvas, pixels, width, height, pixelSize, mapEl);

  // Insight counts
  const counts = { stable: 0, volatile: 0, highPerf: 0, highVar: 0, lowVar: 0, total: 0 };
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (v < 1 || v > 9) continue;
    const perfClass = Math.ceil(v / 3);
    const varClass = ((v - 1) % 3) + 1;
    counts.total++;
    if (perfClass === 3 && varClass === 1) counts.stable++;
    if (perfClass === 1 && varClass === 3) counts.volatile++;
    if (perfClass === 3) counts.highPerf++;
    if (varClass === 3) counts.highVar++;
    if (varClass === 1) counts.lowVar++;
  }

  setHTML(CONFIG.insightSelector, counts.stable > 0
    ? `<span class="hl-teal-dark">${counts.stable} stable, high-performing pixels</span> ` +
    `versus <span class="hl-accent">${counts.volatile} volatile, low-performing pixels</span>. ` +
    `<span class="hl-teal">${counts.lowVar}</span> regions show low variation.`
    : `<span class="hl-teal">${counts.highPerf} pixels</span> show high performance; ` +
    `<span class="hl-accent">${counts.highVar}</span> show significant variation.`
  );
}

// ---------------------------------------------------------------------------
// Legend highlight — re-render canvas with non-matching pixels dimmed
// ---------------------------------------------------------------------------
function highlightClass(groupId, classA, classB) {
  if (!currentSvg) return;
  const entry = cache.get(groupId);
  if (!entry) return;

  const { pixels, width, height, palette } = entry;
  const highlight = classA !== null ? { classA, classB } : null;
  const { canvas } = buildCanvas(pixels, width, height, palette, highlight);
  currentSvg.select("image").attr("href", canvas.toDataURL());
}

// ---------------------------------------------------------------------------
// Canvas renderer
// ---------------------------------------------------------------------------
function buildCanvas(pixels, width, height, palette, highlight) {
  const mapNode = document.querySelector(CONFIG.mapSelector);
  const wrapper = mapNode?.closest(".map-wrapper") || mapNode || document.body;
  const displayWidth = wrapper.clientWidth || 900;
  const displayHeight = wrapper.clientHeight || 600;

  const pixelSize = Math.min(displayWidth / width, displayHeight / height);
  const canvasWidth = Math.round(width * pixelSize);
  const canvasHeight = Math.round(height * pixelSize);

  // Pre-compute RGB for all 9 class values
  // v = (x-1)*3 + y  →  x = ceil(v/3) = perfIdx+1,  y = (v-1)%3+1 = varIdx+1
  // palette[perfIdx][varIdx]
  const rgbByValue = new Array(10);
  for (let v = 1; v <= 9; v++) {
    const perfIdx = Math.ceil(v / 3) - 1;  // x - 1
    const varIdx  = (v - 1) % 3;           // y - 1
    const hex = palette[perfIdx]?.[varIdx];
    rgbByValue[v] = hex ? hexToRgb(hex) : { r: 221, g: 216, b: 206 };
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(canvasWidth, canvasHeight);
  const buf = imgData.data;

  for (let cy = 0; cy < canvasHeight; cy++) {
    for (let cx = 0; cx < canvasWidth; cx++) {
      const v = pixels[Math.floor(cy / pixelSize) * width + Math.floor(cx / pixelSize)];
      const idx = (cy * canvasWidth + cx) * 4;

      if (v >= 1 && v <= 9) {
        let show = true;
        if (highlight !== null) {
          const perfIdx = Math.ceil(v / 3) - 1;
          const varIdx  = (v - 1) % 3;
          // legend: onCellHover(secondIdx=varIdx, firstIdx=perfIdx)
          // so highlight.classA = varIdx, highlight.classB = perfIdx
          show = (varIdx === highlight.classA && perfIdx === highlight.classB);
        }
        if (show) {
          const rgb = rgbByValue[v];
          buf[idx] = rgb.r;
          buf[idx + 1] = rgb.g;
          buf[idx + 2] = rgb.b;
          buf[idx + 3] = 255;
        } else {
          buf[idx] = 210; buf[idx + 1] = 206; buf[idx + 2] = 200; buf[idx + 3] = 255;
        }
      } else {
        buf[idx] = 221; buf[idx + 1] = 216; buf[idx + 2] = 206; buf[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, pixelSize };
}

// ---------------------------------------------------------------------------
// SVG overlay (canvas image + transparent hover rects)
// ---------------------------------------------------------------------------
function buildSvg(canvas, pixels, width, height, pixelSize, container) {
  const canvasWidth = Math.round(width * pixelSize);
  const canvasHeight = Math.round(height * pixelSize);

  const svg = d3.select(container)
    .append("svg")
    .style("width", "100%")
    .style("height", "auto")
    .attr("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("image")
    .attr("href", canvas.toDataURL())
    .attr("width", canvasWidth)
    .attr("height", canvasHeight);

  const hoverData = [];
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (v < 1 || v > 9) continue;
    hoverData.push({
      _col: i % width,
      _row: Math.floor(i / width),
      classA: Math.ceil(v / 3) - 1,
      classB: (v - 1) % 3
    });
  }

  svg.selectAll(".pixel-overlay")
    .data(hoverData)
    .enter()
    .append("rect")
    .attr("class", "pixel-overlay")
    .attr("data-class", d => `${d.classA}-${d.classB}`)
    .attr("x", d => d._col * pixelSize)
    .attr("y", d => d._row * pixelSize)
    .attr("width", pixelSize)
    .attr("height", pixelSize)
    .style("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => showTooltip(event, d))
    .on("mousemove", (event, d) => showTooltip(event, d))
    .on("mouseleave", () => hideTooltip());

  return svg;
}

// ---------------------------------------------------------------------------
// Group toggle (header)
// ---------------------------------------------------------------------------
function buildGroupToggle() {
  const header = document.querySelector("header");
  const nav = document.createElement("div");
  nav.className = "group-toggle";

  GROUPS.forEach(group => {
    const btn = document.createElement("button");
    btn.textContent = group.label;
    btn.dataset.id = group.id;
    btn.className = "ctrl-btn" + (group.id === currentGroup ? " active" : "");
    btn.addEventListener("click", () => {
      if (group.id === currentGroup) return;
      currentGroup = group.id;
      nav.querySelectorAll(".ctrl-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.id === group.id));
      loadAndRender();
    });
    nav.appendChild(btn);
  });

  header.appendChild(nav);

  if (!document.getElementById("controls-style")) {
    const style = document.createElement("style");
    style.id = "controls-style";
    style.textContent = `
      .group-toggle { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
      .ctrl-btn {
        font-family: inherit; font-size: 0.72rem; font-weight: 600;
        letter-spacing: 0.04em; text-transform: uppercase;
        padding: 0.25rem 0.75rem;
        border: 1px solid var(--border); background: transparent;
        color: var(--muted); cursor: pointer; border-radius: 2px;
        transition: background 0.12s, color 0.12s;
      }
      .ctrl-btn:hover  { background: var(--border); color: var(--text); }
      .ctrl-btn.active { background: var(--text); color: var(--bg); border-color: var(--text); }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// GeoTIFF loader
// ---------------------------------------------------------------------------
async function loadClassifiedTif(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const noDataValue = image.getGDALNoData();
  const raw = (await image.readRasters({ samples: [0] }))[0];

  let validCount = 0;
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (isNoData(v, noDataValue) || v < 1 || v > 9) { pixels[i] = 0; }
    else { pixels[i] = v; validCount++; }
  }

  return { pixels, width, height, validCount };
}

async function loadPaletteJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getEl(sel) { try { return document.querySelector(sel); } catch { return null; } }
function setText(sel, txt) { const el = getEl(sel); if (el) el.textContent = txt; }
function setHTML(sel, html) { const el = getEl(sel); if (el) el.innerHTML = html; }

function isNoData(value, noDataValue) {
  if (!isFinite(value)) return true;
  if (noDataValue != null && value === noDataValue) return true;
  return false;
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
    : { r: 221, g: 216, b: 206 };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { init };
