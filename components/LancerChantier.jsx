"use client";

import { useMemo, useState } from "react";
import { apiSend } from "../lib/client-api";
import { demarragePropose, proposerPlanning } from "../lib/planning-chantier";

// Lancer le chantier (maquette PRO-02.1, panneau « env-panel wide ») : Koji
// propose le planning par lot depuis le devis signé (lib/planning-chantier.js),
// l'artisan ajuste la date de démarrage, la durée et l'équipe de chaque lot,
// puis « Créer le chantier » planifie chaque ligne du devis (une tâche par
// ligne, aux dates de son lot) et met le client en suivi dans Koji Client.
// Pas encore construits, donc absents : l'invitation des sous-traitants sur
// leurs lots (Réseau pro), le rappel URSSAF / décennale, le partage du
// planning au client.

function IconCal() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconCheck() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}

function euro(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
}

function jour(iso, options = { day: "numeric", month: "short" }) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", options).format(d) : "";
}

function jourLong(iso) {
  const t = jour(iso, { weekday: "long", day: "numeric", month: "short" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

export function LancerChantier({ project, quote, tasks, workers, hoursPerDay = 7, clientPortalAccess, invoices = [], onClose, onDone }) {
  const [debut, setDebut] = useState(() => demarragePropose(aujourdhui()));
  const [durees, setDurees] = useState({});
  const [equipes, setEquipes] = useState({}); // lot → workerId ("" = équipe)
  const [modifier, setModifier] = useState(false);
  const clientEmail = String(quote?.clientEmail || quote?.clientPortalEmail || "").trim();
  const clientPhone = String(quote?.clientPhone || quote?.clientPortalPhone || "").trim();
  const suiviDeja = Boolean(clientPortalAccess);
  const [suiviClient, setSuiviClient] = useState(!suiviDeja && Boolean(clientEmail || clientPhone));
  const [etat, setEtat] = useState({ status: "idle", fait: 0, total: 0, error: "" });

  const planning = useMemo(() => proposerPlanning(quote, { debut, heuresParJour: hoursPerDay, durees }), [quote, debut, hoursPerDay, durees]);
  const acompte = invoices.find((f) => f.kind === "acompte" && f.status !== "Brouillon");
  const signeLe = quote?.signedAt || quote?.signatureDate || "";

  function equipeDe(lot) {
    const w = workers.find((x) => x.id === equipes[lot]);
    if (!w) return "Équipe";
    return `${w.name}${w.type === "Sous-traitant" ? " · sous-traitant" : ""}`;
  }

  async function creer() {
    const lignes = planning.lots.flatMap((lot) => lot.lignes.map((l) => ({ lot, ...l })));
    setEtat({ status: "envoi", fait: 0, total: lignes.length, error: "" });
    const enregistrees = [];
    try {
      for (const [i, { lot, cle, ligne, heures }] of lignes.entries()) {
        const workerId = equipes[lot.nom] || "";
        const worker = workers.find((w) => w.id === workerId);
        const existante = tasks.find((t) => t.quoteItemId === cle) || tasks.find((t) => t.label === ligne.label && (t.room || "") === (ligne.room || ""));
        const payload = {
          label: existante?.label || ligne.label || "Ouvrage",
          project: project.title,
          projectId: project.id,
          quoteId: quote.id,
          quoteItemId: cle,
          code: ligne.code || "",
          room: ligne.room || "Chantier",
          unit: ligne.unit || "",
          quantity: Number(ligne.quantity || 0),
          startDate: lot.debut,
          endDate: lot.fin,
          dueDate: lot.fin,
          durationHours: heures || 1,
          workerIds: workerId ? [workerId] : [],
          assignedTo: worker?.name || "Equipe",
          participantType: worker?.type === "Sous-traitant" ? "Sous-traitants" : "Ouvriers",
          status: "Planifiee"
        };
        const { task } = existante
          ? await apiSend("/api/tasks", { id: existante.id, ...payload }, "PATCH")
          : await apiSend("/api/tasks", payload);
        enregistrees.push(task);
        setEtat((e) => ({ ...e, fait: i + 1 }));
      }
      if (suiviClient && !suiviDeja) {
        await apiSend("/api/client-portal-info", { projectId: project.id, email: clientEmail, phone: clientPhone }).catch(() => null);
      }
      onDone?.({ taches: enregistrees, planning });
    } catch (error) {
      setEtat((e) => ({ ...e, status: "idle", error: error.message || "La création n'a pas abouti. Les lots déjà planifiés sont gardés." }));
      if (enregistrees.length) onDone?.({ taches: enregistrees, planning, partiel: true });
    }
  }

  const envoi = etat.status === "envoi";

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel wide" role="dialog" aria-modal="true" aria-label="Lancer le chantier">
        <div className="env-h">
          <h2>Lancer le chantier</h2>
          <button type="button" className="link" onClick={onClose} disabled={envoi}>Fermer</button>
        </div>

        <div className="env-sum">
          <div>
            <span className="lab">Chantier</span>
            <strong>{project.title}</strong>
            <span className="muted">{[quote?.client || project.client, project.address].filter(Boolean).join(" · ")}</span>
          </div>
          <div>
            <span className="lab">Depuis le devis</span>
            <strong>{[quote?.quoteNumber, quote?.totalHt ? `${euro(quote.totalHt)} HT` : ""].filter(Boolean).join(" · ")}</strong>
            <span className="muted">
              {[signeLe ? `Signé le ${jour(signeLe)}` : "Signé", acompte ? `acompte facturé ${acompte.invoiceNumber || ""}`.trim() : ""].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>

        <div className="env-grid">
          <label className="ed">
            <span className="ed-l">Démarrage</span>
            <input type="date" value={debut} min={aujourdhui()} onChange={(e) => e.target.value && setDebut(e.target.value)} />
            <span>{jourLong(planning.debut)}</span>
          </label>
          <div className="ed">
            <span className="ed-l">Fin prévue</span>
            <div className="selv">{jourLong(planning.fin)} · {planning.joursOuvres} jour{planning.joursOuvres > 1 ? "s" : ""} ouvré{planning.joursOuvres > 1 ? "s" : ""}</div>
          </div>
        </div>

        <div className="lots">
          <div className="lots-h">
            <span className="lab">Lots et planning proposés par Koji</span>
            <button type="button" className="link" onClick={() => setModifier((v) => !v)}>{modifier ? "Terminer" : "Modifier le planning"}</button>
          </div>
          {planning.lots.length === 0 ? (
            <p className="muted">Le devis n'a pas de lignes à planifier.</p>
          ) : planning.lots.map((lot) => (
            <div className="lr" key={lot.nom}>
              <span className="lr-c">Lot {lot.numero}</span>
              <span className="lr-n">{lot.nom}<small>{lot.lignes.length} ligne{lot.lignes.length > 1 ? "s" : ""} · {String(Math.round(lot.heures * 10) / 10).replace(".", ",")} h</small></span>
              <span className="lr-a">{euro(lot.montantHt)}</span>
              <span className="lr-d">
                <IconCal />{jour(lot.debut)} → {jour(lot.fin)}
                {modifier ? (
                  <input
                    className="lr-j"
                    type="number"
                    min="1"
                    max="60"
                    value={lot.jours}
                    aria-label={`Durée du lot ${lot.numero} en jours`}
                    onChange={(e) => setDurees((d) => ({ ...d, [lot.nom]: Math.max(1, Number(e.target.value) || 1) }))}
                  />
                ) : null}
                <small>{lot.jours} j</small>
              </span>
              {modifier ? (
                <select className="lr-sel" value={equipes[lot.nom] || ""} onChange={(e) => setEquipes((x) => ({ ...x, [lot.nom]: e.target.value }))} aria-label={`Équipe du lot ${lot.numero}`}>
                  <option value="">Équipe</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.type === "Sous-traitant" ? " · sous-traitant" : ""}</option>)}
                </select>
              ) : (
                <span className="lr-t">{equipeDe(lot.nom)}</span>
              )}
            </div>
          ))}
        </div>

        <div className="env-ch">
          <span className="lab">Au lancement</span>
          {suiviDeja ? (
            <span className="ck on"><IconCheck />Client déjà en suivi dans Koji Client : avancement, photos, situations</span>
          ) : (
            <label className={`ck${suiviClient ? " on" : ""}${clientEmail || clientPhone ? "" : " off"}`}>
              <input type="checkbox" checked={suiviClient} disabled={!clientEmail && !clientPhone} onChange={(e) => setSuiviClient(e.target.checked)} />
              {suiviClient ? <IconCheck /> : null}
              {clientEmail || clientPhone
                ? "Client en suivi dans Koji Client : avancement, photos, situations"
                : "Client en suivi dans Koji Client : ajoutez d'abord son e-mail au devis"}
            </label>
          )}
        </div>

        {etat.error ? <p className="err" role="alert">{etat.error}</p> : null}

        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={envoi}>Plus tard</button>
          <button type="button" className="btn btn-main" onClick={creer} disabled={envoi || planning.lots.length === 0}>
            <IconCheck />
            {envoi ? `Planification… ${etat.fait} / ${etat.total}` : "Créer le chantier"}
          </button>
        </div>
      </section>
    </>
  );
}
