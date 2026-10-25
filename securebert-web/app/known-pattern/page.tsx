"use client";

import UseCaseShell from "@/components/UseCaseShell";
import AnalystRetrievePanel from "@/components/AnalystRetrievePanel";

export default function KnownPatternPage() {
  return (
    <UseCaseShell title="Is This a Known Pattern?">
      {(modelWarm) => <AnalystRetrievePanel modelWarm={modelWarm} />}
    </UseCaseShell>
  );
}
