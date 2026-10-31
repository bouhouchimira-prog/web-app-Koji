"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function MesPrixPage() {
  const router = useRouter();
  const prices = [
    { ouvrage: "Carrelage 60x60", unit: "m²", prix: 45, marge: 30 },
    { ouvrage: "Pose carrelage", unit: "m²", prix: 35, marge: 25 },
    { ouvrage: "Jointoiement", unit: "m²", prix: 8, marge: 20 }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Mes prix</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Tarification des ouvrages</h2></div>
        <div className="tbl">
          <table>
            <thead>
              <tr><th>Ouvrage</th><th>Unité</th><th>Prix</th><th>Marge %</th></tr>
            </thead>
            <tbody>
              {prices.map((p, i) => (
                <tr key={i}>
                  <td>{p.ouvrage}</td>
                  <td className="sm">{p.unit}</td>
                  <td className="r">{p.prix}€</td>
                  <td className="r">{p.marge}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
