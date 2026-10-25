"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Title bar + tab bar stay fixed; only the panels below scroll. */}
      <header className="shrink-0 border-b border-panel-border">
        <div className="max-w-[1600px] mx-auto px-6 pt-5 flex items-center gap-3 sm:gap-4 min-w-0">
          <Image src="/app-logo.svg" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" />
          <h1 className="text-base sm:text-xl lg:text-2xl font-semibold leading-tight min-w-0">
            SecureBERT 2.0 AI Investigation Agent
          </h1>
          <p className="text-muted text-sm leading-relaxed ml-auto hidden lg:block max-w-md">
            Standalone demo of a domain-tuned security encoder,{" "}
            <a
              href="https://huggingface.co/cisco-ai/SecureBERT2.0-base"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              SecureBERT2.0
            </a>
            , as a correlation and retrieval layer feeding a free LLM (Groq / GPT-OSS).
          </p>
        </div>
        <div className="max-w-[1600px] mx-auto px-6 flex gap-2 mt-3">
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
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 pt-5 pb-20">
          <WakeBanner state={wakeState} />

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
      </div>
    </div>
  );
}
