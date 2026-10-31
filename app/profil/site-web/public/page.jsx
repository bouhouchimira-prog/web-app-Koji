"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function KojiPagePubliquePage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>KojiPage publique</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Votre page publique</h2></div>
        <div style={{ padding: "24px", background: "#F5F5F2", borderRadius: 4, marginBottom: 16 }}>
          <p style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600 }}>URL: koji.fr/artisans/jean-dupont</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--grey)" }}>Partagez ce lien pour recevoir des demandes</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sec">🔗 Copier le lien</button>
          <button className="btn btn-sec">👁️ Aperçu</button>
          <button className="btn btn-main">✏️ Éditer</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Statistiques</h2></div>
        <div className="kpis">
          <div>
            <div className="l">Visites ce mois</div>
            <div className="v">234</div>
            <div className="s">Vues</div>
          </div>
          <div>
            <div className="l">Demandes générées</div>
            <div className="v">8</div>
            <div className="s">Ce mois</div>
          </div>
          <div>
            <div className="l">Taux de conversion</div>
            <div className="v">3.4%</div>
            <div className="s">Visites→Demandes</div>
          </div>
          <div>
            <div className="l">Rang de recherche</div>
            <div className="v">#3</div>
            <div className="s">Pour "carreleur Paris"</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
