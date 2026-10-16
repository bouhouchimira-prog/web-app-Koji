"use client";

import { useState } from "react";
import { apiSend } from "../lib/client-api";
import { euro } from "../lib/pricing";

// Fenetre "Envoyer le devis" (16 oct, maquette Artifact DevisEnvoi) —
// remplace le bouton "Envoyer" qui ne faisait jusque-la que generer des
// acces de signature a copier-coller a la main (voir sendQuoteToSignature/
// resendSignatureLink dans DevisEditor.jsx, toujours utilisees ici pour
// "Regenerer"). "Envoyer au client" declenche un vrai email serveur
// (app/api/quotes/route.js, action "send" avec sendEmail:true).
export function SendQuoteModal({ quote, quoteNumber, lotsCount, linesCount, totalTtc, defaultObjet, onClose, onSent }) {
  const [destinataire, setDestinataire] = useState(quote?.clientEmail || "");
  const [objet, setObjet] = useState(defaultObjet || `Votre devis ${quoteNumber} — ${quote?.workDescription?.slice(0, 40) || ""}`.trim());
  const [message, setMessage] = useState(`Bonjour ${(quote?.client || "").split(" ")[0] || ""},\n\nVous trouverez ci-joint notre devis pour votre projet. Vous pouvez le signer en ligne en un clic.`.trim());
  const [includePdf, setIncludePdf] = useState(true);
  const [includeSignatureLink, setIncludeSignatureLink] = useState(true);
  const [includeCredentials, setIncludeCredentials] = useState(true);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);
  const [access, setAccess] = useState(quote?.signatureClientAccess || null);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState("");

  function copy(text, field) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 1500);
    }).catch(() => {});
  }

  async function regenerate() {
    if (!quote?.id) return;
    setRegenerating(true);
    setError("");
    try {
      const confirmReopenSigned = quote.signatureStatus === "Signe"
        ? window.confirm("Ce devis est déjà signé. Régénérer les accès effacera la signature existante. Continuer ?")
        : undefined;
      if (quote.signatureStatus === "Signe" && !confirmReopenSigned) { setRegenerating(false); return; }
      const { quote: updated } = await apiSend("/api/quotes", {
        id: quote.id,
        action: "send",
        clientEmail: destinataire,
        clientPhone: quote.clientPhone || "",
        ...(confirmReopenSigned ? { confirmReopenSigned: true } : {})
      }, "PATCH");
      setAccess(updated.signatureClientAccess || null);
      onSent?.(updated, { silent: true });
    } catch (err) {
      setError(err.message || "Impossible de régénérer les accès.");
    } finally {
      setRegenerating(false);
    }
  }

  async function submitSend(event) {
    event.preventDefault();
    if (!quote?.id) return;
    if (!destinataire.trim()) { setError("Adresse e-mail du destinataire manquante."); return; }
    setSending(true);
    setError("");
    try {
      const confirmReopenSigned = quote.signatureStatus === "Signe"
        ? window.confirm("Ce devis est déjà signé. L'envoyer à nouveau effacera la signature existante. Continuer ?")
        : undefined;
      if (quote.signatureStatus === "Signe" && !confirmReopenSigned) { setSending(false); return; }
      const { quote: updated, emailSent, emailError } = await apiSend("/api/quotes", {
        id: quote.id,
        action: "send",
        clientEmail: destinataire,
        clientPhone: quote.clientPhone || "",
        sendEmail: true,
        emailSubject: objet,
        emailMessage: message,
        includePdf,
        includeSignatureLink,
        includeCredentials,
        sendCopyToSelf,
        ...(confirmReopenSigned ? { confirmReopenSigned: true } : {})
      }, "PATCH");
      if (emailSent === false) {
        setError(`${emailError || "Impossible d'envoyer l'email."} Le lien reste disponible ci-dessus pour un partage manuel.`);
        setAccess(updated.signatureClientAccess || null);
      } else {
        onSent?.(updated, { silent: false });
      }
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le devis.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !sending && onClose?.()}>
      <div className="mini-modal send-quote-modal" onClick={(event) => event.stopPropagation()}>
        <div className="send-quote-modal-head">
          <div>
            <h2>Envoyer le devis</h2>
            <p className="muted">Le client reçoit le devis et peut le signer depuis son téléphone.</p>
          </div>
          <button type="button" className="mini-button" onClick={onClose} aria-label="Fermer" disabled={sending}>✕</button>
        </div>

        {/* <div>, pas <form> : cette fenetre est rendue a l'interieur du
            grand <form> de DevisEditor.jsx — un <form> imbrique est
            invalide en HTML. */}
        <div className="send-quote-form">
          <label className="payment-field">
            <span>Destinataire</span>
            <input type="email" value={destinataire} onChange={(e) => setDestinataire(e.target.value)} placeholder="client@email.fr" required />
          </label>
          <label className="payment-field">
            <span>Objet</span>
            <input value={objet} onChange={(e) => setObjet(e.target.value)} />
          </label>
          <label className="payment-field">
            <span>Message</span>
            <textarea className="payment-terms-textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          <div className="send-quote-checklist">
            <label><input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)} /> Joindre le devis en PDF</label>
            <label><input type="checkbox" checked={includeSignatureLink} onChange={(e) => setIncludeSignatureLink(e.target.checked)} /> Inclure le lien de signature en ligne</label>
            <label><input type="checkbox" checked={includeCredentials} onChange={(e) => setIncludeCredentials(e.target.checked)} /> Inclure l'identifiant et le mot de passe de connexion</label>
            <label><input type="checkbox" checked={sendCopyToSelf} onChange={(e) => setSendCopyToSelf(e.target.checked)} /> M'envoyer une copie</label>
          </div>

          <div className="send-quote-access-card">
            <div className="send-quote-access-title">Accès du client pour signer</div>
            <div className="payment-fields-grid">
              <label className="payment-field">
                <span>Identifiant</span>
                <div className="payment-field-suffix">
                  <input value={access?.identifier || "—"} readOnly />
                  <button type="button" className="mini-button" onClick={() => copy(access?.identifier, "id")}>{copiedField === "id" ? "✓" : "Copier"}</button>
                </div>
              </label>
              <label className="payment-field">
                <span>Mot de passe temporaire</span>
                <div className="payment-field-suffix">
                  <input value={access?.password || "—"} readOnly />
                  <button type="button" className="mini-button" onClick={regenerate} disabled={regenerating}>{regenerating ? "…" : "Régénérer"}</button>
                </div>
              </label>
            </div>
            <p className="send-quote-access-hint">
              Le client se connecte avec ces accès pour lire et signer le devis. Le mot de passe est à usage unique et expire à la signature ou après 30 jours.
            </p>
          </div>

          <div className="payment-acompte-summary-bar">
            <span>Devis {quoteNumber} · {lotsCount} lot{lotsCount > 1 ? "s" : ""} · {linesCount} ligne{linesCount > 1 ? "s" : ""}</span>
            <strong>{euro(totalTtc)} TTC</strong>
          </div>

          {error ? <p className="profile-message error">{error}</p> : null}

          <div className="send-quote-footer">
            <button type="button" onClick={onClose} disabled={sending}>Annuler</button>
            <button type="button" onClick={submitSend} disabled={sending}>{sending ? "Envoi…" : "Envoyer au client"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
