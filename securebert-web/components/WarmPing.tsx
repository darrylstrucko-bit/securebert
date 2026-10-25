"use client";

import { useEffect } from "react";

// Fires once, silently, the moment the landing page loads -- before the visitor
// has even picked a use case. Render's free-tier instance can take 50s+ to wake
// from idle, so starting that clock while someone is still reading the four
// cards (instead of only once they click in) buys real lead time. No UI, no
// polling loop here -- each use-case page's own UseCaseShell handles that once
// the visitor actually lands on it.
export default function WarmPing() {
  useEffect(() => {
    fetch("/api/warm").catch(() => {});
  }, []);
  return null;
}
