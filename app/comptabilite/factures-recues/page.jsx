"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function FacturesRecuesPage() {
  const router = useRouter();
  const invoices = [
    { id: 1, supplier: "Matériaux Pro", date: "2026-10-25", amount: 1200, status: "Payée" },
    { id: 2, supplier: "Carrelages Européens", date: "2026-10-20", amount: 850, status: "Payée" },
    { id: 3, supplier: "Plomberie Direct", date: "2026-10-15", amount: 650, status: "En attente" }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Factures reçues</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Fournisseurs</h2></div>
        <div className="tbl">
          <table>
            <thead>
              <tr><th>Fournisseur</th><th>Date</th><th>Montant</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.supplier}</td>
                  <td className="sm">{new Date(inv.date).toLocaleDateString("fr-FR")}</td>
                  <td className="r">{inv.amount}€</td>
                  <td><span className={`tag ${inv.status === "Payée" ? "tag-b" : "tag-o"}`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
