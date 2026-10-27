"use client";

import { useState } from "react";

export function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-panel-border bg-panel/40 p-5">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted mt-1 mb-4">{subtitle}</div>
      {children}
    </section>
  );
}

// Blue/purple (accent/accent-ai) means ONE thing everywhere in this app: classic
// intrusion vs. AI-native attack. Deliberately not reused for anything else (e.g.
// Analyst/Hunter persona), which used to collide with this and make both axes
// read as related when they aren't.
export function FamilyBadge({ family }: { family: string }) {
  const isAi = family === "ai_attack";
  return (
    <span
      className={`inline-block text-xs font-mono-ui px-2 py-0.5 rounded border ${
        isAi
          ? "border-accent-ai/50 text-accent-ai bg-accent-ai/10"
          : "border-accent/50 text-accent bg-accent/10"
      }`}
    >
      {isAi ? "AI-native attack" : "Classic intrusion"}
    </span>
  );
}

// https://attack.mitre.org/techniques/T1566/ (base) or /T1048/003/ (sub-technique:
// dotted suffix becomes its own path segment, per MITRE's own URL convention).
export function attackUrl(id: string): string {
  const [base, sub] = id.split(".");
  return sub ? `https://attack.mitre.org/techniques/${base}/${sub}/` : `https://attack.mitre.org/techniques/${base}/`;
}

// https://atlas.mitre.org/techniques/AML.T0086 -- ATLAS keeps the full dotted ID,
// sub-techniques included, as a single path segment (no splitting).
export function atlasUrl(id: string): string {
  return `https://atlas.mitre.org/techniques/${id}`;
}

// Matches a bare technique ID wherever it appears in running prose -- ATLAS IDs
// first (more specific: "AML.T####" with an optional ".###" sub-technique), then
// plain ATT&CK IDs ("T####" with an optional ".###"). Used to auto-link technique
// mentions inside Groq's narrative text, not just the dedicated badge rows.
const TECHNIQUE_ID_PATTERN = /\bAML\.T\d{4}(?:\.\d{3})?\b|\bT\d{4}(?:\.\d{3})?\b/g;

