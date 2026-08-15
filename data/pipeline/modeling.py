from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    silhouette_score,
)
from sklearn.model_selection import KFold, cross_val_predict, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


RANDOM_STATE = 42
REGRESSION_FEATURES = [
    ("medianIncome", "Median household income"),
    ("multifamilyShare", "Multifamily housing share"),
    ("workFromHomeShare", "Work-from-home share"),
    ("avgCommuteMinutes", "Average commute time"),
]
CLUSTER_FEATURES = [
    ("evPer1kHousing", "EVs per 1,000 housing units", "log(1+x) and z-score"),
    ("portsPer1kHousing", "Public ports per 1,000 housing units", "log(1+x) and z-score"),
    ("medianIncome", "Median household income", "z-score"),
]


@dataclass
class ModelTables:
    regression_coefficients: pd.DataFrame
    regression_predictions: pd.DataFrame
    cluster_evaluation: pd.DataFrame
    cluster_profiles: pd.DataFrame
    cluster_assignments: pd.DataFrame


def _round(value: float, digits: int = 3) -> float:
    return round(float(value), digits)


def _regression(regions: pd.DataFrame) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    feature_keys = [key for key, _ in REGRESSION_FEATURES]
    required = ["zipCode", "city", "county", "evPer1kHousing", *feature_keys]
    complete = regions.dropna(subset=required).copy()
    upper_limit = float(complete["evPer1kHousing"].quantile(0.99))
    sample = complete.loc[complete["evPer1kHousing"].le(upper_limit)].copy()

    x = sample[feature_keys]
    y = sample["evPer1kHousing"]
    folds = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    pipeline = Pipeline(
        [("scale", StandardScaler()), ("model", LinearRegression())]
    )
    out_of_fold = cross_val_predict(pipeline, x, y, cv=folds)
    fold_scores = cross_val_score(pipeline, x, y, cv=folds, scoring="r2")
    pipeline.fit(x, y)

    scaler: StandardScaler = pipeline.named_steps["scale"]
    model: LinearRegression = pipeline.named_steps["model"]
    coefficient_rows = []
    formula_parts = []
    for index, ((key, label), coefficient) in enumerate(
        zip(REGRESSION_FEATURES, model.coef_, strict=True)
    ):
        coefficient_rows.append(
            {
                "key": key,
                "label": label,
                "coefficient": _round(coefficient, 2),
                "direction": "Positive" if coefficient >= 0 else "Negative",
                "mean": _round(scaler.mean_[index], 2),
                "standardDeviation": _round(scaler.scale_[index], 2),
                "interpretation": (
                    f"{label} increases by one standard deviation, the model EV density "
                    f"prediction {abs(coefficient):.1f} EVs per 1,000 housing units "
                    f"{'increases' if coefficient >= 0 else 'decreases'}."
                ),
            }
        )
        sign = "+" if coefficient >= 0 else "−"
        formula_parts.append(f" {sign} {abs(coefficient):.2f}·z({label})")

    predictions = sample[
        ["zipCode", "city", "county", "evPer1kHousing", *feature_keys]
    ].copy()
    predictions["predictedEvPer1kHousing"] = out_of_fold
    predictions["residual"] = predictions["evPer1kHousing"] - out_of_fold
    predictions["absoluteError"] = predictions["residual"].abs()
    predictions["squaredError"] = predictions["residual"].pow(2)
    predictions = predictions.sort_values("zipCode")

    prediction_rows = [
        {
            "zipCode": str(row.zipCode),
            "city": str(row.city),
            "county": str(row.county),
            "actual": _round(row.evPer1kHousing, 1),
            "predicted": _round(row.predictedEvPer1kHousing, 1),
            "residual": _round(row.residual, 1),
        }
        for row in predictions.itertuples()
    ]
    largest_errors = sorted(
        prediction_rows, key=lambda row: abs(row["residual"]), reverse=True
    )[:12]

    r2 = r2_score(y, out_of_fold)
    mae = mean_absolute_error(y, out_of_fold)
    rmse = mean_squared_error(y, out_of_fold) ** 0.5
    formula = f"ŷ = {model.intercept_:.2f}" + "".join(formula_parts)
    result = {
        "method": "Multiple linear regression",
        "target": "Registered EVs per 1,000 housing units",
        "sampleSize": int(len(sample)),
        "completeRows": int(len(complete)),
        "outlierThreshold": _round(upper_limit, 1),
        "r2": _round(r2, 3),
        "mae": _round(mae, 2),
        "rmse": _round(rmse, 2),
        "cvR2Mean": _round(fold_scores.mean(), 3),
        "cvR2Std": _round(fold_scores.std(ddof=0), 3),
        "intercept": _round(model.intercept_, 2),
        "formula": formula,
        "coefficients": coefficient_rows,
        "predictions": prediction_rows,
        "largestErrors": largest_errors,
        "notes": [
            "The outcome variable is defined as EVs per 1,000 housing units to normalize for ZIP size.",
            "Rows with missing fields and the top 1% EV-density outliers were excluded from the model.",
            "R2 and error values were calculated from 5-fold cross-validation predictions where each ZIP was left out of training once.",
            "Coefficients show relationships; they should not be interpreted as causation or future prediction.",
        ],
        "exportUrl": "/exports/regression_analysis.xlsx",
    }
    return result, pd.DataFrame(coefficient_rows), predictions


