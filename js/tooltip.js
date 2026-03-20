/**
 * js/tooltip.js — Tooltip for bivariate raster map
 *
 * Shows raw Performance + Var values, normalised values,
 * and the bivariate class for each pixel.
 */

let tooltip;

const CLASS_LABELS = ["Low", "Mid", "High"];

function initTooltip() {
  // Remove any existing tooltip to avoid duplicates on re-init
  d3.select(".tooltip-raster").remove();

  tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip tooltip-raster")
    .style("opacity", 0)
    .style("pointer-events", "none");
}

function showTooltip(event, d) {
  if (!tooltip || !d) return;

  const perfRaw = d.Performance != null ? d.Performance.toFixed(4) : "—";
  const varRaw = d.Var != null ? d.Var.toFixed(4) : "—";
  const perfNorm = d.Performance_norm != null ? (d.Performance_norm * 100).toFixed(1) + "%" : "—";
  const varNorm = d.Var_norm != null ? (d.Var_norm * 100).toFixed(1) + "%" : "—";

  const classALabel = d.classA != null ? CLASS_LABELS[d.classA] : "—";
  const classBLabel = d.classB != null ? CLASS_LABELS[d.classB] : "—";

  const colorSwatch = d.color
    ? `<span style="display:inline-block;width:10px;height:10px;background:${d.color};
         border-radius:2px;vertical-align:middle;margin-right:4px;"></span>`
    : "";

  tooltip
    .html(`
      <strong style="font-size:0.76rem;">Pixel (${d.x?.toFixed(2)}, ${d.y?.toFixed(2)})</strong>
      <div class="tooltip-row" style="margin-top:6px;">
        <span class="tooltip-label">Performance</span>
        <span class="tooltip-value">${perfRaw}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Variation</span>
        <span class="tooltip-value">${varRaw}</span>
      </div>
      <div class="tooltip-row" style="margin-top:4px; border-top:1px solid #e0dbd3; padding-top:4px;">
        <span class="tooltip-label">Perf. (scaled)</span>
        <span class="tooltip-value">${perfNorm}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Var. (scaled)</span>
        <span class="tooltip-value">${varNorm}</span>
      </div>
      <div class="tooltip-row" style="margin-top:4px; border-top:1px solid #e0dbd3; padding-top:4px;">
        <span class="tooltip-label">Class</span>
        <span class="tooltip-value">${colorSwatch}${classALabel} perf · ${classBLabel} var</span>
      </div>
    `)
    .style("left", (event.pageX + 14) + "px")
    .style("top", (event.pageY - 28) + "px")
    .transition().duration(100)
    .style("opacity", 1);
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.transition().duration(180).style("opacity", 0);
}

export { initTooltip, showTooltip, hideTooltip };
