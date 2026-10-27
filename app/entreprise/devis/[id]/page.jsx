"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

// Devis detail page — show full quote with items, sign button, download PDF.
export default function EntrepriseDevisDetail() {
  const router = useRouter();
  const params = useParams();
  const devisId = params?.id;

  const [devis, setDevis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (devisId) loadDevis();
  }, [devisId]);

  const loadDevis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/entreprise/devis/${devisId}`);
      if (!response.ok) {
        if (response.status === 401) router.push("/login");
        throw new Error("Impossible de charger le devis");
      }
      const data = await response.json();
      setDevis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    try {
      setSigning(true);
      // Redirect to signature page with devis data
      router.push(`/signature/sign?quoteId=${devisId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/entreprise/devis/${devisId}/pdf`);
      if (!response.ok) throw new Error("Erreur lors du téléchargement");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis-${devisId}.pdf`;
      a.click();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div>Chargement…</div>;
  if (!devis) return <div>Devis non trouvé</div>;

  const isSigned = devis.status === "signed" || devis.signatureStatus === "Signe";

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Link href="/entreprise/devis">
          <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500" }}>← Retour aux devis</a>
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1>Devis #{devis.id.substring(0, 8)}</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {!isSigned && (
            <button
              onClick={handleSign}
              disabled={signing}
              style={{
                backgroundColor: "#0052cc",
                color: "white",
                padding: "10px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: signing ? "not-allowed" : "pointer",
                fontWeight: "500",
                fontSize: "14px",
                opacity: signing ? 0.6 : 1,
              }}
            >
              {signing ? "Signature…" : "Signer le devis"}
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            style={{
              backgroundColor: "#f5f7fa",
              color: "#4a5568",
              padding: "10px 16px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            📥 Télécharger PDF
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {/* Devis info */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #e0e6ed",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "600", color: "#718096", marginBottom: "8px" }}>Client</h3>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{devis.clientName || "—"}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#718096" }}>{devis.clientEmail || ""}</p>
          </div>
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "600", color: "#718096", marginBottom: "8px" }}>Statut</h3>
            <p
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "600",
                color: isSigned ? "#2ecc71" : "#ff8c42",
              }}
            >
              {isSigned ? "✓ Signé" : "En attente"}
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "24px",
          border: "1px solid #e0e6ed",
        }}
      >
        <div style={{ padding: "16px", backgroundColor: "#f5f7fa", borderBottom: "1px solid #e0e6ed" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Éléments du devis</h2>
        </div>
        {devis.items && devis.items.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0e6ed" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>
                  Description
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", fontSize: "14px" }}>
                  Quantité
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", fontSize: "14px" }}>
                  Prix unit.
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", fontSize: "14px" }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {devis.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e0e6ed" }}>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{item.description || "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px" }}>{item.quantity || 1}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px" }}>
                    {item.unitPrice ? `${item.unitPrice.toLocaleString("fr-FR")} €` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px", fontWeight: "600" }}>
                    {item.total ? `${item.total.toLocaleString("fr-FR")} €` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "24px", textAlign: "center", color: "#718096" }}>Aucun élément</div>
        )}
      </div>

      {/* Total */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "8px",
          textAlign: "right",
          border: "1px solid #e0e6ed",
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <span style={{ fontSize: "14px", color: "#718096" }}>Montant total : </span>
          <span style={{ fontSize: "24px", fontWeight: "800", color: "#0052cc" }}>
            {devis.totalAmount ? `${devis.totalAmount.toLocaleString("fr-FR")} €` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
