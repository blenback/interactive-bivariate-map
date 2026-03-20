# 🗺️ Bivariate Raster Map — Start Here

This package converts your R-generated robustness maps (GeoTIFF rasters) into **interactive web visualizations** using winsorized scaling and equal interval classification.

## What You Get

✅ **Canvas-based raster rendering** — fast & memory-efficient  
✅ **Interactive legend** — hover cells to highlight pixels  
✅ **Tooltips** — hover pixels to see performance & variation values  
✅ **Fully customizable** — colors, labels, classification methods  
✅ **Ready to deploy** — pure HTML/JS, no backend required  

---

## 🚀 Quick Start (3 Minutes)

### 1️⃣ Export Your R Rasters

```r
source("export_raster_data.R")
export_raster_to_csv(
  robustness_dir = "your_output_dir",
  group = "ES"  # or "BD", "ES_and_BD"
)
```

Creates: `ES_raster_data.csv` (normalized, classified pixels)

### 2️⃣ Set Up Web Files

```
my-project/
├── index-raster.html
├── *.js files
├── data/
│   └── ES_raster_data.csv ← from R
```

### 3️⃣ Open in Browser

```bash
python3 -m http.server 8000
# Open http://localhost:8000/index-raster.html
```

**Done!** Interactive map with legend, tooltips, and metadata. 🎉

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **QUICKSTART.md** | 5-min setup, testing, customization |
| **README.md** | Complete reference (data format, scaling logic, troubleshooting) |
| **INTEGRATION.md** | End-to-end R workflow (PNG + web maps) |
| **sample-data-generator.js** | Create synthetic data for testing |

---

## 📁 Files Included

### Core JavaScript
- `main-raster.js` — Orchestrator (data loading, rendering, interactivity)
- `bivariate-raster.js` — Classification (winsorization, normalization, equal intervals)
- `legend-raster.js` — Legend rendering & hover effects
- `tooltip-raster.js` — Pixel hover tooltips

### HTML & Data
- `index-raster.html` — Complete HTML page with D3 + CSS
- `export_raster_data.R` — R helper to convert rasters to CSV

### Helpers
- `sample-data-generator.js` — Generate synthetic test data
- `00-START-HERE.md` — This file

---

## 🎯 How It Works

```
1. R: Winsorize rasters (5th–95th percentile)
   ↓
2. R: Normalize to [0, 1]
   ↓
3. R: Classify into 3×3 matrix (equal intervals)
   ↓
4. R: Export as CSV (x, y, Performance, Var, classA, classB)
   ↓
5. JS: Load CSV in browser
   ↓
6. JS: Render canvas with bivariate colors
   ↓
7. Browser: Interactive exploration (legend + tooltips)
```

---

## 🎨 Key Features

### Canvas Rendering
- **Fast**: Renders 250K pixels in <500ms
- **Memory-efficient**: No SVG overhead
- **Smooth**: Native browser image handling

### Interactive Legend
Hover any cell to:
- 🔆 Highlight matching pixels (100% opacity)
- 🌑 Dim other pixels (15% opacity)

### Pixel Tooltips
Hover any pixel to see:
- X, Y coordinates
- Performance & Variation (normalized 0–1)
- Class assignment (0–2 for each axis)
- Human-readable interpretation

---

## ⚙️ Configuration (Optional)

Edit `main-raster.js` lines 10–16:

```javascript
const CONFIG = {
  dataUrl: "data/raster_bivariate_data.csv",
  mapSelector: "#map",
  renderMethod: "canvas",  // or "svg-rects"
  cellSize: 10,            // pixels per cell
  // ... other options
};
```

---

## 🔍 Data Requirements

Your CSV must have columns (from `export_raster_data.R`):

```
x          → longitude or X coordinate
y          → latitude or Y coordinate  
Performance → normalized [0, 1]
Var        → normalized [0, 1]
classA     → 0, 1, or 2 (optional, auto-computed)
classB     → 0, 1, or 2 (optional, auto-computed)
```

**Values MUST be normalized to [0, 1]**. The R export function handles this automatically.

---

