import Link from "next/link";

// Persona (Analyst/Hunter) is conveyed by which column a card sits in on the
// landing page, not by color here -- blue/purple is reserved for the classic
// vs. AI-native attack-family distinction everywhere else in the app, and
// reusing it for persona made the two axes look related when they aren't.
export function UseCaseCard({
  href,
  title,
  description,
  meta,
}: {
  href: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-panel-border bg-panel/40 p-5 hover:border-accent/50 hover:bg-panel/60 transition-colors"
    >
      <div className="text-xs font-mono-ui text-muted mb-3">{meta}</div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
      <span className="inline-block mt-4 text-sm text-accent">Open &rarr;</span>
    </Link>
  );
}
