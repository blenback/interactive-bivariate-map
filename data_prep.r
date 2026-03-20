# ============================================================================
# analysis.R - Complete robustness mapping workflow
# ============================================================================

library(tidyverse)
library(terra)
library(biscale)
library(ggplot2)
library(glue)
library(jsonlite)

# Config
config <- list(
  ProjCH = "EPSG:3857",
  robustness_dir = "Y:/CH_Kanton_Bern/03_Workspaces/05_Web_platform/robustness",
  web_output_dir = "data"
)

# Ensure output dirs exist
dir.create(config$robustness_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(config$web_output_dir, showWarnings = FALSE, recursive = TRUE)

install.packages("servr") # one-time
servr::httd(
  "C:/Users/bblack/switchdrive/Private/git_laptop/interactive-bivariate-map"
)

# ============================================================================
# 1. GENERATE ROBUSTNESS MAPS (PNG)
# ============================================================================

#' @describeIn util Ensure that a directory exists
ensure_dir <- function(dir) {
  dir.create(dir, showWarnings = FALSE, recursive = TRUE)
  invisible(dir)
}

create_robustness_maps <- function(
  robustness_dir,
  group_names = c("ES"),
  performance_file_pattern = "_performance",
  variation_file_pattern = "_var",
  scaling_methods = list(
    "minmax" = list(
      var_col = "Var_norm",
      perf_col = "Performance",
      description = "Min-Max Scaling"
    ),
    "quantile" = list(
      var_col = "Var_norm_quantile",
      perf_col = "Performance_norm_quantile",
      description = "Quantile-based Scaling"
    ),
    "robust" = list(
      var_col = "Var_norm_robust",
      perf_col = "Performance_norm_robust",
      description = "Robust (MAD) Scaling"
    ),
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
    ),
    "quantile" = list(
      style = "quantile",
      description = "Quantile Breaks"
    ),
    "fisher" = list(
      style = "fisher",
      description = "Fisher-Jenks"
    )
  ),
  palette = "BlueGold",
  num_classes = 3,
  map_width = 25,
  map_height = 20,
  map_dpi = 300,
  save_json = TRUE,
  quantile_probs = c(0.02, 0.98),
  robust_probs = c(0.01, 0.99),
  winsor_probs = c(0.05, 0.95),
  ProjCH = config$ProjCH,
  verbose = TRUE
) {
  # Ensure robustness directory exists
  ensure_dir(robustness_dir)

  for (group in group_names) {
    if (verbose) {
      cat(paste0("Processing group: ", group, "\n"))
    }

    # Load rasters
    performance_file <- file.path(
      robustness_dir,
      paste0(group, performance_file_pattern, ".tif")
    )
    variation_file <- file.path(
      robustness_dir,
      paste0(group, variation_file_pattern, ".tif")
    )

    # Check if files exist
    if (!file.exists(performance_file)) {
      warning(paste("Performance file not found:", performance_file))
      next
    }
    if (!file.exists(variation_file)) {
      warning(paste("Variation file not found:", variation_file))
      next
    }

    Performance <- rast(performance_file)
    Variation <- rast(variation_file)

    # project to desired CRS if needed
    if (!is.null(ProjCH)) {
      Performance <- project(Performance, ProjCH)
      Variation <- project(Variation, ProjCH)
    }

    # Stack the Performance and undesirable deviation rasters
    Combined_var <- c(Performance, Variation)
    names(Combined_var) <- c("Performance", "Var")

    # Get raster extent for consistent plotting
    raster_ext <- ext(Performance)
    x_range <- raster_ext$xmax - raster_ext$xmin
    y_range <- raster_ext$ymax - raster_ext$ymin
    data_aspect_ratio <- y_range / x_range

    # Convert to df
    Mean_var_df <- as.data.frame(Combined_var, xy = TRUE)

    # Apply all scaling methods

    # 1. Quantile-based rescaling
    var_p_low <- quantile(Mean_var_df$Var, quantile_probs[1], na.rm = TRUE)
    var_p_high <- quantile(Mean_var_df$Var, quantile_probs[2], na.rm = TRUE)
    Mean_var_df$Var_norm_quantile <- pmax(
      0,
      pmin(1, (Mean_var_df$Var - var_p_low) / (var_p_high - var_p_low))
    )

    # For Performance (-1 to 1 range, preserving zero)
    perf_pos <- Mean_var_df$Performance[Mean_var_df$Performance >= 0]
    perf_neg <- Mean_var_df$Performance[Mean_var_df$Performance < 0]

    if (length(perf_pos) > 0) {
      perf_pos_p_high <- quantile(perf_pos, quantile_probs[2], na.rm = TRUE)
    } else {
      perf_pos_p_high <- 0
    }

    if (length(perf_neg) > 0) {
      perf_neg_p_low <- quantile(perf_neg, quantile_probs[1], na.rm = TRUE)
    } else {
      perf_neg_p_low <- 0
    }

    Mean_var_df$Performance_norm_quantile <- ifelse(
      Mean_var_df$Performance >= 0,
      pmin(1, Mean_var_df$Performance / perf_pos_p_high),
      pmax(-1, Mean_var_df$Performance / abs(perf_neg_p_low))
    )

    # 2. Robust scaling using median and MAD
    var_median <- median(Mean_var_df$Var, na.rm = TRUE)
    var_mad <- mad(Mean_var_df$Var, na.rm = TRUE)
    var_robust_scaled <- (Mean_var_df$Var - var_median) / var_mad

    var_robust_min <- quantile(var_robust_scaled, robust_probs[1], na.rm = TRUE)
    var_robust_max <- quantile(var_robust_scaled, robust_probs[2], na.rm = TRUE)
    Mean_var_df$Var_norm_robust <- pmax(
      0,
      pmin(
        1,
        (var_robust_scaled - var_robust_min) / (var_robust_max - var_robust_min)
      )
    )

    perf_median <- median(Mean_var_df$Performance, na.rm = TRUE)
    perf_mad <- mad(Mean_var_df$Performance, na.rm = TRUE)
    perf_robust_scaled <- (Mean_var_df$Performance - perf_median) / perf_mad

    perf_robust_pos <- perf_robust_scaled[perf_robust_scaled >= 0]
    perf_robust_neg <- perf_robust_scaled[perf_robust_scaled < 0]

    if (length(perf_robust_pos) > 0) {
      perf_robust_pos_max <- quantile(
        perf_robust_pos,
        robust_probs[2],
        na.rm = TRUE
      )
    } else {
      perf_robust_pos_max <- 1
    }

    if (length(perf_robust_neg) > 0) {
      perf_robust_neg_min <- quantile(
        perf_robust_neg,
        robust_probs[1],
        na.rm = TRUE
      )
    } else {
      perf_robust_neg_min <- -1
    }

    Mean_var_df$Performance_norm_robust <- ifelse(
      perf_robust_scaled >= 0,
      pmin(1, perf_robust_scaled / perf_robust_pos_max),
      pmax(-1, perf_robust_scaled / abs(perf_robust_neg_min))
    )

    # 3. Winsorized scaling
    var_p_low_w <- quantile(Mean_var_df$Var, winsor_probs[1], na.rm = TRUE)
    var_p_high_w <- quantile(Mean_var_df$Var, winsor_probs[2], na.rm = TRUE)
    var_winsorized <- pmax(var_p_low_w, pmin(var_p_high_w, Mean_var_df$Var))

    Mean_var_df$Var_norm_winsor <- (var_winsorized -
      min(var_winsorized, na.rm = TRUE)) /
      (max(var_winsorized, na.rm = TRUE) - min(var_winsorized, na.rm = TRUE))

    perf_p_low_w <- quantile(
      Mean_var_df$Performance,
      winsor_probs[1],
      na.rm = TRUE
    )
    perf_p_high_w <- quantile(
      Mean_var_df$Performance,
      winsor_probs[2],
      na.rm = TRUE
    )
    perf_winsorized <- pmax(
      perf_p_low_w,
      pmin(perf_p_high_w, Mean_var_df$Performance)
    )

    Mean_var_df$Performance_norm_winsor <- ifelse(
      perf_winsorized >= 0,
      perf_winsorized / max(perf_winsorized, na.rm = TRUE),
      -1 * (perf_winsorized / min(perf_winsorized, na.rm = TRUE))
    )

    # 4. Min-max scaling (original)
    Mean_var_df$Var_norm <- (Mean_var_df$Var -
      min(Mean_var_df$Var, na.rm = TRUE)) /
      (max(Mean_var_df$Var, na.rm = TRUE) - min(Mean_var_df$Var, na.rm = TRUE))

    Mean_var_df$Performance <- ifelse(
      Mean_var_df$Performance >= 0,
      Mean_var_df$Performance / max(Mean_var_df$Performance, na.rm = TRUE),
      -1 *
        (Mean_var_df$Performance / min(Mean_var_df$Performance, na.rm = TRUE))
    )

    # Loop over scaling and classification methods
    for (method_name in names(scaling_methods)) {
      method <- scaling_methods[[method_name]]

      for (class_name in names(classification_methods)) {
        classification <- classification_methods[[class_name]]

        if (verbose) {
          cat(paste0(
            "Processing ",
            group,
            " with ",
            method$description,
            " and ",
            classification$description,
            "\n"
          ))
        }

        # Check if required columns exist
        if (!method$perf_col %in% names(Mean_var_df)) {
          warning(paste(
            "Performance column",
            method$perf_col,
            "not found. Skipping",
            method_name
          ))
          next
        }

        if (!method$var_col %in% names(Mean_var_df)) {
          warning(paste(
            "Variance column",
            method$var_col,
            "not found. Skipping",
            method_name
          ))
          next
        }

        # Create temporary dataframe with standard column names
        temp_df <- Mean_var_df
        temp_df$x_var <- Mean_var_df[[method$perf_col]]
        temp_df$y_var <- Mean_var_df[[method$var_col]]
        temp_df$x <- Mean_var_df$x
        temp_df$y <- Mean_var_df$y

        # Bivariate classification
        Mean_var_class <- bi_class(
          temp_df,
          x = x_var,
          y = y_var,
          style = classification$style,
          dim = num_classes
        )

        # Create breaks
        Mean_var_breaks <- bi_class_breaks(
          temp_df,
          x = x_var,
          y = y_var,
          style = classification$style,
          dim = num_classes,
          dig_lab = 2,
          split = FALSE
        )

        # Create map with ggplot2
        Full_robustness_map <- ggplot() +
          geom_raster(
            data = Mean_var_class,
            aes(x = x, y = y, fill = bi_class),
            show.legend = FALSE
          ) +
          bi_scale_fill(
            pal = palette,
            dim = num_classes,
            flip_axes = FALSE,
            rotate_pal = FALSE,
            na.value = "white"
          ) +
          coord_equal() +
          theme_void()

        # Save map using ggsave with same dimensions as base R
        map_filename <- file.path(
          robustness_dir,
          paste0(
            group,
            "_",
            method_name,
            "_",
            class_name,
            "_robustness_map.png"
          )
        )

        ggsave(
          plot = Full_robustness_map,
          filename = map_filename,
          width = map_width,
          height = map_height,
          units = "cm",
          dpi = map_dpi,
          bg = "transparent"
        )

        # Create and save legend
        Full_map_legend <- bi_legend(
          pal = palette,
          flip_axes = FALSE,
          rotate_pal = FALSE,
          dim = num_classes,
          breaks = Mean_var_breaks,
          xlab = "Mean sum of change",
          ylab = "Norm. undesirable deviation",
          arrow = FALSE
        ) +
          theme(
            text = element_text(size = 8, family = "FiraSans"),
            axis.text.x = element_text(angle = -25, hjust = 0),
            axis.text.y = element_text(angle = -25, hjust = 0.25),
            panel.background = element_rect(fill = 'transparent'),
            plot.background = element_rect(fill = 'transparent', color = NA)
          )

        ggsave(
          Full_map_legend,
          filename = file.path(
            robustness_dir,
            paste0(
              group,
              "_",
              method_name,
              "_",
              class_name,
              "_robustness_legend.png"
            )
          ),
          width = map_width,
          height = map_height,
          units = "cm",
          dpi = map_dpi,
          bg = "transparent"
        )

        # Get bivariate color palette for JSON
        bi_colors_plot <- bi_pal(
          pal = palette,
          dim = num_classes,
          flip_axes = FALSE,
          rotate_pal = FALSE
        )

        bi_colors <- ggplot_build(bi_colors_plot)$data[[1]]$fill

        bi_class_values <- paste0(
          rep(1:num_classes, each = num_classes),
          "-",
          rep(1:num_classes, num_classes)
        )

        if (length(bi_colors) != length(bi_class_values)) {
          bi_colors <- biscale:::bi_pal_manual(
            pal = palette,
            dim = num_classes,
            flip_axes = FALSE,
            rotate_pal = FALSE
          )
        }

        # Save JSON palette information
        if (save_json) {
          palette_info <- list()

          for (i in 1:length(bi_class_values)) {
            class_id <- bi_class_values[i]
            color_code <- bi_colors[i]

            parts <- strsplit(class_id, "-")[[1]]
            x_pos <- as.numeric(parts[1])
            y_pos <- as.numeric(parts[2])

            perf_labels <- c("Low", "Medium", "High")
            var_labels <- c("Low", "Medium", "High")

            interpretation <- paste0(
              perf_labels[x_pos],
              " Performance, ",
              var_labels[y_pos],
              " Variation"
            )

            palette_info[[class_id]] <- list(
              color = color_code,
              interpretation = interpretation
            )
          }

          palette_json <- toJSON(palette_info, pretty = TRUE, auto_unbox = TRUE)

          json_filename <- file.path(
            robustness_dir,
            paste0(
              group,
              "_",
              method_name,
              "_",
              class_name,
              "_palette_info.json"
            )
          )

          write(palette_json, file = json_filename)

          # Export classified raster (1–9) for JS consumption
          class_numeric <- as.numeric(substr(Mean_var_class$bi_class, 1, 1)) *
            10 +
            as.numeric(substr(Mean_var_class$bi_class, 3, 3))
          # Or simpler: map "x-y" → (x-1)*3 + y giving 1–9
          class_idx <- (as.numeric(substr(Mean_var_class$bi_class, 1, 1)) - 1) *
            3 +
            as.numeric(substr(Mean_var_class$bi_class, 3, 3))

          Mean_var_class$class_idx <- class_idx

          classified_raster <- rast(
            Mean_var_class[, c("x", "y", "class_idx")],
            type = "xyz",
            crs = crs(Performance)
          )

          writeRaster(
            classified_raster,
            file.path(
              robustness_dir,
              paste0(
                group,
                "_",
                method_name,
                "_",
                class_name,
                "_classified.tif"
              )
            ),
            overwrite = TRUE,
            datatype = "INT1U" # values 1–9 fit in a single byte
          )

          if (verbose) {
            cat("Saved palette information to:", json_filename, "\n")
          }
        }
      }
    }

    if (verbose) {
      cat(paste0("Completed processing for group: ", group, "\n"))
    }
  }

  invisible(NULL)
}

cat("Step 1: Generating robustness maps...\n")

create_robustness_maps(
  robustness_dir = config$web_output_dir,
  group_names = c("ES", "BD", "BD-ES"),
  scaling_methods = list(
    "winsor" = list(
      var_col = "Var_norm_winsor",
      perf_col = "Performance_norm_winsor",
      description = "Winsorized Scaling"
    )
  ),
  classification_methods = list(
    "quantile" = list(
      style = "quantile",
      description = "Quantile Breaks"
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

groups <- c("ES", "BD", "BD-ES")

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
  "index.html",
  "js/main.js",
  "js/bivariate.js",
  "js/legend.js",
  "js/tooltip.js",
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
      <li><a href="index.html?group=ES">Spain (ES)</a></li>
      <li><a href="index.html?group=BD">Bangladesh (BD)</a></li>
      <li><a href="index.html?group=ES_and_BD">Combined (ES + BD)</a></li>
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
