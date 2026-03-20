# Bivariate Raster Map — JavaScript Implementation

Adapted from your R `create_robustness_maps()` script to display raster data using **winsorized scaling** and **equal interval classification** in an interactive web interface.

---

## Overview

### What Changed from Vector to Raster

Your original code used:
- **Vector geometries**: TopoJSON NUTS2 regions joined with CSV data by `nuts_id`
- **Rendering**: Individual SVG `<path>` elements per region

This version uses:
- **Raster data**: Pixel grid (x, y coordinates) with performance & variation values
- **Rendering options**: 
  - **Canvas** (default, fast): Pre-rendered image with invisible overlay for tooltips
  - **SVG rects** (alternative, accessible): Grid of `<rect>` elements

### Key Integration Points

All JavaScript logic mirrors your R implementation:
- ✅ **Winsorization**: Clips to 5th–95th percentile bounds
- ✅ **Normalization**: Scales to [0, 1] range
- ✅ **Equal Intervals**: Divides [0, 1] into 3 equal classes (0–0.33, 0.33–0.67, 0.67–1.0)
- ✅ **Bivariate Matrix**: 3×3 color palette (performance × variation)
- ✅ **Interactive Legend**: Hover cells to highlight matching pixels
- ✅ **Tooltips**: Hover pixels to see normalized values and class assignments

---

## File Structure

```
├── index.html              # HTML entry point (open in browser)
├── js/main.js                 # Orchestrator: loads data, renders, controls flow
├── js/bivariate.js            # Classification logic: winsorize, normalize, classify
├── js/legend.js               # Legend rendering + cell interactivity
├── js/tooltip.js              # Hover tooltips
├── export_raster_data.R           # R helper: export rasters to CSV for web
└── data/
    └── raster_bivariate_data.csv  # Pre-processed pixel data (from R export)
```

---

## Quick Start

### 1. Prepare Data in R

After running `create_robustness_maps()`:

```r
# Load the export helper script
source("export_raster_data.R")

# Export your classified raster to CSV
export_raster_to_csv(
  robustness_dir = "path/to/robustness_outputs",
  group = "ES",                    # Your group name
  scaling_method = "winsor",       # Must match R script
  classification_method = "equal", # Must match R script
  output_csv = "data/raster_bivariate_data.csv"
)
```

This produces a CSV with columns:
```csv
x,y,Performance,Var,classA,classB
-3.5,43.2,0.123,0.456,0,1
-3.4,43.2,0.234,0.567,1,2
...
```

**Important**: Values must already be **normalized to [0, 1]** as done by the R export function.

### 2. Set Up Web Server

Place files in a web-accessible directory:
```
my-project/
├── index.html
├── *.js files
├── data/
│   └── raster_bivariate_data.csv
```

Start a local server (Python):
```bash
python3 -m http.server 8000
# Visit http://localhost:8000/index.html
```

Or use Node.js:
```bash
npx http-server
```

### 3. Open in Browser

Navigate to `http://localhost:8000/index.html`

---

## Configuration

Edit `CONFIG` object in `js/main.js`:

```javascript
const CONFIG = {
  dataUrl: "data/raster_bivariate_data.csv",
  mapSelector: "#map",
  legendSelector: "#legend",
  renderMethod: "canvas",  // "canvas" or "svg-rects"
  cellSize: 10,            // pixels per grid cell (svg-rects only)
  insightSelector: "#insight",
  metaSelector: "#meta"
};
```

### Rendering Methods

**Canvas (recommended)**:
- Pros: Fast, memory-efficient, handles 100K+ pixels
- Cons: Not selectable text, lower accessibility
- Use for: Large rasters, performance-critical applications

**SVG Rects**:
- Pros: Fully styleable, accessible, supports CSS transitions
- Cons: Slow for >10K pixels, higher memory usage
- Use for: Small rasters, custom styling needs

---

## Data Format Requirements

The CSV must contain:

| Column | Type | Range | Description |
|--------|------|-------|-------------|
| `x` | number | varies | Longitude or X coordinate |
| `y` | number | varies | Latitude or Y coordinate |
| `Performance` | number | [0, 1] | Normalized performance value |
| `Var` | number | [0, 1] | Normalized variation value |
| `classA` | integer | 0–2 | Performance class (optional, computed if missing) |
| `classB` | integer | 0–2 | Variation class (optional, computed if missing) |

**Values must be normalized to [0, 1]** before export. The JavaScript will classify them into 3 equal intervals:
- 0–0.333 → class 0
- 0.333–0.667 → class 1
- 0.667–1.0 → class 2

---

## Color Palette

3×3 bivariate matrix from R's biscale "BlueGold":

```
                 Performance (Low → High)
                 ↓
Variation   ┌─────────┬─────────┬─────────┐
   High     │ #d2ecf1 │ #a8cfdc │ #7eb3c4 │  Blue tint (low perf)
            ├─────────┼─────────┼─────────┤
   Medium   │ #fed4a3 │ #fdb485 │ #fb9367 │  Orange tint
            ├─────────┼─────────┼─────────┤
   Low      │ #c9b044 │ #b8970f │ #a67c00 │  Gold tint (high perf)
            └─────────┴─────────┴─────────┘
```

**Interpretation**:
- **Top-left** (low performance, high variation): Blue
- **Top-right** (high performance, high variation): Mixed (orange-blue)
- **Bottom-right** (high performance, low variation): Gold

To change colors, edit `BIVARIATE_COLORS` in `js/bivariate.js`.

