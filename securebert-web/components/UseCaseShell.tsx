"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./AppHeader";
import { WakeBanner, type WakeState } from "./ui";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 20; // ~80s ceiling, comfortably past the observed 50s+ cold start

export default function UseCaseShell({
  title,
  children,
}: {
  title: string;
  children: (modelWarm: boolean) => React.ReactNode;
}) {
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
      <header className="shrink-0 border-b border-panel-border">
        <AppHeader pageTitle={title} />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 pt-5 pb-20">
          <WakeBanner state={wakeState} />
          {children(modelWarm)}
        </div>
      </div>
    </div>
  );
}
