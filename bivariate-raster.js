/**
 * bivariate-raster.js — Raster classification using winsorized scaling + equal intervals
 *
 * Replicates R's create_robustness_maps logic:
 * - Winsorization: clip to 5th–95th percentile
 * - Min-max normalization to [0, 1]
 * - Equal interval breaks: divide [0, 1] into 3 equal classes (0–0.33, 0.33–0.67, 0.67–1.0)
 * - 3×3 bivariate color matrix (performance × variation)
 */

// Palette from R's biscale "BlueGold" (3×3)
// Rows = performance (low→high), Cols = variation (low→high)
const BIVARIATE_COLORS = [
  // Performance low (row 0)
  ["#d2ecf1", "#a8cfdc", "#7eb3c4"],
  // Performance medium (row 1)
  ["#fed4a3", "#fdb485", "#fb9367"],
  // Performance high (row 2)
  ["#c9b044", "#b8970f", "#a67c00"]
];

const N = 3;

/**
 * Calculate equal interval breaks for [0, 1] range
 * For N=3: breaks at [0.333, 0.667]
 */
function equalIntervalBreaks(n = N) {
  return Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);
}

/**
 * Classify a value [0, 1] into quantile index (0 to N-1)
 */
function classify(value, breaks = equalIntervalBreaks()) {
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return i;
  }
  return breaks.length; // Last class
}

/**
 * Winsorize: clip values to pth and (1-p)th percentiles
 */
function winsorize(values, pLow = 0.05, pHigh = 0.95) {
  const sorted = [...values].filter(v => v != null).sort((a, b) => a - b);
  const n = sorted.length;
  const qLow = sorted[Math.floor(n * pLow)];
  const qHigh = sorted[Math.ceil(n * pHigh)];
  
  return values.map(v => {
    if (v == null) return null;
    return Math.max(qLow, Math.min(qHigh, v));
  });
}

/**
 * Min-max normalization: scale to [0, 1]
 */
function normalize(values) {
  const clean = values.filter(v => v != null);
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min;
  
  return values.map(v => {
    if (v == null) return null;
    return range === 0 ? 0.5 : (v - min) / range;
  });
}

/**
 * Classify all pixels using winsorized + equal interval approach
 * @param {Array} data - Array of {x, y, Performance, Var, ...}
 * @param {string} keyPerf - Column name for performance
 * @param {string} keyVar - Column name for variation
 * @param {number} winsorLow - Lower percentile for winsorization (default: 0.05)
 * @param {number} winsorHigh - Upper percentile for winsorization (default: 0.95)
 * @returns {Object} { breaks, classified, stats }
 */
function classifyRasterBivariate(data, keyPerf = "Performance", keyVar = "Var", 
                                   winsorLow = 0.05, winsorHigh = 0.95) {
  const perfValues = data.map(d => d[keyPerf]);
  const varValues = data.map(d => d[keyVar]);
  
  // Step 1: Winsorize
  const perfWinsor = winsorize(perfValues, winsorLow, winsorHigh);
  const varWinsor = winsorize(varValues, winsorLow, winsorHigh);
  
  // Step 2: Normalize to [0, 1]
  const perfNorm = normalize(perfWinsor);
  const varNorm = normalize(varWinsor);
  
  // Step 3: Equal interval breaks on [0, 1]
  const breaks = {
    perf: equalIntervalBreaks(N),
    var: equalIntervalBreaks(N)
  };
  
  // Step 4: Classify each pixel
  const classified = data.map((d, i) => ({
    ...d,
    Performance_norm: perfNorm[i],
    Var_norm: varNorm[i],
    classA: classify(perfNorm[i], breaks.perf),
    classB: classify(varNorm[i], breaks.var),
    get color() {
      return BIVARIATE_COLORS[this.classB][this.classA];
    }
  }));
  
  // Compute statistics for reporting
  const stats = {
    perf: {
      min: Math.min(...perfValues.filter(v => v != null)),
      max: Math.max(...perfValues.filter(v => v != null)),
      winsorMin: Math.min(...perfWinsor.filter(v => v != null)),
      winsorMax: Math.max(...perfWinsor.filter(v => v != null))
    },
    var: {
      min: Math.min(...varValues.filter(v => v != null)),
      max: Math.max(...varValues.filter(v => v != null)),
      winsorMin: Math.min(...varWinsor.filter(v => v != null)),
      winsorMax: Math.max(...varWinsor.filter(v => v != null))
    }
  };
  
  return { breaks, classified, stats };
}

export { BIVARIATE_COLORS, N, equalIntervalBreaks, classify, winsorize, normalize, classifyRasterBivariate };