def _cluster_labels(profile: pd.DataFrame) -> dict[int, dict]:
    if len(profile) != 3:
        palette = ["#78909c", "#ef8354", "#2f9e72", "#6c63a8", "#2f6fed", "#b7791f"]
        return {
            int(raw_cluster): {
                "clusterId": order,
                "label": f"Cluster {order}",
                "color": palette[(order - 1) % len(palette)],
                "description": "Areas with similar EV density, public port density, and income.",
            }
            for order, raw_cluster in enumerate(
                profile.sort_values("evPer1kHousing").index, 1
            )
        }
    low_demand = int(profile["evPer1kHousing"].idxmin())
    remaining = profile.drop(index=low_demand)
    strong_supply = int(remaining["portsPer1kHousing"].idxmax())
    demand_gap = int(next(index for index in remaining.index if index != strong_supply))
    return {
        low_demand: {
            "clusterId": 1,
            "label": "Low EV / low charging",
            "color": "#78909c",
            "description": "Areas with lower EV and public port density than the other clusters.",
        },
        demand_gap: {
            "clusterId": 2,
            "label": "High EV / limited charging",
            "color": "#ef8354",
            "description": "Areas with high EV density but public port density behind the strong-charging cluster.",
        },
        strong_supply: {
            "clusterId": 3,
            "label": "Strong charging coverage",
            "color": "#2f9e72",
            "description": "Areas with clearly higher public port density.",
        },
    }


