"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { euro } from "../../../lib/pricing";
import { useLocale } from "../../../lib/i18n";

export default function PublicSignaturePage() {
  const { L } = useLocale();
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ signerName: "", signerEmail: "", signerPhone: "", signaturePlace: "", signerMessage: "", consent: false });
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
            signaturePlace: payload.quote.signaturePlace || "",
            signerMessage: payload.quote.signerMessage || ""
          }));
        }
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
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
            <span>{L.signaturePub.clientSig}</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">{L.signaturePub.loadingQuote}</div>
        ) : error && !quote ? (
          <div className="empty-state">{error}</div>
        ) : (
          <>
            <header className="signature-summary">
              <div>
                <p className="eyebrow">{L.signaturePub.quoteToSign}</p>
                <h1>{quote.quoteNumber}</h1>
                <p className="muted">{quote.project} - {quote.client}</p>
              </div>
              <strong>{euro(quote.totalTtc)}</strong>
            </header>

            <div className="grid cols-3">
              <div className="metric"><span>{L.signaturePub.rooms}</span><strong>{quote.rooms?.length || 0}</strong></div>
              <div className="metric"><span>{L.signaturePub.lines}</span><strong>{totalItems}</strong></div>
              <div className="metric"><span>{L.signaturePub.status}</span><strong>{alreadySigned ? L.signaturePub.signedStatus : L.signaturePub.toSignStatus}</strong></div>
            </div>

            <section className="signature-quote-lines">
              {(quote.items || []).length === 0 ? (
                <div className="empty-state">{L.signaturePub.noLines}</div>
              ) : (
                quote.items.map((item, index) => (
                  <article key={`${item.code || item.label}-${index}`}>
                    <div>
                      <small>{item.room || "Chantier"}</small>
                      <strong>{item.label}</strong>
                      <span>{item.quantity} {item.unit}</span>
                      {item.showMaterialsToClient !== false && item.materialLines?.length ? (
                        <em>{L.signaturePub.supplies} {item.materialLines.map((material) => material.productName || material.category).filter(Boolean).join(", ")}</em>
                      ) : null}
                    </div>
                    <b>{euro(item.totalTtc || 0)}</b>
                  </article>
                ))
              )}
            </section>

            <form className="panel" onSubmit={signQuote} style={{ marginTop: 14 }}>
              <h2>{alreadySigned ? L.signaturePub.signedTitle : L.signaturePub.validateTitle}</h2>
              <div className="form-grid">
                <label className="field">{L.signaturePub.signerName}<input value={form.signerName} onChange={(event) => setField("signerName", event.target.value)} disabled={alreadySigned} required /></label>
                <label className="field">{L.signaturePub.email}<input type="email" value={form.signerEmail} onChange={(event) => setField("signerEmail", event.target.value)} disabled={alreadySigned} /></label>
                <label className="field">{L.signaturePub.phone}<input value={form.signerPhone} onChange={(event) => setField("signerPhone", event.target.value)} placeholder="06 12 34 56 78" disabled={alreadySigned} /></label>
                <label className="field">{L.signaturePub.sigPlace}<input value={form.signaturePlace} onChange={(event) => setField("signaturePlace", event.target.value)} placeholder="Ex: Paris" disabled={alreadySigned} /></label>
              </div>
              <label className="field" style={{ marginTop: 10 }}>
                {L.signaturePub.sigMsg}
                <textarea
                  value={form.signerMessage}
                  onChange={(event) => setField("signerMessage", event.target.value)}
                  placeholder={L.signaturePub.sigMsgPh}
                  rows={3}
                  disabled={alreadySigned}
                />
              </label>
              <p className="muted">{L.signaturePub.madeAt} {form.signaturePlace || "__________"}, le {new Date().toLocaleDateString("fr-FR")}.</p>
              {!alreadySigned && (
                <label className="checkline">
                  <input type="checkbox" checked={form.consent} onChange={(event) => setField("consent", event.target.checked)} />
                  {L.signaturePub.consent}
                </label>
              )}
              {error ? <p className="form-error">{error}</p> : null}
              {saved || alreadySigned ? (
                <div className="profile-message">
                  <p>{L.signaturePub.signedConfirm}</p>
                  {clientAccess ? (
                    <p>{L.signaturePub.clientAccessMsg(clientAccess.sentByEmail, clientAccess.sentBySms)} {L.signaturePub.clientAccessEnd}</p>
                  ) : null}
                </div>
              ) : null}
              {!alreadySigned && <button className="button blue" style={{ marginTop: 12 }}>{L.signaturePub.signBtn}</button>}
            </form>
          </>
        )}
      </section>
    </main>
  );
}
