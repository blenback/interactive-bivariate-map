# Design System — Editorial Aesthetic Integration

Your original `style.css` warm gray editorial theme has been fully integrated into the raster bivariate visualization. This document provides a visual overview of the design.

---

## 🎨 Visual Hierarchy

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  H1: "Bivariate Raster Map"                            ║ 14px gap
║  SUBTITLE: Winsorized (5th–95th) + Equal Intervals     ║
║                                                           ║
╠═══════════════════╦═════════════════════════════════════╣
║                   ║                                       ║
║  SIDEBAR (190px)  ║  MAP AREA (Canvas/SVG)              ║
║                   ║                                       ║
║  ┌─────────────┐  ║  ┌───────────────────────────────┐  ║
║  │   LEGEND    │  ║  │                               │  ║
║  │  (3×3 grid) │  ║  │      RASTER VISUALIZATION    │  ║
║  │             │  ║  │   (Clickable, Zoomable)      │  ║
║  └─────────────┘  ║  │                               │  ║
║                   ║  │   Pixels: Canvas @ 250K+ pix  │  ║
║  HOW TO READ      ║  │                               │  ║
║  ─────────────    ║  │  Overlay: SVG for tooltips    │  ║
║  X: Performance   ║  │                               │  ║
║  Y: Variation     ║  └───────────────────────────────┘  ║
║                   ║                                       ║
║  INSIGHT          ║                                       ║
║  ─────────────    ║                                       ║
║  [Editorial       ║                                       ║
║   Narrative]      ║                                       ║
║                   ║                                       ║
╠═══════════════════╩═════════════════════════════════════╣
║  Data · Scaling · Classification · Performance · Credit ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🎭 Color Palette

### CSS Variables (Root)

```
┌─────────────────────────────────────────────────────────┐
│ --bg: #eae6de         Warm gray background              │
│ --bg-card: #ffffff    White card areas                  │
│ --text: #2a2a2a       Dark text (primary)               │
│ --muted: #7a756c      Warm gray (secondary)             │
│ --accent: #c24e80     Pink/magenta (emphasis)           │
│ --teal: #3a9e8f       Teal/green (positive)             │
│ --border: #cdc8be     Light warm gray (dividers)        │
└─────────────────────────────────────────────────────────┘
```

### Application in Visualization

```
HEADER
  Text: --text (#2a2a2a, serif display font)
  Subtitle: --muted (#7a756c, small caps)

LEGEND
  Label text: --muted, uppercase
  Cell borders: --border on hover
  No-data box: --border background

HOW TO READ
  Title: --text (uppercase)
  Body: --muted
  Highlights: --teal (stable), --accent (volatile)

INSIGHT
  Narrative text: --text
  Accent words: --teal (good), --accent (bad)

MAP/CANVAS
  Legend colors: Bivariate palette (#d2ecf1 to #a67c00)
  Background: --bg-card (#ffffff)
  Hover: Brightness filter +10%

TOOLTIP
  Background: --bg-card (#ffffff)
  Border: --border (#cdc8be)
  Text: --text (#2a2a2a)
  Labels: --muted (#7a756c)

FOOTER
  Text: --muted
  Links: --muted (underlined)
  Credit: --muted (italic)
```

---

## 📐 Typography System

### Font Stack

```
Display (Headings):
  "DM Serif Display", Georgia, serif
  → Elegant, editorial serif

Body (Content):
  "Inter", system-ui, -apple-system, sans-serif
  → Clean, modern sans-serif

Metadata/Code:
  Monospace for data breakpoints/values
```

### Scale

```
H1 (Header):       2.0rem, font-weight: 400, serif
Subtitle:          0.72rem, uppercase, --muted
Legend Label:      0.625rem, 600 weight, uppercase
How to Read Title: 0.5625rem, 600 weight, uppercase
How to Read Body:  0.425rem, 400 weight
Insight:           0.45rem, 400 weight
Tooltip:           0.49rem, 400 weight
Footer:            0.39rem, 400 weight
```

### Hierarchy

1. **Header** — Most prominent (editorial serif)
2. **Insight** — Key narrative
3. **Legend** — Reference guide
4. **Tooltip** — Contextual information
5. **Footer** — Attribution

---

## 🖼️ Layout Dimensions

### Desktop (Full Viewport)

```
Total Width:       1280px (max)
Total Height:      100vh (full screen, no scroll)
Padding:           0.5rem (header), 1.5rem (sides)

Container:         1280px max-width, flex column
  Header:          flex-shrink: 0, margin-bottom: 0.3rem
  Main Area:       flex: 1, display: flex, gap: 1rem
    Sidebar:       width: 190px, flex-direction: column
      Legend:      flex-shrink: 0
      How to Read: flex-shrink: 0, margin: 0.7rem 0
      Insight:     flex: auto
    Map Wrapper:   flex: 1, min-width: 0
  Footer:          flex-shrink: 0, border-top
```

