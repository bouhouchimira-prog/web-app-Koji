"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getChantierDraft } from "../../lib/chantier-draft";
import DevisEditor from "./DevisEditor";
import DevisHistory from "./DevisHistory";

function DevisRouter() {
  const params = useSearchParams();
  const needsEditor = useMemo(
    () => Boolean(params.get("id") || params.get("selection") || params.get("new") || getChantierDraft()),
    [params]
  );

  return needsEditor ? <DevisEditor /> : <DevisHistory />;
}

export default function DevisPage() {
  return (
    <Suspense fallback={null}>
      <DevisRouter />
    </Suspense>
  );
}
