"use client";

import { useEffect, useState } from "react";

// Bandeau hors ligne (maquette PRO-19), en haut de toutes les pages.
// Sur le site, rien n'est mis en file d'attente : on garde la page ouverte.
export function HorsLigne() {
  const [horsLigne, setHorsLigne] = useState(false);
  useEffect(() => {
    const maj = () => setHorsLigne(typeof navigator !== "undefined" && navigator.onLine === false);
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => { window.removeEventListener("online", maj); window.removeEventListener("offline", maj); };
  }, []);
  if (!horsLigne) return null;
  return <div className="hl" role="status">Hors ligne · gardez la page ouverte : vos saisies restent à l'écran et pourront être enregistrées au retour du réseau.</div>;
}
