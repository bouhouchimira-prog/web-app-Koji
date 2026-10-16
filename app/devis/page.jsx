"use client";

import { Suspense, useEffect, useState } from "react";
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

  // Brouillon chantier (lib/chantier-draft.js, parcours app/chantier/new)
  // — verifie uniquement pour une arrivee "nue" sur /devis, JAMAIS quand
  // l'URL demande explicitement un nouveau devis (?new=1, "+ Nouveau
  // devis") : ce clic doit toujours montrer l'ecran de choix, meme si un
  // vieux brouillon oublie traine encore dans le navigateur (bug remonte
  // par Amira — le brouillon prenait le dessus sur le clic explicite).
  // Lu dans un useEffect, jamais dans le rendu initial : localStorage est
  // absent cote serveur, le lire directement dans un useMemo desynchronise
  // le rendu serveur/client (erreur d'hydratation).
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    if (!isNew && !isEditingExisting) setHasDraft(Boolean(getChantierDraft()));
  }, [isNew, isEditingExisting]);

  if (isNew && !hasMode && !isEditingExisting) {
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
