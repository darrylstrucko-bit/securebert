"use client";

import { useEffect, useRef, useState } from "react";
import AnalystCorrelatePanel from "./AnalystCorrelatePanel";
import AnalystRetrievePanel from "./AnalystRetrievePanel";
import HunterHuntPanel from "./HunterHuntPanel";
import { WakeBanner, type WakeState } from "./ui";

type Persona = "analyst" | "hunter";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 20; // ~80s ceiling, comfortably past the observed 50s+ cold start

export default function PersonaApp() {
  const [persona, setPersona] = useState<Persona>("analyst");
  const [wakeState, setWakeState] = useState<WakeState>("checking");
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/warm");
        const data = await res.json();
        if (cancelled) return;
        if (!data.remote || data.warmed) {
          setWakeState("warm");
          return;
        }
        setWakeState("cold");
      } catch {
        if (cancelled) return;
        setWakeState("cold");
      }
      pollCount.current += 1;
      if (!cancelled && pollCount.current < MAX_POLLS) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const modelWarm = wakeState === "warm";

  return (
    <div className="max-w-[1600px] mx-auto px-6 pb-20">
      <WakeBanner state={wakeState} />

      <div className="flex gap-2 mb-8 border-b border-panel-border">
        {(["analyst", "hunter"] as Persona[]).map((p) => (
          <button
            key={p}
            onClick={() => setPersona(p)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              persona === p
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {p === "analyst" ? "Analyst" : "Hunter"}
          </button>
        ))}
      </div>

      {persona === "analyst" ? (
        <div className="space-y-10">
          <AnalystCorrelatePanel modelWarm={modelWarm} />
          <AnalystRetrievePanel modelWarm={modelWarm} />
        </div>
      ) : (
        <div className="space-y-10">
          <HunterHuntPanel modelWarm={modelWarm} />
        </div>
      )}
    </div>
  );
}
