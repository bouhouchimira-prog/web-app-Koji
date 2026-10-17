"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getChantierDraft } from "../../lib/chantier-draft";
import DevisEditor from "./DevisEditor";
import DevisHistory from "./DevisHistory";

// Le choix Manuel/Avec l'IA vit desormais directement sur le tableau de
// bord Devis (17 oct, demande d'Amira : "infusionner" l'ecran de choix
// dans le dashboard plutot qu'une page intermediaire separee) — voir les
// deux cartes dans DevisHistory.jsx, qui renvoient vers /devis?new=1&mode=...
function DevisRouter() {
  const params = useSearchParams();
  const isEditingExisting = Boolean(params.get("id") || params.get("selection"));
  const isNew = Boolean(params.get("new"));

  // Brouillon chantier (lib/chantier-draft.js, parcours app/chantier/new)
  // — lu dans un useEffect, jamais dans le rendu initial : localStorage
  // est absent cote serveur, le lire directement dans un useMemo
  // desynchronise le rendu serveur/client (erreur d'hydratation).
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    if (!isNew && !isEditingExisting) setHasDraft(Boolean(getChantierDraft()));
  }, [isNew, isEditingExisting]);

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
