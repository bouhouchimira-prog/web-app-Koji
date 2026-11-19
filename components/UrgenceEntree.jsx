"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "../app/urgences/urgences.css";

// Entrée « Urgence » de Koji Client (maquette PRO-17 · Koji Client ›
// Urgence), posée dans « Mes projets » : commander un dépannage, ou suivre
// l'urgence en cours.
export default function UrgenceEntree({ style }) {
  const [enCours, setEnCours] = useState(null);
  useEffect(() => {
    fetch("/api/client/urgences", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEnCours(d?.urgences?.find((u) => u.enCours) || null))
      .catch(() => {});
  }, []);
  return enCours ? (
    <Link className="ur-entree" href={`/client/urgence/${enCours.id}`} style={style}>
      <div><b>Urgence en cours</b><small>{enCours.titre}</small></div>
      <span className="kc-st">Suivre</span>
    </Link>
  ) : (
    <Link className="ur-entree" href="/client/urgence" style={style}>
      <div><b>Une urgence ?</b><small>Fuite, panne, serrure, vitre : un artisan chez vous rapidement</small></div>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
