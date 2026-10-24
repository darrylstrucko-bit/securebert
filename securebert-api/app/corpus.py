"""
Loads the precomputed embeddings (built offline by scripts/build_embeddings.py)
and serves retrieval + needle-in-haystack clustering over them. No live model
inference happens in here -- only in app/model.py, for the caller's free-text query.
"""
import json
import random
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans

ROOT = Path(__file__).resolve().parent.parent
EMB_DIR = ROOT / "data" / "embeddings"

_case_corpus = None
_alert_pool = None


def _load():
    global _case_corpus, _alert_pool
    if _case_corpus is None:
        _case_corpus = json.loads((EMB_DIR / "case_corpus.json").read_text(encoding="utf-8"))
    if _alert_pool is None:
        _alert_pool = json.loads((EMB_DIR / "alert_pool.json").read_text(encoding="utf-8"))
    return _case_corpus, _alert_pool


def ready() -> bool:
    return (EMB_DIR / "case_corpus.json").exists() and (EMB_DIR / "alert_pool.json").exists()


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


def cluster(case_id: str, noise_count: int = 40, seed: int | None = None):
    _, alert_pool = _load()
    real = [a for a in alert_pool if a["ground_truth"] == case_id]
    if not real:
        raise ValueError(f"unknown case_id: {case_id}")

    noise_all = [a for a in alert_pool if a["ground_truth"] == "noise"]
    rng = random.Random(seed)
    noise_sample = rng.sample(noise_all, min(noise_count, len(noise_all)))

    combined = real + noise_sample
    rng.shuffle(combined)

    vectors = np.array([a["vector"] for a in combined], dtype=np.float32)
    # Per-dimension standardization (z-score) guards against the anisotropy that raw
    # mean-pooled BERT-family embeddings are prone to. Measured directly (see
    # scripts/experiment_clustering.py): once the noise pool's embedded text is
    # properly de-duplicated (see generate_noise.py), raw and standardized embeddings
    # cluster about equally well (~0.98 recall/precision across all 7 cases, classic
    # and AI-attack alike) -- standardizing costs nothing and is a reasonable
    # safeguard if the corpus grows or shifts in ways that reintroduce anisotropy.
    mean = vectors.mean(axis=0, keepdims=True)
    std = vectors.std(axis=0, keepdims=True)
    standardized = (vectors - mean) / np.clip(std, 1e-6, None)

    km = KMeans(n_clusters=2, n_init=10, random_state=seed if seed is not None else 0)
    labels = km.fit_predict(standardized)

    counts = np.bincount(labels, minlength=2)
    signal_label = int(np.argmin(counts))  # smaller cluster = candidate attack sequence

    detected, excluded = [], []
    for item, label in zip(combined, labels):
        (detected if label == signal_label else excluded).append(item)

    real_ids = {a["id"] for a in real}
    detected_ids = {a["id"] for a in detected}
    correctly_grouped = len(real_ids & detected_ids)
    noise_in_detected = sum(1 for a in detected if a["ground_truth"] == "noise")

    light = lambda a: {"id": a["id"], "title": a["title"], "ground_truth": a["ground_truth"]}  # noqa: E731
    full = lambda a: {  # noqa: E731
        "id": a["id"],
        "title": a["title"],
        "description": a.get("description"),
        "why_it_matters": a.get("why_it_matters"),
        "mitre_techniques": a.get("mitre_techniques", []),
        "mitre_atlas_techniques": a.get("mitre_atlas_techniques", []),
        "risk_score": a.get("risk_score"),
        "ground_truth": a["ground_truth"],
    }

    return {
        "case_id": case_id,
        "pool_size": len(combined),
        "real_alert_count": len(real),
        "noise_count": len(noise_sample),
        "detected_cluster": [full(a) for a in detected],
        "excluded": [light(a) for a in excluded],
        "ground_truth_reveal": {
            "real_alerts_in_case": len(real_ids),
            "correctly_grouped": correctly_grouped,
            "missed": len(real_ids) - correctly_grouped,
            "noise_fragments_in_detected_cluster": noise_in_detected,
            "noise_fragments_correctly_excluded": len(noise_sample) - noise_in_detected,
        },
    }
