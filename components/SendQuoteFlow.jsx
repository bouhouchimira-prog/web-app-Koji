"use client";

import { useState } from "react";
import { apiSend } from "../lib/client-api";
import {
  ACOMPTES,
  REGLEMENTS,
  TAUX_TVA,
  VALIDITES,
  erreurEnvoi,
  libelleAcompte,
  libelleReglement,
  libelleTva,
  libelleValidite,
  messageEnvoi,
  nomFichierDevis,
  resumePdf,
  soldeDe,
  texteSms
} from "../lib/devis-envoi";

// Envoyer le devis (maquette PRO-03.2) : panneau par-dessus l'éditeur. Les
// réglages (validité, acompte, règlement, TVA) sont ceux du devis, modifiés
// ici directement ; le devis est enregistré avant l'envoi pour que le PDF
// et le lien de signature partent avec ces valeurs. Envoi : Koji Client
// (lien de signature en ligne et identifiants), e-mail avec le PDF (envoyé
// par Koji), SMS (ouvre l'appli SMS avec le texte prêt, pas d'envoi payant).

function IconCheck() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}

function IconPdf() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM9 12h6M9 16h6" /></svg>;
}

function IconSend() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>;
}

function euro(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function SendQuoteFlow({
  quote,
  quoteNumber,
  client,
  projet,
  debut,
  entreprise,
  totals,
  vatRate,
  onVatRate,
  validityDays,
  onValidity,
  acompte,
  onAcompte,
  soldeLabel,
  onReglement,
  lotsCount,
  linesCount,
  onPreview,
  onSave,
  onClose,
  onSent
}) {
  const [adresse, setAdresse] = useState(client?.email || "");
  const [telephone, setTelephone] = useState(client?.phone || "");
  const [modifierClient, setModifierClient] = useState(!client?.email);
  const [message, setMessage] = useState(() => messageEnvoi({ client: client?.name || "", projet, debut }));
  const [kojiClient, setKojiClient] = useState(true);
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const solde = soldeDe(soldeLabel);
  const reglements = REGLEMENTS.some((r) => r.solde === solde) ? REGLEMENTS : [...REGLEMENTS, { solde, libelle: libelleReglement(soldeLabel) }];
  const taux = TAUX_TVA.includes(Number(vatRate)) ? TAUX_TVA : [...TAUX_TVA, Number(vatRate)];
  const canaux = [
    { id: "koji", label: "Koji Client, avec signature en ligne", on: kojiClient, set: setKojiClient },
    { id: "email", label: "E-mail avec le PDF", on: email, set: setEmail },
    { id: "sms", label: "SMS de notification", on: sms, set: setSms }
  ];

  async function envoyer() {
    const manque = erreurEnvoi({ kojiClient, email, sms, adresse, telephone });
    if (manque) {
      setErreur(manque);
      return;
    }
    if (quote?.signatureStatus === "Signe" && !window.confirm("Ce devis est déjà signé. L'envoyer à nouveau effacera la signature existante. Continuer ?")) return;
    setEnvoi(true);
    setErreur("");
    try {
      // Enregistre d'abord : le PDF et la signature partent avec les
      // réglages choisis ici.
      const enregistre = await onSave?.();
      const id = enregistre?.id || quote?.id;
      if (!id) throw new Error("Le devis n'a pas pu être enregistré.");
      const { quote: envoye, emailSent, emailError } = await apiSend("/api/quotes", {
        id,
        action: "send",
        clientEmail: adresse.trim(),
        clientPhone: telephone.trim(),
        sendEmail: email,
        emailSubject: `Devis ${quoteNumber}${entreprise ? ` · ${entreprise}` : ""}`,
        emailMessage: message,
        includePdf: true,
        includeSignatureLink: kojiClient,
        includeCredentials: kojiClient,
        canalSms: sms,
        ...(quote?.signatureStatus === "Signe" ? { confirmReopenSigned: true } : {})
      }, "PATCH");

      if (sms) {
        const acces = envoye?.signatureClientAccess || {};
        const texte = texteSms({ message, lien: acces.loginUrl || envoye?.signatureUrl, identifiant: acces.identifier, motDePasse: acces.password, kojiClient });
        window.open(`sms:${telephone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(texte)}`);
      }
      if (email && emailSent === false) {
        setErreur(`${emailError || "L'e-mail n'est pas parti."} Le devis est bien marqué envoyé : renvoie-le depuis la liste des devis.`);
        onSent?.(envoye, { silent: true });
        return;
      }
      onSent?.(envoye, { silent: false });
    } catch (err) {
      setErreur(err.message || "Impossible d'envoyer le devis.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel sq-env" role="dialog" aria-modal="true" aria-label="Envoyer le devis">
        <div className="env-h">
          <h2>Envoyer le devis</h2>
          <button type="button" className="link" onClick={onClose} disabled={envoi}>Fermer</button>
        </div>

        <div className="env-sum">
          <div>
            <span className="lab">Client</span>
            <strong>{client?.name || "Client"}</strong>
            {modifierClient ? (
              <span className="sq-cli">
                <input type="email" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="E-mail du client" aria-label="E-mail du client" />
                <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" aria-label="Téléphone du client" />
              </span>
            ) : (
              <span className="muted">
                {[adresse, telephone].filter(Boolean).join(" · ") || "coordonnées à renseigner"}{" "}
                <button type="button" className="sq-mod" onClick={() => setModifierClient(true)}>Modifier</button>
              </span>
            )}
          </div>
          <div>
            <span className="lab">Devis {quoteNumber}</span>
            <strong>{euro(totals?.ht)} HT</strong>
            <span className="muted">TVA {String(vatRate).replace(".", ",")} % {euro(totals?.tva)} · {euro(totals?.ttc)} TTC</span>
          </div>
        </div>

        <div className="env-grid">
          <label className="ed">
            <span className="ed-l">Validité</span>
            <select className="selv" value={Number(validityDays) || 30} onChange={(e) => onValidity?.(Number(e.target.value))}>
              {VALIDITES.map((j) => <option key={j} value={j}>{libelleValidite(j, aujourdhui())}</option>)}
            </select>
          </label>
          <label className="ed">
            <span className="ed-l">Acompte à la signature</span>
            <select className="selv" value={Number(acompte) || 0} onChange={(e) => onAcompte?.(Number(e.target.value))}>
              {(ACOMPTES.includes(Number(acompte) || 0) ? ACOMPTES : [...ACOMPTES, Number(acompte)].sort((a, b) => a - b)).map((p) => (
                <option key={p} value={p}>{libelleAcompte(p, totals?.ttc)}</option>
              ))}
            </select>
          </label>
          <label className="ed">
            <span className="ed-l">Règlement</span>
            <select className="selv" value={solde} onChange={(e) => onReglement?.(`Solde — ${e.target.value}`)}>
              {reglements.map((r) => <option key={r.solde} value={r.solde}>{r.libelle}</option>)}
            </select>
          </label>
          <label className="ed">
            <span className="ed-l">TVA réduite</span>
            <select className="selv" value={Number(vatRate)} onChange={(e) => onVatRate?.(Number(e.target.value))}>
              {taux.map((t) => <option key={t} value={t}>{libelleTva(t)}</option>)}
            </select>
          </label>
        </div>

        <label className="ed">
          <span className="ed-l">Message au client</span>
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        <div className="env-ch">
          <span className="lab">Envoi</span>
          {canaux.map((c) => (
            <label key={c.id} className={`ck${c.on ? " on" : ""}`}>
              <input type="checkbox" checked={c.on} onChange={(e) => c.set(e.target.checked)} />
              {c.on ? <IconCheck /> : null}
              {c.label}
            </label>
          ))}
        </div>

        <div className="env-pdf">
          <IconPdf />
          <div>
            <strong>{nomFichierDevis(quoteNumber, client?.name)}</strong>
            <span className="muted">{resumePdf(linesCount, lotsCount)}</span>
          </div>
          <button type="button" className="link" onClick={onPreview} disabled={envoi}>Aperçu</button>
        </div>

        {erreur ? <p className="err" role="alert">{erreur}</p> : null}

        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={envoi}>Retour au devis</button>
          <button type="button" className="btn btn-main" onClick={envoyer} disabled={envoi}>
            <IconSend />{envoi ? "Envoi…" : "Envoyer le devis"}
          </button>
        </div>
      </section>
    </>
  );
}
