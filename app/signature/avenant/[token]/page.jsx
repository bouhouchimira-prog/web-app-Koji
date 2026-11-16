"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Signature en ligne d'un avenant (maquette PRO-05) : le client lit chaque
// changement avec sa justification, le nouveau total du marché et l'impact
// sur le planning, puis signe.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0).replace(/ | /g, " ");
const signe = (n) => `${n < 0 ? "−" : "+"} ${euro(Math.abs(n))}`;
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : "");
const ICONE = { ajout: "+", modification: "~", suppression: "−" };

export default function SignatureAvenantPage() {
  const { token } = useParams();
  const [avenant, setAvenant] = useState(null);
  const [erreur, setErreur] = useState("");
  const [nom, setNom] = useState("");
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    fetch(`/api/avenants/signature/${token}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lien d'avenant invalide.");
        setAvenant(data.avenant);
        setNom((n) => n || data.avenant?.client || "");
      })
      .catch((e) => setErreur(e.message));
  }, [token]);

  async function signer(event) {
    event.preventDefault();
    setEnvoi(true);
    setErreur("");
    const r = await fetch(`/api/avenants/signature/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signerName: nom, consent: accord }) });
    const data = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) {
      setErreur(data.error || "La signature n'a pas pu être enregistrée.");
      return;
    }
    setAvenant(data.avenant);
  }

  const signeLe = avenant?.status === "Signe";
  return (
    <main className="signature-public">
      <section className="signature-card">
        <div className="signature-brand">
          <img src="/koji-logo-blue.svg" alt="Koji" />
          <div><strong>Koji</strong><span>Avenant à signer</span></div>
        </div>
        {!avenant ? (
          <div className="empty-state">{erreur || "Chargement de l'avenant…"}</div>
        ) : (
          <>
            <header className="signature-summary">
              <div>
                <p className="eyebrow">Avenant {avenant.numero} au devis {avenant.quoteNumber}</p>
                <h1>{avenant.chantier || "Votre chantier"}</h1>
                <p className="muted">{[avenant.entreprise, avenant.client].filter(Boolean).join(" · ")}</p>
              </div>
              <strong>{signe(avenant.avenantHt)} HT</strong>
            </header>
            {avenant.message ? <p className="signature-mention-tva" style={{ whiteSpace: "pre-line" }}>{avenant.message}</p> : null}

            <section className="signature-versions">
              <h2>Ce qui change</h2>
              {avenant.lignes.map((l, i) => (
                <div className="signature-ecart" key={i}>
                  <span><b>{ICONE[l.type]} {l.label}</b><br /><small className="muted">{l.detail}</small></span>
                  <b>{signe(l.total)}</b>
                </div>
              ))}
              <div className="signature-ecart"><span>Devis initial HT</span><b>{euro(avenant.devisHt)}</b></div>
              <div className="signature-ecart"><span>Avenant {avenant.numero} HT</span><b>{signe(avenant.avenantHt)}</b></div>
              <div className="signature-ecart total"><span>Nouveau total du marché</span><b>{euro(avenant.totalHt)} HT · {euro(avenant.totalTtc)} TTC</b></div>
              {avenant.impactJours ? (
                <p className="muted">Planning : {avenant.impactJours > 0 ? `+ ${avenant.impactJours}` : avenant.impactJours} jour{Math.abs(avenant.impactJours) > 1 ? "s" : ""}{avenant.finPrevue ? `, fin prévue le ${jour(avenant.finPrevue)} au lieu du ${jour(avenant.finAvant)}` : ""}.</p>
              ) : null}
            </section>

            {signeLe ? (
              <div className="signature-mention-tva">
                <strong>Avenant signé{avenant.signerName ? ` par ${avenant.signerName}` : ""}{avenant.signedAt ? ` le ${jour(avenant.signedAt)}` : ""}.</strong>
                <p>L'entreprise est prévenue. Gardez ce lien : l'avenant reste consultable ici.</p>
              </div>
            ) : avenant.status === "Refuse" ? (
              <div className="signature-mention-tva"><strong>Cet avenant a été refusé.</strong></div>
            ) : (
              <form className="pform" onSubmit={signer}>
                <label>Votre nom<input value={nom} onChange={(e) => setNom(e.target.value)} required /></label>
                <label className="checkline">
                  <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
                  J'accepte l'avenant {avenant.numero} et le nouveau total du marché.
                </label>
                {erreur ? <p className="form-error">{erreur}</p> : null}
                <button className="button blue" disabled={envoi || !accord || !nom.trim()}>{envoi ? "Signature…" : "Signer l'avenant"}</button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
