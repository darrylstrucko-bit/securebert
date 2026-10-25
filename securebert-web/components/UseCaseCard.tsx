import Link from "next/link";

export function UseCaseCard({
  href,
  persona,
  title,
  description,
  meta,
}: {
  href: string;
  persona: "Analyst" | "Hunter";
  title: string;
  description: string;
  meta: string;
}) {
  const isHunter = persona === "Hunter";
  return (
    <Link
      href={href}
      className="block rounded-lg border border-panel-border bg-panel/40 p-5 hover:border-accent/50 hover:bg-panel/60 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-mono-ui uppercase tracking-wide px-2 py-0.5 rounded border ${
            isHunter ? "border-accent-ai/50 text-accent-ai bg-accent-ai/10" : "border-accent/50 text-accent bg-accent/10"
          }`}
        >
          {persona}
        </span>
        <span className="text-xs text-muted">{meta}</span>
      </div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
      <span className="inline-block mt-4 text-sm text-accent">Open &rarr;</span>
    </Link>
  );
}
