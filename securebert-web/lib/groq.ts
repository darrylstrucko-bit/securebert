const GROQ_MODEL = "openai/gpt-oss-120b";

export async function askGroq(system: string, user: string, maxTokens = 700): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: maxTokens,
      // gpt-oss-120b is a reasoning model: by default it can spend most/all of
      // max_tokens on hidden reasoning before ever writing the answer, finishing
      // with finish_reason "length" and an EMPTY content field -- confirmed
      // directly against Groq with this route's actual prompt (698 of 700 tokens
      // went to reasoning, 0 left for content). We want the prose, not a visible
      // chain of thought, so reasoning effort is capped low.
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const finishReason = data?.choices?.[0]?.finish_reason;
  if (!content.trim() && finishReason === "length") {
    throw new Error("Groq ran out of tokens before producing an answer (finish_reason: length).");
  }
  return content.trim();
}
