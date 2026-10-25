"use client";

import UseCaseShell from "@/components/UseCaseShell";
import CorpusMapPanel from "@/components/CorpusMapPanel";

export default function CorpusMapPage() {
  return (
    <UseCaseShell title="Corpus Map">
      {(modelWarm) => <CorpusMapPanel modelWarm={modelWarm} />}
    </UseCaseShell>
  );
}
