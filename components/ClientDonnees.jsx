"use client";

import { useState } from "react";

// Koji Client · « Mes données » (maquettes CLI-03 et CLI-06) : télécharger
// ses données (/api/account/export, RGPD art. 20) et demander la
// suppression du compte (/api/account/deletion-request, RGPD art. 17 :
// demande enregistrée, traitée par l'équipe sous 30 jours ; devis et
// factures restent chez chaque entreprise pendant la durée légale).

const Doc = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM14 3v5h5" /></svg>;

function useExport() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  async function telecharger() {
    setEnCours(true);
    setErreur("");
    try {
      const r = await fetch("/api/account/export", { credentials: "same-origin" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Téléchargement impossible.");
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `koji-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErreur(e.message || "Téléchargement impossible.");
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, telecharger };
}

function LigneTelecharger({ libelle = "Télécharger mes données", detail = "projets, messages, notifications, en un fichier" }) {
  const { enCours, erreur, telecharger } = useExport();
  return (
    <>
      <button type="button" className="kc3-row" onClick={telecharger} disabled={enCours}>
        <span className="ic"><Doc /></span>
        <div><strong>{libelle}</strong><small>{enCours ? "préparation du fichier…" : detail}</small></div>
        <span aria-hidden="true">›</span>
      </button>
      {erreur ? <p className="kc3-err" role="alert">{erreur}</p> : null}
    </>
  );
}

// Liste « Mes données » : télécharger, puis l'entrée vers la suppression.
export function ClientDonnees({ onSupprimer, lienSupprimer }) {
  const contenu = <div><strong>Supprimer mon compte</strong><small>sous 30 jours ; les factures restent chez l'entreprise</small></div>;
  return (
    <div className="kc3-list">
      <LigneTelecharger />
      {lienSupprimer
        ? <a className="kc3-row" href={lienSupprimer}>{contenu}<span aria-hidden="true">›</span></a>
        : <button type="button" className="kc3-row" onClick={onSupprimer}>{contenu}<span aria-hidden="true">›</span></button>}
    </div>
  );
}

// Écran « Supprimer mon compte » : délai, documents à télécharger avant,
// case explicite non cochée, bouton de suppression en contour.
export function ClientSuppression({ onGarder }) {
  const [compris, setCompris] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState("");

  async function supprimer() {
    if (!compris) return;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: "", accountType: "particulier" })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "La demande n'est pas partie. Réessayez.");
      setFait(true);
    } catch (e) {
      setErreur(e.message || "La demande n'est pas partie. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) {
    return (
      <div className="kc3-list" role="status">
        <p className="kc-p"><b>Demande enregistrée.</b> Vos projets, messages et photos seront effacés sous 30 jours.</p>
        <p className="kc-s">Pour l'annuler d'ici là, écrivez à <a className="kc3-lien" href="mailto:contact@getkoji.io">contact@getkoji.io</a>.</p>
      </div>
    );
  }

  return (
    <div className="kc3-list">
      <p className="kc-p">Vos projets, messages et photos seront effacés sous 30 jours. Pour changer d'avis avant, écrivez à contact@getkoji.io.</p>
      <div className="kc-info">Les devis signés et les factures sont conservés par chaque entreprise pendant la durée légale ; vous pouvez les télécharger avant.</div>
      <LigneTelecharger libelle="Télécharger mes données" detail="projets, messages, notifications, en un fichier" />
      <label className="kc-ck">
        <input type="checkbox" checked={compris} onChange={(e) => setCompris(e.target.checked)} />
        <span>{compris ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg> : null}</span>
        Je comprends que mon compte et mes projets seront supprimés
      </label>
      {erreur ? <p className="kc3-err" role="alert">{erreur}</p> : null}
      <button type="button" className="kc3-del" onClick={supprimer} disabled={!compris || envoi}>{envoi ? "Envoi…" : "Supprimer mon compte"}</button>
      <button type="button" className="kc-sec" onClick={onGarder}>Garder mon compte</button>
    </div>
  );
}
