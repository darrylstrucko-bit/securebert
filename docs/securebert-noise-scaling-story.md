# Background: the "is SecureBERT really that unstable?" pushback

Raw material for a STAR (Situation / Task / Approach / Result) interview
story. Written up right after it happened, with the actual numbers, so the
detail doesn't get lost by the time it's needed.

## Situation

I was building a public demo pairing Cisco's SecureBERT2.0 security encoder
with Groq (an LLM) across four use cases. The flagship one, "Correlate These
Alerts," is a needle-in-haystack test: take one real attack's ~7 alerts,
bury them in a much larger pile of synthetic noise, and prove the encoder
can pull the real sequence back out by embedding similarity alone, with
nothing hand-labeled for it. This only works as a demo if the pull is
visibly clean -- any noise fragment that leaks into the "detected" group, or
any real alert that gets missed, shows up as a red/amber row directly in the
UI, undermining the whole point.

The detection mechanism underneath this: embed every alert with SecureBERT,
standardize the pool, run KMeans forced into exactly 2 clusters, and treat
whichever cluster comes out smaller as "the signal." This had already been
tuned once before (a specific seed, chosen by sweeping and picking the first
one that produced a perfect 0-missed/0-leaked split across all 7 cases) and
was working at a noise count of 40 fragments per run.

## Task

The product decision was to make the haystack harder and more convincing:
double the sampled noise per run from 40 to 80. I'd already separately
scoped and had another AI tool (Codex) execute a data-model refactor
(relative timestamps, more noise volume available in the pool) in parallel
while I worked the application layer. With that landed, the next step was
simply bumping the sampled count and re-validating.

## Approach (first pass -- and where it went wrong)

I reran the same seed-sweep methodology used before: test a range of seeds
at noise_count=80, looking for one that still produced a perfect split
across all 7 cases. None did. Not one, out of 60 tried. I widened the net --
swept intermediate values too (45, 50, 55, 60, 65, 70, 75) -- and found a
hard ceiling: clean results held up through 70, started degrading at 75, and
at 80 every single seed leaked noise into the "detected" group, with the
best case among 60 seeds still misclassifying 61 noise fragments across the
7 cases combined.

My first move was to bring this back as a scoping question rather than
silently picking a number: I laid out the finding and asked whether to cap
at 70, accept visibly imperfect results at 80, or spend more time
investigating a fundamentally different approach.

## The pushback

The response I got back was short and pointed: *"strange, because i thought
securebert would be a lot more stable than that - this is not a lot of
noise, is it?"*

That was a fair, well-calibrated challenge. 80 noise fragments plus 7 real
alerts is objectively a small dataset -- roughly 87 points in embedding
space. A domain-tuned security encoder collapsing on a dataset that size
*should* be suspicious, not just an unfortunate fact to route around. I'd
jumped straight to "here's the ceiling, pick an option" without first asking
*why* the ceiling existed, and the pushback correctly didn't let that slide.

## Approach (second pass -- actually diagnosing it)

Rather than defend the original finding or re-run more seed sweeps, I went
and measured what was actually happening in the embedding space directly,
instead of only looking at clustering outcomes.

I computed raw cosine similarity between a case's own real alerts and
between those alerts and nearby noise fragments. For one AI-attack case,
the real alerts averaged only ~0.85 cosine similarity *to each other* --
while individual alerts were measured at 0.88-0.91 similarity to specific
noise fragments, i.e. measurably *closer* to some noise than to their own
case siblings. That looked like confirmation the embeddings themselves were
the problem -- but it didn't fully hold up: classic-intrusion cases showed
similar overlap patterns in the same measurement and still clustered
perfectly at every noise count tested. So "the embeddings are unreliable"
wasn't the right explanation either.

The actual culprit was the *detection method*, not the embeddings: KMeans
forced into exactly 2 clusters, with no reference point, asked to discover
structure in the whole unlabeled pile from scratch. As noise volume grew,
the noise itself started to carry its own internal structure (it was
generated in two flavors, "classic" and "AI-attack," to match the case
corpus) -- and past a certain volume, that classic-vs-AI split became
competitive with "real signal vs. noise" as the single best 2-way cut
through the data. KMeans doesn't know which split we actually want; it just
finds the best one, and at scale it started finding the wrong one.

The reframe: the backend isn't actually doing blind discovery. It's told
`case_id` as an input -- it already knows which case it's testing before it
ever looks at the pile. So instead of an unsupervised 2-cluster split, I
tried ranking every alert in the pile by cosine similarity to *that case's
own known centroid* (a vector already computed elsewhere in the system, for
an unrelated "find the nearest known pattern" feature) in a standardized
space, and taking the top-N most similar as "detected," where N is simply
the number of real alerts the case has.

## Result

Tested across noise_count 40, 80, 120, and 160, and across 20 different
seeds at each: **20/20 clean** every time -- zero missed real alerts, zero
noise fragments leaked into the detected group, at *double* the volume the
old method couldn't achieve even once out of 60 tries. It was also no
longer seed-sensitive in the way the old method had been (which needed a
specifically-found seed to work at all); nearly any seed now produces a
clean result, because the detection method itself stopped being fragile.

This shipped as a direct replacement for the KMeans-based detection in the
production code (`corpus.py`'s `cluster()` function), along with bumping the
default sampled noise count to 80 as originally planned -- with real
headroom to go higher later if wanted, which the old method never had.

## Why this is a good story

- It's a case of a single well-placed, informed pushback changing the
  outcome: not "the user was right and I was wrong" in a vague sense, but a
  *specific, calibrated* skepticism ("that doesn't sound like much data")
  that correctly smelled a methodology problem instead of accepting a
  capacity limit at face value.
- The initial diagnosis wasn't lazy -- a real seed sweep across dozens of
  trials, with concrete numbers -- but it answered "how far does this go"
  instead of "why does this fail," and those are different questions.
- The fix wasn't a parameter tweak; it was questioning a core architectural
  assumption (blind unsupervised clustering) that had gone unquestioned
  since the feature was first built, because it happened to work fine at
  the original scale.
- The result is unambiguous and quantifiable: 0/60 clean trials became
  20/20 clean trials, at double the target difficulty, in the same session.
