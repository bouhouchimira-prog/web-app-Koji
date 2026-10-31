"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function CoutChantiersPage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Coût d'un chantier</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Détail des coûts</h2></div>
        <div className="kpis">
          <div>
            <div className="l">Main d'œuvre</div>
            <div className="v">1800€</div>
            <div className="s">69%</div>
          </div>
          <div>
            <div className="l">Fournitures</div>
            <div className="v">700€</div>
            <div className="s">27%</div>
          </div>
          <div>
            <div className="l">Frais généraux</div>
            <div className="v">150€</div>
            <div className="s">6%</div>
          </div>
          <div>
            <div className="l">Coût total</div>
            <div className="v">2650€</div>
            <div className="s">100%</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
