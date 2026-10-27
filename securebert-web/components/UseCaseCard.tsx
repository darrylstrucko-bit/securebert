import Link from "next/link";

// Persona (Analyst/Hunter) is conveyed by which column a card sits in on the
// landing page, not by color here -- blue/purple is reserved for the classic
// vs. AI-native attack-family distinction everywhere else in the app, and
// reusing it for persona made the two axes look related when they aren't.
export function UseCaseCard({
  href,
  icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-panel-border bg-panel/40 p-5 hover:border-accent/50 hover:bg-panel/60 transition-colors"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0 h-9 w-9 rounded-md border border-panel-border bg-black/20 flex items-center justify-center text-accent">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-xs font-mono-ui text-muted">{meta}</div>
          <h2 className="text-lg font-semibold mt-0.5">{title}</h2>
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
      <span className="inline-block mt-4 text-sm text-accent">Open &rarr;</span>
    </Link>
  );
}
