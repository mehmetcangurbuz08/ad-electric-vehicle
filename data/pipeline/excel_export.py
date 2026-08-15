from __future__ import annotations

from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference, ScatterChart, Series
from openpyxl.cell.cell import MergedCell
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.table import Table, TableStyleInfo

from data.pipeline.modeling import ModelTables


NAVY = "17324D"
BLUE = "2F6FED"
GREEN = "2F9E72"
ORANGE = "EF8354"
LIGHT = "EAF0F6"
MUTED = "60758A"
WHITE = "FFFFFF"
THIN = Side(style="thin", color="D9E2EC")


def _title(sheet, title: str, subtitle: str, end_column: int = 8) -> None:
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=end_column)
    cell = sheet.cell(1, 1, title)
    cell.font = Font(size=20, bold=True, color=WHITE)
    cell.fill = PatternFill("solid", fgColor=NAVY)
    cell.alignment = Alignment(vertical="center")
    sheet.row_dimensions[1].height = 34
    sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=end_column)
    sheet.cell(2, 1, subtitle).font = Font(size=10, color=MUTED, italic=True)
    sheet.row_dimensions[2].height = 25
    sheet.freeze_panes = "A4"
    sheet.sheet_view.showGridLines = False


def _section(sheet, row: int, text: str, end_column: int = 8) -> None:
    sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=end_column)
    cell = sheet.cell(row, 1, text)
    cell.font = Font(size=12, bold=True, color=WHITE)
    cell.fill = PatternFill("solid", fgColor=BLUE)
    cell.alignment = Alignment(vertical="center")
    sheet.row_dimensions[row].height = 23


def _headers(sheet, row: int, headers: list[str]) -> None:
    for column, value in enumerate(headers, 1):
        cell = sheet.cell(row, column, value)
        cell.font = Font(bold=True, color=WHITE)
        cell.fill = PatternFill("solid", fgColor=NAVY)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = Border(bottom=THIN)
    sheet.row_dimensions[row].height = 28


def _table(sheet, reference: str, name: str) -> None:
    table = Table(displayName=name, ref=reference)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    sheet.add_table(table)


def _widths(sheet, widths: dict[str, float]) -> None:
    for column, width in widths.items():
        sheet.column_dimensions[column].width = width


def _center_workbook_cells(workbook: Workbook) -> None:
    for sheet in workbook.worksheets:
        for row in sheet.iter_rows():
            for cell in row:
                if isinstance(cell, MergedCell) or cell.value is None:
                    continue
                cell.alignment = Alignment(
                    horizontal="center",
                    vertical="center",
                    wrap_text=cell.alignment.wrap_text,
                    shrink_to_fit=cell.alignment.shrink_to_fit,
                )


