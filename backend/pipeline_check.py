import requests
import json
from datetime import datetime
from pathlib import Path

API_URL = "https://flood-risk-app-production.up.railway.app"

def check_pipeline():
    print(f"\n{'='*50}")
    print(f"Pipeline Check: {datetime.now()}")
    print(f"{'='*50}")

    checks = []

    # Check 1: Health
    try:
        r = requests.get(f"{API_URL}/health", timeout=10)
        status = "PASS" if r.status_code == 200 else "FAIL"
        checks.append(("Health Check", status))
        print(f"Health: {status}")
    except:
        checks.append(("Health Check", "FAIL"))
        print("Health: FAIL - API unreachable")

    # Check 2: Prediction test
    try:
        body = {
            "district": "Colombo",
            "rainfall_7d_mm": 100,
            "elevation_m": 5
        }
        r = requests.post(
            f"{API_URL}/predict",
            json=body, timeout=30
        )
        if r.status_code == 200:
            score = r.json().get("flood_risk_score", 0)
            status = "PASS" if 0 <= score <= 1 else "FAIL"
        else:
            status = "FAIL"
        checks.append(("Prediction Test", status))
        print(f"Prediction: {status} (score={score:.4f})")
    except Exception as e:
        checks.append(("Prediction Test", "FAIL"))
        print(f"Prediction: FAIL - {e}")

    # Check 3: Drift detection
    try:
        r = requests.get(
            f"{API_URL}/monitoring/drift",
            timeout=10
        )
        if r.status_code == 200:
            data = r.json()
            drift = data.get("drift_detected", False)
            status = "WARNING" if drift else "PASS"
        else:
            status = "FAIL"
        checks.append(("Drift Detection", status))
        print(f"Drift: {status}")
    except:
        checks.append(("Drift Detection", "SKIP"))
        print("Drift: SKIP")

    # Summary
    print(f"\nSummary:")
    passed = sum(1 for _, s in checks if s == "PASS")
    print(f"  Passed: {passed}/{len(checks)}")

    # Save report
    report = {
        "timestamp": datetime.now().isoformat(),
        "checks": [
            {"name": n, "status": s}
            for n, s in checks
        ],
        "passed": passed,
        "total": len(checks)
    }

    Path("pipeline_report.json").write_text(
        json.dumps(report, indent=2)
    )
    print(f"  Report saved: pipeline_report.json")
    return report

if __name__ == "__main__":
    check_pipeline()
