export function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-panel-border bg-panel/40 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted mt-1 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}

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

export function FrameworkBadges({
  attack,
  atlas,
}: {
  attack: { technique_id?: string }[];
  atlas: { technique_id?: string }[];
}) {
  const attackIds = attack.map((a) => a.technique_id).filter(Boolean);
  const atlasIds = atlas.map((a) => a.technique_id).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attackIds.length > 0 ? (
        attackIds.map((id) => (
          <span key={id} className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-accent/15 text-accent">
            ATT&amp;CK {id}
          </span>
        ))
      ) : (
        <span className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-white/5 text-muted">ATT&amp;CK: n/a</span>
      )}
      {atlasIds.length > 0 ? (
        atlasIds.map((id) => (
          <span key={id} className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-accent-ai/15 text-accent-ai">
            ATLAS {id}
          </span>
        ))
      ) : (
        <span className="text-xs font-mono-ui px-1.5 py-0.5 rounded bg-white/5 text-muted">ATLAS: n/a</span>
      )}
    </div>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }
) {
  const { loading, loadingLabel, children, disabled, className, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-md bg-accent text-black text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:brightness-110 transition ${className ?? ""}`}
    >
      {loading ? (loadingLabel ?? "Working...") : children}
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
            <span className="font-medium">Waking up the SecureBERT model service.</span> It runs on a
            free Render instance that sleeps when idle -- the first request after a while can take up
            to a minute. This has nothing to do with Groq or the correlation itself; once it&rsquo;s
            awake, everything below responds normally. Feel free to click a button now, it&rsquo;ll
            just wait a bit longer this one time.
          </>
        )}
      </p>
    </div>
  );
}

export function loadingLabelFor(modelWarm: boolean): string {
  return modelWarm ? "Working..." : "Waking up model service...";
}
