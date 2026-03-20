/**
 * main-raster.js — Bivariate raster choropleth map orchestrator
 *
 * Flow:
 * 1. Load GeoTIFF rasters (Performance, Variation) or pre-processed pixel data
 * 2. Apply winsorized scaling + equal interval classification (3×3 matrix)
 * 3. Render canvas or SVG grid with bivariate colors
 * 4. Draw legend, tooltips, and metadata
 *
 * Data source: R script output (create_robustness_maps)
 * - Uses winsorized scaling (5th–95th percentile clipping)
 * - Equal interval classification (equal breaks on normalized [0,1] scale)
 * - Bivariate 3×3 palette (performance × variation)
 */

import { classifyRasterBivariate, BIVARIATE_COLORS } from "./bivariate-raster.js?v=10";
import { drawLegend } from "./legend-raster.js?v=10";
import { initTooltip, showTooltip, hideTooltip } from "./tooltip-raster.js?v=10";

// Configuration
const CONFIG = {
  // Data source: pre-processed CSV from R (raster as dataframe)
  dataUrl: "data/raster_bivariate_data.csv", // x, y, Performance, Var (already winsorized + normalized)
  
  // Map container
  mapSelector: "#map",
  legendSelector: "#legend",
  
  // Rendering
  renderMethod: "canvas", // "canvas" or "svg-rects"
  cellSize: 10, // pixels per grid cell (for svg-rects method)
  
  // Metadata display
  insightSelector: "#insight",
  metaSelector: "#meta"
};

