"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Page du client d'une intervention rapide (PRO-17.1) : prix écrits de
// l'artisan, « J'accepte ces prix », puis suivi (en route, sur place…).
const st = {
  page: { minHeight: "100dvh", background: "#F5F5F1", color: "#171B1E", fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif", padding: "24px 16px" },
  carte: { maxWidth: 520, margin: "0 auto", background: "#FFFFFF", border: "1px solid #CFCFC9", borderTop: "2px solid #171B1E", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 },
  lab: { fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5B5F66" },
  prix: { background: "#FAFAF7", border: "1px solid #E1E1DB", padding: "10px 12px", fontSize: 15, lineHeight: 1.5 },
  btn: { height: 52, border: 0, background: "#171B1E", color: "#FFFFFF", fontWeight: 700, fontSize: 16, borderRadius: 2, cursor: "pointer" },
  ok: { borderLeft: "3px solid #171B1E", padding: "8px 12px", fontSize: 14 },
  petit: { fontSize: 12, color: "#5B5F66", lineHeight: 1.5, margin: 0 }
};

export default function InterventionClient() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const charger = () => fetch(`/api/intervention-client?t=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Lien inconnu."); setD(j); }).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
    const t = setInterval(charger, 30000);
    return () => clearInterval(t);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accepter() {
    setBusy(true);
    try {
      const r = await fetch("/api/intervention-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, action: "accepter" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erreur.");
      setD(j);
    } catch (e) { setErreur(e.message); }
    setBusy(false);
  }

  return (
    <main style={st.page}>
      <div style={st.carte}>
        {!d ? <p>{erreur || "Chargement…"}</p> : (
          <>
            <span style={st.lab}>Intervention · {d.entreprise}</span>
            <h1 style={{ margin: 0, fontSize: 22 }}>{d.probleme || "Dépannage"}</h1>
            {d.adresse ? <p style={{ margin: 0, color: "#3A3E44" }}>{d.adresse}</p> : null}
            {d.prix ? (
              <>
                <span style={st.lab}>Prix de l'intervention</span>
                <div style={st.prix}>{d.prix}</div>
              </>
            ) : null}
            {d.accepteLe ? <p style={st.ok}>Prix acceptés à {d.accepteLe.replace(":", " h ")}.</p> : d.prix && d.etape !== "annulee" ? (
              <button type="button" style={{ ...st.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={accepter}>{busy ? "…" : "J'accepte ces prix"}</button>
            ) : null}
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{d.suivi}</p>
            {d.telephone ? <a href={`tel:${d.telephone.replace(/[^\d+]/g, "")}`} style={{ color: "#171B1E" }}>Appeler {d.entreprise}</a> : null}
            {erreur ? <p style={{ color: "#B3261E", margin: 0 }}>{erreur}</p> : null}
            <p style={st.petit}>Avant de commencer, l'artisan vous fera signer un devis détaillé. Les pièces sont sur devis. L'intervention est réalisée et facturée par {d.entreprise}.</p>
          </>
        )}
      </div>
    </main>
  );
}
