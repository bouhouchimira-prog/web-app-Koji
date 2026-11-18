"use client";

import { useEffect, useState } from "react";

// Invoicing page
export default function EntrepriseFacturation() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await fetch("/api/entreprise/facturation");
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setInvoices(data.invoices || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "32px" }}>Facturation</h1>

      {loading && <div>Chargement…</div>}

      {!loading && invoices.length === 0 && (
        <div style={{ backgroundColor: "#fff", padding: "40px", textAlign: "center", borderRadius: "8px", color: "#718096" }}>
          Aucune facture
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div style={{ backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f7fa", borderBottom: "1px solid #e0e6ed" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>N° Facture</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>Client</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600" }}>Montant</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #e0e6ed" }}>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{inv.number}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{inv.clientName}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px", fontWeight: "600" }}>{inv.amount}€</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{inv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
