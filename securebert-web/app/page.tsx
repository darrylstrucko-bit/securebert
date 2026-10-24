import PersonaApp from "@/components/PersonaApp";

export default function Home() {
  return (
    <main className="flex-1">
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-10">
        <p className="text-xs font-mono-ui text-muted mb-3 tracking-wide uppercase">
          SecureBERT x AI Investigation Agent
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          Correlating classic intrusions <span className="text-accent">and</span> AI-native attacks
          <br />
          against MITRE <span className="text-accent">ATT&amp;CK</span> and{" "}
          <span className="text-accent-ai">ATLAS</span> -- side by side.
        </h1>
        <p className="text-muted mt-4 max-w-2xl leading-relaxed">
          This is a standalone demo of a domain-tuned security encoder,{" "}
          <a
            href="https://huggingface.co/cisco-ai/SecureBERT2.0-base"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            SecureBERT2.0
          </a>
          , as a correlation and retrieval layer feeding a free LLM (Groq / Llama 3.3) --
          not the other way around. Every narrative below is shown next to the raw similarity
          scores and cluster result that produced it, so SecureBERT&rsquo;s contribution is
          provable, not asserted. 4 of the 7 sample cases are AI-native attacks (prompt
          injection, model theft, ML supply-chain compromise, agent jailbreaks) mapped to MITRE
          ATLAS; the other 3 are classic intrusions mapped to ATT&amp;CK -- one correlation
          engine, both worlds.
        </p>
        <p className="text-sm text-muted mt-4">
          Companion to{" "}
          <a
            href="https://aia.darrylstrucko.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            aia.darrylstrucko.com
          </a>{" "}
          -- this demo is a working prototype of that project&rsquo;s own backlogged
          &ldquo;historical case retrieval with RAG&rdquo; and &ldquo;use a free agent instead
          of Claude&rdquo; next steps.
        </p>
      </div>
      <PersonaApp />
    </main>
  );
}
