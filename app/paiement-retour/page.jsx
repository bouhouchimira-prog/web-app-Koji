"use client";

import { useEffect, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";

// Retour du prestataire de paiement (Stripe) quand le parcours a commencé
// dans une app : paiement d'une facture dans Koji (?app=client&etat=ok|annule)
// ou inscription au paiement en ligne dans Koji Pro (?app=pro&etat=retour|relancer).
// Rien n'est lu ni enregistré ici : on renvoie vers l'app
// (com.koji.client://paiement ou com.koji.pro://paiement), qui se met à jour.
const TEXTES = {
  ok: ["Paiement transmis", "Revenez dans l'app Koji : la facture se met à jour dès que le prestataire confirme le paiement, et le reçu arrive dans Documents."],
  annule: ["Paiement abandonné", "Rien n'a été prélevé. Revenez dans l'app Koji pour payer plus tard ou régler par virement."],
  retour: ["Inscription transmise", "Revenez dans l'app Koji Pro : l'état du paiement en ligne s'affiche dans Encaissements dès que le prestataire a vérifié votre entreprise."],
  relancer: ["Lien expiré", "Le lien d'inscription n'est plus valable. Revenez dans l'app Koji Pro et touchez « Terminer l'inscription » pour en ouvrir un nouveau."]
};

export default function PaiementRetourPage() {
  const [etat, setEtat] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const app = p.get("app") === "pro" ? "pro" : "client";
    const e = String(p.get("etat") || "");
    const cle = app === "pro" ? (e === "relancer" ? "relancer" : "retour") : e === "annule" ? "annule" : "ok";
    const lien = `com.koji.${app}://paiement?etat=${cle}`;
    setEtat({ app, cle, lien });
    // Ouvre l'app tout de suite ; le bouton reste si le navigateur le bloque.
    window.location.href = lien;
  }, []);

  if (!etat) return null;
  const [titre, texte] = TEXTES[etat.cle];
  const pro = etat.app === "pro";

  return (
    <main className={`auth-screen${pro ? " auth-pro" : ""}`}>
      <AuthBrandPanel profile={pro ? "entreprise" : "particulier"} />
      <section className="auth-panel">
        <h2>{titre}</h2>
        <p className="muted">{texte}</p>
        <a className="button blue" href={etat.lien} style={{ marginTop: 16, display: "block", textAlign: "center", textDecoration: "none" }}>{pro ? "Revenir dans Koji Pro" : "Revenir dans l'app Koji"}</a>
        <p className="muted" style={{ marginTop: 16 }}>Vous pouvez ensuite fermer cette page.</p>
      </section>
    </main>
  );
}
