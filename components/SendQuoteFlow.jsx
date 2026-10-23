"use client";

import { useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";
import { euro } from "../lib/pricing";
import { contactDisplayName } from "../lib/contacts";

// Fenetre "Envoyer le devis" (24 oct, maquette Artifact DevisRecapEnvoiContact)
// — remplace components/SendQuoteModal.jsx : choix du destinataire (un
// contact existant du carnet, ou un contact Marketplace deja engage via un
// chantier — meme regle de confidentialite RDV que partout ailleurs,
// /api/marketplace/mes-chantiers deja construit) + canaux COMBINABLES
// (email/WhatsApp/SMS coches ensemble, un seul clic). L'email reste le seul
// envoi reellement server-side (action "send", sendEmail:true) ; WhatsApp et
// SMS restent des ouvertures manuelles d'appli (wa.me / sms:), decision du
// 23 oct : pas d'integration operateur payante pour l'instant.
//
// A la difference de la maquette : garde "Inclure l'identifiant et le mot
// de passe de connexion" (case a cocher, cochee par defaut) — sans eux le
// client ne peut pas se connecter pour signer, la maquette ne le montre
// pas mais le supprimer casserait la signature en ligne.
export function SendQuoteFlow({ quote, quoteNumber, lotsCount, linesCount, totalTtc, contacts, onClose, onSent }) {
  const [destinataireMode, setDestinataireMode] = useState("existing");
  const [selected, setSelected] = useState(() => ({
    key: "current",
    name: quote?.client || "Client",
    email: quote?.clientEmail || "",
    phone: quote?.clientPhone || ""
  }));
  const [contactQuery, setContactQuery] = useState("");
  const [marketplaceContacts, setMarketplaceContacts] = useState(null);
  const [marketplaceError, setMarketplaceError] = useState("");

  const [channelEmail, setChannelEmail] = useState(true);
  const [channelWhatsapp, setChannelWhatsapp] = useState(false);
  const [channelSms, setChannelSms] = useState(false);

  const [objet, setObjet] = useState(`Votre devis ${quoteNumber} — ${quote?.workDescription?.slice(0, 40) || ""}`.trim());
  const [message, setMessage] = useState(`Bonjour ${(selected.name || "").split(" ")[0] || ""}, voici notre devis pour votre projet. Vous pouvez le lire et le signer en ligne en un clic. Je reste disponible pour toute question.`.trim());
  const [includePdf, setIncludePdf] = useState(true);
  const [includeSignatureLink, setIncludeSignatureLink] = useState(true);
  const [includeCredentials, setIncludeCredentials] = useState(true);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function openMarketplaceTab() {
    setDestinataireMode("marketplace");
    if (marketplaceContacts !== null) return;
    apiGet("/api/marketplace/mes-chantiers")
      .then((data) => setMarketplaceContacts(data.chantiers || []))
      .catch((err) => setMarketplaceError(err.message || "Impossible de charger vos chantiers Marketplace."));
  }

  function pickContact(name, email, phone, key) {
    setSelected({ key, name, email, phone });
    setMessage((current) => current.replace(/^Bonjour [^,]*,/, `Bonjour ${(name || "").split(" ")[0] || ""},`));
  }

  const phoneDigits = String(selected.phone || "").replace(/[^\d]/g, "");
  const channelsChosenLabels = [
    channelEmail ? "e-mail" : null,
    channelWhatsapp ? "WhatsApp" : null,
    channelSms ? "SMS" : null
  ].filter(Boolean);
  const sendButtonLabel = channelsChosenLabels.length
    ? `Envoyer par ${channelsChosenLabels.join(" et ")}…`
    : "Envoyer…";

  async function submitSend(event) {
    event.preventDefault();
    if (!quote?.id) return;
    if (!channelEmail && !channelWhatsapp && !channelSms) {
      setError("Choisissez au moins un canal d'envoi.");
      return;
    }
    if (channelEmail && !selected.email.trim()) {
      setError("E-mail du destinataire manquant pour l'envoi par e-mail.");
      return;
    }
    if ((channelWhatsapp || channelSms) && !phoneDigits) {
      setError("Téléphone du destinataire manquant pour WhatsApp/SMS.");
      return;
    }
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
        clientEmail: selected.email,
        clientPhone: selected.phone,
        sendEmail: channelEmail,
        emailSubject: objet,
        emailMessage: message,
        includePdf,
        includeSignatureLink,
        includeCredentials,
        sendCopyToSelf,
        ...(confirmReopenSigned ? { confirmReopenSigned: true } : {})
      }, "PATCH");

      if (channelEmail && emailSent === false) {
        setError(`${emailError || "Impossible d'envoyer l'email."} Les autres canaux cochés restent ouverts ci-dessous.`);
      }

      const access = updated.signatureClientAccess;
      if ((channelWhatsapp || channelSms) && access?.loginUrl) {
        const shareText = [
          message,
          `Lien : ${access.loginUrl}`,
          includeCredentials ? `Identifiant : ${access.identifier} · Mot de passe : ${access.password}` : null
        ].filter(Boolean).join("\n");
        if (channelWhatsapp) window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(shareText)}`, "_blank");
        if (channelSms) window.open(`sms:${phoneDigits}?&body=${encodeURIComponent(shareText)}`);
      }

      if (!(channelEmail && emailSent === false)) {
        onSent?.(updated, { silent: false });
      } else {
        onSent?.(updated, { silent: true });
      }
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le devis.");
    } finally {
      setSending(false);
    }
  }

  const filteredContacts = (contacts || []).filter((contact) => {
    if (!contactQuery.trim()) return true;
    return contactDisplayName(contact).toLowerCase().includes(contactQuery.trim().toLowerCase());
  }).slice(0, 30);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !sending && onClose?.()}>
      <div className="mini-modal send-quote-modal" onClick={(event) => event.stopPropagation()}>
        <div className="send-quote-modal-head">
          <div>
            <h2>Envoyer le devis</h2>
            <p className="muted">Choisissez le client et les canaux. Il pourra lire et signer le devis depuis son téléphone.</p>
          </div>
          <button type="button" className="mini-button" onClick={onClose} aria-label="Fermer" disabled={sending}>✕</button>
        </div>

        <div className="send-quote-form">
          <div className="segmented large send-quote-dest-toggle">
            <button type="button" className={destinataireMode === "existing" ? "active" : ""} onClick={() => setDestinataireMode("existing")}>Client existant</button>
            <button type="button" className={destinataireMode === "marketplace" ? "active" : ""} onClick={openMarketplaceTab}>Client de la marketplace</button>
          </div>

          <div className="send-quote-dest-label">Destinataire</div>

          {destinataireMode === "existing" ? (
            <>
              <input
                className="quote-picker-search"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Rechercher un contact…"
              />
              <div className="marketplace-picker-list send-quote-dest-list">
                <button type="button" className={`marketplace-picker-row${selected.key === "current" ? " selected" : ""}`} onClick={() => pickContact(quote?.client || "Client", quote?.clientEmail || "", quote?.clientPhone || "", "current")}>
                  <strong>{quote?.client || "Client"}</strong>
                  <small>{[quote?.clientEmail, quote?.clientPhone].filter(Boolean).join(" · ")}</small>
                </button>
                {filteredContacts.map((contact) => (
                  <button
                    type="button"
                    key={contact.id}
                    className={`marketplace-picker-row${selected.key === contact.id ? " selected" : ""}`}
                    onClick={() => pickContact(contactDisplayName(contact), contact.email || "", contact.phone || "", contact.id)}
                  >
                    <strong>{contactDisplayName(contact)}</strong>
                    <small>{[contact.email, contact.phone].filter(Boolean).join(" · ")}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="marketplace-picker-list send-quote-dest-list">
              {marketplaceError ? <p className="auth-error">{marketplaceError}</p> : null}
              {!marketplaceError && marketplaceContacts === null ? <p className="muted">Chargement…</p> : null}
              {!marketplaceError && marketplaceContacts && !marketplaceContacts.length ? (
                <p className="muted">Aucun chantier avec un RDV confirmé pour l'instant.</p>
              ) : null}
              {(marketplaceContacts || []).map((chantier) => (
                <button
                  type="button"
                  key={chantier.offerId}
                  className={`marketplace-picker-row${selected.key === chantier.offerId ? " selected" : ""}`}
                  onClick={() => pickContact(chantier.clientName, chantier.clientEmail || "", chantier.clientPhone || "", chantier.offerId)}
                >
                  <strong>{chantier.clientName}</strong>
                  <small>{chantier.description || chantier.address}</small>
                  <small>{[chantier.clientPhone, chantier.clientEmail].filter(Boolean).join(" · ")}</small>
                </button>
              ))}
            </div>
          )}

          <div className="send-quote-channels">
            <label className={`send-quote-channel${channelEmail ? " checked" : ""}`}>
              <input type="checkbox" checked={channelEmail} onChange={(e) => setChannelEmail(e.target.checked)} />
              <div><strong>E-mail</strong><small>{selected.email || "—"}</small></div>
            </label>
            <label className={`send-quote-channel${channelWhatsapp ? " checked" : ""}`}>
              <input type="checkbox" checked={channelWhatsapp} onChange={(e) => setChannelWhatsapp(e.target.checked)} />
              <div><strong>WhatsApp</strong><small>{selected.phone || "—"}</small></div>
            </label>
            <label className={`send-quote-channel${channelSms ? " checked" : ""}`}>
              <input type="checkbox" checked={channelSms} onChange={(e) => setChannelSms(e.target.checked)} />
              <div><strong>SMS</strong><small>{selected.phone || "—"}</small></div>
            </label>
          </div>

          {channelEmail ? (
            <label className="payment-field">
              <span>Objet</span>
              <input value={objet} onChange={(e) => setObjet(e.target.value)} />
            </label>
          ) : null}
          <label className="payment-field">
            <span>Message</span>
            <textarea className="payment-terms-textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          {(channelWhatsapp || channelSms) ? (
            <div className="send-quote-preview">
              <div className="send-quote-preview-title">Aperçu · {channelWhatsapp ? "WhatsApp" : "SMS"}</div>
              <p>{message} {includeSignatureLink ? "Lien : kojibuild.com/s/…" : ""}</p>
              {includePdf ? <div className="send-quote-preview-pdf">Devis_{quoteNumber}.pdf</div> : null}
            </div>
          ) : null}

          <div className="send-quote-checklist">
            <label><input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)} /> Joindre le devis en PDF</label>
            <label><input type="checkbox" checked={includeSignatureLink} onChange={(e) => setIncludeSignatureLink(e.target.checked)} /> Inclure le lien de signature en ligne</label>
            <label><input type="checkbox" checked={includeCredentials} onChange={(e) => setIncludeCredentials(e.target.checked)} /> Inclure l'identifiant et le mot de passe de connexion</label>
            {channelEmail ? <label><input type="checkbox" checked={sendCopyToSelf} onChange={(e) => setSendCopyToSelf(e.target.checked)} /> M'envoyer une copie</label> : null}
          </div>

          <div className="payment-acompte-summary-bar">
            <span>Devis {quoteNumber} · {lotsCount} lot{lotsCount > 1 ? "s" : ""} · {linesCount} ligne{linesCount > 1 ? "s" : ""}</span>
            <strong>{euro(totalTtc)} TTC</strong>
          </div>

          {error ? <p className="profile-message error">{error}</p> : null}

          <div className="send-quote-footer">
            <button type="button" onClick={onClose} disabled={sending}>Annuler</button>
            <button type="button" className="button blue" onClick={submitSend} disabled={sending}>{sending ? "Envoi…" : sendButtonLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
