from catboost import CatBoostRegressor
from pathlib import Path
import pandas as pd
import numpy as np
import json

TRAIN_PATH = Path(r"E:\Mlops-Hackthon\train_cleaned.csv")
SAVE_DIR   = Path(r"E:\flood-risk-app\backend\model")
SAVE_DIR.mkdir(parents=True, exist_ok=True)

TARGET   = "flood_risk_score"
DROP     = ["generation_date", "reason_not_good_to_live", "record_id"]
SEEDS    = [42, 123, 456, 789, 999]

CAT_COLS = [
    "district", "place_name", "landcover", "soil_type",
    "water_supply", "electricity", "road_quality", "urban_rural",
    "water_presence_flag", "flood_occurrence_current_event", "is_good_to_live",
]

# EXACT params from diverse_ensemble_push.py train_catboost()
PARAMS = dict(
    iterations       = 3000,
    learning_rate    = 0.03,
    depth            = 7,
    l2_leaf_reg      = 5,
    min_data_in_leaf = 10,
    loss_function    = "MAE",
    eval_metric      = "RMSE",
    od_type          = "Iter",
    od_wait          = 150,
    use_best_model   = False,
    allow_writing_files = False,
    verbose          = 200,
)

print("Loading data...")
train = pd.read_csv(TRAIN_PATH)

for col in DROP:
    if col in train.columns:
        train.drop(columns=[col], inplace=True)

y = train[TARGET].astype(float)
train.drop(columns=[TARGET], inplace=True)

# Auto-detect ALL categoricals exactly like diverse_ensemble_push.py
all_cat = CAT_COLS + [
    c for c in train.columns
    if c not in CAT_COLS
    and not pd.api.types.is_numeric_dtype(train[c])
]
all_cat = list(set(all_cat))

for col in all_cat:
    if col in train.columns:
        train[col] = train[col].fillna("missing").astype(str)

num_cols = [
    c for c in train.columns
    if c not in all_cat
    and pd.api.types.is_numeric_dtype(train[c])
]

medians = train[num_cols].median()
train[num_cols] = train[num_cols].fillna(medians)
cat_idx = [i for i, c in enumerate(train.columns) if c in all_cat]

# Train 5 seeds and save seed=42 as primary model
print(f"Training 5-seed ensemble...")
models = []
for seed in SEEDS:
    print(f"  Training seed={seed}...")
    p = {**PARAMS, "random_seed": seed}
    model = CatBoostRegressor(**p)
    model.fit(train, y, cat_features=cat_idx)
    models.append(model)
    print(f"  Seed {seed} done")

# Save seed=42 model as the API model
print("\nSaving model...")
models[0].save_model(str(SAVE_DIR / "flood_model.cbm"))

# Save preprocessing metadata
medians.to_csv(SAVE_DIR / "medians.csv")

meta = {
    "features" : list(train.columns),
    "cat_cols" : all_cat,
    "num_cols" : num_cols,
}
with open(SAVE_DIR / "feature_names.json", "w") as f:
    json.dump(meta, f, indent=2)

print("\nSaved successfully:")
for f in SAVE_DIR.iterdir():
    size = f.stat().st_size / (1024*1024)
    print(f"  {f.name}: {size:.2f} MB")
print("\nModel ready for backend API.")