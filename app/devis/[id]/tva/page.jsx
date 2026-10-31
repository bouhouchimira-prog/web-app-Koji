"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function TVAPage() {
  const router = useRouter();
  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>TVA automatique</h1>
      </div>
      <div className="card">
        <div className="card-h"><h2>Calcul TVA</h2></div>
        <div className="row"><div className="t"><small>Montant HT</small><strong>4333€</strong></div></div>
        <div className="row"><div className="t"><small>TVA (20%)</small><strong>867€</strong></div></div>
        <div className="row"><div className="t"><small>Montant TTC</small><strong>5200€</strong></div></div>
      </div>
      <div className="card">
        <p style={{ fontSize: 14, color: "var(--grey)" }}>La TVA est calculée automatiquement selon le taux applicable à votre région et la nature des travaux.</p>
      </div>
    </Shell>
  );
}