def _method_sheet(workbook: Workbook, title: str, rows: list[tuple[str, str]]) -> None:
    sheet = workbook.create_sheet("Method")
    _title(sheet, title, "Formulas, data preparation, and interpretation notes", 6)
    _headers(sheet, 4, ["Topic", "Description"])
    for row_index, (heading, detail) in enumerate(rows, 5):
        sheet.cell(row_index, 1, heading).font = Font(bold=True, color=NAVY)
        sheet.cell(row_index, 2, detail).alignment = Alignment(wrap_text=True, vertical="top")
        sheet.cell(row_index, 1).alignment = Alignment(vertical="top")
        sheet.row_dimensions[row_index].height = max(34, min(90, len(detail) // 2))
    _widths(sheet, {"A": 28, "B": 100})
    sheet.freeze_panes = "A5"


def _regression_workbook(
    destination: Path, analysis: dict, tables: ModelTables
) -> None:
    workbook = Workbook()
    workbook.calculation.fullCalcOnLoad = True
    summary = workbook.active
    summary.title = "Summary"
    _title(
        summary,
        "Multiple Linear Regression",
        "Census indicators explaining EV density across Washington ZIP/ZCTA areas",
        9,
    )
    _section(summary, 4, "Model definition", 9)
    definitions = [
        ("Target", analysis["target"]),
        ("Sample", analysis["sampleSize"]),
        ("Validation", "5-fold cross-validation; each ZIP was predicted while left out of training"),
        ("Equation", analysis["formula"]),
    ]
    for row_index, (label, value) in enumerate(definitions, 5):
        summary.cell(row_index, 1, label).font = Font(bold=True, color=NAVY)
        summary.cell(row_index, 2, value)
        summary.merge_cells(start_row=row_index, start_column=2, end_row=row_index, end_column=9)
        summary.cell(row_index, 2).alignment = Alignment(wrap_text=True)

    _section(summary, 10, "Performance metrics", 9)
    _headers(summary, 11, ["Metric", "Python result", "Excel check", "How to read it"])
    last_prediction_row = len(tables.regression_predictions) + 1
    metric_rows = [
        (
            "R²",
            analysis["r2"],
            f"=1-SUM('Predictions'!H2:H{last_prediction_row})/DEVSQ('Predictions'!D2:D{last_prediction_row})",
            "Shows how much of the EV-density difference between ZIPs the model explains; higher is better.",
        ),
        (
            "MAE",
            analysis["mae"],
            f"=AVERAGE('Predictions'!G2:G{last_prediction_row})",
            "Average absolute difference between predictions and actual values; lower is better.",
        ),
        (
            "RMSE",
            analysis["rmse"],
            f"=SQRT(AVERAGE('Predictions'!H2:H{last_prediction_row}))",
            "Gives more weight to large errors than MAE; lower is better.",
        ),
        (
            "Average CV R2",
            analysis["cvR2Mean"],
            "Python 5-fold result",
            "Average R2 across the five validation folds.",
        ),
    ]
    for row_index, values in enumerate(metric_rows, 12):
        for column, value in enumerate(values, 1):
            summary.cell(row_index, column, value)
        summary.cell(row_index, 1).font = Font(bold=True, color=NAVY)
        summary.cell(row_index, 4).alignment = Alignment(wrap_text=True)
    _widths(summary, {"A": 23, "B": 18, "C": 24, "D": 78})

    coefficients = workbook.create_sheet("Coefficients")
    _title(
        coefficients,
        "Standardized Regression Coefficients",
        "Estimated change in EVs per 1,000 housing units for a +1 standard deviation change",
        7,
    )
    coefficient_headers = [
        "Variable", "Coefficient", "Direction", "Mean", "Standard deviation", "Interpretation"
    ]
    _headers(coefficients, 4, coefficient_headers)
    for row_index, row in enumerate(analysis["coefficients"], 5):
        values = [
            row["label"], row["coefficient"], row["direction"], row["mean"],
            row["standardDeviation"], row["interpretation"],
        ]
        for column, value in enumerate(values, 1):
            coefficients.cell(row_index, column, value)
        coefficients.cell(row_index, 6).alignment = Alignment(wrap_text=True)
    coefficient_end = len(analysis["coefficients"]) + 4
    _table(coefficients, f"A4:F{coefficient_end}", "RegressionCoefficients")
    _widths(coefficients, {"A": 32, "B": 14, "C": 13, "D": 17, "E": 18, "F": 72})
    chart = BarChart()
    chart.type = "bar"
    chart.style = 10
    chart.title = "Coefficient sizes"
    chart.y_axis.title = "Variable"
    chart.x_axis.title = "EVs per 1,000 housing units"
    chart.add_data(Reference(coefficients, min_col=2, min_row=4, max_row=coefficient_end), titles_from_data=True)
    chart.set_categories(Reference(coefficients, min_col=1, min_row=5, max_row=coefficient_end))
    chart.height = 8
    chart.width = 15
    coefficients.add_chart(chart, "H4")

    predictions = workbook.create_sheet("Predictions")
    prediction_headers = [
        "ZIP", "City", "County", "Actual EV/1K", "Predicted EV/1K",
        "Residual (Actual-Predicted)", "Absolute error", "Squared error",
        "Median income", "Multifamily housing %", "Work-from-home %", "Commute min",
    ]
    _headers(predictions, 1, prediction_headers)
    for row_index, row in enumerate(tables.regression_predictions.itertuples(), 2):
        values = [
            str(row.zipCode), row.city, row.county, row.evPer1kHousing,
            row.predictedEvPer1kHousing,
        ]
        for column, value in enumerate(values, 1):
            predictions.cell(row_index, column, value)
        predictions.cell(row_index, 6, f"=D{row_index}-E{row_index}")
        predictions.cell(row_index, 7, f"=ABS(F{row_index})")
        predictions.cell(row_index, 8, f"=F{row_index}^2")
        trailing = [
            row.medianIncome, row.multifamilyShare, row.workFromHomeShare,
            row.avgCommuteMinutes,
        ]
        for column, value in enumerate(trailing, 9):
            predictions.cell(row_index, column, value)
    _table(predictions, f"A1:L{last_prediction_row}", "RegressionPredictions")
    predictions.freeze_panes = "D2"
    predictions.auto_filter.ref = f"A1:L{last_prediction_row}"
    _widths(
        predictions,
        {"A": 11, "B": 20, "C": 18, "D": 15, "E": 15, "F": 21,
         "G": 14, "H": 14, "I": 17, "J": 20, "K": 18, "L": 15},
    )
    predictions.conditional_formatting.add(
        f"G2:G{last_prediction_row}",
        ColorScaleRule(start_type="min", start_color="E8F5E9", mid_type="percentile", mid_value=50, mid_color="FFF3CD", end_type="max", end_color="F8D7DA"),
    )
    scatter = ScatterChart()
    scatter.title = "Actual and cross-validation predictions"
    scatter.x_axis.title = "Actual EVs per 1,000 housing units"
    scatter.y_axis.title = "Predicted EVs per 1,000 housing units"
    series = Series(
        Reference(predictions, min_col=5, min_row=2, max_row=last_prediction_row),
        Reference(predictions, min_col=4, min_row=2, max_row=last_prediction_row),
        title="ZIP areas",
    )
    series.marker.symbol = "circle"
    series.marker.size = 4
    series.graphicalProperties.line.noFill = True
    scatter.series.append(series)
    scatter.height = 10
    scatter.width = 17
    summary.add_chart(scatter, "F11")

    _method_sheet(
        workbook,
        "Regression Method",
        [
            ("Research question", "How much do income, housing structure, and commute indicators explain ZIP-level EV density?"),
            ("Dependent variable", "Y = (Registered EVs / Housing units) x 1,000"),
            ("Model", "y_hat = beta0 + beta1*z(Income) + beta2*z(Multifamily housing) + beta3*z(Work from home) + beta4*z(Commute)"),
            ("Standardization", "z = (x - mean) / standard deviation. This makes coefficients from different units comparable."),
            ("R²", "R2 = 1 - sum(y-y_hat)^2 / sum(y-y_mean)^2. It is the explained variation ratio; higher values mean stronger explanation."),
            ("MAE", "MAE = sum(|y-y_hat|) / n. It shows the average prediction error in EVs per 1,000 housing units."),
            ("Validation", "In 5-fold cross-validation, data is split into five groups; each group is predicted by a model trained on the other four."),
            ("Limit", "Because the data is cross-sectional and observational, coefficients should not be interpreted as causation or future forecasts."),
        ],
    )
    _center_workbook_cells(workbook)
    workbook.save(destination)


def _clustering_workbook(
    destination: Path, analysis: dict, tables: ModelTables
) -> None:
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    _title(
        summary,
        "K-Means Clustering Analysis",
        "ZIP/ZCTA profiles built from EV density, public charging port density, and income",
        9,
    )
    _section(summary, 4, "Model summary", 9)
    summary_rows = [
        ("ZIPs used", analysis["sampleSize"]),
        ("Selected cluster count", analysis["selectedK"]),
        ("Silhouette score", analysis["silhouetteScore"]),
        ("Objective function", analysis["formula"]),
    ]
    for row_index, (label, value) in enumerate(summary_rows, 5):
        summary.cell(row_index, 1, label).font = Font(bold=True, color=NAVY)
        summary.cell(row_index, 2, value)
        summary.merge_cells(start_row=row_index, start_column=2, end_row=row_index, end_column=7)
    _section(summary, 10, "Cluster profiles", 9)
    profile_headers = [
        "Cluster", "Name", "ZIP", "EV/1K housing units", "Ports/1K housing units", "Median income",
        "Multifamily %", "Commute min", "Description",
    ]
    _headers(summary, 11, profile_headers)
    for row_index, row in enumerate(analysis["clusters"], 12):
        values = [
            row["clusterId"], row["label"], row["zipCount"], row["evPer1kHousing"],
            row["portsPer1kHousing"], row["medianIncome"], row["multifamilyShare"],
            row["avgCommuteMinutes"], row["description"],
        ]
        for column, value in enumerate(values, 1):
            summary.cell(row_index, column, value)
        summary.cell(row_index, 1).fill = PatternFill("solid", fgColor=row["color"].lstrip("#"))
        summary.cell(row_index, 1).font = Font(bold=True, color=WHITE)
        summary.cell(row_index, 9).alignment = Alignment(wrap_text=True)
    profile_end = len(analysis["clusters"]) + 11
    _table(summary, f"A11:I{profile_end}", "ClusterSummary")
    _widths(summary, {"A": 10, "B": 29, "C": 10, "D": 16, "E": 17, "F": 18, "G": 17, "H": 16, "I": 70})

    profile_sheet = workbook.create_sheet("Cluster Profiles")
    _title(profile_sheet, "Cluster Profiles", "Cluster averages and totals", 12)
    profile_columns = [
        ("clusterId", "Cluster"), ("label", "Name"), ("zipCount", "ZIP count"),
        ("evPer1kHousing", "EV/1K housing units"), ("portsPer1kHousing", "Ports/1K housing units"),
        ("medianIncome", "Median income"), ("multifamilyShare", "Multifamily %"),
        ("workFromHomeShare", "Work-from-home %"), ("avgCommuteMinutes", "Commute min"),
        ("bevShare", "BEV %"), ("vehicles", "Total EVs"), ("publicPorts", "Total ports"),
    ]
    _headers(profile_sheet, 4, [label for _, label in profile_columns])
    for row_index, row in enumerate(analysis["clusters"], 5):
        for column, (key, _) in enumerate(profile_columns, 1):
            profile_sheet.cell(row_index, column, row[key])
        profile_sheet.cell(row_index, 1).fill = PatternFill("solid", fgColor=row["color"].lstrip("#"))
        profile_sheet.cell(row_index, 1).font = Font(color=WHITE, bold=True)
    _table(profile_sheet, f"A4:L{len(analysis['clusters']) + 4}", "ClusterProfiles")
    _widths(profile_sheet, {"A": 10, "B": 30, "C": 13, "D": 16, "E": 17, "F": 18, "G": 17, "H": 18, "I": 16, "J": 12, "K": 14, "L": 14})
    chart = BarChart()
    chart.type = "col"
    chart.title = "EV and port density by cluster"
    chart.y_axis.title = "per 1,000 housing units"
    chart.add_data(Reference(profile_sheet, min_col=4, max_col=5, min_row=4, max_row=len(analysis["clusters"]) + 4), titles_from_data=True)
    chart.set_categories(Reference(profile_sheet, min_col=2, min_row=5, max_row=len(analysis["clusters"]) + 4))
    chart.height = 9
    chart.width = 17
    profile_sheet.add_chart(chart, "A10")

    selection = workbook.create_sheet("K Selection")
    _title(selection, "Cluster Count Selection", "Inertia and silhouette comparison for K=2-6", 7)
    _headers(selection, 4, ["K", "Inertia", "Silhouette", "Selected?"])
    for row_index, row in enumerate(analysis["kEvaluation"], 5):
        values = [row["k"], row["inertia"], row["silhouette"], "Yes" if row["k"] == analysis["selectedK"] else "No"]
        for column, value in enumerate(values, 1):
            selection.cell(row_index, column, value)
    selection_end = len(analysis["kEvaluation"]) + 4
    _table(selection, f"A4:D{selection_end}", "ClusterKEvaluation")
    _widths(selection, {"A": 10, "B": 16, "C": 16, "D": 16})
    line = LineChart()
    line.title = "Silhouette score"
    line.y_axis.title = "Score"
    line.x_axis.title = "K"
    line.add_data(Reference(selection, min_col=3, min_row=4, max_row=selection_end), titles_from_data=True)
    line.set_categories(Reference(selection, min_col=1, min_row=5, max_row=selection_end))
    line.height = 9
    line.width = 16
    selection.add_chart(line, "F4")

    assignments = workbook.create_sheet("ZIP Assignments")
    assignment_columns = [
        ("zipCode", "ZIP"), ("city", "City"), ("county", "County"),
        ("clusterId", "Cluster"), ("clusterLabel", "Cluster name"),
        ("vehicles", "EV"), ("publicPorts", "Public ports"),
        ("evPer1kHousing", "EV/1K housing units"), ("portsPer1kHousing", "Ports/1K housing units"),
        ("medianIncome", "Median income"), ("multifamilyShare", "Multifamily %"),
        ("workFromHomeShare", "Work-from-home %"), ("avgCommuteMinutes", "Commute min"),
        ("bevShare", "BEV %"),
    ]
    _headers(assignments, 1, [label for _, label in assignment_columns])
    color_by_cluster = {
        row["clusterId"]: row["color"].lstrip("#") for row in analysis["clusters"]
    }
    for row_index, row in enumerate(analysis["assignments"], 2):
        for column, (key, _) in enumerate(assignment_columns, 1):
            assignments.cell(row_index, column, row[key])
        assignments.cell(row_index, 4).fill = PatternFill("solid", fgColor=color_by_cluster[row["clusterId"]])
        assignments.cell(row_index, 4).font = Font(color=WHITE, bold=True)
    assignment_end = len(analysis["assignments"]) + 1
    _table(assignments, f"A1:N{assignment_end}", "ClusterAssignments")
    assignments.freeze_panes = "F2"
    assignments.auto_filter.ref = f"A1:N{assignment_end}"
    _widths(assignments, {"A": 11, "B": 20, "C": 18, "D": 10, "E": 28, "F": 12, "G": 14, "H": 16, "I": 17, "J": 18, "K": 17, "L": 18, "M": 15, "N": 11})

    _method_sheet(
        workbook,
        "K-Means Methodi",
        [
            ("Research question", "Which similar profiles do Washington ZIP areas form by EV density, public charging port density, and income?"),
            ("Inputs", "EVs per 1,000 housing units, public ports per 1,000 housing units, and median household income."),
            ("Transformation", "Densities were transformed with log(1+x), then all inputs were scaled with z = (x - mean) / standard deviation."),
            ("Objective function", "min sum_k sum_x_in_Ck ||x_i - mu_k||^2. The squared distance between each ZIP and its assigned cluster center is minimized."),
            ("Silhouette", "s(i) = [b(i)-a(i)] / max[a(i),b(i)]. Values closer to 1 mean clearer clusters; values near 0 indicate overlap."),
            ("K selection", "K=2-6 was tested and the option with the highest silhouette score was selected."),
            ("Profile variables", "Housing type, work-from-home, commute, and BEV share did not build the model; they are reported only to describe the clusters."),
            ("Limit", "Clusters are not final investment decisions. Traffic, grid capacity, cost, and site suitability should be reviewed separately."),
        ],
    )
    _center_workbook_cells(workbook)
    workbook.save(destination)


def export_model_workbooks(
    analysis: dict, tables: ModelTables, destination_dir: Path
) -> list[Path]:
    destination_dir.mkdir(parents=True, exist_ok=True)
    regression_path = destination_dir / "regression_analysis.xlsx"
    clustering_path = destination_dir / "clustering_analysis.xlsx"
    _regression_workbook(regression_path, analysis["regression"], tables)
    _clustering_workbook(clustering_path, analysis["clustering"], tables)
    return [regression_path, clustering_path]
