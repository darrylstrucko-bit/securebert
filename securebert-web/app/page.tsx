import { GitMerge, SearchCheck, Crosshair, ChartScatter } from "lucide-react";
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
                icon={<GitMerge className="h-5 w-5" aria-hidden />}
                meta="SecureBERT 2.0 + Groq/gpt-oss-120b LLM"
                title="Correlate These Alerts"
                description="See how SecureBERT 2.0 identifies related security events within a stream of alerts and background noise. Select a case to reconstruct the attack timeline and reveal the events that matter."
              />
              <UseCaseCard
                href="/known-pattern"
                icon={<SearchCheck className="h-5 w-5" aria-hidden />}
                meta="SecureBERT 2.0 + Groq/gpt-oss-120b LLM"
                title="Is This a Known Pattern?"
                description="Describe a security incident or choose an example to see if SecureBERT 2.0 recognizes similar activity. Explore matching cases, understand their relevance, and get an AI-generated assessment."
              />
            </div>

            <div className="space-y-5">
              <h2 className="text-base font-bold tracking-wide">Hunter</h2>
              <UseCaseCard
                href="/hunt-plan"
                icon={<Crosshair className="h-5 w-5" aria-hidden />}
                meta="SecureBERT 2.0 + Groq/gpt-oss-120b LLM"
                title="Hypothesis -> Hunt Plan"
                description="Enter a plain-English hunting hypothesis, traditional or AI-native. SecureBERT 2.0 finds relevant precedents, then Groq uses them to generate a concrete hunt plan."
              />
              <UseCaseCard
                href="/corpus-map"
                icon={<ChartScatter className="h-5 w-5" aria-hidden />}
                meta="SecureBERT 2.0 only, no LLM"
                title="Corpus Map"
                description="Explore how SecureBERT 2.0 groups security cases and alerts based on their semantic similarity. Related events appear closer together, helping reveal common patterns, clusters, and outliers."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
