"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { euro } from "../../../lib/pricing";

export default function PublicSignaturePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ signerName: "", signerEmail: "", consent: false });
  const [saved, setSaved] = useState(false);

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
            signerEmail: payload.quote.clientEmail || ""
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

            <section className="table-card" style={{ marginTop: 14 }}>
              <table className="data-table">
                <thead><tr><th>Ouvrage</th><th>Piece</th><th>Quantite</th><th>Total TTC</th></tr></thead>
                <tbody>
                  {(quote.items || []).length === 0 ? (
                    <tr><td colSpan={4}><div className="empty-state">Aucune ligne detaillee.</div></td></tr>
                  ) : (
                    quote.items.map((item, index) => (
                      <tr key={`${item.code || item.label}-${index}`}>
                        <td><strong>{item.label}</strong><br /><span className="muted">{item.code}</span></td>
                        <td>{item.room}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{euro(item.totalTtc || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <form className="panel" onSubmit={signQuote} style={{ marginTop: 14 }}>
              <h2>{alreadySigned ? "Signature enregistree" : "Valider le devis"}</h2>
              <div className="form-grid">
                <label className="field">Nom du signataire<input value={form.signerName} onChange={(event) => setField("signerName", event.target.value)} disabled={alreadySigned} required /></label>
                <label className="field">E-mail<input type="email" value={form.signerEmail} onChange={(event) => setField("signerEmail", event.target.value)} disabled={alreadySigned} /></label>
              </div>
              {!alreadySigned && (
                <label className="checkline">
                  <input type="checkbox" checked={form.consent} onChange={(event) => setField("consent", event.target.checked)} />
                  J'accepte ce devis et je confirme ma signature.
                </label>
              )}
              {error ? <p className="form-error">{error}</p> : null}
              {saved || alreadySigned ? <p className="profile-message">Devis signe et enregistre dans Koji.</p> : null}
              {!alreadySigned && <button className="button blue" style={{ marginTop: 12 }}>Signer le devis</button>}
            </form>
          </>
        )}
      </section>
    </main>
  );
}
