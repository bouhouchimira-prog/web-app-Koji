"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { euro } from "../../../lib/pricing";

export default function PublicSignaturePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ signerName: "", signerEmail: "", signerPhone: "", signaturePlace: "", consent: false });
  const [saved, setSaved] = useState(false);
  const [clientAccess, setClientAccess] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/signatures/${token}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Lien invalide.");
        if (alive) {
          setQuote(payload.quote);
          setForm((current) => ({
            ...current,
            signerName: payload.quote.client || "",
            signerEmail: payload.quote.clientEmail || "",
            signerPhone: payload.quote.clientPhone || "",
            signaturePlace: payload.quote.signaturePlace || ""
          }));
        }
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const alreadySigned = quote?.signatureStatus === "Signe";
  const totalItems = useMemo(() => quote?.items?.length || 0, [quote]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function signQuote(event) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/signatures/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Signature impossible.");
      return;
    }
    setQuote(payload.quote);
    setClientAccess(payload.clientAccess || null);
    setSaved(true);
  }

  return (
    <main className="signature-public">
      <section className="signature-card">
        <div className="signature-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <div>
            <strong>Koji</strong>
            <span>Signature client</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Chargement du devis...</div>
        ) : error && !quote ? (
          <div className="empty-state">{error}</div>
        ) : (
          <>
            <header className="signature-summary">
              <div>
                <p className="eyebrow">DEVIS A SIGNER</p>
                <h1>{quote.quoteNumber}</h1>
                <p className="muted">{quote.project} - {quote.client}</p>
              </div>
              <strong>{euro(quote.totalTtc)}</strong>
            </header>

            <div className="grid cols-3">
              <div className="metric"><span>Pieces</span><strong>{quote.rooms?.length || 0}</strong></div>
              <div className="metric"><span>Lignes</span><strong>{totalItems}</strong></div>
              <div className="metric"><span>Statut</span><strong>{alreadySigned ? "Signe" : "A signer"}</strong></div>
            </div>

            <section className="signature-quote-lines">
              {(quote.items || []).length === 0 ? (
                <div className="empty-state">Aucune ligne detaillee.</div>
              ) : (
                quote.items.map((item, index) => (
                  <article key={`${item.code || item.label}-${index}`}>
                    <div>
                      <small>{item.room || "Chantier"}</small>
                      <strong>{item.label}</strong>
                      <span>{item.quantity} {item.unit}</span>
                      {item.showMaterialsToClient !== false && item.materialLines?.length ? (
                        <em>Fournitures: {item.materialLines.map((material) => material.productName || material.category).filter(Boolean).join(", ")}</em>
                      ) : null}
                    </div>
                    <b>{euro(item.totalTtc || 0)}</b>
                  </article>
                ))
              )}
            </section>

            <form className="panel" onSubmit={signQuote} style={{ marginTop: 14 }}>
              <h2>{alreadySigned ? "Signature enregistree" : "Valider le devis"}</h2>
              <div className="form-grid">
                <label className="field">Nom du signataire<input value={form.signerName} onChange={(event) => setField("signerName", event.target.value)} disabled={alreadySigned} required /></label>
                <label className="field">E-mail<input type="email" value={form.signerEmail} onChange={(event) => setField("signerEmail", event.target.value)} disabled={alreadySigned} /></label>
                <label className="field">Telephone<input value={form.signerPhone} onChange={(event) => setField("signerPhone", event.target.value)} placeholder="06 12 34 56 78" disabled={alreadySigned} /></label>
                <label className="field">Lieu de signature<input value={form.signaturePlace} onChange={(event) => setField("signaturePlace", event.target.value)} placeholder="Ex: Paris" disabled={alreadySigned} /></label>
              </div>
              <p className="muted">Fait à {form.signaturePlace || "__________"}, le {new Date().toLocaleDateString("fr-FR")}.</p>
              {!alreadySigned && (
                <label className="checkline">
                  <input type="checkbox" checked={form.consent} onChange={(event) => setField("consent", event.target.checked)} />
                  J'accepte ce devis et je confirme ma signature.
                </label>
              )}
              {error ? <p className="form-error">{error}</p> : null}
              {saved || alreadySigned ? (
                <div className="profile-message">
                  <p>Devis signe et enregistre dans Koji.</p>
                  {clientAccess ? (
                    <p>Votre acces Koji Particulier a ete envoye {clientAccess.sentByEmail ? "par e-mail" : ""}{clientAccess.sentByEmail && clientAccess.sentBySms ? " et " : ""}{clientAccess.sentBySms ? "par SMS" : ""}. Vous pourrez suivre l'avancement de vos travaux dans votre espace client.</p>
                  ) : null}
                </div>
              ) : null}
              {!alreadySigned && <button className="button blue" style={{ marginTop: 12 }}>Signer le devis</button>}
            </form>
          </>
        )}
      </section>
    </main>
  );
}
