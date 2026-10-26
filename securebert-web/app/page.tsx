import { AppHeader } from "@/components/AppHeader";
import { UseCaseCard } from "@/components/UseCaseCard";
import WarmPing from "@/components/WarmPing";

export default function Home() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <WarmPing />
      <header className="shrink-0 border-b border-panel-border">
        <AppHeader />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-20">
          <p className="text-muted leading-relaxed mb-10">
            Click on a Use case to explore how{" "}
            <a
              href="https://huggingface.co/cisco-ai/SecureBERT2.0-base"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              SecureBERT 2.0
            </a>{" "}
            can be used to help security operations analysis of classic intrusions and AI-native
            attacks.
          </p>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
            <div className="space-y-5">
              <h2 className="text-base font-bold tracking-wide">Analyst</h2>
              <UseCaseCard
                href="/correlate"
                meta="SecureBERT 2.0 + Groq/gpt-oss-120b LLM"
                title="Correlate These Alerts"
                description="7 case studies, each with its own real alert chain mixed into ~80 unlabeled noise fragments. SecureBERT 2.0 clusters by embedding similarity before you ever see which rows are real; Groq narrates the sequence and scores the risk."
              />
              <UseCaseCard
                href="/known-pattern"
                meta="SecureBERT 2.0 + Groq/gpt-oss-120b LLM"
                title="Is This a Known Pattern?"
                description="Paste a new, unlabeled incident description. SecureBERT 2.0 retrieves the nearest matching precedent(s) by embedding distance before Groq writes the analyst brief -- grounded retrieval, not a guess."
              />
            </div>

            <div className="space-y-5">
              <h2 className="text-base font-bold tracking-wide">Hunter</h2>
              <UseCaseCard
                href="/hunt-plan"
                meta="SecureBERT 2.0 + Groq/gpt-oss-120b LLM"
                title="Hypothesis -> Hunt Plan"
                description="Type a plain-English hunting hypothesis, classic or AI-native. SecureBERT 2.0 grounds it against the nearest precedent before Groq turns it into a concrete hunt plan with a starter detection query."
              />
              <UseCaseCard
                href="/corpus-map"
                meta="SecureBERT 2.0 only, no LLM"
                title="Corpus Map"
                description="See where all 7 cases sit in embedding space, classic and AI-native, and where a snippet of your own would land -- or whether it looks like nothing seen before. Pure SecureBERT 2.0, no Groq call."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
