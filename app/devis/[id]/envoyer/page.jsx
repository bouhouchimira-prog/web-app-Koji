"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { useState } from "react";

export default function EnvoyerPage() {
  const router = useRouter();
  const [emails, setEmails] = useState(["client@example.com"]);
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("Veuillez trouver ci-joint le devis demandé.");

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Devis</span>
          <h1>Envoyer le devis</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Destinataires</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {emails.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <span>{e}</span>
              <button className="link" onClick={() => setEmails(emails.filter((_, idx) => idx !== i))}>Retirer</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Ajouter un email" style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 4 }} />
          <button className="btn btn-sec" onClick={() => { setEmails([...emails, newEmail]); setNewEmail(""); }}>Ajouter</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Message</h2></div>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid var(--line)", borderRadius: 4, fontFamily: "inherit", fontSize: 14 }} />
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">📧 Envoyer</button>
        </div>
      </div>
    </Shell>
  );
}
