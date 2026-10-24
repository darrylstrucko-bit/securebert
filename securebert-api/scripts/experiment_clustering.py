"""
Measures raw-vs-standardized-embedding KMeans clustering accuracy on the
needle-in-haystack task, so app/corpus.py's choice is backed by a number, not
a guess.

History worth keeping in mind: an earlier version of this corpus had a bug where
repeated noise templates produced byte-identical embedded text (varying fields
like host/user/date weren't actually part of what gets embedded), which created
degenerate duplicate-vector micro-clusters that wrecked every clustering method,
especially on the AI-attack cases. See generate_noise.py's "varied_desc" comment
for the fix. With that fixed, raw and standardized embeddings now cluster about
equally well here -- standardization is kept in corpus.py anyway as a cheap
safeguard against anisotropy in general, not because it was the fix for that bug.

Run from securebert-api/: python scripts/experiment_clustering.py
"""
import json
import random
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans

ROOT = Path(__file__).resolve().parent.parent
alert_pool = json.loads((ROOT / "data" / "embeddings" / "alert_pool.json").read_text(encoding="utf-8"))

CASES = ["CASE-001", "CASE-002", "CASE-005", "CASE-AI-01", "CASE-AI-02", "CASE-AI-03", "CASE-AI-04"]
SEEDS = [1, 2, 3, 4, 5]
NOISE_COUNT = 40


def get_pool(case_id, seed):
    real = [a for a in alert_pool if a["ground_truth"] == case_id]
    noise_all = [a for a in alert_pool if a["ground_truth"] == "noise"]
    rng = random.Random(seed)
    noise_sample = rng.sample(noise_all, min(NOISE_COUNT, len(noise_all)))
    combined = real + noise_sample
    rng.shuffle(combined)
    return real, combined


def smaller_cluster_kmeans(vectors, seed):
    km = KMeans(n_clusters=2, n_init=10, random_state=seed or 0)
    labels = km.fit_predict(vectors)
    counts = np.bincount(labels, minlength=2)
    signal = int(np.argmin(counts))
    return [i for i, l in enumerate(labels) if l == signal]


def raw(combined, seed):
    vecs = np.array([a["vector"] for a in combined], dtype=np.float32)
    return smaller_cluster_kmeans(vecs, seed)


def standardized(combined, seed):
    vecs = np.array([a["vector"] for a in combined], dtype=np.float32)
    mean = vecs.mean(axis=0, keepdims=True)
    std = vecs.std(axis=0, keepdims=True)
    z = (vecs - mean) / np.clip(std, 1e-6, None)
    return smaller_cluster_kmeans(z, seed)


def score(real, combined, idx):
    real_ids = {a["id"] for a in real}
    detected = [combined[i] for i in idx]
    detected_ids = {a["id"] for a in detected}
    correct = len(real_ids & detected_ids)
    noise_in = sum(1 for a in detected if a["ground_truth"] == "noise")
    return correct, len(real_ids), noise_in, len(detected)


def run(name, fn):
    print(f"=== {name} ===")
    total_correct, total_real, precisions = 0, 0, []
    for case_id in CASES:
        per_case = []
        for seed in SEEDS:
            real, combined = get_pool(case_id, seed)
            idx = fn(combined, seed)
            correct, n_real, noise_in, size = score(real, combined, idx)
            per_case.append((correct, n_real, noise_in, size))
            total_correct += correct
            total_real += n_real
            if size:
                precisions.append((size - noise_in) / size)
        recall = sum(r[0] for r in per_case) / sum(r[1] for r in per_case)
        print(f"  {case_id}: recall={recall:.2f}  raw={per_case}")
    print(f"  OVERALL recall={total_correct / total_real:.2f}  avg_precision={sum(precisions) / len(precisions):.2f}\n")


if __name__ == "__main__":
    run("raw embeddings", raw)
    run("standardized embeddings (what corpus.py uses)", standardized)
