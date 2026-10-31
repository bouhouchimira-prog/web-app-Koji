"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";

export default function FiltresPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    compagnon: "",
    chantier: "",
    type: "all"
  });

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Filtres du calendrier</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Affichage</h2></div>
        <div className="fgrid">
          <label>
            <span>Par compagnon</span>
            <select value={filters.compagnon} onChange={(e) => setFilters({...filters, compagnon: e.target.value})}>
              <option value="">Tous</option>
              <option>Jean Dupont</option>
              <option>Marie Laurent</option>
            </select>
          </label>

          <label>
            <span>Par chantier</span>
            <select value={filters.chantier} onChange={(e) => setFilters({...filters, chantier: e.target.value})}>
              <option value="">Tous</option>
              <option>Chantier Dupont</option>
              <option>Chantier Martin</option>
            </select>
          </label>

          <label>
            <span>Type de tâche</span>
            <select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}>
              <option value="all">Toutes</option>
              <option value="ouvrage">Ouvrages</option>
              <option value="rdv">RDV</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="ed-act">
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">✓ Appliquer</button>
        </div>
      </div>
    </Shell>
  );
}
