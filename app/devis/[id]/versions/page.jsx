"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function VersionsPage() {
  const router = useRouter();
  const versions = [
    { v: "1.0", date: "2026-10-20", author: "Vous", status: "Actuelle", total: "5200€" },
    { v: "0.9", date: "2026-10-19", author: "Vous", status: "Archivée", total: "5000€" }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Versions du devis</h1>
      </div>
      <div className="card">
        <div className="card-h"><h2>Historique</h2></div>
        <div className="tbl">
          <table>
            <thead><tr><th>Version</th><th>Date</th><th>Auteur</th><th>Montant</th><th>Statut</th></tr></thead>
            <tbody>
              {versions.map((v, i) => (
                <tr key={i}><td className="sm">{v.v}</td><td>{v.date}</td><td>{v.author}</td><td className="n">{v.total}</td><td><span className="tag">{v.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
