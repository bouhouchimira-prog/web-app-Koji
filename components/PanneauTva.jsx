"use client";

import { CLIENTS_TVA, LOCAUX_TVA, TRAVAUX_TVA } from "../lib/tva";

// TVA du devis (maquette PRO-03.5) : les trois questions de Koji (client,
// local, travaux), le taux qu'il applique, ce qu'il a vérifié, la mention
// ajoutée au document ; les lignes de rénovation énergétique à 5,5 % et
// les lignes à un taux propre. Tout s'applique au fil des réponses.

function IconCheck() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}

function Etape({ numero, titre, options, valeur, onChange }) {
  return (
    <div className="tva-q">
      <span className="tva-n">{numero}</span>
      <div>
        <strong>{titre}</strong>
        <div className="kp-seg" role="group" aria-label={titre}>
          {options.map((o) => (
            <button key={o.id} type="button" className={valeur === o.id ? "on" : ""} aria-pressed={valeur === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

const taux = (t) => `${String(t).replace(".", ",")} %`;

export function PanneauTva({ choix, client, decision, lignesProposees, lignesAuTaux, onChange, onTauxLigne, onClose }) {
  const local = choix.local || "";
  const travaux = choix.travaux || "renovation";
  return (
    <>
      <div className="env-scrim" onClick={onClose} />
      <section className="env-panel tva-env" role="dialog" aria-modal="true" aria-label="TVA du devis">
        <div className="env-h">
          <h2>TVA du devis</h2>
          <button type="button" className="link" onClick={onClose}>Fermer</button>
        </div>
        <p className="muted">Koji choisit le taux sur trois questions et le reporte sur le devis. Le taux reste modifiable ligne par ligne.</p>

        <Etape numero="1" titre="Qui est le client ?" options={CLIENTS_TVA} valeur={client} onChange={(v) => onChange({ ...choix, client: v })} />
        {client !== "sous-traitance" ? (
          <>
            <Etape numero="2" titre="Quel local ?" options={LOCAUX_TVA} valeur={local} onChange={(v) => onChange({ ...choix, local: v })} />
            {local === "logement-ancien" ? (
              <Etape numero="3" titre="Quels travaux ?" options={TRAVAUX_TVA} valeur={travaux} onChange={(v) => onChange({ ...choix, travaux: v })} />
            ) : null}
          </>
        ) : null}

        <div className="card tva-res">
          <div className="card-h"><h2>{decision.titre || "TVA à confirmer"}</h2></div>
          {decision.taux == null ? (
            <p className="muted">Réponds à la question du local : Koji applique ensuite le bon taux.</p>
          ) : null}
          <span className="lab">Ce que Koji a vérifié</span>
          <ul className="tva-ok">
            {decision.verifications.map((v) => <li key={v}><IconCheck />{v}</li>)}
          </ul>
          {decision.taux != null ? (
            <>
              <span className="lab">Mention ajoutée au document</span>
              <p className="tva-mention">
                {decision.mention
                  ? decision.autoliquidation ? decision.mention : `« ${decision.mention} » · signée par le client à l'acceptation du devis.`
                  : "Aucune mention de taux réduit."}
              </p>
            </>
          ) : null}
          {client === "entreprise" && !decision.autoliquidation ? (
            <label className="ed">
              <span className="ed-l">Numéro de commande du client</span>
              <input value={choix.commande || ""} onChange={(e) => onChange({ ...choix, commande: e.target.value })} placeholder="Pas de commande" maxLength={60} />
            </label>
          ) : null}
        </div>

        {lignesProposees.length || lignesAuTaux.length ? (
          <div className="card tva-lignes">
            <div className="card-h"><h2>Taux par ligne</h2></div>
            {lignesProposees.map((l) => (
              <div className="kv" key={l.id}>
                <span>{l.label}<small>Rénovation énergétique : Koji propose 5,5 %</small></span>
                <button type="button" className="btn btn-sec" onClick={() => onTauxLigne(l.id, 5.5)}>Appliquer 5,5 %</button>
              </div>
            ))}
            {lignesAuTaux.map((l) => (
              <div className="kv" key={l.id}>
                <span>{l.label}<small>TVA {taux(l.taux)} sur cette ligne</small></span>
                <button type="button" className="link" onClick={() => onTauxLigne(l.id, null)}>Taux du devis</button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="env-act">
          <button type="button" className="btn btn-main" onClick={onClose}>Terminé</button>
        </div>
      </section>
    </>
  );
}