async function init() {
  console.log("Initializing raster bivariate map...");
  
  try {
    // Load pre-processed raster data from R
    const data = await d3.csv(CONFIG.dataUrl, d3.autoType);
    
    if (!data || data.length === 0) {
      throw new Error("CSV data is empty or unreachable");
    }
    
    console.log(`Loaded ${data.length} pixels`);
    
    // Verify required columns (already normalized + winsorized by R)
    const requiredCols = ["x", "y", "Performance", "Var"];
    const cols = Object.keys(data[0]);
    const missing = requiredCols.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      throw new Error(`Missing columns: ${missing.join(", ")}. Available: ${cols.join(", ")}`);
    }
    
    // Classify pixels using equal interval breaks on [0, 1]
    const { breaks, classified, stats } = classifyRasterBivariate(data, "Performance", "Var");
    
    console.log("Classification complete:", {
      breaksPerf: breaks.perf.map(b => b.toFixed(2)),
      breaksVar: breaks.var.map(b => b.toFixed(2)),
      pixelsClassified: classified.length,
      statsPerf: { min: stats.perf.min.toFixed(3), max: stats.perf.max.toFixed(3) },
      statsVar: { min: stats.var.min.toFixed(3), max: stats.var.max.toFixed(3) }
    });
    
    // Get raster bounds and dimensions
    const xs = data.map(d => d.x);
    const ys = data.map(d => d.y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xResolution = Math.min(...data.map((d, i, arr) => {
      const next = arr.find(p => p.y === d.y && p.x > d.x);
      return next ? next.x - d.x : Infinity;
    }).filter(x => isFinite(x)));
    const yResolution = Math.min(...data.map((d, i, arr) => {
      const next = arr.find(p => p.x === d.x && p.y > d.y);
      return next ? next.y - d.y : Infinity;
    }).filter(y => isFinite(y)));
    
    console.log(`Raster extent: [${xMin}, ${yMin}] → [${xMax}, ${yMax}]`);
    console.log(`Resolution: ${xResolution} × ${yResolution}`);
    
    // Data insights for editorial narrative
    const highVariation = classified.filter(d => d.classB === 2); // High variation
    const lowVariation = classified.filter(d => d.classB === 0); // Low variation
    const highPerf = classified.filter(d => d.classA === 2); // High performance
    const lowPerf = classified.filter(d => d.classA === 0); // Low performance
    const stable = classified.filter(d => d.classA === 2 && d.classB === 0); // Best case: high perf, stable
    const volatile = classified.filter(d => d.classA === 0 && d.classB === 2); // Worst case: low perf, volatile
    
    const perfRange = (Math.max(...data.map(d => d.Performance)) - Math.min(...data.map(d => d.Performance))).toFixed(2);
    const varRange = (Math.max(...data.map(d => d.Var)) - Math.min(...data.map(d => d.Var))).toFixed(2);
    
    // Render editorial narrative insight
    const insightText = stable.length > 0 
      ? `<span class="hl-teal-dark">${stable.length} stable, high-performing pixels</span> ` +
        `versus <span class="hl-accent">${volatile.length} volatile, low-performing pixels</span>. ` +
        `<span class="hl-teal">${lowVariation.length}</span> regions show stability.`
      : `<span class="hl-teal">${highPerf.length} pixels</span> demonstrate high performance; ` +
        `<span class="hl-accent">${highVariation.length}</span> show significant variation. ` +
        `Range: <strong>${perfRange}</strong> (performance), <strong>${varRange}</strong> (variation).`;
    
    document.querySelector(CONFIG.insightSelector).innerHTML = insightText;
    
    // Render map using chosen method
    if (CONFIG.renderMethod === "canvas") {
      await renderCanvasMap(classified, { xMin, yMin, xMax, yMax, xResolution, yResolution });
    } else {
      renderSvgGridMap(classified, { xMin, yMin, xMax, yMax, xResolution, yResolution });
    }
    
    // Initialize tooltip system
    initTooltip();
    
    // Draw legend
    drawLegend(CONFIG.legendSelector, {
      labelA: "Performance (mean sum of change)",
      labelB: "Variation (norm. undesirable deviation)",
      numClasses: 3,
      onCellHover(classA, classB) {
        const container = document.querySelector(CONFIG.mapSelector);
        const pixels = container.querySelectorAll("[data-class]");
        pixels.forEach(pixel => {
          const [ca, cb] = pixel.dataset.class.split("-").map(Number);
          pixel.style.opacity = (ca === classA && cb === classB) ? 1 : 0.15;
        });
      },
      onCellLeave() {
        const container = document.querySelector(CONFIG.mapSelector);
        const pixels = container.querySelectorAll("[data-class]");
        pixels.forEach(pixel => {
          pixel.style.opacity = 1;
        });
      }
    });
    
    // Metadata footer
    document.querySelector(CONFIG.metaSelector).textContent =
      `${classified.length} pixels · ` +
      `Performance breaks: ${breaks.perf.map(b => b.toFixed(2)).join(", ")} · ` +
      `Variation breaks: ${breaks.var.map(b => b.toFixed(2)).join(", ")} · ` +
      `Scaling: Winsorized (5th–95th) + Equal Intervals`;
    
  } catch (err) {
    console.error("Error initializing map:", err);
    document.querySelector(CONFIG.mapSelector).innerHTML =
      `<p class="error" style="color:#c24e80">Error: ${err.message}</p>`;
  }
}

/**
 * Render raster as canvas — fast, memory-efficient for large datasets
 */
