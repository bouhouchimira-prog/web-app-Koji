"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function ChantiersPage() {
  const router = useRouter();
  const projects = [
    { id: 1, name: "Chantier Dupont", ca: 5200, charges: 2800, resultat: 2400 },
    { id: 2, name: "Chantier Martin", ca: 3800, charges: 1900, resultat: 1900 },
    { id: 3, name: "Chantier Moreau", ca: 2100, charges: 950, resultat: 1150 }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Coût des chantiers</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Par chantier</h2></div>
        <div className="tbl">
          <table>
            <thead>
              <tr><th>Chantier</th><th>CA</th><th>Charges</th><th>Résultat</th></tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="r">{p.ca}€</td>
                  <td className="r">{p.charges}€</td>
                  <td className="r n">{p.resultat}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