### Sidebar Components

```
Legend (SVG):
  Size: ~140px × 160px
  Cell: 40px × 40px with 2px gap
  Labels: Positioned around edges

How to Read:
  Font: 0.68rem / 1.5 line-height
  Spacing: 0.35rem between sections
  Width: Constrained to 190px (wraps naturally)

Insight:
  Font: 0.72rem / 1.55 line-height
  Color: #4a463e (slightly warmer than muted)
  Max height: Fills remaining vertical space
```

### Map Area

```
Canvas/SVG:
  Width: 100% of flex space (minus sidebar + gap)
  Height: 100% of flex space (minus header + footer)
  Aspect Ratio: Depends on raster
  Rendering: Canvas for performance, SVG overlay for interaction

Interactivity:
  Canvas layer: Raster image
  SVG layer: Invisible rectangles for hover/click
  Tooltip: position: absolute, z-index: 10, max-width: 230px
```

---

## 🎨 Component Styles

### Legend Styling

```
.bivariate-legend {
  font-size: 9px / 8px (labels/corners)
  font-weight: 600 (labels), 400 (corners)
  letter-spacing: 0.04em / 0.02em
  text-transform: uppercase (labels only)
  fill: var(--muted)
}

Cell interaction:
  .legend-cell:hover rect {
    stroke: #333
    stroke-width: 1.5
    transition: 150ms ease
  }
```

### How to Read (Interpretive Guide)

```
.how-to-read {
  font-size: 0.68rem
  line-height: 1.5
  color: var(--muted)
  margin: 0.7rem from legend
}

.how-title {
  font-size: 0.5625rem / 9px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.04em
  color: var(--text)
  margin-bottom: 0.2rem
}

.how-dimension {
  margin-top: 0.35rem
  color: var(--text)
  font-size: 0.41rem / 0.65rem
}

Color highlights:
  .hl-teal: var(--teal) — stability, positive
  .hl-accent: var(--accent) — change, emphasis
  .hl-teal-dark: #1b6e62 — strong/stable (bold)
```

### Insight Narrative

```
.insight {
  font-size: 0.72rem
  line-height: 1.55
  color: #4a463e (slightly warm)
  flex: auto (expands to fill sidebar)
  
  Highlights:
    .hl-teal: var(--teal) + font-weight: 600
    .hl-accent: var(--accent) + font-weight: 600
}
```

### Tooltip Style

```
.tooltip {
  position: absolute
  background: var(--bg-card) / #ffffff
  border: 1px var(--border)
  border-radius: 3px
  padding: 10px 12px
  font-size: 0.78rem
  line-height: 1.6
  max-width: 230px
  z-index: 10
  box-shadow: 0 2px 8px rgba(0,0,0,0.10)
  
  Strong text (header):
    font-size: 0.82rem
    font-weight: 600
  
  Labels:
    color: var(--muted)
    font-size: 0.72rem
  
  Values:
    font-weight: 600
    font-variant-numeric: tabular-nums
}

Change indicators:
  .change-up: var(--accent) — increase/volatility
  .change-down: var(--teal) — decrease/stability
```

### Pixel Interaction

```
.pixel {
  transition: opacity 150ms ease
  
  :hover {
    filter: brightness(1.1)  — slight highlight
    stroke: var(--text)      — dark outline
    stroke-width: 1
  }
}

.pixel-overlay {
  fill: transparent
  cursor: pointer
  transition: opacity 150ms ease
  
  :hover { opacity: 0.2 }    — dim effect
}
```

### Footer/Sources

```
.sources {
  font-size: 0.62rem
  line-height: 1.6
  color: var(--muted)
  border-top: 1px var(--border)
  padding-top: 0.25rem
  display: flex
  flex-wrap: wrap
  gap: 0 0.15rem
  
  .sep: " · " (visual separator)
  .meta-inline: font-weight: 500
  .note: font-style: italic
  .credit: margin-left: auto, italic
}
```

---

## 📱 Responsive Breakpoint

### Mobile (<768px)

```css
.main-area {
  flex-direction: column  /* Stack vertically */
}

.sidebar {
  width: 100%           /* Full width */
  flex-direction: row    /* Horizontal wrap */
  flex-wrap: wrap       /* Items wrap to new lines */
  gap: 0.5rem          /* Tighter spacing */
}

header h1 {
  font-size: 1.4rem    /* Smaller headline */
}

.container {
  padding: 0.5rem 1rem /* Smaller margins */
}
```

Result:
```
┌──────────────────┐
│ Header           │
├──────────────────┤
│ Legend | Guide   │  (wrapped)
├──────────────────┤
│ Map              │  (full width)
├──────────────────┤
│ Insight          │
├──────────────────┤
│ Footer           │
└──────────────────┘
```

