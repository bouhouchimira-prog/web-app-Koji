"use client";

import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function PartenairesPage() {
  const router = useRouter();
  const partners = [
    { id: 1, name: "Matériaux Pro", category: "Matériaux généraux", discount: "5%" },
    { id: 2, name: "Carrelages Européens", category: "Carrelage", discount: "8%" },
    { id: 3, name: "Plomberie Direct", category: "Plomberie", discount: "3%" }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Partenaires Koji</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Fournisseurs partenaires</h2></div>
        <div className="mlist">
          {partners.map((p) => (
            <div key={p.id} className="m-card">
              <div className="top2">
                <div>
                  <div className="nm">{p.name}</div>
                  <div className="meta">{p.category} · Réduction {p.discount}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <a href="#" className="link" style={{ fontSize: 12 }}>Consulter</a>
                <a href="#" className="link" style={{ fontSize: 12 }}>Commander</a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <p style={{ fontSize: 14, color: "var(--grey)" }}>Les partenaires Koji offrent des prix négociés et des conditions de paiement avantageuses.</p>
      </div>
    </Shell>
  );
}
