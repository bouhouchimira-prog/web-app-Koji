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

      <div className="kpis">
        <div>
          <div className="l">Montant HT</div>
          <div className="v">4333€</div>
          <div className="s">Avant TVA</div>
        </div>
        <div>
          <div className="l">TVA (20%)</div>
          <div className="v">867€</div>
          <div className="s">À ajouter</div>
        </div>
        <div>
          <div className="l">Montant TTC</div>
          <div className="v">5200€</div>
          <div className="s">Avec TVA</div>
        </div>
        <div>
          <div className="l">Taux appliqué</div>
          <div className="v">20%</div>
          <div className="s">Standard</div>
        </div>
      </div>

      <div className="card">
        <p style={{ fontSize: 14, color: "var(--grey)" }}>La TVA est calculée automatiquement selon le taux applicable à votre région et la nature des travaux.</p>
      </div>
    </Shell>
  );
}
