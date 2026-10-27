"""
Standalone evaluation for Corpus Map's match-classification calibration
(app/corpus.py's _calibrate() / classify_match()). Re-run this whenever
data/cases/*.json or data/noise/noise_pool.json change, to confirm the
thresholds still behave sensibly -- this is documentation and a regression
check, not something the server imports.

Run from securebert-api/: python scripts/evaluate_corpus_map_calibration.py

What this measures, and why each piece exists:

1. Case-identification accuracy (honest, leave-one-out). Each case's stored
   vector is the MEAN of that case's own real alert vectors (build_embeddings.py),
   so scoring a real alert against its own case's full centroid partly measures
   the alert's similarity to itself (~1/7 of the average). Here every real
   alert is scored against a centroid that excludes it, which is the honest
   question: "is this alert's own case even its best match, out of all 7?"

2. TPR / FPR at the live thresholds. Real alerts (honest, as above) vs. noise
   alerts (no leakage concern -- noise never contributes to any centroid).

3. Margin (top1 - top2 similarity) vs. raw top-1 similarity, compared on the
   same TPR/FPR terms, to check whether margin is actually a better signal
   before using it live (it was tested and rejected -- see the printed
   comparison below).

4. Leave-one-case-out: hold out one of the 7 cases entirely and score its own
   real alerts against the other 6. This simulates a genuinely unfamiliar 8th
   attack category -- the noise pool was purpose-built as excludable decoy
   text for the Correlate use case, not as a stand-in for "a real but
   different attack category," so this is a separate, more direct check of
   exactly that scenario.

Caveats that apply to every number below, not just the ones it's attached to:
only 7 cases, ~6-8 real alerts each (49 total), and 166 purpose-built noise
fragments. That is nowhere near enough data to validate a threshold with
statistical confidence -- these are the best honest estimates available from
this dataset, not a validated accuracy figure.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
import statistics as st  # noqa: E402

from app import corpus  # noqa: E402


def main():
    case_corpus, alert_pool = corpus._load()
    full_centroids = {c["case_id"]: np.asarray(c["vector"], dtype=np.float32) for c in case_corpus}
    case_ids = list(full_centroids.keys())

    real = [a for a in alert_pool if a["ground_truth"] != "noise"]
    noise = [a for a in alert_pool if a["ground_truth"] == "noise"]
    by_case: dict = {}
    for a in real:
        by_case.setdefault(a["ground_truth"], []).append(a)

    def loo_centroid(case_id, exclude_id):
        sibs = [np.asarray(x["vector"], dtype=np.float32) for x in by_case[case_id] if x["id"] != exclude_id]
        return np.mean(sibs, axis=0)

    # ---- honest real-alert scoring (leave-one-out) + margin ----
    real_sim, real_margin, correct = [], [], 0
    for a in real:
        cid = a["ground_truth"]
        vec = np.asarray(a["vector"], dtype=np.float32)
        sims = {cid: corpus.cosine_sim(vec, loo_centroid(cid, a["id"]))}
        sims.update({o: corpus.cosine_sim(vec, full_centroids[o]) for o in case_ids if o != cid})
        ordered = sorted(sims.items(), key=lambda kv: kv[1], reverse=True)
        top_case, top_sim = ordered[0]
        real_sim.append(top_sim)
        real_margin.append(top_sim - ordered[1][1])
        correct += top_case == cid

    # ---- noise scoring (no leakage: noise never in any centroid) ----
    noise_sim, noise_margin = [], []
    for a in noise:
        vec = np.asarray(a["vector"], dtype=np.float32)
        sims = sorted((corpus.cosine_sim(vec, full_centroids[c]) for c in case_ids), reverse=True)
        noise_sim.append(sims[0])
        noise_margin.append(sims[0] - sims[1])

    # ---- leave-one-case-out: simulate a genuinely unfamiliar 8th category ----
    loco_sim = []
    per_case_loco = {}
    for held_out in case_ids:
        remaining = [c for c in case_ids if c != held_out]
        sims_for_case = []
        for a in by_case[held_out]:
            vec = np.asarray(a["vector"], dtype=np.float32)
            sims_for_case.append(max(corpus.cosine_sim(vec, full_centroids[c]) for c in remaining))
        per_case_loco[held_out] = sims_for_case
        loco_sim.extend(sims_for_case)

    def tpr_fpr(pos, neg, t):
        return (sum(1 for s in pos if s >= t) / len(pos), sum(1 for s in neg if s >= t) / len(neg))

    def best_balanced(pos, neg):
        best_t, best_j = 0.0, -1.0
        for t in sorted(set(pos) | set(neg)):
            tpr, fpr = tpr_fpr(pos, neg, t)
            if (j := tpr - fpr) > best_j:
                best_j, best_t = j, t
        return best_t, best_j

    print("=" * 72)
    print("1. CASE-IDENTIFICATION ACCURACY (honest, leave-one-out)")
    print("=" * 72)
    print(f"  {correct}/{len(real)} = {correct / len(real):.1%}")
    print("  i.e. even with the leakage fixed, the single best-matching case is")
    print("  only right about 7 times in 10 -- a real limitation to disclose,")
    print("  not just a calibration detail.\n")

    print("=" * 72)
    print("2. LIVE THRESHOLDS (from app/corpus.py's _calibrate())")
    print("=" * 72)
    c = corpus._calibrate()
    print(f"  t_low  (No Strong Match boundary) = {c['t_low']:.4f}")
    print(f"  t_high (Likely Match boundary)    = {c['t_high']:.4f}")
    tpr_low, fpr_low = tpr_fpr(real_sim, noise_sim, c["t_low"])
    print(f"  at t_low:  TPR(real) = {tpr_low:.1%}   FPR(noise) = {fpr_low:.1%}")
    tpr_high, fpr_high = tpr_fpr(real_sim, noise_sim, c["t_high"])
    loco_high = sum(1 for s in loco_sim if s >= c["t_high"]) / len(loco_sim)
    print(f"  at t_high: real reaching it = {tpr_high:.1%}   noise reaching it = {fpr_high:.1%}"
          f"   unfamiliar-category reaching it = {loco_high:.1%}\n")

    print("=" * 72)
    print("3. MARGIN (top1 - top2) vs. RAW TOP-1 SIMILARITY -- was margin adopted?")
    print("=" * 72)
    t_sim, j_sim = best_balanced(real_sim, noise_sim)
    t_margin, j_margin = best_balanced(real_margin, noise_margin)
    print(f"  raw similarity: best balanced J = {j_sim:.3f}  (t={t_sim:.4f})")
    print(f"  margin:         best balanced J = {j_margin:.3f}  (t={t_margin:.4f})")
    verdict = "REJECTED -- margin is a weaker signal than raw similarity" if j_margin < j_sim else "adopted"
    print(f"  -> margin {verdict}\n")

    print("=" * 72)
    print("4. LEAVE-ONE-CASE-OUT (per case, unfamiliar-category simulation)")
    print("=" * 72)
    for cid, sims in per_case_loco.items():
        print(f"  {cid:12s} n={len(sims):2d}  mean={st.mean(sims):.4f}  min={min(sims):.4f}  max={max(sims):.4f}")
    print(f"  ALL combined: n={len(loco_sim)}  mean={st.mean(loco_sim):.4f}  median={st.median(loco_sim):.4f}\n")

    print("=" * 72)
    print("5. THREE-POPULATION SUMMARY (in-category real vs. unfamiliar-category vs. noise)")
    print("=" * 72)
    for label, sims in [("in-category real (honest)", real_sim), ("leave-one-case-out", loco_sim), ("noise", noise_sim)]:
        print(f"  {label:28s} n={len(sims):3d}  mean={st.mean(sims):.4f}  median={st.median(sims):.4f}  "
              f"min={min(sims):.4f}  max={max(sims):.4f}")
    print()
    print("Caveat: with only 7 categories and ~7 real examples each, every number")
    print("above is a small-sample estimate from this synthetic dataset, not a")
    print("statistically validated accuracy or novelty-detection guarantee.")


if __name__ == "__main__":
    main()
