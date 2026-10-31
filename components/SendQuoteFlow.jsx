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

  const channels = [
    { id: "email", label: "E-mail", detail: selected.email || "—", checked: channelEmail, set: setChannelEmail },
    { id: "whatsapp", label: "WhatsApp", detail: selected.phone || "—", checked: channelWhatsapp, set: setChannelWhatsapp },
    { id: "sms", label: "SMS", detail: selected.phone || "—", checked: channelSms, set: setChannelSms }
  ];

  return (
    <div className="pmodal-bg" onClick={() => !sending && onClose?.()}>
      <div className="pmodal sq" role="dialog" aria-modal="true" aria-label="Envoyer le devis" onClick={(event) => event.stopPropagation()}>
        <div className="card-h">
          <h2>Envoyer le devis</h2>
          <button type="button" className="link" onClick={onClose} disabled={sending}>Fermer</button>
        </div>
        <p className="muted">Choisissez le client et les canaux. Il pourra lire et signer le devis depuis son téléphone.</p>

        <div className="pm-sec">
          <div className="kp-seg" role="group" aria-label="Origine du client">
            <button type="button" className={destinataireMode === "existing" ? "on" : ""} aria-pressed={destinataireMode === "existing"} onClick={() => setDestinataireMode("existing")}>Client existant</button>
            <button type="button" className={destinataireMode === "marketplace" ? "on" : ""} aria-pressed={destinataireMode === "marketplace"} onClick={openMarketplaceTab}>Client du Radar</button>
          </div>

          <h3>Destinataire</h3>
          {destinataireMode === "existing" ? (
            <>
              <label className="search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
                <input value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} placeholder="Rechercher un contact…" aria-label="Rechercher un contact" />
              </label>
              <div className="sq-list">
                <button type="button" className={`sq-pick${selected.key === "current" ? " on" : ""}`} aria-pressed={selected.key === "current"} onClick={() => pickContact(quote?.client || "Client", quote?.clientEmail || "", quote?.clientPhone || "", "current")}>
                  <b>{quote?.client || "Client"}</b>
                  <small>{[quote?.clientEmail, quote?.clientPhone].filter(Boolean).join(" · ") || "coordonnées à renseigner"}</small>
                </button>
                {filteredContacts.map((contact) => (
                  <button
                    type="button"
                    key={contact.id}
                    className={`sq-pick${selected.key === contact.id ? " on" : ""}`}
                    aria-pressed={selected.key === contact.id}
                    onClick={() => pickContact(contactDisplayName(contact), contact.email || "", contact.phone || "", contact.id)}
                  >
                    <b>{contactDisplayName(contact)}</b>
                    <small>{[contact.email, contact.phone].filter(Boolean).join(" · ")}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="sq-list">
              {marketplaceError ? <p className="err" role="alert">{marketplaceError}</p> : null}
              {!marketplaceError && marketplaceContacts === null ? <p className="muted">Chargement…</p> : null}
              {!marketplaceError && marketplaceContacts && !marketplaceContacts.length ? (
                <p className="muted">Aucun chantier avec un RDV confirmé pour l'instant.</p>
              ) : null}
              {(marketplaceContacts || []).map((chantier) => (
                <button
                  type="button"
                  key={chantier.offerId}
                  className={`sq-pick${selected.key === chantier.offerId ? " on" : ""}`}
                  aria-pressed={selected.key === chantier.offerId}
                  onClick={() => pickContact(chantier.clientName, chantier.clientEmail || "", chantier.clientPhone || "", chantier.offerId)}
                >
                  <b>{chantier.clientName}</b>
                  <small>{chantier.description || chantier.address}</small>
                  <small>{[chantier.clientPhone, chantier.clientEmail].filter(Boolean).join(" · ")}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pm-sec">
          <h3>Canaux</h3>
          <div className="sq-channels">
            {channels.map((channel) => (
              <label key={channel.id} className={`sq-ch${channel.checked ? " on" : ""}`}>
                <input type="checkbox" checked={channel.checked} onChange={(e) => channel.set(e.target.checked)} />
                <span><b>{channel.label}</b><small>{channel.detail}</small></span>
              </label>
            ))}
          </div>
        </div>

        <div className="fgrid">
          {channelEmail ? (
            <label className="full">Objet<input value={objet} onChange={(e) => setObjet(e.target.value)} /></label>
          ) : null}
          <label className="full">Message<textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        </div>

        {(channelWhatsapp || channelSms) ? (
          <div className="sq-preview">
            <span className="flab">Aperçu · {channelWhatsapp ? "WhatsApp" : "SMS"}</span>
            <p>{message} {includeSignatureLink ? "Lien : kojibuild.com/s/…" : ""}</p>
            {includePdf ? <span className="tag tag-o">Devis_{quoteNumber}.pdf</span> : null}
          </div>
        ) : null}

        <div className="sq-checks">
          <label className="chk"><input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)} /> Joindre le devis en PDF</label>
          <label className="chk"><input type="checkbox" checked={includeSignatureLink} onChange={(e) => setIncludeSignatureLink(e.target.checked)} /> Inclure le lien de signature en ligne</label>
          <label className="chk"><input type="checkbox" checked={includeCredentials} onChange={(e) => setIncludeCredentials(e.target.checked)} /> Inclure l'identifiant et le mot de passe de connexion</label>
          {channelEmail ? <label className="chk"><input type="checkbox" checked={sendCopyToSelf} onChange={(e) => setSendCopyToSelf(e.target.checked)} /> M'envoyer une copie</label> : null}
        </div>

        <div className="kv kv-strong">
          <span>Devis {quoteNumber} · {lotsCount} lot{lotsCount > 1 ? "s" : ""} · {linesCount} ligne{linesCount > 1 ? "s" : ""}</span>
          <b>{euro(totalTtc)} TTC</b>
        </div>

        {error ? <p className="err" role="alert">{error}</p> : null}

        <div className="pm-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={sending}>Annuler</button>
          <button type="button" className="btn btn-main" onClick={submitSend} disabled={sending}>{sending ? "Envoi…" : sendButtonLabel}</button>
        </div>
      </div>
    </div>
  );
}
