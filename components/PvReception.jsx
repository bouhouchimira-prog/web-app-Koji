"use client";

import { useRef, useState } from "react";
import { apiSend } from "../lib/client-api";
import { euro } from "../lib/cloture-chantier";
import { pourLe as pourLeReserve, reservesNonLevees } from "../lib/reserves";
import { SignaturePad } from "./SignaturePad";

// Procès-verbal de réception signé sur place (maquette PRO-02.4, écran
// « Réception · PV signé sur le téléphone ») : réserves non levées inscrites,
// travaux réceptionnés, signature du client puis la vôtre. Le serveur fige
// la date, le numéro et les réserves (app/api/cloture/route.js).
export function PvReception({ project, quote, reserves, travaux, solde, onClose, onSigned }) {
  const clientRef = useRef(null);
  const proRef = useRef(null);
  const [signataire, setSignataire] = useState(quote?.client || project?.client || "");
  const [clientVide, setClientVide] = useState(true);
  const [proVide, setProVide] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const ouvertes = reservesNonLevees(reserves);
  const aujourdhui = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date());

  async function valider() {
    setEnvoi(true);
    setErreur("");
    try {
      const { cloture } = await apiSend("/api/cloture", {
        projectId: project.id,
        signataire,
        signatureClient: clientRef.current.toDataURL(),
        signaturePro: proRef.current.toDataURL(),
        source: "site"
      });
      onSigned(cloture);
    } catch (error) {
      setErreur(error.message || "Le procès-verbal n'a pas pu être enregistré.");
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel cl-pv" role="dialog" aria-modal="true" aria-label="Procès-verbal de réception">
        <div className="env-h">
          <div>
            <h2>Procès-verbal de réception</h2>
            <span className="muted">{[project.title, aujourdhui].join(" · ")}</span>
          </div>
          <button type="button" className="link" onClick={onClose} disabled={envoi}>Fermer</button>
        </div>

        <div className="rs-card">
          <strong>{ouvertes.length ? `Réception avec ${ouvertes.length} réserve${ouvertes.length > 1 ? "s" : ""}` : "Réception sans réserve"}</strong>
          {ouvertes.map((r) => (
            <small key={r.id}>{[r.numero, r.titre, r.pourLe ? `à lever avant le ${pourLeReserve(r)}` : "à lever"].join(" · ")}</small>
          ))}
        </div>
        <div className="rs-card">
          <strong>Travaux réceptionnés</strong>
          <small>{travaux}</small>
        </div>
        {solde?.tauxRetenue ? (
          <div className="rs-card">
            <strong>Retenue de garantie {solde.tauxRetenue} %</strong>
            <small>{euro(solde.retenueTtc)} TTC, libérable un an après cette réception si aucune réserve n'est en cours</small>
          </div>
        ) : null}

        <label className="cl-who">
          <span className="lab">Signe pour le client</span>
          <input value={signataire} onChange={(event) => setSignataire(event.target.value)} maxLength={120} placeholder="Nom et prénom" />
        </label>
        <SignaturePad ref={clientRef} label={`Signature de ${signataire || "votre client"}`} onChange={setClientVide} />
        <SignaturePad ref={proRef} label="Votre signature" onChange={setProVide} />
        <p className="muted cl-pv-n">La date et l'heure sont posées par Koji. Les garanties partent de ce jour ; le PV signé est rangé avec le chantier.</p>
        {erreur ? <p className="cl-err" role="alert">{erreur}</p> : null}

        <div className="env-act">
          <button type="button" className="btn btn-main" onClick={valider} disabled={envoi || clientVide || proVide || !signataire.trim()}>
            {envoi ? "Enregistrement…" : "Valider la réception"}
          </button>
        </div>
      </section>
    </>
  );
}
