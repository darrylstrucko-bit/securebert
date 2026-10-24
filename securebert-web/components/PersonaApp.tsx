"use client";

import { useState } from "react";
import AnalystCorrelatePanel from "./AnalystCorrelatePanel";
import AnalystRetrievePanel from "./AnalystRetrievePanel";
import HunterHuntPanel from "./HunterHuntPanel";

type Persona = "analyst" | "hunter";

export default function PersonaApp() {
  const [persona, setPersona] = useState<Persona>("analyst");

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20">
      <div className="flex gap-2 mb-8 border-b border-panel-border">
        {(["analyst", "hunter"] as Persona[]).map((p) => (
          <button
            key={p}
            onClick={() => setPersona(p)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              persona === p
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {p === "analyst" ? "Analyst" : "Hunter"}
          </button>
        ))}
      </div>

      {persona === "analyst" ? (
        <div className="space-y-10">
          <AnalystCorrelatePanel />
          <AnalystRetrievePanel />
        </div>
      ) : (
        <div className="space-y-10">
          <HunterHuntPanel />
        </div>
      )}
    </div>
  );
}
