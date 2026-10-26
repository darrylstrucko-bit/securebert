"""
Offline, one-time embedding build. Run this whenever data/cases/*.json or
data/noise/noise_pool.json change.

Writes:
  data/embeddings/case_corpus.json  -- one vector per case, for /retrieve
  data/embeddings/alert_pool.json   -- one vector per real alert + per noise
                                       fragment, for /cluster's ground-truth reveal

Run from securebert-api/: python scripts/build_embeddings.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402

from app.model import embed  # noqa: E402
from app.textgen import alert_text  # noqa: E402

CASES_DIR = ROOT / "data" / "cases"
NOISE_FILE = ROOT / "data" / "noise" / "noise_pool.json"
OUT_DIR = ROOT / "data" / "embeddings"


def load_cases():
    cases = []
    for f in sorted(CASES_DIR.glob("*.json")):
        cases.append(json.loads(f.read_text(encoding="utf-8")))
    return cases


def build_case_corpus(cases, alert_pool):
    # The case-level vector is the mean of that case's own real-alert vectors,
    # not a fresh embed() of one long concatenated document. A single long,
    # heterogeneous document diluted the signal enough that a classic-case query
    # once out-scored its own case against an unrelated one (measured directly --
    # see the comment in app/corpus.py's retrieve()). Averaging the short, focused
    # alert embeddings that already cluster at ~0.98 recall/precision (see
    # experiment_clustering.py) is both cheaper and more accurate.
    out = []
    for i, case in enumerate(cases):
        alert_vecs = np.array(
            [a["vector"] for a in alert_pool if a["ground_truth"] == case["case_id"]],
            dtype=np.float32,
        )
        vec = alert_vecs.mean(axis=0).tolist()
        print(f"  [{i+1}/{len(cases)}] case {case['case_id']} vector = mean of {len(alert_vecs)} alert vectors")
        out.append({
            "case_id": case["case_id"],
            "case_name": case["case_name"],
            "attack_family": case["attack_family"],
            "mitre_attack_mapping": case["threat_context"]["mitre_attack_mapping"],
            "mitre_atlas_mapping": case["threat_context"]["mitre_atlas_mapping"],
            "detection_recommendation": case.get("detection_recommendation", {}),
            "vector": vec,
        })
    return out


def build_alert_pool(cases):
    out = []
    total_real = sum(len(c["alerts"]) for c in cases)
    noise = json.loads(NOISE_FILE.read_text(encoding="utf-8"))
    total = total_real + len(noise)
    done = 0

    for case in cases:
        for alert in case["alerts"]:
            done += 1
            text = alert_text(alert)
            if done % 10 == 0 or done == total:
                print(f"  [{done}/{total}] embedding alert {alert['alert_id']}")
            vec = embed(text)
            out.append({
                "id": alert["alert_id"],
                "ground_truth": case["case_id"],
                "attack_family": case["attack_family"],
                "title": alert["title"],
                "source": alert.get("source"),
                "category": alert.get("category"),
                "severity": alert.get("severity"),
                "minutes_ago": alert.get("minutes_ago"),
                "description": alert.get("description"),
                "why_it_matters": alert.get("why_it_matters"),
                "mitre_techniques": alert.get("mitre_techniques", []),
                "mitre_atlas_techniques": alert.get("mitre_atlas_techniques", []),
                "risk_score": alert.get("risk_score"),
                "vector": vec,
            })

    for n in noise:
        done += 1
        text = alert_text(n)
        if done % 10 == 0 or done == total:
            print(f"  [{done}/{total}] embedding {n['alert_id']}")
        vec = embed(text)
        out.append({
            "id": n["alert_id"],
            "ground_truth": "noise",
            "noise_subtype": n["noise_subtype"],
            "attack_family": n["flavor"],
            "title": n["title"],
            "source": n.get("source"),
            "category": n.get("category"),
            "severity": n.get("severity"),
            "minutes_ago": n.get("minutes_ago"),
            "description": n.get("description"),
            "why_it_matters": n.get("why_it_matters"),
            "mitre_techniques": n.get("mitre_techniques", []),
            "mitre_atlas_techniques": n.get("mitre_atlas_techniques", []),
            "risk_score": n.get("risk_score"),
            "vector": vec,
        })
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Loading case packs...")
    cases = load_cases()
    print(f"Loaded {len(cases)} cases.")

    print("Building alert-level pool embeddings (real + noise)...")
    alert_pool = build_alert_pool(cases)
    (OUT_DIR / "alert_pool.json").write_text(json.dumps(alert_pool), encoding="utf-8")
    print(f"Wrote {len(alert_pool)} alert-level vectors.")

    print("Building case-level corpus vectors from alert-pool means...")
    case_corpus = build_case_corpus(cases, alert_pool)
    (OUT_DIR / "case_corpus.json").write_text(json.dumps(case_corpus), encoding="utf-8")
    print(f"Wrote {len(case_corpus)} case vectors.")


if __name__ == "__main__":
    main()
