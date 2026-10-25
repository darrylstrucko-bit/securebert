import Image from "next/image";
import { UseCaseCard } from "@/components/UseCaseCard";
import WarmPing from "@/components/WarmPing";

export default function Home() {
  return (
    <div className="h-full overflow-y-auto">
      <WarmPing />
      <div className="max-w-[1600px] mx-auto px-6 pt-10 pb-20">
        <div className="flex items-center gap-4 mb-3">
          <Image src="/app-logo.svg" alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
            SecureBERT 2.0 AI Investigation Agent
          </h1>
        </div>
        <p className="text-muted max-w-2xl leading-relaxed mb-10">
          Four standalone demos of a domain-tuned security encoder,{" "}
          <a
            href="https://huggingface.co/cisco-ai/SecureBERT2.0-base"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            SecureBERT2.0
          </a>
          , as a correlation and retrieval layer feeding a free LLM (Groq / GPT-OSS) -- spanning
          classic intrusions and AI-native attacks, mapped to MITRE ATT&amp;CK and ATLAS. Pick a use
          case below.
        </p>

        <div className="grid sm:grid-cols-2 gap-5">
          <UseCaseCard
            href="/correlate"
            persona="Analyst"
            meta="SecureBERT + Groq"
            title="Correlate These Alerts"
            description="A pile of ~47 unlabeled alerts, one real attack chain buried in noise. SecureBERT clusters by embedding similarity before you ever see which rows are real; Groq narrates the sequence and scores the risk."
          />
          <UseCaseCard
            href="/known-pattern"
            persona="Analyst"
            meta="SecureBERT + Groq"
            title="Is This a Known Pattern?"
            description="Paste a new, unlabeled incident description. SecureBERT retrieves the nearest matching precedent(s) by embedding distance before Groq writes the analyst brief -- grounded retrieval, not a guess."
          />
          <UseCaseCard
            href="/hunt-plan"
            persona="Hunter"
            meta="SecureBERT + Groq"
            title="Hypothesis -> Hunt Plan"
            description="Type a plain-English hunting hypothesis, classic or AI-native. SecureBERT grounds it against the nearest precedent before Groq turns it into a concrete hunt plan with a starter detection query."
          />
          <UseCaseCard
            href="/corpus-map"
            persona="Hunter"
            meta="SecureBERT only, no LLM"
            title="Corpus Map"
            description="See where all 7 cases sit in embedding space, classic and AI-native, and where a snippet of your own would land -- or whether it looks like nothing seen before. Pure SecureBERT, no Groq call."
          />
        </div>
      </div>
    </div>
  );
}
