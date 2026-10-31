"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { useState } from "react";

export default function SignaturePage() {
  const router = useRouter();
  const [status, setStatus] = useState("pending");

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Signature et rétractation</h1>
      </div>
      <div className="card">
        <div className="card-h"><h2>Statut de signature</h2></div>
        <div style={{ padding: "16px", background: "#F5F5F2", borderRadius: 4, marginBottom: 16 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>
            {status === "pending" && "⏳ En attente de signature"}
            {status === "signed" && "✓ Signé"}
            {status === "cancelled" && "✗ Annulé"}
          </strong>
          <small style={{ color: "var(--grey)" }}>Le {new Date().toLocaleDateString("fr-FR")}</small>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Droit de rétractation</h2></div>
        <p style={{ marginBottom: 12, color: "var(--grey)", fontSize: 14 }}>Le client dispose de 14 jours pour se rétracter après signature du devis.</p>
        <p style={{ fontSize: 12, color: "var(--grey)" }}>Délai de rétractation: jusqu'au 13 novembre 2026</p>
      </div>
    </Shell>
  );
}
