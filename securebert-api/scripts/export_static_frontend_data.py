"""
Exports the parts of the corpus that don't need a live model call or live
clustering: the case list, and each case's deterministic unlabeled pool
(same seed the live /cluster endpoint uses), with ground_truth and
in_detected_cluster stripped out so the "answer" still isn't visible before
a real correlation run.

Why this exists: the web app used to fetch /cases and run a /cluster call
against Render just to paint the case chips and the haystack table, so
first-time visitors stared at "waking up the model service" before seeing
*any* content, even though that content never depended on the model being
warm. Bundling it statically with the Vercel-hosted frontend means only the
real "Run correlation" action (and the free-text retrieve/hunt panels, which
genuinely need a live embedding) ever waits on Render.

Run from securebert-api/: python scripts/export_static_frontend_data.py
Then copy the output into securebert-web/lib/data/static-pool.json by hand
(separate repos, no shared build) whenever the case packs or noise pool
change.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import corpus  # noqa: E402

OUT_PATH = ROOT / "data" / "static_frontend_data.json"

STRIP_FIELDS = {"ground_truth", "in_detected_cluster"}


def main():
    cases = corpus.list_cases()
    pools = {}
    for c in cases:
        result = corpus.cluster(c["case_id"])
        pools[c["case_id"]] = {
            "pool_size": result["pool_size"],
            "real_alert_count": result["real_alert_count"],
            "noise_count": result["noise_count"],
            "pool": [
                {k: v for k, v in item.items() if k not in STRIP_FIELDS}
                for item in result["pool"]
            ],
        }
        print(f"  {c['case_id']}: {result['pool_size']} items (answer fields stripped)")

    OUT_PATH.write_text(json.dumps({"cases": cases, "pools": pools}), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