// Renders prose with any technique ID it contains turned into a MITRE link,
// instead of only linking IDs that already have their own dedicated badge row.
export function LinkedText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = new RegExp(TECHNIQUE_ID_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const id = match[0];
    const isAtlas = id.startsWith("AML.");
    nodes.push(
      <a
        key={key++}
        href={isAtlas ? atlasUrl(id) : attackUrl(id)}
        target="_blank"
        rel="noreferrer"
        className={`font-mono-ui hover:underline ${isAtlas ? "text-accent-ai" : "text-accent"}`}
      >
        {id}
      </a>
    );
    lastIndex = match.index + id.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

export function FrameworkBadges({
  attack,
  atlas,
}: {
  attack: { technique_id?: string }[];
  atlas: { technique_id?: string }[];
}) {
  const attackIds = attack.map((a) => a.technique_id).filter((id): id is string => Boolean(id));
  const atlasIds = atlas.map((a) => a.technique_id).filter((id): id is string => Boolean(id));
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attackIds.length > 0 ? (
        attackIds.map((id) => (
          <a
            key={id}
            href={attackUrl(id)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-accent/15 text-accent hover:underline"
          >
            ATT&amp;CK {id}
          </a>
        ))
      ) : (
        <span className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-white/5 text-muted">ATT&amp;CK: n/a</span>
      )}
      {atlasIds.length > 0 ? (
        atlasIds.map((id) => (
          <a
            key={id}
            href={atlasUrl(id)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-accent-ai/15 text-accent-ai hover:underline"
          >
            ATLAS {id}
          </a>
        ))
      ) : (
        <span className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-white/5 text-muted">ATLAS: n/a</span>
      )}
    </div>
  );
}

// Risk and confidence are two different claims (how bad, vs. how sure) -- kept as
// two separate badges rather than one combined string so each can be read (and
// color-judged, for risk) independently.
export function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 67
      ? "border-red-400/50 text-red-300 bg-red-400/10"
      : score >= 34
        ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
        : "border-green-400/50 text-green-300 bg-green-400/10";
  return (
    <span className={`inline-block text-xs font-mono-ui px-2 py-0.5 rounded border ${color}`}>
      Risk {score}/100
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  return (
    <span className="inline-block text-xs font-mono-ui px-2 py-0.5 rounded border border-panel-border text-muted bg-white/5">
      {confidence} confidence
    </span>
  );
}

// Splits narrative prose into paragraphs (blank-line separated, per the system
// prompts that generate this text) instead of rendering one dense unbroken
// block. Falls back gracefully to a single paragraph if the model didn't
// actually include blank lines.
export function Narrative({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="rounded border border-panel-border bg-black/20 p-4 text-sm leading-relaxed space-y-3">
      {(paragraphs.length > 0 ? paragraphs : [text]).map((p, i) => (
        <p key={i}>
          <LinkedText text={p} />
        </p>
      ))}
    </div>
  );
}

// A small "i" button that reveals an explanation on click (not hover, so it
// works the same on touch devices) -- for jargon that's load-bearing to
// understanding a panel (e.g. "PCA") but too long to put in the subtitle.
export function InfoButton({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-text-top ml-1.5 -translate-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        className="inline-flex items-center justify-center h-[18px] w-[18px] rounded-full border border-muted text-muted text-xs leading-none font-mono-ui hover:border-accent hover:text-accent cursor-pointer"
      >
        i
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-2 left-0 w-72 text-xs leading-relaxed bg-panel border border-panel-border rounded-md p-3 shadow-lg text-left">
          {children}
        </div>
      )}
    </span>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    modelWarm?: boolean;
  }
) {
  const { loading, modelWarm, children, disabled, className, onClick, ...rest } = props;
  const [showWakeNote, setShowWakeNote] = useState(false);
  const notReady = modelWarm === false && !loading;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (notReady) {
      setShowWakeNote(true);
      window.setTimeout(() => setShowWakeNote(false), 5000);
    }
    onClick?.(e);
  }

  return (
    <div className="relative inline-block">
      <button
        {...rest}
        onClick={handleClick}
        disabled={disabled || loading}
        className={`px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:brightness-110 transition ${
          notReady ? "bg-amber-400 text-black" : "bg-accent text-black"
        } ${className ?? ""}`}
      >
        {loading ? "Working..." : notReady ? `${children} (waking up...)` : children}
      </button>
      {showWakeNote && (
        <div className="absolute z-10 top-full mt-2 left-0 w-72 text-xs leading-relaxed bg-panel border border-amber-400/40 rounded-md p-3 shadow-lg">
          <span className="font-medium text-amber-300">Still waking up.</span>{" "}
          <span className="text-muted">
            The model service runs on a free instance that sleeps when idle -- your click will go
            through, it just needs up to a minute the first time.
          </span>
        </div>
      )}
    </div>
  );
}

export function ClearButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`px-4 py-2 rounded-md text-sm font-medium border border-panel-border text-muted hover:text-foreground hover:border-foreground/30 cursor-pointer transition ${className ?? ""}`}
    >
      Clear
    </button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-400 border border-red-400/30 bg-red-400/10 rounded px-3 py-2 mt-3">
      {message}
    </p>
  );
}

export type WakeState = "checking" | "cold" | "warm";

// Distinct from the per-action "Working..." spinner: this is specifically about
// the Render free-tier instance spinning up from sleep, which can take 50s+ and
// has nothing to do with how long SecureBERT/Groq themselves take to respond.
// Conflating the two left people staring at a generic spinner with no idea
// whether anything was actually happening.
export function WakeBanner({ state }: { state: WakeState }) {
  if (state === "warm") return null;
  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 mb-6">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
      <p className="text-sm text-amber-200">
        {state === "checking" ? (
          <>Checking the model service...</>
        ) : (
          <>
            <span className="font-medium">Waking up the SecureBERT 2.0 model service.</span> It runs on a
            free Render instance that sleeps when idle -- the first request after a while can take up
            to a minute. This has nothing to do with Groq or the correlation itself; once it&rsquo;s
            awake, everything below responds normally. The button below will show it&rsquo;s not ready
            yet -- feel free to click it anyway, it&rsquo;ll just wait a bit longer this one time.
          </>
        )}
      </p>
    </div>
  );
}
