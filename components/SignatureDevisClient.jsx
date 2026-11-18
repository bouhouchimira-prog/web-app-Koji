"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "../app/client/cli02.css";

// Signature d'un devis par le particulier (maquettes CLI-02 et CLI-07) : un
// seul composant pour l'onglet Devis de Koji Client et la page publique du
// lien de signature, pour que les règles soient au même endroit. Les textes
// et les cases viennent du serveur (lib/signature-devis.js) : information
// de rétractation, mention TVA, démarrage anticipé, acceptation. Aucune case
// n'est cochée d'avance ; la signature se trace à la souris ou au doigt.

function PaveSignature({ onChange, libelle }) {
  const canvas = useRef(null);
  const trace = useRef(false);
  const dernier = useRef(null);
  const [vide, setVide] = useState(true);
  const largeur = useRef(0);
  const image = useRef("");

  // Taille du dessin = taille affichée. Sur téléphone, la barre d'adresse
  // qui se replie déclenche « resize » sans changer la largeur : la
  // signature n'est alors pas touchée ; si la largeur change, elle est
  // redessinée à la nouvelle taille.
  const dimensionner = useCallback(() => {
    const c = canvas.current;
    if (!c) return false;
    const r = c.getBoundingClientRect();
    if (Math.round(r.width) === largeur.current) return false;
    largeur.current = Math.round(r.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#101529";
    if (image.current) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = image.current;
    }
    return true;
  }, []);

  const effacer = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    image.current = "";
    setVide(true);
    onChange("");
  }, [onChange]);

  useEffect(() => {
    dimensionner();
    const surRedim = () => dimensionner();
    window.addEventListener("resize", surRedim);
    return () => window.removeEventListener("resize", surRedim);
  }, [dimensionner]);

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function debut(e) {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    trace.current = true;
    dernier.current = point(e);
    const ctx = canvas.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(dernier.current.x, dernier.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#101529";
    ctx.fill();
  }
  function bouge(e) {
    if (!trace.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = canvas.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(dernier.current.x, dernier.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dernier.current = p;
  }
  function fin() {
    if (!trace.current) return;
    trace.current = false;
    setVide(false);
    image.current = canvas.current.toDataURL("image/png");
    onChange(image.current);
  }

  return (
    <div className="kc2-sig">
      <canvas
        ref={canvas}
        aria-label={libelle}
        role="img"
        onPointerDown={debut}
        onPointerMove={bouge}
        onPointerUp={fin}
        onPointerLeave={fin}
        onPointerCancel={fin}
      />
      {vide ? <span className="kc2-sig-l">{libelle}</span> : <button type="button" className="kc2-sig-x" onClick={effacer}>Effacer</button>}
    </div>
  );
}

function Case({ coche, onChange, children, note }) {
  return (
    <label className="kc-ck">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" /></svg></span>
      <span className="kc2-ck-t">{children}{note ? <small>{note}</small> : null}</span>
    </label>
  );
}

// regles : { retractation, mentionTva: { libelle, texte } | null,
//   demarrage: { libelle } | null, acceptation, preuve }
// identite : { nom, emailMasque } pour la page sans compte (nom et e-mail
//   demandés), null dans Koji Client (le compte suffit).
// onSigner(donnees) : renvoie une promesse ; un message d'erreur s'affiche
//   si elle échoue.
export function SignatureDevisClient({ regles, identite = null, onSigner, libelleSignature = "Signez ici à la souris, ou sur votre téléphone", compact = false, suite = null, note = "" }) {
  const [nom, setNom] = useState(identite?.nom || "");
  const [email, setEmail] = useState("");
  const [mentionTva, setMentionTva] = useState(false);
  const [demandeExpresse, setDemandeExpresse] = useState(false);
  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const surSignature = useCallback((image) => setSignature(image), []);

  if (!regles) return null;
  const manque = !consent || (regles.mentionTva && !mentionTva) || !signature || (identite && !nom.trim());

  async function signer(e) {
    e.preventDefault();
    if (manque || envoi) return;
    setEnvoi(true);
    setErreur("");
    try {
      await onSigner({
        signerName: identite ? nom.trim() : undefined,
        signerEmail: identite ? email.trim() : undefined,
        mentionTva: Boolean(regles.mentionTva) && mentionTva,
        demandeExpresse: Boolean(regles.demarrage) && demandeExpresse,
        demandeExpresseLe: regles.demarrage && demandeExpresse ? new Date().toISOString() : "",
        consent,
        signature
      });
    } catch (error) {
      setErreur(error?.message || "La signature n'a pas pu être enregistrée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="kc2-signer" onSubmit={signer} noValidate>
      {identite ? (
        <>
          <div className="kc-fld">
            <label htmlFor="kc2-nom">Votre nom</label>
            <input id="kc2-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" maxLength={120} required />
          </div>
          <div className="kc-fld">
            <label htmlFor="kc2-email">E-mail (pour recevoir le devis signé)</label>
            <input id="kc2-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={identite.emailMasque || "vous@exemple.fr"} autoComplete="email" maxLength={200} />
            {identite.emailMasque ? <small className="kc2-fld-n">Laissez vide pour l'adresse donnée à l'entreprise ({identite.emailMasque}).</small> : null}
          </div>
        </>
      ) : null}
      {regles.retractation ? <div className="kc-info">{regles.retractation}</div> : null}
      {regles.mentionTva ? (
        <Case coche={mentionTva} onChange={setMentionTva} note={compact ? "" : regles.mentionTva.texte}>{regles.mentionTva.libelle}</Case>
      ) : null}
      {regles.demarrage ? <Case coche={demandeExpresse} onChange={setDemandeExpresse}>{regles.demarrage.libelle}</Case> : null}
      <Case coche={consent} onChange={setConsent}>{regles.acceptation}</Case>
      <PaveSignature onChange={surSignature} libelle={libelleSignature} />
      {erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null}
      <button type="submit" className={`kc-btn${compact ? "" : " sm"} kc2-plein`} disabled={Boolean(manque) || envoi}>{envoi ? "Signature…" : "Signer le devis"}</button>
      {suite}
      <p className="kc-n kc2-preuve">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" /></svg> {note || regles.preuve}
      </p>
    </form>
  );
}