async function renderCanvasMap(classified, bounds) {
  const container = document.querySelector(CONFIG.mapSelector);
  const wrapper = container.closest(".map-wrapper") || container;
  const displayWidth = wrapper.clientWidth || 900;
  const displayHeight = wrapper.clientHeight || 600;
  
  const { xMin, yMin, xMax, yMax, xResolution, yResolution } = bounds;
  const rasterWidth = Math.ceil((xMax - xMin) / xResolution);
  const rasterHeight = Math.ceil((yMax - yMin) / yResolution);
  
  // Canvas dimensions
  const pixelSize = Math.min(displayWidth / rasterWidth, displayHeight / rasterHeight);
  const canvasWidth = Math.round(rasterWidth * pixelSize);
  const canvasHeight = Math.round(rasterHeight * pixelSize);
  
  console.log(`Canvas: ${canvasWidth}×${canvasHeight} (raster: ${rasterWidth}×${rasterHeight})`);
  
  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = canvasWidth + "px";
  canvas.style.height = canvasHeight + "px";
  canvas.style.display = "block";
  
  const ctx = canvas.getContext("2d");
  
  // Create image data
  const imgData = ctx.createImageData(canvasWidth, canvasHeight);
  const data = imgData.data; // RGBA array
  
  // Map pixels to canvas
  const pixelMap = new Map(classified.map(p => [`${p.x.toFixed(6)},${p.y.toFixed(6)}`, p]));
  
  for (let row = 0; row < canvasHeight; row++) {
    for (let col = 0; col < canvasWidth; col++) {
      const x = xMin + (col / pixelSize) * xResolution;
      const y = yMax - (row / pixelSize) * yResolution; // Top-down canvas coords
      
      const key = `${x.toFixed(6)},${y.toFixed(6)}`;
      const pixel = pixelMap.get(key);
      
      const idx = (row * canvasWidth + col) * 4;
      
      if (pixel && pixel.color) {
        const rgb = hexToRgb(pixel.color);
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = 255;
      } else {
        // No data: light beige
        data[idx] = 221;
        data[idx + 1] = 216;
        data[idx + 2] = 206;
        data[idx + 3] = 255;
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  
  // Add interactivity layer (SVG overlay)
  const svg = d3.select(container)
    .append("svg")
    .style("width", "100%")
    .style("height", "auto")
    .style("max-width", "100%")
    .attr("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  
  svg.append("image")
    .attr("href", canvas.toDataURL())
    .attr("width", canvasWidth)
    .attr("height", canvasHeight);
  
  // Invisible overlay rectangles for hover interactivity
  const pixelRects = svg.selectAll(".pixel-overlay")
    .data(classified)
    .enter()
    .append("rect")
    .attr("class", "pixel-overlay")
    .attr("data-class", d => `${d.classA}-${d.classB}`)
    .attr("x", d => ((d.x - xMin) / xResolution) * pixelSize)
    .attr("y", d => ((yMax - d.y) / yResolution) * pixelSize)
    .attr("width", pixelSize)
    .attr("height", pixelSize)
    .style("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      showTooltip(event, d);
    })
    .on("mousemove", (event, d) => {
      showTooltip(event, d);
    })
    .on("mouseleave", () => {
      hideTooltip();
    });
  
  // Append canvas before SVG for layering
  container.insertBefore(canvas, svg.node());
}

/**
 * Render raster as SVG grid — slower, but fully styleable and accessible
 */
function renderSvgGridMap(classified, bounds) {
  const container = document.querySelector(CONFIG.mapSelector);
  const wrapper = container.closest(".map-wrapper") || container;
  const displayWidth = wrapper.clientWidth || 900;
  const displayHeight = wrapper.clientHeight || 600;
  
  const { xMin, yMin, xMax, yMax, xResolution, yResolution } = bounds;
  const rasterWidth = Math.ceil((xMax - xMin) / xResolution);
  const rasterHeight = Math.ceil((yMax - yMin) / yResolution);
  
  const svg = d3.select(container)
    .append("svg")
    .style("width", "100%")
    .style("height", "auto")
    .style("max-width", "100%")
    .attr("viewBox", `0 0 ${displayWidth} ${displayHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  
  const pixelWidth = displayWidth / rasterWidth;
  const pixelHeight = displayHeight / rasterHeight;
  
  svg.selectAll(".pixel")
    .data(classified)
    .enter()
    .append("rect")
    .attr("class", "pixel")
    .attr("data-class", d => `${d.classA}-${d.classB}`)
    .attr("x", d => ((d.x - xMin) / (xMax - xMin)) * displayWidth)
    .attr("y", d => ((yMax - d.y) / (yMax - yMin)) * displayHeight)
    .attr("width", pixelWidth)
    .attr("height", pixelHeight)
    .attr("fill", d => d.color || "#ddd8ce")
    .attr("stroke", "none")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      showTooltip(event, d);
    })
    .on("mousemove", (event, d) => {
      showTooltip(event, d);
    })
    .on("mouseleave", () => {
      hideTooltip();
    });
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 221, g: 216, b: 206 };
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { init };
