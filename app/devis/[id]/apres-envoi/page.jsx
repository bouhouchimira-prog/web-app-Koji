"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function ApresEnvoiPage() {
  const router = useRouter();
  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Après l'envoi</h1>
      </div>
      <div className="card">
        <div className="card-h"><h2>Statut</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
            <strong>Devis envoyé</strong>
            <div style={{ fontSize: 12, color: "var(--grey)", marginTop: 4 }}>Le 30 octobre 2026 à 14h30</div>
          </div>
          <div style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
            <strong>Lecture du devis</strong>
            <div style={{ fontSize: 12, color: "var(--grey)", marginTop: 4 }}>En attente</div>
          </div>
          <div style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
            <strong>Signature</strong>
            <div style={{ fontSize: 12, color: "var(--grey)", marginTop: 4 }}>En attente</div>
          </div>
        </div>
      </div>
      <div className="card">
        <button className="btn btn-sec" onClick={() => router.back()}>Retour</button>
      </div>
    </Shell>
  );
}
