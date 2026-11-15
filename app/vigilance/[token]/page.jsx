"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fichierPourEnvoi } from "../../../lib/fichier-client";

// Dépôt des documents de vigilance par le sous-traitant (maquette
// PRO-10.1), sans compte : un bouton par document demandé.
const ETAT = { ok: "à jour", echeance: "expire bientôt", manquant: "à déposer", expire: "expiré, à renouveler" };

export default function DepotVigilance() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function charger() {
    const r = await fetch(`/api/vigilance/${token}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Lien invalide.");
    setData(d);
  }
  useEffect(() => { charger().catch((e) => setErreur(e.message)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deposer(doc, file) {
    setBusy(doc); setErreur(""); setMessage("");
    try {
      const r = await fetch(`/api/vigilance/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, data: await fichierPourEnvoi(file) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Dépôt impossible.");
      setMessage(d.lu?.autreDocument ? "Document reçu, mais il ne ressemble pas au document demandé : vérifiez." : `Document reçu${d.lu?.validJusqu ? `, valable jusqu'au ${d.lu.validJusqu.split("-").reverse().join("/")}` : ""}. Merci.`);
      await charger();
    } catch (e) { setErreur(e.message); }
    setBusy("");
  }

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "40px 16px", fontFamily: "Inter, Arial, sans-serif", color: "#171B1E", background: "#ECECE7", minHeight: "100vh" }}>
      <p style={{ letterSpacing: ".3em", fontWeight: 700, margin: "0 0 24px" }}>KOJI</p>
      {erreur ? <p role="alert" style={{ background: "#FBEBEB", padding: 12 }}>{erreur}</p> : null}
      {!data ? (erreur ? null : <p>Chargement…</p>) : (
        <>
          <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>Documents à déposer</h1>
          <p style={{ color: "#5B5F66", margin: "0 0 20px" }}>{data.entreprise} vous demande ces documents ({data.pour}) avant de vous confier des travaux. Un PDF ou une photo nette suffit ; la date de validité est lue automatiquement.</p>
          {message ? <p role="status" style={{ background: "#E5F4E4", padding: 12 }}>{message}</p> : null}
          {data.docs.map((d) => (
            <div key={d.cle} style={{ background: "#fff", border: "1px solid #CFCFC9", borderTop: "2px solid #171B1E", padding: 16, marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px" }}>
                <strong>{d.nom}</strong>
                <div style={{ fontSize: 13, color: "#5B5F66" }}>{d.aide}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{d.depose && d.etat !== "expire" ? "déposé · " : ""}{ETAT[d.etat]}</div>
              </div>
              <label style={{ background: d.etat === "ok" ? "#fff" : "#FFC400", border: "1px solid #171B1E", padding: "10px 14px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {busy === d.cle ? "Envoi…" : d.depose ? "Remplacer" : "Déposer"}
                <input type="file" accept="application/pdf,image/*" hidden disabled={Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) deposer(d.cle, f); }} />
              </label>
            </div>
          ))}
          <p style={{ fontSize: 12, color: "#5B5F66" }}>Ces documents sont transmis à {data.entreprise} seulement et conservés pour la durée de vos travaux ensemble.</p>
        </>
      )}
    </main>
  );
}
