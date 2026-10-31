"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function TauxPage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Taux d'après mes factures</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Analyse des prix facturés</h2></div>
        <div className="kpis">
          <div>
            <div className="l">Prix moyen pratiqué</div>
            <div className="v">42€</div>
            <div className="s">Par m²</div>
          </div>
          <div>
            <div className="l">Fourchette</div>
            <div className="v">35-50€</div>
            <div className="s">Min/Max</div>
          </div>
          <div>
            <div className="l">Taux de marge</div>
            <div className="v">28%</div>
            <div className="s">Moyen</div>
          </div>
          <div>
            <div className="l">Chantiers analysés</div>
            <div className="v">24</div>
            <div className="s">Derniers 12 mois</div>
          </div>
        </div>
      </div>

      <div className="card">
        <p style={{ fontSize: 14, color: "var(--grey)" }}>Les taux sont calculés automatiquement à partir de vos factures. Mettez à jour vos prix pour refléter votre stratégie commerciale.</p>
      </div>
    </Shell>
  );
}
