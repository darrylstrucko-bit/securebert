import PersonaApp from "@/components/PersonaApp";

export default function Home() {
  return (
    <main className="flex-1">
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
          SecureBERT 2.0 AI Investigation Agent
        </h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">
          Standalone demo of a domain-tuned security encoder,{" "}
          <a
            href="https://huggingface.co/cisco-ai/SecureBERT2.0-base"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            SecureBERT2.0
          </a>
          , as a correlation and retrieval layer feeding a free LLM (Groq / GPT-OSS).
        </p>
      </div>
      <PersonaApp />
    </main>
  );
}
