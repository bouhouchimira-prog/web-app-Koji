"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function DevisFacturesPage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Devis et factures</h1>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Devis émis</div>
          <div className="v">24</div>
          <div className="s">Cette année</div>
        </div>
        <div>
          <div className="l">Factures</div>
          <div className="v">18</div>
          <div className="s">Émises</div>
        </div>
        <div>
          <div className="l">Montant total CA</div>
          <div className="v">45.2K€</div>
          <div className="s">HT</div>
        </div>
        <div>
          <div className="l">Paiements en attente</div>
          <div className="v">8.5K€</div>
          <div className="s">À encaisser</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Derniers devis/factures</h2></div>
        <div style={{ padding: "24px", textAlign: "center", color: "var(--grey)" }}>
          <p>Aucun document récent</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sec">📊 Voir les statistiques</button>
          <button className="btn btn-main">📄 Tous les documents</button>
        </div>
      </div>
    </Shell>
  );
}
