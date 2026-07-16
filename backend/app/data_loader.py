"""
data_loader.py
----------------
Data-source abstraction for training. Today, the only available data is
synthetic (physics-generated). This module exists so that when real UAV
flight-test data becomes available, switching to it - or blending it with
the synthetic set - requires no changes to train_model.py, only a flag.

USAGE
-----
    from app.data_loader import load_training_data

    df = load_training_data(source="synthetic")                  # current default
    df = load_training_data(source="real")                       # once real data exists
    df = load_training_data(source="blended", real_weight=0.5)    # mix both

Or from the command line:
    python -m app.train_model --data-source synthetic   (default)
    python -m app.train_model --data-source real
    python -m app.train_model --data-source blended

REAL-DATA SCHEMA REQUIREMENT
-----------------------------
A real dataset must be a CSV at backend/data/real_uav_flight_data.csv with
EXACTLY the same columns as the synthetic dataset (see
FEATURE_COLUMNS + TARGET_COLUMNS in dataset_generator.py, and
docs/DATASET_DESCRIPTION.md for the full column reference / units). Each
row = one logged flight (or one steady-state flight-test point) with the
UAV's design parameters as features and its measured performance as
targets. An empty template with the correct header row is provided at
backend/data/real_uav_flight_data_template.csv - copy it, fill it with
real logged values, save as real_uav_flight_data.csv, and re-run
train_model.py with --data-source real or --data-source blended.

WHY THIS MATTERS FOR THE PROJECT
----------------------------------
The single biggest disclosed limitation of this platform (see
docs/ML_METHODOLOGY.md) is that it has never been trained or validated on
real flight data. This module is the seam where that gap gets closed
later, without needing to touch the physics engine, the FastAPI backend,
or the frontend - only the training data source changes.
"""

import os
import pandas as pd

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNTHETIC_PATH = os.path.join(BACKEND_DIR, "data", "uav_synthetic_dataset.csv")
REAL_PATH = os.path.join(BACKEND_DIR, "data", "real_uav_flight_data.csv")
REAL_TEMPLATE_PATH = os.path.join(BACKEND_DIR, "data", "real_uav_flight_data_template.csv")


def real_data_available() -> bool:
    """True once a real dataset has been dropped in at REAL_PATH with at
    least a handful of rows. Used by the API/UI to report data provenance
    honestly (e.g. an 'About' page badge: 'trained on synthetic data only'
    vs 'trained on synthetic + N real flight-test rows')."""
    if not os.path.exists(REAL_PATH):
        return False
    try:
        return len(pd.read_csv(REAL_PATH)) >= 5
    except Exception:
        return False


def load_training_data(source: str = "synthetic", real_weight: float = 0.5) -> pd.DataFrame:
    """
    source:
      "synthetic" (default) - the physics-generated dataset only.
      "real"                - real_uav_flight_data.csv only. Raises a clear
                               error if it doesn't exist yet or has too few
                               rows to be meaningful.
      "blended"              - concatenates synthetic + real data. real_weight
                               controls how many times the real rows are
                               duplicated relative to their natural count, so
                               a small real dataset can still meaningfully
                               influence training against a much larger
                               synthetic set (a standard technique when real
                               data is scarce relative to simulated data).
    """
    synthetic_df = pd.read_csv(SYNTHETIC_PATH) if os.path.exists(SYNTHETIC_PATH) else None

    if source == "synthetic":
        if synthetic_df is None:
            raise FileNotFoundError(
                f"No synthetic dataset at {SYNTHETIC_PATH}. Run `python -m app.dataset_generator` first."
            )
        return synthetic_df

    if source in ("real", "blended"):
        if not real_data_available():
            raise FileNotFoundError(
                f"No real dataset found at {REAL_PATH} (or it has fewer than 5 rows). "
                f"Copy {REAL_TEMPLATE_PATH} to {REAL_PATH}, fill it with real flight-test "
                f"rows matching the template's columns, then retry."
            )
        real_df = pd.read_csv(REAL_PATH)
        expected_cols = set(synthetic_df.columns) if synthetic_df is not None else set(real_df.columns)
        missing = expected_cols - set(real_df.columns)
        if missing:
            raise ValueError(f"real_uav_flight_data.csv is missing required columns: {sorted(missing)}")

        if source == "real":
            return real_df[list(expected_cols)]

        # blended: oversample the real rows so they carry real_weight's worth
        # of influence relative to the (much larger) synthetic set, then
        # concatenate. This is a simple, transparent oversampling strategy -
        # documented here rather than hidden, since how real/synthetic data
        # are weighted materially affects what the model learns.
        if synthetic_df is None:
            raise FileNotFoundError("Blended mode requires the synthetic dataset too - run app.dataset_generator first.")
        target_real_rows = int(len(synthetic_df) * real_weight / max(1 - real_weight, 1e-6))
        reps = max(1, target_real_rows // max(len(real_df), 1))
        real_oversampled = pd.concat([real_df] * reps, ignore_index=True)
        blended = pd.concat([synthetic_df, real_oversampled[list(synthetic_df.columns)]], ignore_index=True)
        return blended.sample(frac=1.0, random_state=42).reset_index(drop=True)

    raise ValueError(f"Unknown data source '{source}'. Use 'synthetic', 'real', or 'blended'.")
