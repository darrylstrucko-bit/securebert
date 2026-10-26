# Spec: relative time model + expanded noise pool

## Context

`securebert-api` is the backend for a public demo pairing Cisco's SecureBERT2.0
encoder with Groq. One use case ("Correlate These Alerts") hands a visitor a
pile of unlabeled alerts -- a handful of real ones from one of 7 case studies,
mixed into a much larger pile of synthetic noise -- and shows that SecureBERT
can pull the real attack chain back out by embedding similarity alone.

Two problems with the current data:

1. **Noise volume is too small relative to the story.** There's a pool of 166
   noise fragments (`data/noise/noise_pool.json`), but only 40 are sampled per
   demo run. We want **80** sampled per run -- decided, not a range to pick
   from. 166 existing fragments (78 unique titles, host/user variation
   already making all 166 descriptions distinct) is confirmed enough raw
   material for an 80-sample draw -- no need to expand or rewrite noise
   narratives. This spec is about *when* each fragment happened
   (`minutes_ago`), not generating new ones.

2. **Times are hardcoded absolute dates from 2026** (e.g. `"2026-04-23"`,
   or bare `"07:55"` meaning "same day as the rest of this case"), authored by
   hand with no consistent relationship to each other. They're already
   internally inconsistent (mixed formats sort incorrectly) and they will
   look obviously stale within weeks of being committed, since nothing
   regenerates them.

## The fix: relative time, resolved at view time

Replace every alert's absolute `time` field with a **relative offset in
minutes before "now"**, and resolve it to a real clock time only in the
frontend, at the moment someone is actually looking at the page (not baked in
at generation time, not resolved server-side). That's out of scope for you --
the frontend side is being handled separately. **Your job is entirely about
producing the relative-offset data**, in a shape the frontend can consume.

### Field change

Every alert object (in each case pack's `alerts[]` array, and every noise
fragment in `noise_pool.json`) currently has:

```json
"time": "2026-04-23 09:17"
```

or

```json
"time": "09:17"
```

Replace this field with:

```json
"minutes_ago": 143
```

An integer, minutes before "now" (view time). `0` would mean "happening right
now"; `1440` would mean exactly 24 hours ago. Use whatever granularity makes
the data feel natural -- these don't need to be round numbers.

### The window

Think of the whole visible pile (noise + whichever case's real alerts are
mixed in) as **the last day or so of SOC telemetry**, not a sprawling
multi-week history -- but that recency constraint is about where the demo's
"now" moment anchors, not a hard cap on how far back a case's own story is
allowed to reach.

- **Noise**: spread across `minutes_ago` `0`–`2160` (up to 36h ago), with a
  realistic distribution weighted toward the recent end (more density near
  "now," thinning out further back) -- not uniform, not perfectly even. No
  separate "oldest anchor" number beyond that upper bound; don't read this as
  a stricter 12h window.
- **Each case's own real alert chain, active/most-recent portion**: the
  alerts that represent the case's current, in-progress activity -- the part
  a SOC would actually be looking at "right now" -- should land inside that
  same recent window as the noise, spaced out realistically rather than
  bunched in the same few minutes.
- **Array order is not the source of truth for chronology.** Several case
  packs already present events out of narrative order (e.g. a headline alert
  first, then earlier context after it). Don't reorder the JSON arrays and
  don't force `minutes_ago` to decrease monotonically with array position --
  assign offsets based on each alert's actual place in the story, and verify
  correctness by checking that the inferred attack sequence (sorted by
  `minutes_ago`) still reads coherently, not by array position.
- **Earlier causal alerts, and any genuinely slow-burn case, keep their real
  elapsed time.** Two kinds of alerts should NOT be compressed into the
  recent window:
  - **Explicit narrative callbacks to something older** -- e.g.
    `CASE-AI-01`'s "a dismissed near-miss nine days earlier," or
    `CASE-AI-04`'s prior policy-exception event from weeks back. Scan all 7
    cases for this pattern (don't assume it's limited to the two just named)
    and give each a `minutes_ago` matching the stated/implied interval,
    clearly outside the main noise window.
  - **Cases whose own narrative spans a genuinely longer arc** -- e.g.
    `CASE-AI-03`'s backdoored model serving production traffic for several
    days before detection. For a case like this, preserve the real elapsed
    interval between the early/causal alerts (initial compromise, supply
    chain entry) and the active detection/impact alerts, rather than
    compressing the whole chain into the 36h noise window. Only the
    case's final, active-detection-and-impact alerts need to land recent;
    the earlier causal chain can extend back as far as its own story
    requires.
  Different cases' recent-window portions are allowed to overlap each other
  in time -- that's fine, since a demo run only ever shows one case's real
  alerts mixed with noise at a time, never two cases' real alerts together.

