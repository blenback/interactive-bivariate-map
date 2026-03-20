/**
 * js/main.js — Bivariate raster map
 *
 * Loads pre-classified TIFs (pixel values 1–9) and palette JSONs from R.
 * Three groups: ES | BD | BD-ES — no scaling/classification selectors.
 * All groups are lazily loaded and cached after first selection.
 */

import { drawLegend } from "./legend.js";

const { fromArrayBuffer } = window.GeoTIFF;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const GROUPS = [
  { id: "ES", label: "ES", tifUrl: "data/ES.tif", jsonUrl: "data/palette.json" },
  { id: "BD", label: "BD", tifUrl: "data/BD.tif", jsonUrl: "data/palette.json" },
  { id: "BD-ES", label: "BD-ES", tifUrl: "data/BD-ES.tif", jsonUrl: "data/palette.json" }
];

const CONFIG = {
  mapSelector: "#map",
  legendSelector: "#legend",
  renderOversample: 3,
  assetVersion: "12"
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentGroup = GROUPS[0].id;
let currentSvg = null;
let currentLegendSvg = null;
let pinnedLegendClass = null;
let currentClassAreasSqM = {};

// Cache: groupId → { pixels, width, height, palette }
const cache = new Map();

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function init() {
  buildGroupToggle();
  await loadAndRender();
}

// ---------------------------------------------------------------------------
// Load (if not cached) + render
// ---------------------------------------------------------------------------
async function loadAndRender() {
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
  const palette = [["", "", ""], ["", "", ""], ["", "", ""]];
  for (const [classKey, val] of Object.entries(paletteJson)) {
    const [x, y] = classKey.split("-").map(Number);
    palette[y - 1][x - 1] = val.color;
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
  mapEl.style.position = "relative";
  mapEl.innerHTML = "";

  // Re-draw legend with this group's exact palette
  setHTML(CONFIG.legendSelector, "");
  currentLegendSvg = drawLegend(CONFIG.legendSelector, {
    labelA: "Performance",
    labelB: "Stability",
    numClasses: 3,
    colors: palette,
    selectedCell: pinnedLegendClass,
    onCellHover: (classA, classB) => highlightClass(groupId, classA, classB),
    onCellLeave: () => highlightClass(groupId, null, null),
    onCellClick: (classA, classB) => togglePinnedLegendClass(groupId, classA, classB)
  });

  const renderedImages = getRenderedImages(entry);
  currentSvg = buildSvg(
    renderedImages.baseHref,
    renderedImages.canvasWidth,
    renderedImages.canvasHeight,
    mapEl
  );

  const counts = summarisePixels(pixels, entry.cellAreaSqM);
  currentClassAreasSqM = counts.classAreasSqM;
  updateLegendSelection();
}

// ---------------------------------------------------------------------------
// Legend highlight — re-render canvas with non-matching pixels dimmed
// ---------------------------------------------------------------------------
function highlightClass(groupId, classA, classB) {
  if (!currentSvg) return;
  const entry = cache.get(groupId);
  if (!entry) return;

  const highlight = classA !== null
    ? { classA, classB }
    : pinnedLegendClass;
  const renderedImages = getRenderedImages(entry);
  const href = highlight === null
    ? renderedImages.baseHref
    : renderedImages.filteredHrefs[getHighlightKey(highlight)];
  currentSvg.select(".zoom-layer image").attr("href", href);
}

function togglePinnedLegendClass(groupId, classA, classB) {
  const isSamePinned = pinnedLegendClass !== null
    && pinnedLegendClass.classA === classA
    && pinnedLegendClass.classB === classB;

  pinnedLegendClass = isSamePinned ? null : { classA, classB };
  updateLegendSelection();
  highlightClass(groupId, null, null);
}

function updateLegendSelection() {
  if (!currentLegendSvg) return;

  currentLegendSvg.selectAll(".legend-cell")
    .attr("stroke", "transparent")
    .attr("stroke-width", 0);

  currentLegendSvg.selectAll(".legend-count").remove();

  if (pinnedLegendClass === null) return;

  const selectedCell = currentLegendSvg
    .select(`.cell-${pinnedLegendClass.classB}-${pinnedLegendClass.classA}`);

  selectedCell
    .attr("stroke", "#2a2a2a")
    .attr("stroke-width", 2);

  const cellNode = selectedCell.node();
  if (!cellNode) return;

  const areaSqM = currentClassAreasSqM[getHighlightKey(pinnedLegendClass)] ?? 0;
  const { x, y, width, height } = cellNode.getBBox();

  currentLegendSvg
    .select("g")
    .append("text")
    .attr("class", "legend-count")
    .attr("x", x + (width / 2))
    .attr("y", y + (height / 2) + 4)
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none")
    .style("font-size", "7px")
    .style("font-weight", "700")
    .style("fill", "#1f1f1f")
    .style("paint-order", "stroke")
    .style("stroke", "#ffffff")
    .style("stroke-width", "2px")
    .text(formatAreaLabel(areaSqM));
}

// ---------------------------------------------------------------------------
// Canvas renderer
// ---------------------------------------------------------------------------
function buildCanvas(pixels, width, height, palette, highlight) {
  const mapNode = document.querySelector(CONFIG.mapSelector);
  const displayWidth = mapNode?.clientWidth || 900;
  const displayHeight = mapNode?.clientHeight || 600;
  const pixelSize = Math.min(displayWidth / width, displayHeight / height) * CONFIG.renderOversample;
  const canvasWidth = Math.round(width * pixelSize);
  const canvasHeight = Math.round(height * pixelSize);

  // Pre-compute RGB for all 9 class values
  // v = (x-1)*3 + y  →  x = ceil(v/3) = perfIdx+1,  y = (v-1)%3+1 = varIdx+1
  // palette[perfIdx][varIdx]
  const rgbByValue = new Array(10);
  for (let v = 1; v <= 9; v++) {
    const perfIdx = Math.ceil(v / 3) - 1;  // x - 1
    const varIdx = (v - 1) % 3;           // y - 1
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
          const varIdx = (v - 1) % 3;
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
// SVG overlay
// ---------------------------------------------------------------------------
function buildSvg(imageHref, canvasWidth, canvasHeight, container) {
  const framePadding = 18;
  const framedWidth = canvasWidth + (framePadding * 2);
  const framedHeight = canvasHeight + (framePadding * 2);
  const mapPadding = 6.4;
  const availableWidth = Math.max(0, (container.clientWidth || framedWidth) - (mapPadding * 2));
  const availableHeight = Math.max(0, (container.clientHeight || framedHeight) - (mapPadding * 2));
  const renderScale = Math.min(availableWidth / framedWidth, availableHeight / framedHeight);
  const renderedWidth = framedWidth * renderScale;
  const renderedHeight = framedHeight * renderScale;
  const offsetLeft = mapPadding + ((availableWidth - renderedWidth) / 2);
  const offsetTop = mapPadding;

  const svg = d3.select(container)
    .append("svg")
    .style("position", "absolute")
    .style("left", `${offsetLeft}px`)
    .style("top", `${offsetTop}px`)
    .style("width", `${renderedWidth}px`)
    .style("height", `${renderedHeight}px`)
    .style("cursor", "grab")
    .style("touch-action", "none")
    .attr("viewBox", `0 0 ${framedWidth} ${framedHeight}`)
    .attr("preserveAspectRatio", "xMidYMin meet");

  const hitbox = svg.append("rect")
    .attr("class", "zoom-hitbox")
    .attr("x", framePadding)
    .attr("y", framePadding)
    .attr("width", canvasWidth)
    .attr("height", canvasHeight)
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  const defs = svg.append("defs");
  defs.append("clipPath")
    .attr("id", "map-clip")
    .append("rect")
    .attr("x", framePadding)
    .attr("y", framePadding)
    .attr("width", canvasWidth)
    .attr("height", canvasHeight);

  svg.append("rect")
    .attr("x", framePadding)
    .attr("y", framePadding)
    .attr("width", canvasWidth)
    .attr("height", canvasHeight)
    .attr("fill", "#ddd8ce")
    .style("pointer-events", "none");

  const zoomLayer = svg.append("g")
    .attr("class", "zoom-layer")
    .attr("clip-path", "url(#map-clip)");

  zoomLayer.append("image")
    .attr("href", imageHref)
    .attr("x", framePadding)
    .attr("y", framePadding)
    .attr("width", canvasWidth)
    .attr("height", canvasHeight)
    .style("pointer-events", "none");

  let currentTransform = { x: 0, y: 0, k: 1 };

  function clampTransform(transform) {
    const nextK = Math.max(1, Math.min(8, transform.k));
    const minX = canvasWidth - (canvasWidth * nextK);
    const maxX = 0;
    const minY = canvasHeight - (canvasHeight * nextK);
    const maxY = 0;

    return {
      x: Math.max(minX, Math.min(maxX, transform.x)),
      y: Math.max(minY, Math.min(maxY, transform.y)),
      k: nextK
    };
  }

  function applyTransform() {
    zoomLayer.attr(
      "transform",
      `translate(${currentTransform.x},${currentTransform.y}) scale(${currentTransform.k})`
    );
  }

  function zoomBy(factor) {
    const nextK = Math.max(1, Math.min(8, currentTransform.k * factor));
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const scaleRatio = nextK / currentTransform.k;

    currentTransform = clampTransform({
      x: centerX - ((centerX - currentTransform.x) * scaleRatio),
      y: centerY - ((centerY - currentTransform.y) * scaleRatio),
      k: nextK
    });

    applyTransform();
  }

  applyTransform();

  let dragStartTransform = currentTransform;
  hitbox.call(
    d3.drag()
      .subject((event) => ({ x: event.x, y: event.y }))
      .on("start", () => {
        dragStartTransform = currentTransform;
        svg.style("cursor", "grabbing");
      })
      .on("drag", (event) => {
        currentTransform = clampTransform({
          x: dragStartTransform.x + event.x - event.subject.x,
          y: dragStartTransform.y + event.y - event.subject.y,
          k: dragStartTransform.k
        });
        applyTransform();
      })
      .on("end", () => {
        svg.style("cursor", "grab");
      })
  );

  buildZoomControls(container, offsetLeft, offsetTop, renderedWidth, framePadding, renderScale, zoomBy);

  return svg;
}

function buildZoomControls(container, offsetLeft, offsetTop, renderedWidth, framePadding, renderScale, onZoom) {
  container.querySelector(".zoom-controls-overlay")?.remove();
  const frameInset = framePadding * renderScale;

  const overlay = document.createElement("div");
  overlay.className = "zoom-controls-overlay";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "6";

  const controls = document.createElement("div");
  controls.className = "zoom-controls";
  controls.style.position = "absolute";
  controls.style.top = `${offsetTop + frameInset + 8}px`;
  controls.style.left = `${offsetLeft + renderedWidth - frameInset - 32}px`;
  controls.style.display = "flex";
  controls.style.flexDirection = "column";
  controls.style.gap = "0.35rem";
  controls.style.pointerEvents = "auto";

  const zoomInButton = createZoomButton("+", "Zoom in", () => {
    onZoom(1.35);
  });

  const zoomOutButton = createZoomButton("-", "Zoom out", () => {
    onZoom(1 / 1.35);
  });

  controls.appendChild(zoomInButton);
  controls.appendChild(zoomOutButton);
  overlay.appendChild(controls);
  container.appendChild(overlay);
}

function createZoomButton(label, ariaLabel, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.style.width = "2rem";
  button.style.height = "2rem";
  button.style.border = "1px solid var(--border)";
  button.style.background = "rgba(255, 255, 255, 0.94)";
  button.style.color = "var(--text)";
  button.style.font = "600 1rem/1 var(--font)";
  button.style.cursor = "pointer";
  button.style.borderRadius = "3px";
  button.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.08)";
  button.style.padding = "0";
  button.addEventListener("click", onClick);
  return button;
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
  const response = await fetch(withAssetVersion(url), { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const noDataValue = image.getGDALNoData();
  const cellAreaSqM = getCellAreaSqM(image);
  const raw = (await image.readRasters({ samples: [0] }))[0];

  let validCount = 0;
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (isNoData(v, noDataValue) || v < 1 || v > 9) { pixels[i] = 0; }
    else { pixels[i] = v; validCount++; }
  }

  return { pixels, width, height, validCount, cellAreaSqM };
}

async function loadPaletteJson(url) {
  const response = await fetch(withAssetVersion(url), { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getEl(sel) { try { return document.querySelector(sel); } catch { return null; } }
function setText(sel, txt) { const el = getEl(sel); if (el) el.textContent = txt; }
function setHTML(sel, html) { const el = getEl(sel); if (el) el.innerHTML = html; }
function withAssetVersion(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${CONFIG.assetVersion}`;
}

function isNoData(value, noDataValue) {
  if (!isFinite(value)) return true;
  if (noDataValue != null && value === noDataValue) return true;
  return false;
}

function getCellAreaSqM(image) {
  const fallbackCellSizeMeters = 100;
  const fallbackAreaSqM = fallbackCellSizeMeters * fallbackCellSizeMeters;

  const resolution = typeof image.getResolution === "function"
    ? image.getResolution()
    : null;
  const fileDirectory = image.fileDirectory || {};
  const modelPixelScale = Array.isArray(fileDirectory.ModelPixelScale)
    ? fileDirectory.ModelPixelScale
    : null;
  const source = Array.isArray(resolution) && resolution.length >= 2
    ? resolution
    : modelPixelScale;

  if (!Array.isArray(source) || source.length < 2) return fallbackAreaSqM;

  const cellWidth = Math.abs(Number(source[0]));
  const cellHeight = Math.abs(Number(source[1]));
  if (!isFinite(cellWidth) || !isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
    return fallbackAreaSqM;
  }

  return cellWidth * cellHeight;
}

function getRenderedImages(entry) {
  const { pixels, width, height, palette } = entry;
  const mapNode = document.querySelector(CONFIG.mapSelector);
  const displayWidth = mapNode?.clientWidth || 900;
  const displayHeight = mapNode?.clientHeight || 600;
  const pixelSize = Math.min(displayWidth / width, displayHeight / height) * CONFIG.renderOversample;
  const canvasWidth = Math.round(width * pixelSize);
  const canvasHeight = Math.round(height * pixelSize);
  const renderKey = `${canvasWidth}x${canvasHeight}`;

  if (entry.renderedImages?.key === renderKey) {
    return entry.renderedImages;
  }

  const base = buildCanvas(pixels, width, height, palette, null);
  const filteredHrefs = {};
  for (let classB = 0; classB < 3; classB++) {
    for (let classA = 0; classA < 3; classA++) {
      const key = getHighlightKey({ classA, classB });
      filteredHrefs[key] = buildCanvas(pixels, width, height, palette, { classA, classB }).canvas.toDataURL();
    }
  }

  entry.renderedImages = {
    key: renderKey,
    canvasWidth,
    canvasHeight,
    baseHref: base.canvas.toDataURL(),
    filteredHrefs
  };

  return entry.renderedImages;
}

function getHighlightKey({ classA, classB }) {
  return `${classA}-${classB}`;
}

function decodeClassValue(value) {
  return {
    perfClass: Math.ceil(value / 3),
    varClass: ((value - 1) % 3) + 1
  };
}

function summarisePixels(pixels, cellAreaSqM) {
  const counts = {
    total: 0,
    highPerformance: 0,
    midPerformance: 0,
    lowPerformance: 0,
    highStability: 0,
    midStability: 0,
    lowStability: 0,
    highPerfHighStability: 0,
    lowPerfLowStability: 0,
    classAreasSqM: {}
  };

  for (let i = 0; i < pixels.length; i++) {
    const value = pixels[i];
    if (value < 1 || value > 9) continue;

    const { perfClass, varClass } = decodeClassValue(value);
    const stabilityClass = 4 - varClass;
    const classKey = getHighlightKey({ classA: varClass - 1, classB: perfClass - 1 });

    counts.total++;
    counts.classAreasSqM[classKey] = (counts.classAreasSqM[classKey] || 0) + cellAreaSqM;

    if (perfClass === 3) counts.highPerformance++;
    else if (perfClass === 2) counts.midPerformance++;
    else counts.lowPerformance++;

    if (stabilityClass === 3) counts.highStability++;
    else if (stabilityClass === 2) counts.midStability++;
    else counts.lowStability++;

    if (perfClass === 3 && stabilityClass === 3) counts.highPerfHighStability++;
    if (perfClass === 1 && stabilityClass === 1) counts.lowPerfLowStability++;
  }

  return counts;
}

function formatAreaLabel(areaSqM) {
  if (!isFinite(areaSqM) || areaSqM <= 0) return "0 ha";
  if (areaSqM >= 1_000_000) return `${formatCompactNumber(areaSqM / 1_000_000)} km²`;
  if (areaSqM >= 10_000) return `${formatCompactNumber(areaSqM / 10_000)} ha`;
  return `${formatCompactNumber(areaSqM)} m²`;
}

function formatCompactNumber(value) {
  if (value >= 100) return Math.round(value).toLocaleString();
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
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
