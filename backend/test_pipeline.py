import os
import json
import sys
from pathlib import Path

def test_all():
    print("Running pipeline validation tests...")
    print("=" * 50)

    BASE = Path(__file__).parent

    # Test 1: Model file
    model_path = BASE / "model" / "flood_model.cbm"
    assert model_path.exists(), "Model file missing"
    size_mb = model_path.stat().st_size / 1024 / 1024
    print(f"Model file: {size_mb:.1f} MB")

    # Test 2: Feature names
    feat_path = BASE / "model" / "feature_names.json"
    assert feat_path.exists(), "Feature names missing"
    with open(feat_path) as f:
        meta = json.load(f)
    assert len(meta["features"]) > 0
    print(f"Features: {len(meta['features'])} total")
    print(f"Cat cols: {len(meta['cat_cols'])}")
    print(f"Num cols: {len(meta['num_cols'])}")

    # Test 3: Medians
    med_path = BASE / "model" / "medians.csv"
    assert med_path.exists(), "Medians missing"
    print("Medians file exists")

    # Test 4: main.py syntax
    main_path = BASE / "main.py"
    assert main_path.exists(), "main.py missing"
    with open(main_path) as f:
        content = f.read()
    compile(content, "main.py", "exec")
    print("main.py syntax valid")

    # Test 5: Requirements
    req_path = BASE / "requirements.txt"
    assert req_path.exists(), "requirements.txt missing"
    reqs = req_path.read_text().strip().split("\n")
    print(f"Requirements: {len(reqs)} packages")

    print("=" * 50)
    print("ALL TESTS PASSED")
    return True

if __name__ == "__main__":
    success = test_all()
    sys.exit(0 if success else 1)
