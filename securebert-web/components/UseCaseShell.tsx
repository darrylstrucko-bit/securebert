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
        <div className="max-w-[1600px] mx-auto px-6 pt-5 flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/app-logo.svg" alt="" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="hidden sm:inline text-sm font-semibold text-muted hover:text-foreground transition-colors">
              SecureBERT 2.0
            </span>
          </Link>
          <span className="text-muted shrink-0">/</span>
          <h1 className="text-base sm:text-lg font-semibold leading-tight min-w-0 truncate">{title}</h1>
          <Link
            href="/"
            className="ml-auto text-sm text-accent hover:underline shrink-0 whitespace-nowrap"
          >
            &larr; All use cases
          </Link>
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
