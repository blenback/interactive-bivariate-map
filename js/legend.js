/**
 * legend.js - Bivariate legend (3x3 matrix)
 *
 * Layout matches the map renderer in main.js, with the legend rotated so:
 *   Rows    = Variation, high at top -> low at bottom
 *   Columns = Performance, low at left -> high at right
 *
 * Colours are resolved the same way as the raster canvas:
 *   value   = (perfIdx * 3) + varIdx + 1
 *   perfIdx = ceil(value / 3) - 1
 *   varIdx  = (value - 1) % 3
 *   fill    = palette[perfIdx][varIdx]
 */


// BlueGold palette (biscale) — palette[firstDigit-1][secondDigit-1]
// First digit (rows, 0=low at bottom, 2=high at top in legend)
// Second digit (cols, 0=low at left, 2=high at right in legend)
// Verified against R legend PNG and palette_info.json
const BIVARIATE_COLORS = [
  ["#d3d3d3", "#d8bd75", "#dea301"],  // first digit 1 (low row)
  ["#8fb1c2", "#929f6c", "#498062"],  // first digit 2 (mid row)
  ["#488fb0", "#968901", "#4c6e01"]   // first digit 3 (high row, gold at top-left)
];

const N = 3;

const CELL = 34;
const GAP = 1.5;

function drawLegend(selector, {
  labelA,
  labelB,
  numClasses,
  colors,
  selectedCell,
  onCellHover,
  onCellLeave,
  onCellClick
} = {}) {
  const n = numClasses || N;
  const palette = colors || BIVARIATE_COLORS;

  const size = n * (CELL + GAP) - GAP;
  const margin = { top: 20, right: 12, bottom: 92, left: 58 };
  const w = size + margin.left + margin.right;
  const h = size + margin.top + margin.bottom;

  const svg = d3.select(selector)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("class", "bivariate-legend");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      // Mirror the class-value decoding used in main.js so the legend
      // always resolves colours exactly the same way as the map.
      const value = (col * n) + (n - row);
      const perfIdx = Math.ceil(value / n) - 1;
      const varIdx = (value - 1) % n;
      const fill = (palette[perfIdx] && palette[perfIdx][varIdx]) || "#ddd8ce";
      const isSelected = selectedCell !== null
        && selectedCell?.classA === varIdx
        && selectedCell?.classB === perfIdx;

      g.append("rect")
        .attr("x", col * (CELL + GAP))
        .attr("y", row * (CELL + GAP))
        .attr("width", CELL)
        .attr("height", CELL)
        .attr("fill", fill)
        .attr("class", `legend-cell cell-${perfIdx}-${varIdx}`)
        .attr("stroke", isSelected ? "#2a2a2a" : "transparent")
        .attr("stroke-width", isSelected ? 2 : 0)
        .style("cursor", "pointer")
        .on("mouseenter", () => onCellHover?.(varIdx, perfIdx))
        .on("mouseleave", () => onCellLeave?.())
        .on("click", () => onCellClick?.(varIdx, perfIdx));
    }
  }

  g.append("text")
    .attr("x", size / 2).attr("y", size + 20)
    .attr("text-anchor", "middle")
    .attr("class", "legend-label")
    .text((labelA || "Performance") + " ->");

  g.append("text")
    .attr("x", -(size / 2)).attr("y", -12)
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("class", "legend-label")
    .text((labelB || "Stability") + " -> ");

  // g.append("text")
  //   .attr("x", 4).attr("y", size + 54)
  //   .attr("text-anchor", "start")
  //   .attr("class", "legend-corner")
  //   .style("font-size", "7px")
  //   .text("Low performance");

  // g.append("text")
  //   .attr("x", size - 4).attr("y", size + 54)
  //   .attr("text-anchor", "end")
  //   .attr("class", "legend-corner")
  //   .style("font-size", "7px")
  //   .text("High performance");

  // g.append("text")
  //   .attr("x", -34).attr("y", -8)
  //   .attr("class", "legend-corner")
  //   .style("font-size", "7px")
  //   .text("High stability");

  // g.append("text")
  //   .attr("x", -34).attr("y", size + 8)
  //   .attr("class", "legend-corner")
  //   .style("font-size", "7px")
  //   .text("Low stability");

  const ndY = size + 42;
  g.append("rect")
    .attr("x", 0).attr("y", ndY)
    .attr("width", 12).attr("height", 12)
    .attr("fill", "#ddd8ce").attr("stroke", "#cdc8be").attr("stroke-width", 0.5);
  g.append("text")
    .attr("x", 20).attr("y", ndY + 10)
    .attr("class", "legend-nodata")
    .text("No data");

  return svg;
}

export { drawLegend };