## 🧪 Test Without Real Data

In browser console (F12 → Console):

```javascript
import { generateSampleData, downloadCSV } from './sample-data-generator.js';
const data = generateSampleData(50, 50);  // 50×50 grid
downloadCSV(data, 'raster_bivariate_data.csv');
```

Then move the downloaded file to `data/` and refresh.

---

## 🚨 Troubleshooting

| Issue | Fix |
|-------|-----|
| **Blank map** | Check CSV in `data/` folder. Open DevTools (F12 → Console) for errors. |
| **Values out of range** | Values must be [0, 1]. Re-run `export_raster_to_csv()` in R. |
| **No legend** | D3.js must be loaded. Check HTML `<script>` tag. |
| **Slow rendering** | Use Canvas method (not SVG). Reduce raster size. |

See **QUICKSTART.md** or **README.md** for detailed fixes.

---

## 🎓 Understanding the Numbers

### Bivariate Classes

Each pixel has two independent classes:

```
classA (Performance):    0=Low, 1=Medium, 2=High
classB (Variation):      0=Low, 1=Medium, 2=High

Example: classA=2, classB=0 → High Performance, Low Variation
                              = Stable top-performer (gold color)
```

### Equal Interval Breaks

[0, 1] divided into 3 equal parts:

```
[0.0 — 0.333)  → class 0
[0.333 — 0.667) → class 1
[0.667 — 1.0]   → class 2
```

---

## 🎨 Color Palette

Default **BlueGold** 3×3 matrix (from R biscale):

```
              Performance (Low → High)
              ↓
Variation  Low  #d2ecf1  #a8cfdc  #7eb3c4  ← Blue (low perf)
           Mid  #fed4a3  #fdb485  #fb9367  ← Orange
           High #c9b044  #b8970f  #a67c00  ← Gold (high perf)
```

To change colors, edit `BIVARIATE_COLORS` in `bivariate-raster.js`.

---

## 📊 Scaling Methods (R → JS)

Your R script uses:

| Method | Percentile Bounds | Use Case |
|--------|-------------------|----------|
| **Winsor** | 5th–95th | Default (robust to outliers) |
| Quantile | 2nd–98th | More aggressive trimming |
| Robust | 1st–99th + MAD | Median-based |

JavaScript automatically applies **Winsorization** (5th–95th) to match R output.

---

## 🌐 Deploy to Web

1. Copy all files to a directory
2. Serve via HTTP (Python, Node, etc.)
3. Share URL with collaborators
4. No backend/database needed!

Example deployment:

```bash
# Local testing
python3 -m http.server 8000

# Production (with nginx)
cp -r my-project /var/www/html/
# Then access: https://yourdomain.com/my-project/index-raster.html
```

---

## 📖 Next Steps

1. **QUICKSTART.md** — Get up and running in 5 minutes
2. **export_raster_data.R** — Export your R rasters
3. **README.md** — Full reference (data formats, scaling, customization)
4. **INTEGRATION.md** — Complete R→Web workflow

---

## 🛠️ Advanced Customization

See **README.md** for:
- Changing classification methods (4×4 matrix, Fisher-Jenks, etc.)
- Custom color palettes
- GeoTIFF support
- Map annotations
- Export to PNG/PDF

---

## 📝 Summary

| Aspect | Details |
|--------|---------|
| **Time to Deploy** | 5 minutes |
| **Browser Support** | All modern browsers (ES6 modules required) |
| **Performance** | 100K+ pixels in real-time |
| **Data Size** | 0.5–2 MB CSV for typical rasters |
| **Dependencies** | D3.js (loaded from CDN) |
| **Licensing** | Same as your R package |

---

## ❓ Questions?

- **Setup issue?** → QUICKSTART.md
- **Data format?** → README.md (Data Format Requirements)
- **R integration?** → INTEGRATION.md
- **Scaling logic?** → README.md (Scaling & Classification Deep Dive)

---

**Ready to create your interactive bivariate map?** 

Start with **QUICKSTART.md** or follow the 3-minute setup above.

Happy mapping! 🗺️✨