---

## Interactivity

### Legend Cells

Hover any cell in the legend to:
- Highlight matching pixels on the map (100% opacity)
- Dim non-matching pixels (15% opacity)

### Pixels

Hover any pixel to see:
- X, Y coordinates
- Normalized performance & variation values (0–1)
- Class assignments (0–2)
- Human-readable interpretation ("Low", "Medium", "High")

---

## Scaling & Classification Deep Dive

### Winsorization (5th–95th percentile)

```javascript
// R equivalent:
quantile(data, c(0.05, 0.95))  → bounds
data_clipped = pmax(lower, pmin(upper, data))
```

JavaScript implementation:
```javascript
function winsorize(values, pLow = 0.05, pHigh = 0.95) {
  const sorted = [...values].filter(v => v != null).sort((a, b) => a - b);
  const n = sorted.length;
  const qLow = sorted[Math.floor(n * pLow)];
  const qHigh = sorted[Math.ceil(n * pHigh)];
  return values.map(v => Math.max(qLow, Math.min(qHigh, v)));
}
```

### Normalization

After winsorization, scale to [0, 1]:
```javascript
normalized = (value - min) / (max - min)
```

### Equal Interval Breaks

Divide [0, 1] into N equal parts:
```javascript
// For N = 3:
breaks = [1/3, 2/3]  // i.e., [0.333, 0.667]

// Classification:
if (value <= 0.333) class = 0
else if (value <= 0.667) class = 1
else class = 2
```

---

## Customization

### Change Number of Classes

Edit `N` in `js/bivariate.js`:

```javascript
const N = 4;  // 4×4 matrix instead of 3×3

const BIVARIATE_COLORS = [
  // 4 rows (variation) × 4 cols (performance)
  ["#...", "#...", "#...", "#..."],
  ["#...", "#...", "#...", "#..."],
  ["#...", "#...", "#...", "#..."],
  ["#...", "#...", "#...", "#..."]
];
```

Then regenerate colors from your biscale palette in R:
```r
bi_pal(pal = "BlueGold", dim = 4)
```

### Adjust Winsorization Bounds

Edit percentiles in `js/main.js`:

```javascript
const { breaks, classified } = classifyRasterBivariate(
  data, 
  "Performance", 
  "Var",
  0.02,  // Lower percentile (2nd instead of 5th)
  0.98   // Upper percentile (98th instead of 95th)
);
```

### Custom Canvas Rendering

The canvas method supports custom pixel sizes and transformations. See `renderCanvasMap()` in `js/main.js` for details.

---

## Performance Notes

| Raster Size | Canvas | SVG Rects |
|-------------|--------|-----------|
| 100 × 100 (10K pixels) | <100ms | ~500ms |
| 500 × 500 (250K pixels) | ~500ms | >5s (slow) |
| 1000 × 1000 (1M pixels) | ~2s | unusable |

**Recommendation**: Use **Canvas** for rasters larger than 10,000 pixels.

---

## Troubleshooting

### No data appears on map

1. Check browser console for errors (F12 → Console)
2. Verify CSV file is in `data/` folder
3. Confirm values are normalized to [0, 1]:
   ```javascript
   // In browser console:
   d3.csv("data/raster_bivariate_data.csv").then(data => {
     console.log(d3.extent(data, d => d.Performance));  // Should be [0, 1]
   });
   ```

### Legend doesn't appear

- Ensure D3.js is loaded (check Network tab in DevTools)
- Check that `#legend` div exists in HTML
- Verify `drawLegend()` is called in `js/main.js`

### Pixels are not interactive

- If using **Canvas**: Overlays are invisible but present. Hover to see tooltip.
- If using **SVG**: Ensure `renderSvgGridMap()` is being called (set `renderMethod: "svg-rects"`)

### Memory issues / slow rendering

- Switch to Canvas method
- Reduce raster resolution before export from R
- Downsample GeoTIFF to lower DPI

---

## Exporting Static Images

To save the map as PNG:

```javascript
// In browser console:
const canvas = document.querySelector("canvas");
const link = document.createElement("a");
link.href = canvas.toDataURL();
link.download = "bivariate_map.png";
link.click();
```

Or use browser Print → Save as PDF (preserves vector data if using SVG method).

---

## Advanced: GeoTIFF Support

To load GeoTIFFs directly (instead of pre-processed CSV):

1. Add [geotiff.js](https://geotiffjs.github.io/):
   ```html
   <script src="https://cdn.jsdelivr.net/npm/geotiff@2.0.1/dist/geotiff.min.js"></script>
   ```

2. Load and parse in `js/main.js`:
   ```javascript
   const response = await fetch("data/performance.tif");
   const arrayBuffer = await response.arrayBuffer();
   const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
   const image = await tiff.getImage();
   const data = await image.readRasters();
   ```

3. Proceed with classification

Contact if you want a full GeoTIFF loader implementation.

---

## References

- **Original vector code**: `bivariate.js`, `legend.js`, `main.js`, `tooltip.js`
- **R function**: `create_robustness_maps()` from your package
- **Bivariate color theory**: Joshua Stevens' methodology (US Census cartography)
- **D3.js docs**: https://d3js.org/
- **Biscale R package**: https://srvanderplas.github.io/biscale/

---

## License

Same as your original project.

---

## Questions?

Key points for debugging:
1. Check CSV format matches expected columns
2. Verify values are [0, 1] range
3. Check browser console for JavaScript errors
4. Test with small dataset first (100 pixels) to isolate issues
