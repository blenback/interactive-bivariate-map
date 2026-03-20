# Integration: R Robustness Maps → Web Bivariate Raster Visualization

This document shows how to integrate the JavaScript raster visualization into your complete R analysis workflow.

---

## Complete Workflow

```
1. Prepare EDGAR + population data
        ↓
2. Run create_robustness_maps() with winsor scaling + equal classification
        ↓
3. Generate PNG maps (published to reports)
        ↓
4. Export rasters to CSV using export_raster_to_csv()
        ↓
5. Deploy web maps (interactive exploration)
```

---

## R Code Integration

### Step 1: Run Your Existing Analysis

```r
# Your existing code from create_robustness_maps()
source("create_robustness_maps.R")

robustness_dir <- "output/robustness"

create_robustness_maps(
  robustness_dir = robustness_dir,
  group_names = c("ES", "BD", "ES_and_BD"),
  scaling_methods = list(
    "winsor" = list(
      var_col = "Var_norm_winsor",
      perf_col = "Performance_norm_winsor",
      description = "Winsorized Scaling"
    )
  ),
  classification_methods = list(
    "equal" = list(
      style = "equal",
      description = "Equal Intervals"
    )
  ),
  palette = "BlueGold",
  num_classes = 3,
  save_json = TRUE,
  winsor_probs = c(0.05, 0.95)
)

# This generates PNG maps + legend + JSON palettes
```

### Step 2: Export for Web

```r
# Load the export helper
source("export_raster_data.R")

# Export each group for web visualization
groups <- c("ES", "BD", "ES_and_BD")

for (group in groups) {
  export_raster_to_csv(
    robustness_dir = robustness_dir,
    group = group,
    scaling_method = "winsor",
    classification_method = "equal",
    output_csv = file.path("web_output", paste0(group, "_raster_data.csv"))
  )
  cat("Exported:", group, "\n")
}
```

This creates:
- `web_output/ES_raster_data.csv` (normalized, classified pixels)
- `web_output/BD_raster_data.csv`
- `web_output/ES_and_BD_raster_data.csv`

### Step 3: Deploy Web Maps

```r
# Optional: Create HTML files for each group
library(glue)

for (group in groups) {
  html_content <- glue::glue('
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bivariate Map - {group}</title>
      <link rel="stylesheet" href="index-raster.html">
    </head>
    <body>
      <div id="map"></div>
      <div id="legend"></div>
      <div id="insight"></div>
      <script type="module">
        import {{ init }} from "./main-raster.js";
        const CONFIG = {{
          dataUrl: "data/{tolower(group)}_raster_data.csv"
        }};
        // init() called automatically
      </script>
    </body>
    </html>
  ')
  
  writeLines(html_content, file.path("web_output", paste0(group, ".html")))
}
```

---

## Complete R Example Script

```r
# ============================================================================
# analysis.R - Complete robustness mapping workflow
# ============================================================================

library(tidyverse)
library(terra)
library(biscale)
library(ggplot2)

# Config
config <- list(
  ProjCH = "EPSG:3857",
  robustness_dir = "output/robustness",
  web_output_dir = "web_output"
)

# Ensure output dirs exist
dir.create(config$robustness_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(config$web_output_dir, showWarnings = FALSE, recursive = TRUE)

# ============================================================================
# 1. GENERATE ROBUSTNESS MAPS (PNG)
# ============================================================================

source("create_robustness_maps.R")

cat("Step 1: Generating robustness maps...\n")

create_robustness_maps(
  robustness_dir = config$robustness_dir,
  group_names = c("ES", "BD", "ES_and_BD"),
  scaling_methods = list(
    "winsor" = list(
      var_col = "Var_norm_winsor",
      perf_col = "Performance_norm_winsor",
      description = "Winsorized Scaling"
    )
  ),
  classification_methods = list(
    "equal" = list(
      style = "equal",
      description = "Equal Intervals"
    )
  ),
  palette = "BlueGold",
  num_classes = 3,
  save_json = TRUE,
  winsor_probs = c(0.05, 0.95),
  verbose = TRUE
)

cat("✓ Maps generated:\n")
cat("  -", list.files(config$robustness_dir, pattern = ".png"), "\n")

# ============================================================================
# 2. EXPORT FOR WEB VISUALIZATION
# ============================================================================

cat("\nStep 2: Exporting raster data for web...\n")

source("export_raster_data.R")

groups <- c("ES", "BD", "ES_and_BD")

for (group in groups) {
  csv_file <- file.path(
    config$web_output_dir,
    paste0(group, "_raster_data.csv")
  )
  
  export_raster_to_csv(
    robustness_dir = config$robustness_dir,
    group = group,
    scaling_method = "winsor",
    classification_method = "equal",
    output_csv = csv_file
  )
}

cat("✓ CSV exports ready:\n")
cat("  -", list.files(config$web_output_dir, pattern = ".csv"), "\n")

# ============================================================================
# 3. COPY WEB ASSETS
# ============================================================================

cat("\nStep 3: Setting up web assets...\n")

web_files <- c(
  "index-raster.html",
  "main-raster.js",
  "bivariate-raster.js",
  "legend-raster.js",
  "tooltip-raster.js",
  "sample-data-generator.js"
)

for (file in web_files) {
  if (file.exists(file)) {
    file.copy(file, file.path(config$web_output_dir, file), overwrite = TRUE)
  }
}

cat("✓ Web files copied\n")

# ============================================================================
# 4. CREATE INDEX PAGE (Optional)
# ============================================================================

cat("\nStep 4: Creating web index...\n")

index_html <- '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Robustness Maps - Interactive Visualization</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #333; }
    .map-list { list-style: none; padding: 0; }
    .map-list li { margin: 1rem 0; }
    .map-list a {
      display: inline-block;
      padding: 12px 24px;
      background: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }
    .map-list a:hover { background: #0052a3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Interactive Robustness Maps</h1>
    <p>Winsorized scaling (5th–95th) + Equal interval classification</p>
    <ul class="map-list">
      <li><a href="index-raster.html?group=ES">Spain (ES)</a></li>
      <li><a href="index-raster.html?group=BD">Bangladesh (BD)</a></li>
      <li><a href="index-raster.html?group=ES_and_BD">Combined (ES + BD)</a></li>
    </ul>
    <hr>
    <p><small>Static PNG maps also available in <code>output/robustness/</code></small></p>
  </div>
</body>
</html>
'

writeLines(index_html, file.path(config$web_output_dir, "index.html"))

cat("✓ Index page created\n")

# ============================================================================
# 5. SUMMARY
# ============================================================================

cat("\n", strrep("=", 70), "\n")
cat("WORKFLOW COMPLETE\n")
cat(strrep("=", 70), "\n\n")

cat("Static outputs:\n")
cat("  PNG maps & legends: ", config$robustness_dir, "\n")
cat("  JSON palette info: ", config$robustness_dir, "\n\n")

cat("Interactive web maps:\n")
cat("  Location: ", config$web_output_dir, "\n")
cat("  Open file: ", file.path(config$web_output_dir, "index.html"), "\n")
cat("  Or serve with: python3 -m http.server\n\n")

cat("Files generated:\n")
cat("  -", length(list.files(config$robustness_dir)), "robustness outputs\n")
cat("  -", length(list.files(config$web_output_dir)), "web assets\n")

cat("\nTo deploy:\n")
cat("  1. Copy ", config$web_output_dir, " to web server\n")
cat("  2. Open index.html in browser\n")
cat("  3. Click any map link\n\n")
```

