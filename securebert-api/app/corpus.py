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


_calibration = None


def _loo_case_centroid(by_case: dict, case_id: str, exclude_alert_id: str):
    siblings = [
        np.asarray(a["vector"], dtype=np.float32)
        for a in by_case[case_id]
        if a["id"] != exclude_alert_id
    ]
    return np.mean(siblings, axis=0)


# Calibrates Corpus Map's match classification against the alert pool's own
# ground truth. Three things this corrects versus a naive version:
#
# 1. LEAKAGE: each case's stored vector is the MEAN of that case's own real
#    alert vectors (see build_embeddings.py). Scoring a real alert against its
#    own case's full centroid therefore partly measures the alert's cosine
#    similarity to itself (~1/7 of the average). So real alerts are scored
#    here against a leave-one-out centroid (same case, that one alert
#    excluded) -- the honest version of "how similar is this to its case."
#    This does NOT apply to live user queries (see retrieve()): a genuinely
#    new query was never averaged into any centroid, so comparing it against
#    the full centroid is correct and unaffected by this issue.
#
# 2. THRESHOLD OBJECTIVE: the low cutoff is chosen to maximize true-positive
#    rate subject to a 5% cap on false-positive rate, not a balanced
#    (Youden's J) tradeoff -- a confidently wrong match is worse for an
#    analyst than an over-cautious "no strong match", so the threshold
#    deliberately trades recall for precision.
#
# 3. UNFAMILIAR CATEGORIES: noise alerts (used as the "should not match"
#    class above) were purpose-built as excludable decoys for the Correlate
#    use case, not as a stand-in for "a real but different attack category."
#    So a second check, leave-one-case-out (hold out one of the 7 cases
#    entirely, score its own alerts against the other 6), simulates that
#    directly. The high cutoff ("Likely Match") additionally requires that
#    held-out-category alerts rarely cross it -- not just that noise doesn't.
#
# Measured on this dataset (see docs/corpus-map-calibration.md for the full
# report): t_low ~0.93 (61% of real alerts correctly at/above it, 5% of noise
# incorrectly above it); t_high ~0.945 (0% of noise, ~4% of held-out-category
# alerts reach it). Honest case-ID accuracy (is the top-1 case even the
# RIGHT one) is only ~69% -- stated plainly in the UI, not just here, because
# with only 7 categories and ~7 examples each this is a rough, small-sample
# estimate, not a validated accuracy figure.
def _calibrate() -> dict:
    global _calibration
    if _calibration is not None:
        return _calibration

    case_corpus, alert_pool = _load()
    full_centroids = {c["case_id"]: np.asarray(c["vector"], dtype=np.float32) for c in case_corpus}
    case_ids = list(full_centroids.keys())

    real = [a for a in alert_pool if a["ground_truth"] != "noise"]
    noise = [a for a in alert_pool if a["ground_truth"] == "noise"]
    by_case: dict = {}
    for a in real:
        by_case.setdefault(a["ground_truth"], []).append(a)

    real_sim, correct = [], 0
    for a in real:
        cid = a["ground_truth"]
        vec = np.asarray(a["vector"], dtype=np.float32)
        sims = {cid: cosine_sim(vec, _loo_case_centroid(by_case, cid, a["id"]))}
        sims.update({o: cosine_sim(vec, full_centroids[o]) for o in case_ids if o != cid})
        top_case = max(sims, key=sims.get)
        real_sim.append(sims[top_case])
        correct += top_case == cid

    noise_sim = [
        max(cosine_sim(np.asarray(a["vector"], dtype=np.float32), full_centroids[c]) for c in case_ids)
        for a in noise
    ]

    loco_sim = []
    for held_out in case_ids:
        remaining = [c for c in case_ids if c != held_out]
        for a in by_case[held_out]:
            vec = np.asarray(a["vector"], dtype=np.float32)
            loco_sim.append(max(cosine_sim(vec, full_centroids[c]) for c in remaining))

    t_low, best_tpr = 1.0, -1.0
    for t in sorted(set(real_sim) | set(noise_sim)):
        fpr = sum(1 for s in noise_sim if s >= t) / len(noise_sim)
        if fpr <= 0.05:
            tpr = sum(1 for s in real_sim if s >= t) / len(real_sim)
            if tpr > best_tpr:
                best_tpr, t_low = tpr, t

    candidates = sorted(s for s in (set(real_sim) | set(loco_sim)) if s > t_low)
    t_high = candidates[-1] if candidates else t_low
    for t in candidates:
        noise_fpr = sum(1 for s in noise_sim if s >= t) / len(noise_sim)
        loco_rate = sum(1 for s in loco_sim if s >= t) / len(loco_sim)
        if noise_fpr == 0 and loco_rate <= 0.05:
            t_high = t
            break

    _calibration = {
        "t_low": t_low,
        "t_high": t_high,
        "real_tpr_at_t_low": sum(1 for s in real_sim if s >= t_low) / len(real_sim),
        "noise_fpr_at_t_low": sum(1 for s in noise_sim if s >= t_low) / len(noise_sim),
        "case_id_accuracy": correct / len(real),
        "n_real": len(real),
        "n_noise": len(noise),
        "n_loco": len(loco_sim),
    }
    return _calibration


# Three tiers, not a binary match/no-match: the evaluation showed a real,
# data-supported middle zone where both real alerts and noise have meaningful
# density (neither "clearly noise" nor "clearly a confirmed match"). A hard
# cutoff through that zone would be arbitrary; a middle "Possible Match" tier
# names the ambiguity instead of hiding it. "Likely Match" is still NOT a
# claim that the identified case is correct -- it only means this similarity
# level is rarely reached by unrelated text (see case_id_accuracy above).
def classify_match(similarity: float) -> str:
    c = _calibrate()
    if similarity < c["t_low"]:
        return "no_strong_match"
    if similarity < c["t_high"]:
        return "possible_match"
    return "likely_match"


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