---

## 🎯 Design Principles

### 1. **Editorial Restraint**
- Serif display font for hierarchy
- Warm neutral palette (no bright colors except data)
- Generous whitespace
- Content-focused layout

### 2. **Data Visualization**
- Bivariate colors for performance/variation
- Interactive legend for exploration
- Subtle tooltips (not intrusive)
- Canvas rendering for performance

### 3. **Information Hierarchy**
1. Header (what you're looking at)
2. Legend (how to read it)
3. Map (the data)
4. Insight (what it means)
5. Footer (where it came from)

### 4. **Accessibility**
- WCAG contrast ratios (text meets AA)
- Semantic HTML structure
- Keyboard-friendly (legend, tooltips)
- Mobile-responsive layout

### 5. **Customization-Ready**
- All colors in CSS variables
- Typography scales proportionally
- Layout adapts to content size
- Print-friendly styling

---

## 🔄 Customization Workflow

### Change Aesthetic

1. **Edit `:root` variables** (colors)
2. **Update font stack** (Typography)
3. **Adjust sidebar width** (Layout)
4. **Test on mobile** (Responsive)
5. **Print preview** (⌘P)

### Change Content

1. **Update legend labels** (main-raster.js line ~121–122)
2. **Edit "How to Read"** (index-raster.html body)
3. **Customize insight** (main-raster.js line ~100)
4. **Update metadata** (index-raster.html footer)

### Change Data

1. **Export new CSV from R** (export_raster_data.R)
2. **Place in data/ folder**
3. **Refresh browser** → Map updates automatically

---

## 📊 Bivariate Color Integration

Bivariate palette colors (from `bivariate-raster.js`) are used:

```
LEGEND CELLS
↓
Bivariate 3×3 matrix (#d2ecf1 to #a67c00)
↓
CANVAS PIXELS
↓
Match legend cells visually

SEMANTIC MAPPING
Low performance  ← Blue (#7eb3c4, #a8cfdc, #d2ecf1)
Mid performance  ← Orange (#fb9367, #fdb485, #fed4a3)
High performance ← Gold (#a67c00, #b8970f, #c9b044)

Low variation   ← Pale colors
High variation  ← Saturated colors
```

Integrated with CSS palette:
- `--teal`: Used for "stable" indicators in text
- `--accent`: Used for "volatile" indicators in text
- Bivariate colors: Unchanged (data-driven)

---

## ✨ Special Features

### Hover Effects

**Legend Cells**:
```
Stroke: #333, Width: 1.5px
Transition: 150ms ease
Effect: Visual feedback for interactive cells
```

**Pixels**:
```
Canvas: No direct effect (performance)
SVG Overlay: opacity: 0.2 (dim effect)
Effect: Shows which pixels match legend cell
```

### Data-Driven Insight

JavaScript generates insight narrative based on:
- Number of stable pixels (high perf, low variation)
- Number of volatile pixels (low perf, high variation)
- Performance range
- Variation range

Text includes semantic color highlighting via inline spans.

### Print Optimization

```css
@media print {
  body { background: white; }
  #map { height: 600px; }
  .how-to-read { display: none; }  /* Or keep, depends on use */
  .tooltip { display: none; }
}
```

---

## 🎨 Theming Examples

### Dark Mode

```css
:root {
  --bg: #1a1a1a;
  --bg-card: #2a2a2a;
  --text: #f0f0f0;
  --muted: #aaa;
  --accent: #ff6b9d;
  --teal: #4dd9c4;
  --border: #444;
}
```

### High Contrast

```css
:root {
  --bg: #ffffff;
  --bg-card: #f5f5f5;
  --text: #000000;
  --muted: #333;
  --accent: #ff0000;
  --teal: #0066cc;
  --border: #999;
}
```

### Warm

```css
:root {
  --bg: #f5ead6;
  --text: #3d2817;
  --accent: #c84c4c;
  --teal: #556b2f;
}
```

---

## 📝 Files

- **index-raster.html** — HTML structure + inline CSS (complete)
- **main-raster.js** — Logic, insight generation
- **legend-raster.js** — Legend SVG (uses CSS variable colors)
- **bivariate-raster.js** — Bivariate color palette (hardcoded)
- **tooltip-raster.js** — Tooltip rendering (uses CSS)
- **CSS-INTEGRATION.md** — Technical customization guide (this doc)

---

## 🎯 Next Steps

1. Open **index-raster.html** in browser
2. Test interactive legend (hover cells)
3. Test tooltips (hover pixels)
4. Try customizing colors in `:root` CSS variables
5. Test mobile view (F12 → responsive mode)
6. Print preview (⌘P or Ctrl+P)

Enjoy your editorial bivariate raster visualization! 🗺️✨
