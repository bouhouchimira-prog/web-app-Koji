"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getChantierDraft } from "../../lib/chantier-draft";
import DevisEditor from "./DevisEditor";
import DevisHistory from "./DevisHistory";
import DevisModeChoice from "./DevisModeChoice";

function DevisRouter() {
  const params = useSearchParams();
  const isEditingExisting = Boolean(params.get("id") || params.get("selection"));
  const isNew = Boolean(params.get("new"));
  const hasMode = Boolean(params.get("mode"));
  const hasDraft = useMemo(() => Boolean(getChantierDraft()), []);

  // "+ Nouveau devis" (17 oct, demande d'Amira) : passe desormais par cet
  // ecran de choix Manuel/Avec l'IA avant d'ouvrir l'editeur, plutot que
  // d'ouvrir directement en mode Manuel — jamais pour une edition d'un
  // devis existant (id/selection) ni pour un brouillon chantier deja en
  // cours, qui vont toujours droit a l'editeur.
  if (isNew && !hasMode && !isEditingExisting && !hasDraft) {
    return <DevisModeChoice />;
  }

  const needsEditor = isEditingExisting || isNew || hasDraft;
  return needsEditor ? <DevisEditor /> : <DevisHistory />;
}

export default function DevisPage() {
  return (
    <Suspense fallback={null}>
      <DevisRouter />
    </Suspense>
  );
}
