# Quick Start Guide — Bivariate Raster Map

## 5-Minute Setup

### Step 1: Export Your Raster Data from R

After running `create_robustness_maps()`:

```r
# Copy export_raster_data.R to your R project
source("export_raster_data.R")

# Export classified raster to CSV
export_raster_to_csv(
  robustness_dir = "path/to/your/outputs",
  group = "ES",
  scaling_method = "winsor",
  classification_method = "equal",
  output_csv = "raster_bivariate_data.csv"
)
```

This creates a **2.5MB CSV** for a typical 500×500 pixel raster.

### Step 2: Organize Files

```
my-map-project/
├── index-raster.html
├── main-raster.js
├── bivariate-raster.js
├── legend-raster.js
├── tooltip-raster.js
├── data/
│   └── raster_bivariate_data.csv        ← from R export
└── (optional) sample-data-generator.js
```

### Step 3: Start Local Server

**Python 3:**
```bash
cd my-map-project
python3 -m http.server 8000
# Open http://localhost:8000/index-raster.html
```

**Node.js:**
```bash
npx http-server
# Open http://localhost:8080
```

**VS Code:**
- Install "Live Server" extension
- Right-click `index-raster.html` → "Open with Live Server"

### Step 4: View Your Map

Open browser → http://localhost:8000/index-raster.html

Done! ✅

---

## Testing Without Real Data

### Option A: Generate Sample Data (Easiest)

In browser console (F12 → Console):

```javascript
import { generateSampleData, downloadCSV } from './sample-data-generator.js';

// Generate 50×50 grid of synthetic data
const data = generateSampleData(50, 50);

// Download as CSV
downloadCSV(data, 'raster_bivariate_data.csv');
```

Then place the downloaded file in `data/` folder and refresh.

### Option B: Use Placeholder CSV

Create `data/raster_bivariate_data.csv` manually:

```csv
x,y,Performance,Var
0,0,0.2,0.3
0.1,0,0.4,0.5
0.2,0,0.6,0.7
0.3,0,0.8,0.2
0.4,0,0.9,0.8
0,0.1,0.15,0.6
0.1,0.1,0.35,0.4
0.2,0.1,0.55,0.8
0.3,0.1,0.75,0.5
0.4,0.1,0.95,0.3
```

Refresh browser → should see colored pixels appear.

---

## Verify Installation

### Check Console for Errors

Open **F12 → Console**. Should see:

```
Initializing raster bivariate map...
Loaded 2500 pixels
Classification complete: {
  breaksPerf: ["0.33", "0.67"],
  breaksVar: ["0.33", "0.67"],
  pixelsClassified: 2500,
  ...
}
```

### Hover Test

- ✅ Hover legend cells → pixels should highlight/dim
- ✅ Hover pixels → tooltip should appear
- ✅ Tooltip shows: X, Y, Performance, Variation, Class

---

## Customization Checklist

### Change Map Title
Edit `index-raster.html`:
```html
<h1>Your Custom Title</h1>
<p class="subtitle">Your subtitle here</p>
```

### Change Legend Labels
Edit `main-raster.js`, line ~100:
```javascript
drawLegend(CONFIG.legendSelector, {
  labelA: "Your Performance Label",
  labelB: "Your Variation Label",
  ...
});
```

### Change Canvas Size
Edit `main-raster.js`, line ~15:
```javascript
const CONFIG = {
  cellSize: 10,  // Larger = bigger pixels
  ...
};
```

### Switch Rendering Method
Edit `main-raster.js`, line ~14:
```javascript
renderMethod: "svg-rects",  // "canvas" or "svg-rects"
```

**Canvas** = fast (recommended)  
**SVG Rects** = slower, fully styleable

### Change Color Palette
Edit `bivariate-raster.js`, lines 10–14:
```javascript
const BIVARIATE_COLORS = [
  ["#your-blue", "#...", "#..."],      // Low variation
  ["#your-orange", "#...", "#..."],    // Medium variation
  ["#your-gold", "#...", "#..."]       // High variation
];
```

Get new palette from R:
```r
biscale::bi_pal(pal = "YourPalette", dim = 3)
```

---

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| **Blank white map** | Check CSV is in `data/` folder. Open DevTools Console → look for file errors. |
| **"CSV data is empty"** | CSV file missing or path wrong. Verify `dataUrl: "data/raster_bivariate_data.csv"` in `main-raster.js`. |
| **Legend not showing** | D3 not loaded. Check `<script src="d3..."></script>` in HTML. |
| **Tooltips don't appear** | CSS issue. Ensure `tooltip` class exists in `index-raster.html`. |
| **Map too slow** | Switch to Canvas method. Or reduce raster size before R export. |
| **Values out of range [0,1]** | Re-run R export function. Ensure `Performance` and `Var` columns are normalized. |

---

## Data Workflow (End-to-End)

```
R: GeoTIFFs (Performance, Variation)
        ↓
R: create_robustness_maps()
        ↓
R: export_raster_to_csv()
        ↓
CSV: raster_bivariate_data.csv
        ↓
Web: main-raster.js loads CSV
        ↓
Web: classifyRasterBivariate() applies winsorization + classification
        ↓
Web: Canvas/SVG renders with BIVARIATE_COLORS
        ↓
Browser: Interactive map with legend + tooltips
```

---

## Understanding the Numbers

### Bivariate Classes (0–2)

Each pixel gets two classes:
- **classA** (Performance): 0 = Low, 1 = Medium, 2 = High
- **classB** (Variation): 0 = Low, 1 = Medium, 2 = High

**Example**: A pixel with `classA=2, classB=0` means:
- High performance + Low variation = **stable high-performance** area (gold color)

### Breaks (Percentiles)

Default equal intervals:
```
[0.0 — 0.333) → class 0
[0.333 — 0.667) → class 1
[0.667 — 1.0] → class 2
```

You'll see in the metadata footer:
```
Performance breaks: 0.33, 0.67 · Variation breaks: 0.33, 0.67
```

---

## Next Steps

1. **Read full README.md** for advanced options
2. **Check sample-data-generator.js** for synthetic data patterns
3. **Explore color palettes** in `bivariate-raster.js`
4. **Customize tooltip** content in `tooltip-raster.js`
5. **Add annotations** by extending `main-raster.js` (see old vector code for examples)

---

## Support

If you get stuck:

1. **Check browser console** (F12 → Console)
2. **Verify CSV** format and values [0, 1]
3. **Compare to vector code** in original files
4. **Read comments** in `main-raster.js` and `bivariate-raster.js`

---

**Happy mapping!** 🗺️
