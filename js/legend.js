/**
 * legend-raster.js — Bivariate legend (3×3 matrix)
 *
 * Layout matches R's biscale output exactly:
 *   Rows    = Performance, high at top (row 0) → low at bottom (row n-1)
 *   Columns = Variation,   low at left (col 0) → high at right (col n-1)
 *
 * palette[varIdx][perfIdx] as built from R's palette JSON ("perf-var" keys).
 */

import { BIVARIATE_COLORS, N } from "./bivariate.js";

const CELL = 34;
const GAP = 1.5;

function drawLegend(selector, { labelA, labelB, numClasses, colors, onCellHover, onCellLeave } = {}) {
  const n = numClasses || N;
  const palette = colors || BIVARIATE_COLORS;

  const size = n * (CELL + GAP) - GAP;
  const margin = { top: 20, right: 6, bottom: 60, left: 28 };
  const w = size + margin.left + margin.right;
  const h = size + margin.top + margin.bottom;

  const svg = d3.select(selector)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("class", "bivariate-legend");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // rows = first digit  (high at top = row 0 → firstIdx = n-1, low at bottom)
  // cols = second digit (low at left = col 0 → secondIdx = 0, high at right)
  // palette[firstIdx][secondIdx] — matches JSON key "(firstDigit)-(secondDigit)"
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const firstIdx = n - 1 - row;  // row 0 → firstIdx 2 (high), row 2 → firstIdx 0 (low)
      const secondIdx = col;           // col 0 → secondIdx 0 (low), col 2 → secondIdx 2 (high)
      const fill = (palette[firstIdx] && palette[firstIdx][secondIdx]) || "#ddd8ce";

      g.append("rect")
        .attr("x", col * (CELL + GAP))
        .attr("y", row * (CELL + GAP))
        .attr("width", CELL)
        .attr("height", CELL)
        .attr("fill", fill)
        .attr("class", `legend-cell cell-${firstIdx}-${secondIdx}`)
        .style("cursor", "pointer")
        .on("mouseenter", () => onCellHover?.(secondIdx, firstIdx))
        .on("mouseleave", () => onCellLeave?.());
    }
  }

  // X-axis = Performance →
  g.append("text")
    .attr("x", size / 2).attr("y", size + 16)
    .attr("text-anchor", "middle")
    .attr("class", "legend-label")
    .text((labelA || "Performance") + " →");

  // Y-axis = ↑ Variation
  g.append("text")
    .attr("x", -(size / 2)).attr("y", -14)
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("class", "legend-label")
    .text("→ " + (labelB || "Variation"));

  // Corner labels
  g.append("text")
    .attr("x", -2).attr("y", size + 28)
    .attr("class", "legend-corner")
    .text("Low perf");

  g.append("text")
    .attr("x", size + 2).attr("y", size + 28)
    .attr("text-anchor", "end")
    .attr("class", "legend-corner")
    .text("High perf");

  g.append("text")
    .attr("x", -4).attr("y", -8)
    .attr("class", "legend-corner")
    .text("High stability");

  g.append("text")
    .attr("x", -2).attr("y", size + 12)
    .attr("class", "legend-corner")
    .text("Low stability");

  // No data swatch
  const ndY = size + 40;
  g.append("rect")
    .attr("x", 0).attr("y", ndY)
    .attr("width", 12).attr("height", 12)
    .attr("fill", "#ddd8ce").attr("stroke", "#cdc8be").attr("stroke-width", 0.5);
  g.append("text")
    .attr("x", 16).attr("y", ndY + 10)
    .attr("class", "legend-nodata")
    .text("No data");

  return svg;
}

export { drawLegend };