### Embedded text must not contain a literal date/time

The noise generator currently bakes something like `"(Host: {host}; user:
{user}; observed {date} {time}.)"` into each fragment's *embedded* text (the
part SecureBERT actually turns into a vector), specifically to make repeated
template instances embed as distinct vectors rather than duplicates.

Once `minutes_ago` is resolved to a real clock time only on the frontend at
view time, a literal date/time baked into the embedded text would go stale
and contradict whatever the UI displays. **Drop the literal date/time from
the embedded text entirely.** Keep the host/user (or whatever else already
varies) for the dedup purpose it was serving -- that's sufficient on its own
without also including a date string. If you need another cheap source of
variation to keep embeddings distinct, a sequence/ticket-style ID embedded in
the text works fine too.

## Files you'll likely touch

- `securebert-api/data/noise/noise_pool.json` -- noise fragments: `time` →
  `minutes_ago`, and strip any literal date/time from their embedded text
  fields.
- `securebert-api/scripts/generate_noise.py` -- the generator that produces
  the file above; update its time-assignment logic and its embedded-text
  template (the "varied_desc" style string) to match.
- `securebert-api/data/cases/case-*.json` (7 files) -- each case's
  `alerts[].time` → `alerts[].minutes_ago`, preserving each case's existing
  internal chronological order, re-expressed as the window described above.
- Anywhere else in `securebert-api` that reads an alert's `time` field and
  would need updating to read `minutes_ago` instead (search for `"time"`
  across `app/` and `scripts/` -- a couple of places pass it through
  unchanged today and should keep doing exactly that, just under the new key
  name, no date-math needed on this side).

## What's explicitly NOT your job

- Resolving `minutes_ago` into an actual displayed date/time -- that's
  frontend work, happening separately.
- Anything in `securebert-web`.
- Bumping the *sampled* count from 40 to 80 in `app/corpus.py`'s
  `cluster()` default -- also being handled on the app side, not a data
  change.
- Changing noise *content*/narrative (titles, descriptions, categories) --
  only the time representation and the embedded-text date/time stripping, and
  only expanding template variety if you judge 166 fragments isn't enough raw
  material to support a repetition-free 80-sample draw.

## Verification before handing back

1. `python scripts/generate_noise.py` (or however it's invoked) runs clean
   and produces `minutes_ago` on every fragment, no `time` field left behind.
2. Spot-check every case pack: sort its alerts by `minutes_ago` (not array
   order) and confirm the resulting sequence still tells a coherent,
   correctly-ordered story -- that's the actual correctness check, not
   whether `minutes_ago` decreases monotonically through the JSON array
   (it won't, and that's fine -- see "Array order is not the source of
   truth" above).
3. Re-run `scripts/build_embeddings.py` and sanity-check embeddings still
   build without errors (it reads `description`/`why_it_matters`/`title` for
   the text it embeds -- `minutes_ago` itself is never embedded, only
   display data, so this should be unaffected either way, but confirm
   nothing else broke).
4. Flag anything in this spec that turned out to be ambiguous or that you had
   to make a judgment call on, so it can be reviewed before the frontend side
   wires up against the new field.

**Not your job, flagging so it's not a surprise:** stripping the literal
date/time out of noise fragments' embedded text will shift those fragments'
embedding vectors, and the app side is separately planning to raise the
sampled-noise count from 40 to 80. Both changes affect clustering quality.
Re-benchmarking the clustering seed/accuracy once this data change and that
count change both land is owned on the app side (`securebert-api/app`),
using the same kind of seed sweep that was already needed once before this
session when quantizing the model shifted the embedding space. You don't
need to prove clustering quality holds -- just producing correct data per
this spec is the deliverable.
