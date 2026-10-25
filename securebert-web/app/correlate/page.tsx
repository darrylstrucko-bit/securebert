"use client";

import UseCaseShell from "@/components/UseCaseShell";
import AnalystCorrelatePanel from "@/components/AnalystCorrelatePanel";

export default function CorrelatePage() {
  return (
    <UseCaseShell title="Correlate These Alerts">
      {(modelWarm) => <AnalystCorrelatePanel modelWarm={modelWarm} />}
    </UseCaseShell>
  );
}
