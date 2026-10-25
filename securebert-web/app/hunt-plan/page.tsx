"use client";

import UseCaseShell from "@/components/UseCaseShell";
import HunterHuntPanel from "@/components/HunterHuntPanel";

export default function HuntPlanPage() {
  return (
    <UseCaseShell title="Hypothesis -> Hunt Plan">
      {(modelWarm) => <HunterHuntPanel modelWarm={modelWarm} />}
    </UseCaseShell>
  );
}
