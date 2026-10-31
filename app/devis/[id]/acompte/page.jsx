"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function AcomptePage() {
  const router = useRouter();
  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Facture d'acompte</h1>
      </div>
      <div className="card">
        <div className="card-h"><h2>Acompte demandé</h2></div>
        <div className="row"><div className="t"><small>Montant total TTC</small><strong>5200€</strong></div></div>
        <div className="row"><div className="t"><small>Acompte demandé (30%)</small><strong>1560€</strong></div></div>
        <div className="row"><div className="t"><small>Solde restant</small><strong>3640€</strong></div></div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Conditions de paiement</h2></div>
        <p style={{ fontSize: 14, marginBottom: 12 }}>30% à la signature du devis, solde à la fin des travaux.</p>
      </div>
    </Shell>
  );
}