def _clustering(
    regions: pd.DataFrame,
) -> tuple[dict, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    work = regions.copy()
    work["portsPer1kHousing"] = (
        work["publicPorts"] / work["housingUnits"].replace(0, np.nan) * 1000
    )
    required = [
        "zipCode", "city", "county", "vehicles", "publicPorts",
        "evPer1kHousing", "portsPer1kHousing", "medianIncome", "bevShare",
        "multifamilyShare", "workFromHomeShare", "avgCommuteMinutes",
    ]
    complete = work.dropna(subset=required).copy()
    ev_limit = float(complete["evPer1kHousing"].quantile(0.99))
    port_limit = float(complete["portsPer1kHousing"].quantile(0.99))
    sample = complete.loc[
        complete["evPer1kHousing"].le(ev_limit)
        & complete["portsPer1kHousing"].le(port_limit)
    ].copy()

    feature_keys = [key for key, _, _ in CLUSTER_FEATURES]
    transformed = sample[feature_keys].copy()
    transformed["evPer1kHousing"] = np.log1p(transformed["evPer1kHousing"])
    transformed["portsPer1kHousing"] = np.log1p(
        transformed["portsPer1kHousing"]
    )
    scaler = StandardScaler()
    scaled = scaler.fit_transform(transformed)

    evaluation_rows = []
    for cluster_count in range(2, 7):
        candidate = KMeans(
            n_clusters=cluster_count, n_init=50, random_state=RANDOM_STATE
        ).fit(scaled)
        evaluation_rows.append(
            {
                "k": cluster_count,
                "inertia": _round(candidate.inertia_, 2),
                "silhouette": _round(
                    silhouette_score(scaled, candidate.labels_), 3
                ),
            }
        )

    selected_k = max(evaluation_rows, key=lambda row: row["silhouette"])["k"]
    model = KMeans(
        n_clusters=selected_k, n_init=50, random_state=RANDOM_STATE
    ).fit(scaled)
    sample["rawCluster"] = model.labels_

    profile_columns = {
        "zipCount": ("zipCode", "size"),
        "evPer1kHousing": ("evPer1kHousing", "mean"),
        "portsPer1kHousing": ("portsPer1kHousing", "mean"),
        "medianIncome": ("medianIncome", "mean"),
        "multifamilyShare": ("multifamilyShare", "mean"),
        "workFromHomeShare": ("workFromHomeShare", "mean"),
        "avgCommuteMinutes": ("avgCommuteMinutes", "mean"),
        "bevShare": ("bevShare", "mean"),
        "vehicles": ("vehicles", "sum"),
        "publicPorts": ("publicPorts", "sum"),
    }
    profile = sample.groupby("rawCluster").agg(**profile_columns)
    labels = _cluster_labels(profile)
    sample["clusterId"] = sample["rawCluster"].map(
        lambda value: labels[int(value)]["clusterId"]
    )
    sample["clusterLabel"] = sample["rawCluster"].map(
        lambda value: labels[int(value)]["label"]
    )

    profile_rows = []
    for raw_cluster, row in profile.iterrows():
        identity = labels[int(raw_cluster)]
        profile_rows.append(
            {
                **identity,
                "zipCount": int(row.zipCount),
                "evPer1kHousing": _round(row.evPer1kHousing, 1),
                "portsPer1kHousing": _round(row.portsPer1kHousing, 2),
                "medianIncome": _round(row.medianIncome, 0),
                "multifamilyShare": _round(row.multifamilyShare, 1),
                "workFromHomeShare": _round(row.workFromHomeShare, 1),
                "avgCommuteMinutes": _round(row.avgCommuteMinutes, 1),
                "bevShare": _round(row.bevShare, 1),
                "vehicles": int(row.vehicles),
                "publicPorts": int(row.publicPorts),
            }
        )
    profile_rows.sort(key=lambda row: row["clusterId"])

    assignments = sample.sort_values(["clusterId", "vehicles"], ascending=[True, False])
    assignment_rows = [
        {
            "zipCode": str(row.zipCode),
            "city": str(row.city),
            "county": str(row.county),
            "clusterId": int(row.clusterId),
            "clusterLabel": str(row.clusterLabel),
            "vehicles": int(row.vehicles),
            "publicPorts": int(row.publicPorts),
            "evPer1kHousing": _round(row.evPer1kHousing, 1),
            "portsPer1kHousing": _round(row.portsPer1kHousing, 2),
            "medianIncome": _round(row.medianIncome, 0),
            "multifamilyShare": _round(row.multifamilyShare, 1),
            "workFromHomeShare": _round(row.workFromHomeShare, 1),
            "avgCommuteMinutes": _round(row.avgCommuteMinutes, 1),
            "bevShare": _round(row.bevShare, 1),
        }
        for row in assignments.itertuples()
    ]
    features = [
        {"key": key, "label": label, "transform": transform}
        for key, label, transform in CLUSTER_FEATURES
    ]
    selected = next(row for row in evaluation_rows if row["k"] == selected_k)
    result = {
        "method": "K-Means clustering",
        "sampleSize": int(len(sample)),
        "completeRows": int(len(complete)),
        "selectedK": int(selected_k),
        "silhouetteScore": selected["silhouette"],
        "evOutlierThreshold": _round(ev_limit, 1),
        "portOutlierThreshold": _round(port_limit, 2),
        "formula": "min Σ(k=1..K) Σ(xᵢ∈Cₖ) ||xᵢ−μₖ||²",
        "features": features,
        "kEvaluation": evaluation_rows,
        "clusters": profile_rows,
        "assignments": assignment_rows,
        "notes": [
            "Clustering used only EV density, public port density, and median income.",
            "Density variables used log(1+x), then all inputs were standardized with z-scores.",
            "K=2-6 options were compared and the K with the highest silhouette score was selected.",
            "Housing and commute indicators were used to describe the resulting clusters, not to build them.",
            "Clusters are not investment decisions; they are area profiles for detailed site review.",
        ],
        "exportUrl": "/exports/clustering_analysis.xlsx",
    }
    return (
        result,
        pd.DataFrame(evaluation_rows),
        pd.DataFrame(profile_rows),
        pd.DataFrame(assignment_rows),
    )


def build_models(regions: pd.DataFrame) -> tuple[dict, ModelTables]:
    regression, coefficients, predictions = _regression(regions)
    clustering, evaluation, profiles, assignments = _clustering(regions)
    return (
        {"regression": regression, "clustering": clustering},
        ModelTables(
            regression_coefficients=coefficients,
            regression_predictions=predictions,
            cluster_evaluation=evaluation,
            cluster_profiles=profiles,
            cluster_assignments=assignments,
        ),
    )
