/**
 * bivariate-raster.js — winsorized scaling + equal interval classification
 *
 * Rule: NEVER use spread syntax on pixel arrays (millions of values = stack overflow).
 * All operations use explicit for-loops or typed arrays.
 */

// BlueGold palette (biscale) — palette[firstDigit-1][secondDigit-1]
// First digit (rows, 0=low at bottom, 2=high at top in legend)
// Second digit (cols, 0=low at left, 2=high at right in legend)
// Verified against R legend PNG and palette_info.json
const BIVARIATE_COLORS = [
  ["#d3d3d3", "#8fb1c2", "#488fb0"],  // first digit 1 (low row)
  ["#d8bd75", "#929f6c", "#498062"],  // first digit 2 (mid row)
  ["#dea301", "#968901", "#4c6e01"]   // first digit 3 (high row, gold at top-left)
];

const N = 3;

function equalIntervalBreaks(n = N) {
  return Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);
}

function classify(value, breaks) {
  for (let i = 0; i < breaks.length; i++) if (value <= breaks[i]) return i;
  return breaks.length;
}

/**
 * Winsorize an array in-place into a new plain Array.
 * No spread, no .filter() into a spread sort.
 */
function winsorize(values, pLow = 0.05, pHigh = 0.95) {
  const n = values.length;

  // Collect finite values
  const clean = [];
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v != null && isFinite(v)) clean.push(v);
  }
  clean.sort((a, b) => a - b);

  const m     = clean.length;
  const qLow  = clean[Math.floor(m * pLow)];
  const qHigh = clean[Math.min(Math.ceil(m * pHigh), m - 1)];

  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v == null || !isFinite(v)) { out[i] = null; continue; }
    out[i] = v < qLow ? qLow : v > qHigh ? qHigh : v;
  }
  return out;
}

/**
 * Min-max normalise to [0, 1]. Pure loop, no spread.
 */
function normalize(values) {
  const n = values.length;
  let min =  Infinity;
  let max = -Infinity;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v == null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  const out   = new Array(n);

  for (let i = 0; i < n; i++) {
    const v = values[i];
    out[i]  = v == null ? null : range === 0 ? 0.5 : (v - min) / range;
  }
  return out;
}

/**
 * Classify all pixels.
 * @param {Array}  data      - Array of objects with keyPerf and keyVar fields
 * @param {string} keyPerf
 * @param {string} keyVar
 */
function classifyRasterBivariate(data, keyPerf = "Performance", keyVar = "Var",
                                  winsorLow = 0.05, winsorHigh = 0.95) {
  const n = data.length;

  // Extract into plain arrays with a loop (no .map spread risk)
  const perfRaw = new Array(n);
  const varRaw  = new Array(n);
  for (let i = 0; i < n; i++) {
    perfRaw[i] = data[i][keyPerf];
    varRaw[i]  = data[i][keyVar];
  }

  const perfWinsor = winsorize(perfRaw, winsorLow, winsorHigh);
  const varWinsor  = winsorize(varRaw,  winsorLow, winsorHigh);

  const perfNorm = normalize(perfWinsor);
  const varNorm  = normalize(varWinsor);

  const breaks = {
    perf: equalIntervalBreaks(N),
    var:  equalIntervalBreaks(N)
  };

  // Build classified array with a plain loop
  const classified = new Array(n);
  for (let i = 0; i < n; i++) {
    const classA = classify(perfNorm[i], breaks.perf);
    const classB = classify(varNorm[i],  breaks.var);
    classified[i] = {
      ...data[i],
      Performance_norm: perfNorm[i],
      Var_norm:         varNorm[i],
      classA,
      classB,
      color: BIVARIATE_COLORS[classB][classA]
    };
  }

  // Stats (loop-based min/max)
  let perfMin =  Infinity, perfMax = -Infinity;
  let varMin  =  Infinity, varMax  = -Infinity;
  let perfWMin =  Infinity, perfWMax = -Infinity;
  let varWMin  =  Infinity, varWMax  = -Infinity;

  for (let i = 0; i < n; i++) {
    const p = perfRaw[i], v = varRaw[i];
    const pw = perfWinsor[i], vw = varWinsor[i];
    if (p != null) { if (p < perfMin) perfMin = p; if (p > perfMax) perfMax = p; }
    if (v != null) { if (v < varMin)  varMin  = v; if (v > varMax)  varMax  = v; }
    if (pw != null) { if (pw < perfWMin) perfWMin = pw; if (pw > perfWMax) perfWMax = pw; }
    if (vw != null) { if (vw < varWMin)  varWMin  = vw; if (vw > varWMax)  varWMax  = vw; }
  }

  const stats = {
    perf: { min: perfMin, max: perfMax, winsorMin: perfWMin, winsorMax: perfWMax },
    var:  { min: varMin,  max: varMax,  winsorMin: varWMin,  winsorMax: varWMax  }
  };

  return { breaks, classified, stats };
}

export { BIVARIATE_COLORS, N, equalIntervalBreaks, classify, winsorize, normalize, classifyRasterBivariate };
