"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { apiSend } from "../lib/client-api";
import { MENTION_TAUX_REDUIT, estTauxReduit } from "../lib/tva";
import {
  LIEUX_SIGNATURE,
  acompteAPartirDu,
  demarrageAvantFin,
  finRetractation,
  libelleLundi,
  lundiApres,
  masquerEmail,
  reglesSignature,
  texteAcompte,
  texteDemandeExpresse,
  texteRetractation
} from "../lib/signature-lieu";
import { SignaturePad } from "./SignaturePad";

// Signature et rétractation (maquette PRO-03.7) : « Envoyer pour signature »
// ou « Faire signer maintenant » sur l'appareil de l'entreprise, chez le
// client (ou « dans vos locaux »). Koji applique seul les règles du lieu :
// rétractation, aucun paiement avant 7 jours au domicile, démarrage avant
// la fin du délai sur demande expresse, mention TVA, exemplaire du client.
// Les cases sont cochées par le client lui-même, jamais à l'avance.

const aujourdhui = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

function court(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

function euro(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}


function TableRegles() {
  const regles = LIEUX_SIGNATURE.map((l) => reglesSignature(l.id));
  const lignes = [
    ["Droit de rétractation", regles.map((r) => (r.retractation ? "14 jours" : "non"))],
    ["Paiement avant 7 jours", regles.map((r) => (r.paiementAvant7Jours === "interdit" ? "interdit" : r.retractation ? "possible, remboursable" : "possible"))],
    ["Formulaire de rétractation", regles.map((r) => (r.formulaire ? "joint" : "—"))],
    ["Démarrage avant la fin du délai", regles.map((r) => (r.demarrageAvantFin === "libre" ? "libre" : "demande expresse"))]
  ];
  return (
    <div className="fs-regles">
      <div className="fs-r fs-rh"><span /> {LIEUX_SIGNATURE.map((l) => <span key={l.id}>{l.label}</span>)}</div>
      {lignes.map(([titre, valeurs]) => (
        <div className="fs-r" key={titre}><span>{titre}</span>{valeurs.map((v, i) => <b key={i}>{v}</b>)}</div>
      ))}
      <p className="muted">Client professionnel (société, syndic, SCI à l'IS…) : pas de droit de rétractation, sauf petite entreprise hors de son activité principale.</p>
    </div>
  );
}

export function FaireSigner({ quote, client, totals, acomptePct, debut, onEnvoyer, onDecaler, onClose, onSigne }) {
  const [etape, setEtape] = useState("choix");
  const [lieu, setLieu] = useState("domicile");
  const [proposerDemarrage, setProposerDemarrage] = useState(true);
  const [pourquoi, setPourquoi] = useState(false);
  const [cases, setCases] = useState({});
  const [nom, setNom] = useState(client?.name || "");
  const [signature, setSignature] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState(null);
  const padRef = useRef(null);

  const jour = aujourdhui();
  const particulier = quote.clientType !== "societe";
  const regles = reglesSignature(lieu, quote.clientType);
  const fin = finRetractation(jour, lieu, quote.clientType);
  const acompteDate = acompteAPartirDu(jour, lieu, quote.clientType);
  const acompteTtc = Number(totals?.ttc || 0) * (Number(acomptePct) || 0) / 100;
  const avantFin = regles.retractation && demarrageAvantFin(debut, fin);
  const reduit = !quote.autoliquidation && (estTauxReduit(quote.vatRate) || (quote.items || []).some((item) => estTauxReduit(item.tauxTva)));
  const nomClient = client?.name || "le client";
  const version = Number(quote.versions?.at(-1)?.number || quote.versionNumber || 1);
  const peutSigner = signature && nom.trim() && (!reduit || cases.mentionTva);

  function cocher(cle, valeur) {
    setCases((c) => ({ ...c, [cle]: valeur, [`${cle}Le`]: valeur ? new Date().toISOString() : "" }));
  }

  async function signer() {
    if (!peutSigner) return;
    setEnvoi(true);
    setErreur("");
    try {
      const { quote: signe, exemplaire } = await apiSend("/api/quotes", {
        id: quote.id,
        action: "signer-sur-place",
        lieu,
        signerName: nom.trim(),
        signature: padRef.current?.toDataURL() || "",
        consentements: {
          demandeExpresse: Boolean(cases.demandeExpresse),
          demandeExpresseLe: cases.demandeExpresseLe || "",
          mentionTva: Boolean(cases.mentionTva),
          mentionTvaLe: cases.mentionTvaLe || "",
          exemplaireEmail: Boolean(cases.exemplaireEmail),
          exemplaireEmailLe: cases.exemplaireEmailLe || ""
        }
      }, "PATCH");
      setResultat({ quote: signe, exemplaire });
      setEtape("fait");
      onSigne?.(signe);
    } catch (error) {
      setErreur(error.message || "La signature n'a pas pu être enregistrée.");
    } finally {
      setEnvoi(false);
    }
  }

  // Écran tendu au client : plein écran, rien d'autre.
  if (etape === "client") {
    return (
      <div className="fs-client" role="dialog" aria-modal="true" aria-label={`Signature de ${nomClient}`}>
        <div className="fs-client-in">
          <div className="fs-client-h">
            <strong>Avant de signer</strong>
            <span className="muted">à lire par {nomClient}</span>
          </div>
          <div className="card fs-devis">
            <span className="lab">Votre devis</span>
            <strong>{quote.project || "Travaux"} · version {version}</strong>
            <b>{euro(totals?.ttc)} TTC</b>
            {acomptePct > 0 ? <span className="muted">{texteAcompte(acomptePct, acompteTtc, acompteDate)}</span> : null}
          </div>
          {regles.retractation ? (
            <div className="card">
              <strong>Votre droit de rétractation</strong>
              <p>{texteRetractation(fin)}</p>
            </div>
          ) : null}
          {avantFin && proposerDemarrage ? (
            <label className={`ck${cases.demandeExpresse ? " on" : ""}`}>
              <input type="checkbox" checked={Boolean(cases.demandeExpresse)} onChange={(e) => cocher("demandeExpresse", e.target.checked)} />
              <span>{texteDemandeExpresse(debut)}</span>
            </label>
          ) : null}
          {reduit ? (
            <label className={`ck${cases.mentionTva ? " on" : ""}`}>
              <input type="checkbox" checked={Boolean(cases.mentionTva)} onChange={(e) => cocher("mentionTva", e.target.checked)} />
              <span>
                Logement de plus de 2 ans, à usage d'habitation · mention pour la TVA à {String(quote.vatRate).replace(".", ",")} %
                <small>{MENTION_TAUX_REDUIT}</small>
              </span>
            </label>
          ) : null}
          {quote.clientEmail ? (
            <label className={`ck${cases.exemplaireEmail ? " on" : ""}`}>
              <input type="checkbox" checked={Boolean(cases.exemplaireEmail)} onChange={(e) => cocher("exemplaireEmail", e.target.checked)} />
              <span>Je reçois mon exemplaire par e-mail · {masquerEmail(quote.clientEmail)}<small>sinon l'entreprise l'imprime</small></span>
            </label>
          ) : null}
          <p className="muted fs-note">Cases cochées par {nomClient}, jamais à l'avance.</p>
          <label className="ed">
            <span className="ed-l">Nom du signataire</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <SignaturePad ref={padRef} label={`Signature de ${nomClient}`} onChange={(vide) => setSignature(!vide)} />
          {erreur ? <p className="err" role="alert">{erreur}</p> : null}
          <div className="fs-client-act">
            <button type="button" className="btn btn-sec" onClick={() => setEtape("resume")} disabled={envoi}>Retour</button>
            <button type="button" className="btn btn-main" onClick={signer} disabled={!peutSigner || envoi}>{envoi ? "Signature…" : "Signer"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel fs-env" role="dialog" aria-modal="true" aria-label="Faire signer">
        <div className="env-h">
          <h2>{etape === "fait" ? "Devis signé" : `Faire signer la version ${version}`}</h2>
          <button type="button" className="link" onClick={onClose}>Fermer</button>
        </div>

        {etape === "choix" ? (
          <>
            <button type="button" className="fs-choix" onClick={onEnvoyer}>
              <strong>Envoyer pour signature</strong>
              <span className="muted">{nomClient} signe en ligne, dans son espace Koji</span>
            </button>
            <button type="button" className="fs-choix" onClick={() => { setLieu("domicile"); setEtape("resume"); }}>
              <strong>Faire signer maintenant</strong>
              <span className="muted">sur cet appareil, chez {nomClient}</span>
            </button>
            <button type="button" className="link fs-locaux" onClick={() => { setLieu("locaux"); setEtape("resume"); }}>Vous êtes dans vos locaux ?</button>
            <div className="card">
              <div className="card-h"><h2>Ce que Koji applique selon le lieu de signature</h2><span className="muted">client particulier</span></div>
              <TableRegles />
            </div>
          </>
        ) : null}

        {etape === "resume" ? (
          <>
            <div className="card fs-res">
              <div className="card-h">
                <h2>Signé {lieu === "locaux" ? "dans vos locaux" : `chez ${particulier ? "un client particulier" : "un client professionnel"}`}</h2>
                <span className="muted">{particulier ? "particulier" : "professionnel"} d'après sa fiche contact · Koji applique ces règles seul</span>
              </div>
              {regles.retractation ? (
                <div className="kv"><span>Rétractation jusqu'au {court(fin)} inclus</span><b>14 jours à partir de la signature le {court(jour)} · formulaire joint au devis signé</b></div>
              ) : (
                <div className="kv"><span>Pas de droit de rétractation</span><b>{particulier ? "signé dans vos locaux" : "client professionnel"}</b></div>
              )}
              {acompteDate ? (
                <div className="kv"><span>Aucun paiement avant le {court(acompteDate)}</span><b>{acomptePct > 0 ? `facture d'acompte (${euro(acompteTtc)} TTC) à envoyer à partir du ${court(acompteDate)}` : "aucun acompte prévu"}</b></div>
              ) : null}
              {avantFin ? (
                <div className="kv fs-dem">
                  <span>Démarrage prévu le {court(debut)}, avant la fin du délai</span>
                  <b>{nomClient} pourra le demander en cochant une case à la signature ; sinon vous décalez</b>
                  <div className="fs-dem-act">
                    <button type="button" className={`btn btn-sec${proposerDemarrage ? " on" : ""}`} aria-pressed={proposerDemarrage} onClick={() => setProposerDemarrage(true)}>Lui proposer de commencer le {court(debut)}</button>
                    <button type="button" className="btn btn-sec" onClick={() => { onDecaler?.(lundiApres(fin)); setProposerDemarrage(false); }}>Décaler au {libelleLundi(lundiApres(fin))}</button>
                  </div>
                </div>
              ) : null}
              {reduit ? <div className="kv"><span>Mention TVA {String(quote.vatRate).replace(".", ",")} %</span><b>certifiée par le client à la signature</b></div> : null}
              <div className="kv"><span>Exemplaire de {nomClient}</span><b>{quote.clientEmail ? "par e-mail s'il l'accepte, sinon PDF à imprimer" : "PDF à imprimer (pas d'e-mail sur la fiche)"}</b></div>
            </div>
            <button type="button" className="link" onClick={() => setPourquoi((v) => !v)}>Pourquoi ces règles ?</button>
            {pourquoi ? (
              <div className="card fs-pourquoi">
                <p className="muted">Signé chez le client (hors établissement) : 14 jours de rétractation à partir de la signature, information et formulaire obligatoires, aucun paiement avant 7 jours, démarrage pendant le délai seulement à sa demande expresse (Code de la consommation, L221-18, L221-10, L221-25). Sans cette information, le client peut se rétracter même après les travaux. En ligne : 14 jours aussi. Dans vos locaux : pas de rétractation.</p>
                <TableRegles />
              </div>
            ) : null}
            <div className="env-act">
              <button type="button" className="btn btn-sec" onClick={() => setEtape("choix")}>Retour</button>
              <button type="button" className="btn btn-main" onClick={() => { setCases({}); setEtape("client"); }}>Passer {lieu === "locaux" ? "la main" : "le téléphone"} à {nomClient}</button>
            </div>
          </>
        ) : null}

        {etape === "fait" && resultat ? (
          <>
            <div className="card fs-res">
              <div className="card-h">
                <h2>{quote.project || "Devis"}</h2>
                <span className="signed"><span className="seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg></span>Signé</span>
              </div>
              <p className="muted">Signé {lieu === "locaux" ? "dans vos locaux" : "chez le client"} · version {version} · {euro(totals?.ttc)} TTC</p>
              <div className="kv">
                <span>Exemplaire</span>
                <b>
                  {resultat.exemplaire?.email ? `envoyé par e-mail${fin ? " avec le formulaire de rétractation" : ""}` : (
                    <a className="link" href={`/api/quotes/${quote.id}/documents?type=quote&format=pdf&preview=1`} target="_blank" rel="noreferrer">PDF à imprimer</a>
                  )}
                </b>
              </div>
              {resultat.quote.acompteAPartirDu ? <div className="kv"><span>Acompte bloqué jusqu'au {court(resultat.quote.acompteAPartirDu)}</span><b>facture à envoyer à partir de cette date</b></div> : null}
              {resultat.quote.retractationJusquau ? (
                <div className="kv"><span>Fin du délai le {court(resultat.quote.retractationJusquau)}</span><b>{resultat.quote.demarrageDemande ? `démarrage le ${court(resultat.quote.demarrageDemande)} demandé par ${nomClient}` : "pas de démarrage avant cette date"}</b></div>
              ) : null}
              {resultat.quote.retractationJusquau ? (
                <p className="muted">Si {nomClient} se rétracte : devis annulé, chantier retiré du planning, remboursement à faire sous 14 jours. Koji vous prévient.</p>
              ) : null}
            </div>
            {resultat.quote.projectId ? (
              <div className="env-act">
                <Link className="btn btn-main" href={`/chantiers?project=${resultat.quote.projectId}&lancer=1`}>Lancer le chantier</Link>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}

