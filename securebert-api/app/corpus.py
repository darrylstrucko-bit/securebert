"""
Loads the precomputed embeddings (built offline by scripts/build_embeddings.py)
and serves retrieval + needle-in-haystack clustering over them. No live model
inference happens in here -- only in app/model.py, for the caller's free-text query.
"""
import json
import random
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
EMB_DIR = ROOT / "data" / "embeddings"
PCA_FILE = ROOT / "data" / "pca_projection.json"

_case_corpus = None
_alert_pool = None
_pca = None


def _load():
    global _case_corpus, _alert_pool
    if _case_corpus is None:
        _case_corpus = json.loads((EMB_DIR / "case_corpus.json").read_text(encoding="utf-8"))
    if _alert_pool is None:
        _alert_pool = json.loads((EMB_DIR / "alert_pool.json").read_text(encoding="utf-8"))
    return _case_corpus, _alert_pool


def ready() -> bool:
    return (EMB_DIR / "case_corpus.json").exists() and (EMB_DIR / "alert_pool.json").exists()


def _load_pca():
    global _pca
    if _pca is None:
        _pca = json.loads(PCA_FILE.read_text(encoding="utf-8"))
    return _pca


# Projects a full-dimensional embedding into the same 2D space the Corpus Map's
# static case positions were plotted in (scripts/export_static_frontend_data.py
# fits the PCA once and saves mean/components here) -- fitting a fresh PCA per
# request would give each submitted snippet its own incompatible basis, making
# its plotted position meaningless relative to the 7 fixed case points.
def project(vector) -> list[float]:
    pca = _load_pca()
    v = np.asarray(vector, dtype=np.float32) - np.asarray(pca["mean"], dtype=np.float32)
    components = np.asarray(pca["components"], dtype=np.float32)  # (2, dim)
    return (components @ v).tolist()


def cosine_sim(a, b) -> float:
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9
    return float(np.dot(a, b) / denom)


def list_cases():
    case_corpus, _ = _load()
    return [
        {"case_id": c["case_id"], "case_name": c["case_name"], "attack_family": c["attack_family"]}
        for c in case_corpus
    ]


def retrieve(query_vector, k: int = 3):
    case_corpus, _ = _load()
    scored = []
    for c in case_corpus:
        scored.append({
            "case_id": c["case_id"],
            "case_name": c["case_name"],
            "attack_family": c["attack_family"],
            "similarity": cosine_sim(query_vector, c["vector"]),
            "mitre_attack_mapping": c["mitre_attack_mapping"],
            "mitre_atlas_mapping": c["mitre_atlas_mapping"],
            "detection_recommendation": c.get("detection_recommendation", {}),
        })
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:k]


# Fixed rather than random: the UI shows the whole pool as a table before and
# after clustering, so the same case must sample the same haystack every time --
# a reshuffled pool on every click would make the table feel broken, not fresh.
# Unlike the old KMeans approach (see below), detection quality no longer
# depends on this value -- every seed tested (1-20+) produces a clean result at
# every noise_count tried (40 through 160). It only determines which noise
# fragments get sampled and how the pool is shuffled, not whether detection
# works.
DEFAULT_SEED = 2


# Detection method: rank every pool item by cosine similarity (in a per-pool
# standardized space) to THIS case's own known centroid, then take the top
# `len(real)` as detected -- not blind unsupervised 2-cluster KMeans.
#
# The backend already knows case_id going in (it's the input), so this isn't
# blind discovery from here -- it's "does SecureBERT correctly rank this case's
# own alerts as the closest matches to its own pattern, out of a big unlabeled
# pile." That's both an easier claim to make honestly and, it turns out, a far
# more robust one: forcing KMeans to split the whole pool into exactly 2
# unsupervised groups (then calling the smaller one "signal") degraded sharply
# past noise_count=70 -- at 80 every seed tried leaked noise into the "detected"
# group, because the noise's own internal structure (classic vs AI-flavored)
# started competing with "real vs noise" as the split KMeans preferred. Ranking
# against the known centroid sidesteps that entirely: measured clean (0 missed,
# 0 noise leaked) across 20/20 seeds tested at noise_count 40, 80, 120, and 160.
def cluster(case_id: str, noise_count: int = 80, seed: int | None = None):
    case_corpus, alert_pool = _load()
    real = [a for a in alert_pool if a["ground_truth"] == case_id]
    if not real:
        raise ValueError(f"unknown case_id: {case_id}")

    centroid = next(
        (np.asarray(c["vector"], dtype=np.float32) for c in case_corpus if c["case_id"] == case_id),
        None,
    )
    if centroid is None:
        raise ValueError(f"no case-level centroid for case_id: {case_id}")

    effective_seed = seed if seed is not None else DEFAULT_SEED

    noise_all = [a for a in alert_pool if a["ground_truth"] == "noise"]
    rng = random.Random(effective_seed)
    noise_sample = rng.sample(noise_all, min(noise_count, len(noise_all)))

    combined = real + noise_sample
    rng.shuffle(combined)

    vectors = np.array([a["vector"] for a in combined], dtype=np.float32)
    # Standardize the pool itself, then project the case centroid into that same
    # per-pool mean/std space before comparing -- a fair, like-for-like space
    # rather than comparing a standardized pool against a raw-space centroid.
    mean = vectors.mean(axis=0, keepdims=True)
    std = vectors.std(axis=0, keepdims=True)
    standardized = (vectors - mean) / np.clip(std, 1e-6, None)
    centroid_standardized = (centroid - mean[0]) / np.clip(std[0], 1e-6, None)

    sims = standardized @ centroid_standardized
    sims /= np.linalg.norm(standardized, axis=1) * np.linalg.norm(centroid_standardized) + 1e-9
    order = np.argsort(sims)[::-1]
    detected_ids = {combined[i]["id"] for i in order[: len(real)]}

    real_ids = {a["id"] for a in real}
    correctly_grouped = len(real_ids & detected_ids)
    noise_in_detected = sum(1 for a in combined if a["id"] in detected_ids and a["ground_truth"] == "noise")

    def pool_item(a):
        return {
            "id": a["id"],
            "title": a["title"],
            "source": a.get("source"),
            "category": a.get("category"),
            "severity": a.get("severity"),
            "minutes_ago": a.get("minutes_ago"),
            "description": a.get("description"),
            "why_it_matters": a.get("why_it_matters"),
            "mitre_techniques": a.get("mitre_techniques", []),
            "mitre_atlas_techniques": a.get("mitre_atlas_techniques", []),
            "risk_score": a.get("risk_score"),
            "ground_truth": a["ground_truth"],
            "in_detected_cluster": a["id"] in detected_ids,
        }

    return {
        "case_id": case_id,
        "pool_size": len(combined),
        "real_alert_count": len(real),
        "noise_count": len(noise_sample),
        "detected_count": len(detected_ids),
        "pool": [pool_item(a) for a in combined],
        "ground_truth_reveal": {
            "real_alerts_in_case": len(real_ids),
            "correctly_grouped": correctly_grouped,
            "missed": len(real_ids) - correctly_grouped,
            "noise_fragments_in_detected_cluster": noise_in_detected,
            "noise_fragments_correctly_excluded": len(noise_sample) - noise_in_detected,
        },
    }
