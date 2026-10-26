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

import numpy as np
from sklearn.decomposition import PCA

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import corpus  # noqa: E402

OUT_PATH = ROOT / "data" / "static_frontend_data.json"
PCA_OUT_PATH = ROOT / "data" / "pca_projection.json"

STRIP_FIELDS = {"ground_truth", "in_detected_cluster"}


def build_corpus_map(case_corpus, alert_pool):
    # Fit once here, on the 7 case-level vectors, and persist mean/components so
    # app/corpus.py's live /project endpoint reuses the exact same 2D basis for a
    # submitted snippet -- a fresh per-request PCA fit would give every submission
    # its own incompatible space, making its plotted position meaningless next to
    # these 7 fixed points.
    vectors = np.array([c["vector"] for c in case_corpus], dtype=np.float32)
    pca = PCA(n_components=2, svd_solver="full")
    coords = pca.fit_transform(vectors)

    PCA_OUT_PATH.write_text(
        json.dumps({"mean": pca.mean_.tolist(), "components": pca.components_.tolist()}),
        encoding="utf-8",
    )
    print(f"Wrote {PCA_OUT_PATH} (explained variance: {pca.explained_variance_ratio_.sum():.2f})")

    cases = [
        {
            "case_id": c["case_id"],
            "case_name": c["case_name"],
            "attack_family": c["attack_family"],
            "x": float(coords[i][0]),
            "y": float(coords[i][1]),
        }
        for i, c in enumerate(case_corpus)
    ]

    # Every individual alert (real + noise) projected into the SAME 2D space as
    # the 7 case centroids above, via pca.transform (not a fresh fit) -- so a
    # case's own alerts can be drawn as small dots clustered around its big dot,
    # with noise scattered elsewhere. ground_truth is the case_id it really
    # belongs to, or "noise" -- used for color and for drawing centroid-to-alert
    # spoke lines, not hidden/answer-like the way the correlate pool's
    # ground_truth is (Corpus Map has no "Run correlation" reveal state).
    alert_vectors = np.array([a["vector"] for a in alert_pool], dtype=np.float32)
    alert_coords = pca.transform(alert_vectors)
    alerts = [
        {
            "id": a["id"],
            "title": a["title"],
            "ground_truth": a["ground_truth"],
            "attack_family": a.get("attack_family"),
            "x": float(alert_coords[i][0]),
            "y": float(alert_coords[i][1]),
        }
        for i, a in enumerate(alert_pool)
    ]

    return cases, alerts


def main():
    case_corpus, alert_pool = corpus._load()
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

    map_cases, map_alerts = build_corpus_map(case_corpus, alert_pool)

    OUT_PATH.write_text(
        json.dumps(
            {"cases": cases, "pools": pools, "corpusMap": {"cases": map_cases, "alerts": map_alerts}}
        ),
        encoding="utf-8",
    )
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
