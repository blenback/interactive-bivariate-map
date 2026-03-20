#' Export Raster Data to CSV for JavaScript Visualization
#'
#' After running create_robustness_maps(), use this function to convert
#' the classified raster back to CSV format for web visualization.
#'
#' @param robustness_dir Character: Directory containing the classification results
#' @param group Character: Group name (e.g., "ES")
#' @param scaling_method Character: Scaling method used (e.g., "winsor")
#' @param classification_method Character: Classification method used (e.g., "equal")
#' @param output_csv Character: Output CSV filename
#' @return data.frame (invisibly) with columns: x, y, Performance, Var, classA, classB
#'
#' @export
export_raster_to_csv <- function(
  robustness_dir,
  group = "ES",
  scaling_method = "winsor",
  classification_method = "equal",
  output_csv = NULL
) {
  
  if (is.null(output_csv)) {
    output_csv <- file.path(
      robustness_dir,
      paste0(group, "_", scaling_method, "_", classification_method, "_raster_data.csv")
    )
  }
  
  # Load rasters
  performance_file <- file.path(
    robustness_dir,
    paste0("Mean_sum_of_change_", group, ".tif")
  )
  variation_file <- file.path(
    robustness_dir,
    paste0("Undesirable_deviation_sum_of_change_", group, ".tif")
  )
  
  if (!file.exists(performance_file)) {
    stop(paste("Performance file not found:", performance_file))
  }
  if (!file.exists(variation_file)) {
    stop(paste("Variation file not found:", variation_file))
  }
  
  Performance <- rast(performance_file)
  Variation <- rast(variation_file)
  
  # Stack and convert to dataframe
  Combined_var <- c(Performance, Variation)
  names(Combined_var) <- c("Performance", "Var")
  
  data_df <- as.data.frame(Combined_var, xy = TRUE)
  names(data_df) <- c("x", "y", "Performance", "Var")
  
  # Apply winsorization + normalization (same as R script)
  # Winsorize at 5th–95th percentiles
  perf_low <- quantile(data_df$Performance, 0.05, na.rm = TRUE)
  perf_high <- quantile(data_df$Performance, 0.95, na.rm = TRUE)
  data_df$Performance_winsor <- pmax(perf_low, pmin(perf_high, data_df$Performance))
  
  var_low <- quantile(data_df$Var, 0.05, na.rm = TRUE)
  var_high <- quantile(data_df$Var, 0.95, na.rm = TRUE)
  data_df$Var_winsor <- pmax(var_low, pmin(var_high, data_df$Var))
  
  # Normalize to [0, 1]
  data_df$Performance_norm <- (data_df$Performance_winsor - min(data_df$Performance_winsor, na.rm = TRUE)) /
    (max(data_df$Performance_winsor, na.rm = TRUE) - min(data_df$Performance_winsor, na.rm = TRUE))
  
  data_df$Var_norm <- (data_df$Var_winsor - min(data_df$Var_winsor, na.rm = TRUE)) /
    (max(data_df$Var_winsor, na.rm = TRUE) - min(data_df$Var_winsor, na.rm = TRUE))
  
  # Equal interval classification (3 classes)
  # Breaks at 1/3 and 2/3
  data_df$classA <- ifelse(data_df$Performance_norm <= 1/3, 0,
                           ifelse(data_df$Performance_norm <= 2/3, 1, 2))
  data_df$classB <- ifelse(data_df$Var_norm <= 1/3, 0,
                           ifelse(data_df$Var_norm <= 2/3, 1, 2))
  
  # Select columns for export
  export_df <- data_df %>%
    select(x, y, Performance = Performance_norm, Var = Var_norm, classA, classB) %>%
    filter(!is.na(Performance) & !is.na(Var))
  
  # Write CSV
  write.csv(export_df, output_csv, row.names = FALSE)
  
  cat("Exported", nrow(export_df), "pixels to:", output_csv, "\n")
  
  invisible(export_df)
}

#' Quick export with default parameters
#'
#' @param robustness_dir Character: Directory path
#' @export
export_bivariate_raster <- function(robustness_dir) {
  export_raster_to_csv(
    robustness_dir = robustness_dir,
    group = "ES",
    scaling_method = "winsor",
    classification_method = "equal"
  )
}

# Usage example:
# export_raster_to_csv(
#   robustness_dir = "path/to/robustness_outputs",
#   group = "ES",
#   scaling_method = "winsor",
#   classification_method = "equal",
#   output_csv = "data/raster_bivariate_data.csv"
# )