---

## Key Differences: PNG vs. Web

| Aspect | PNG Maps (R) | Web Maps (JS) |
|--------|-------------|---------------|
| **Format** | Static image | Interactive raster |
| **Use case** | Reports, publications | Exploration, dashboards |
| **Interactivity** | None | Hover tooltips, legend filtering |
| **Size** | 5–20 MB (high-res) | 0.5–2 MB CSV |
| **Best for** | Print, archival | Web deployment |
| **Customization** | R + ggplot2 | JavaScript + CSS |

**Recommendation**: Generate BOTH. Use PNG for reports, web for exploration.

---

## Data Flow Diagram

```
┌─────────────────────┐
│  GeoTIFF Rasters    │
│  (Performance,      │
│   Variation)        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  create_robustness_maps()           │
│  • Winsorization (5–95%)            │
│  • Min-max normalization [0, 1]     │
│  • Equal interval classes (3×3)     │
│  • Output: ggplot2 PNG + JSON       │
└──────────┬──────────────────────────┘
           │
           ├──→ PNG files (static reports)
           │
           ↓
┌─────────────────────────────────────┐
│  export_raster_to_csv()             │
│  • Convert raster to dataframe      │
│  • Apply same winsorization         │
│  • Export normalized + classified   │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  CSV: x, y, Performance, Var        │
│  (normalized [0, 1], classes 0–2)   │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  Web Visualization                  │
│  • Load CSV in JavaScript           │
│  • Canvas/SVG rendering             │
│  • Interactive legend + tooltips    │
│  • Deployed to web server           │
└─────────────────────────────────────┘
```

---

## Advantages of This Approach

✅ **Consistency**: Same scaling & classification in R and JavaScript  
✅ **Efficiency**: PNG for reports, CSV for web  
✅ **Flexibility**: Customize web visualization without re-running R  
✅ **Scalability**: Works with 100K+ pixels  
✅ **Open source**: No proprietary tools needed  

---

## Troubleshooting Integration

### CSV exports but map is blank

```r
# Check that values are normalized [0, 1]
df <- read.csv("web_output/ES_raster_data.csv")
summary(df$Performance)  # Should show Min: 0, Max: 1
summary(df$Var)        # Should show Min: 0, Max: 1
```

### PNG looks different from web map

- Ensure **same scaling_method** ("winsor" in both R and JS config)
- Ensure **same classification_method** ("equal" in both)
- JavaScript uses **equal intervals**, not the R biscale breaks

### File too large for CSV

- Downsample GeoTIFF before export
- Or split large rasters into tiles

---

## Next Steps

1. Copy `export_raster_data.R` to your project
2. Add export call to your workflow (see script above)
3. Test with one group first (e.g., "ES")
4. Verify CSV and web map match
5. Deploy remaining groups to web server

---

**Questions about the integration?** Check the `README.md` and `QUICKSTART.md` in the JavaScript files.
