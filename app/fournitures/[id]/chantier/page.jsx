"use client";

import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function FournituresChantiersPage() {
  const router = useRouter();
  const supplies = [
    { id: 1, name: "Carrelage 60x60 blanc", qty: 40, unit: "m²", cost: 1200, status: "Reçu" },
    { id: 2, name: "Ciment blanc", qty: 5, unit: "sacs", cost: 150, status: "En transit" },
    { id: 3, name: "Robinetterie chrome", qty: 3, unit: "pcs", cost: 800, status: "Commandé" }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Fournitures du chantier</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Liste des fournitures</h2></div>
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Quantité</th>
                <th>Coût</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="sm">{s.qty} {s.unit}</td>
                  <td className="r">{s.cost}€</td>
                  <td><span className={`tag ${s.status === "Reçu" ? "tag-b" : "tag-o"}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
