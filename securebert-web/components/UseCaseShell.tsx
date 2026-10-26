"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
        <div className="max-w-[1600px] mx-auto px-6 pt-5 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/app-logo.svg" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="text-lg sm:text-xl font-semibold leading-tight">SecureBERT 2.0</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-accent hover:underline shrink-0 whitespace-nowrap border border-accent/30 rounded-full px-2.5 py-1"
          >
            &larr; All use cases
          </Link>
          <span className="text-muted shrink-0 hidden sm:inline">/</span>
          <h1 className="text-base sm:text-lg font-semibold leading-tight min-w-0 truncate w-full sm:w-auto">
            {title}
          </h1>
        </div>
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
