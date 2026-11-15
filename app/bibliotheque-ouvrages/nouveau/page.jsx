"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { SITUATION_FACTORS } from "../../../lib/situation-factors";
import { FACTEURS_FICHE, NIVEAUX_SENSIBILITE, apercuLigne, controlesOuvrage, exempleSituation, moOuvrage, multiplicateur, niveauSensibilite, prochainCode } from "../../../lib/bibliotheque-pro";
import familles from "../../../data/ouvrage-families.json";
import { BibliothequeTabs } from "../BibliothequeTabs";
import "../../fournitures/fournitures.css";

// Création d'ouvrage (maquette PRO-08.1) : Koji remplit la fiche depuis une
// description ; l'entrepreneur règle la sensibilité aux situations (Koji
// règle la valeur des facteurs) ; fournitures liées depuis le catalogue.
// Brouillon : Koji ne s'en sert pas tant qu'il n'est pas enregistré.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const nb = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(n) || 0);
const UNITES = ["u", "m²", "ml", "m³", "forfait", "h", "kg"];
const VIDE = { label: "", code: "", familyCode: "", unit: "u", defaultLot: "", normativeTime: "", fixedTime: "", hourlyRate: "", coefficient: "1", discount: "0", confidence: "C", sensitivities: { ACC: 0, STO: 0, EXI: 0, OCC: 0, SUP: 0, HSP: 0, HOR: 0 }, fournitures: [], clientFournit: false, synonyms: [], triggers: [], questions: [], noteInterne: "" };
const champ = { height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" };

export default function NouvelOuvrage() {
  const router = useRouter();
  const [f, setF] = useState(VIDE);
  const [ouvrages, setOuvrages] = useState([]);
  const [articles, setArticles] = useState([]);
  const [tauxFam, setTauxFam] = useState({});
  const [description, setDescription] = useState("");
  const [koji, setKoji] = useState({ busy: false, note: "" });
  const [ajout, setAjout] = useState({ articleId: "", conso: "1" });
  const [saisie, setSaisie] = useState({ synonyme: "", trigger: "", question: "" });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    apiGet("/api/ouvrages").then((d) => setOuvrages(d.ouvrages || [])).catch(() => {});
    apiGet("/api/fournitures/articles").then((d) => setArticles(d.articles || [])).catch(() => {});
    apiGet("/api/entreprise/taux").then((d) => setTauxFam(d.parFamille || {})).catch(() => {});
  }, []);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const famille = familles.find((x) => x.code === f.familyCode) || null;
  const tauxDefaut = Number(tauxFam[f.familyCode]) || famille?.hourlyRateDefault || 0;
  const taux = Number(f.hourlyRate) || tauxDefaut;
  const ouvrage = { ...f, normativeTime: Number(f.normativeTime) || 0, fixedTime: Number(f.fixedTime) || 0, coefficient: Number(f.coefficient) || 1, discount: Number(f.discount) || 0 };
  const mo = moOuvrage(ouvrage, taux);
  const fournituresPrix = f.fournitures.filter((x, i) => !(f.clientFournit && i === 0)).map((x) => {
    const a = articles.find((y) => y.id === x.articleId);
    return { conso: Number(x.conso) || 0, perte: a?.perte || 0, vente: a?.vente || 0 };
  });
  const apercu = apercuLigne(ouvrage, { taux, quantite: 1, fournitures: fournituresPrix });
  const sensibles = FACTEURS_FICHE.filter((x) => f.sensitivities[x.key] > 0).slice(0, 2).map((x) => {
    const def = SITUATION_FACTORS.find((d) => d.key === x.key);
    const opt = x.key === "ACC" ? def.options[4] : def.options[1];
    return { nom: x.nom, situation: x.key === "EXI" ? "Pièce de 4,8 m²" : opt.label, multiplicateur: Math.round(multiplicateur(opt.value, f.sensitivities[x.key]) * 100) / 100 };
  });
  const exemple = exempleSituation(ouvrage, taux, sensibles);
  const controles = useMemo(() => controlesOuvrage({ ...ouvrage, id: "" }, ouvrages), [ouvrage.label, ouvrage.unit, ouvrage.familyCode, ouvrage.confidence, ouvrages]); // eslint-disable-line react-hooks/exhaustive-deps
  const parCode = new Map(ouvrages.map((o) => [o.code, o]));

  function choisirFamille(code) {
    const fam = familles.find((x) => x.code === code);
    set({ familyCode: code, defaultLot: fam?.defaultLot || "", code: prochainCode(code, ouvrages.map((o) => o.code)) });
  }

  async function remplir() {
    setKoji({ busy: true, note: "" });
    try {
      const { proposition: p } = await apiSend("/api/ouvrages/proposer", { description });
      setF((x) => ({
        ...x,
        label: p.label, familyCode: p.familyCode, defaultLot: p.defaultLot, code: p.code, unit: p.unit,
        normativeTime: String(p.normativeTime), fixedTime: String(p.fixedTime), confidence: p.confidence, sensitivities: p.sensitivities,
        fournitures: p.fournitures.filter((y) => y.articleId).map((y) => ({ articleId: y.articleId, conso: String(y.conso || 1) })),
        aCreer: p.fournitures.filter((y) => !y.articleId),
        synonyms: p.synonyms, triggers: p.triggers, questions: p.questions
      }));
      setKoji({ busy: false, note: "Koji a rempli la fiche : vérifiez chaque champ, surtout le temps (estimé, confiance C)." });
    } catch (e) { setKoji({ busy: false, note: e.message }); }
  }

  async function enregistrer(autre) {
    setBusy(true);
    setErreur("");
    try {
      await apiSend("/api/ouvrages", {
        code: f.code || prochainCode(f.familyCode || "PERSO", ouvrages.map((o) => o.code)),
        label: f.label.trim(),
        family: famille?.name || "Autre",
        familyCode: f.familyCode,
        category: famille?.name || "Autre",
        unit: f.unit,
        defaultLot: f.defaultLot,
        normativeTime: ouvrage.normativeTime,
        fixedTime: ouvrage.fixedTime,
        hourlyRate: Number(f.hourlyRate) || 0,
        coefficient: ouvrage.coefficient,
        discount: ouvrage.discount,
        confidence: f.confidence,
        sensitivities: f.sensitivities,
        synonyms: f.synonyms,
        triggers: f.triggers,
        questions: f.questions,
        noteInterne: f.noteInterne,
        clientFournit: f.clientFournit,
        fournitures: f.fournitures.map((x) => ({ articleId: x.articleId, conso: Number(x.conso) || 0 }))
      });
      if (autre) {
        setOuvrages((l) => [...l, { code: f.code, label: f.label }]);
        setF(VIDE);
        setDescription("");
        setKoji({ busy: false, note: `« ${f.label} » enregistré. Ouvrage suivant :` });
        setBusy(false);
        window.scrollTo({ top: 0 });
        return;
      }
      router.push("/bibliotheque-ouvrages");
    } catch (e) { setErreur(e.message); setBusy(false); }
  }

  const peutEnregistrer = f.label.trim() && f.familyCode && Number(f.normativeTime) >= 0 && f.unit;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><Link className="link" href="/bibliotheque-ouvrages">Bibliothèque</Link></span>
          <h1>Nouvel ouvrage</h1>
          <span className="muted">Brouillon · non visible par Koji tant qu'il n'est pas enregistré</span>
        </div>
        <div className="hact">
          <Link className="btn btn-sec" href="/bibliotheque-ouvrages">Annuler</Link>
          <button type="button" className="btn btn-sec" disabled={busy || !peutEnregistrer} onClick={() => enregistrer(true)}>Enregistrer et créer un autre</button>
          <button type="button" className="btn btn-main" disabled={busy || !peutEnregistrer} onClick={() => enregistrer(false)}>{busy ? "…" : "Enregistrer l'ouvrage"}</button>
        </div>
      </div>
      <BibliothequeTabs current="ouvrages" />
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}

      <div className="fx-scan">
        <p><b>Décris l'ouvrage, Koji remplit la fiche.</b><br />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="pose d'un receveur extra-plat 90 × 120 sur chape, raccord à l'évacuation existante, sans maçonnerie" aria-label="Description de l'ouvrage" style={{ ...champ, width: "100%", height: "auto", padding: 8, marginTop: 8 }} />
          <span className="fx-note">Koji propose famille, unité, temps, fournitures et liaisons ; tu valides chaque champ.{koji.note ? ` ${koji.note}` : ""}</span>
        </p>
        <button type="button" className="btn btn-main" disabled={koji.busy || description.trim().length < 8} onClick={remplir}>{koji.busy ? "Koji remplit…" : "Remplir avec Koji"}</button>
      </div>

      <div className="fx-form">
        <div>
          <section className="card">
            <div className="card-h"><h2>Identité</h2></div>
            <div className="fx-grid2">
              <label className="ed" style={{ gridColumn: "1 / -1" }}>Désignation · verbe d'action<input value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="Poser un receveur de douche extra-plat, raccordé à l'évacuation existante" /></label>
              <label className="ed">Code · proposé, modifiable<input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder={prochainCode(f.familyCode || "PERSO", ouvrages.map((o) => o.code))} /></label>
              <label className="ed">Famille<select value={f.familyCode} onChange={(e) => choisirFamille(e.target.value)}><option value="">Choisir…</option>{familles.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
              <label className="ed">Unité<select value={f.unit} onChange={(e) => set({ unit: e.target.value })}>{UNITES.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label className="ed">Lot par défaut<input value={f.defaultLot} onChange={(e) => set({ defaultLot: e.target.value })} /></label>
            </div>
          </section>

          <section className="card">
            <div className="card-h"><h2>Main-d'œuvre</h2></div>
            <div className="fx-grid3">
              <label className="ed">Temps de base · h / {f.unit} · conditions de référence<input type="number" min="0" step="0.05" value={f.normativeTime} onChange={(e) => set({ normativeTime: e.target.value })} /></label>
              <label className="ed">Temps fixe · h par intervention<input type="number" min="0" step="0.1" value={f.fixedTime} onChange={(e) => set({ fixedTime: e.target.value })} /></label>
              <label className="ed">Taux horaire · €/h<input type="number" min="0" step="1" value={f.hourlyRate} placeholder={tauxDefaut ? `${tauxDefaut} · taux ${famille?.name.split(",")[0] || "du métier"} du compte` : "taux du métier"} onChange={(e) => set({ hourlyRate: e.target.value })} /></label>
              <label className="ed">Coefficient · marge, ajustement<input type="number" min="0.1" step="0.05" value={f.coefficient} onChange={(e) => set({ coefficient: e.target.value })} /></label>
              <label className="ed">Réduction · %<input type="number" min="0" max="100" step="1" value={f.discount} onChange={(e) => set({ discount: e.target.value })} /></label>
              <label className="ed">Confiance<select value={f.confidence} onChange={(e) => set({ confidence: e.target.value })}><option value="A">A · chronométré</option><option value="B">B · recalé</option><option value="C">C · estimé</option></select></label>
            </div>
            <div className="fx-sum"><span>MO / {f.unit} en conditions de référence</span><b>{euro(mo.parUnite)} HT</b></div>
            <p className="fx-note">{nb(ouvrage.normativeTime)} h × {nb(taux)} €/h × {nb(mo.facteur)}{mo.fixe > 0 ? ` · + ${euro(mo.fixe)} de temps fixe par intervention` : ""}</p>
          </section>

          <section className="card">
            <div className="card-h"><h2>Sensibilité aux situations</h2></div>
            <p className="fx-note">Koji applique les facteurs de situation du chantier selon cette sensibilité. Valeurs des facteurs : réglées par Koji.</p>
            {FACTEURS_FICHE.map((x) => (
              <div className="fx-row" key={x.key}>
                <span className="t"><b>{x.nom}</b><small>{x.aide}</small></span>
                <div className="kp-seg" role="group" aria-label={`Sensibilité ${x.nom}`}>
                  {NIVEAUX_SENSIBILITE.map((niv) => (
                    <button key={niv.id} type="button" className={niveauSensibilite(f.sensitivities[x.key]).id === niv.id ? "on" : ""} aria-pressed={niveauSensibilite(f.sensitivities[x.key]).id === niv.id} onClick={() => set({ sensitivities: { ...f.sensitivities, [x.key]: niv.valeur } })}>{niv.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-h"><h2>Fournitures liées</h2></div>
            {f.fournitures.map((x, i) => {
              const a = articles.find((y) => y.id === x.articleId);
              return (
                <div className="fx-row" key={x.articleId}>
                  <span className="t"><b>{a?.name || "Article"}</b><small>{a ? `${euro(a.vente)} / ${a.unit}` : ""}{f.clientFournit && i === 0 ? " · fournie par le client" : ""}</small></span>
                  <span><input type="number" min="0" step="0.01" value={x.conso} onChange={(e) => set({ fournitures: f.fournitures.map((y, j) => (j === i ? { ...y, conso: e.target.value } : y)) })} aria-label={`Quantité de ${a?.name} par ${f.unit}`} style={{ ...champ, width: 80, textAlign: "right" }} /> {a?.unit} / {f.unit}</span>
                  <button type="button" className="link" onClick={() => set({ fournitures: f.fournitures.filter((_, j) => j !== i) })}>Retirer</button>
                </div>
              );
            })}
            {(f.aCreer || []).length ? <p className="fx-note">Koji propose aussi : {f.aCreer.map((y) => <Link key={y.nom} className="link" href={`/fournitures/nouveau?nom=${encodeURIComponent(y.nom)}`}>{y.nom} ({nb(y.conso)} {y.unite})</Link>).reduce((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])} · absent{f.aCreer.length > 1 ? "s" : ""} de votre catalogue.</p> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={ajout.articleId} onChange={(e) => setAjout({ ...ajout, articleId: e.target.value })} aria-label="Article du catalogue" style={{ ...champ, flex: 1, minWidth: 200 }}>
                <option value="">Ajouter depuis la bibliothèque fournitures…</option>
                {articles.filter((a) => !f.fournitures.some((x) => x.articleId === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={ajout.conso} onChange={(e) => setAjout({ ...ajout, conso: e.target.value })} aria-label="Quantité par unité" style={{ ...champ, width: 80 }} />
              <button type="button" className="btn btn-sec" disabled={!ajout.articleId} onClick={() => { set({ fournitures: [...f.fournitures, { articleId: ajout.articleId, conso: ajout.conso }] }); setAjout({ articleId: "", conso: "1" }); }}>Ajouter</button>
            </div>
            <button type="button" className={`ck${f.clientFournit ? " on" : ""}`} aria-pressed={f.clientFournit} onClick={() => set({ clientFournit: !f.clientFournit })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>Fourniture principale fournie par le client : déduire automatiquement</button>
          </section>

          <section className="card">
            <div className="card-h"><h2>Pour Koji</h2></div>
            {[["synonyme", "synonyms", "Synonymes", "bac à douche"], ["trigger", "triggers", "Déclenche · code d'ouvrage", "PLO-120"], ["question", "questions", "Questions à poser", "Le receveur est-il fourni par le client ?"]].map(([k, cle, titre, exemple]) => (
              <div className="ob-sec" key={k}>
                <div className="lab">{titre}</div>
                <div className="fx-chips">{f[cle].map((v) => <span key={v}>{cle === "triggers" ? `${v} ${parCode.get(v)?.label || ""}` : v}<button type="button" aria-label={`Retirer ${v}`} onClick={() => set({ [cle]: f[cle].filter((y) => y !== v) })}>×</button></span>)}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input list={k === "trigger" ? "bib-codes" : undefined} value={saisie[k]} onChange={(e) => setSaisie({ ...saisie, [k]: e.target.value })} placeholder={exemple} aria-label={titre} style={{ ...champ, flex: 1 }} />
                  <button type="button" className="link" disabled={!saisie[k].trim() || (k === "trigger" && !parCode.has(saisie[k].trim().toUpperCase()))} onClick={() => { const v = k === "trigger" ? saisie[k].trim().toUpperCase() : saisie[k].trim(); set({ [cle]: [...new Set([...f[cle], v])] }); setSaisie({ ...saisie, [k]: "" }); }}>{k === "trigger" ? "+ lier" : "+ ajouter"}</button>
                </div>
              </div>
            ))}
            <datalist id="bib-codes">{ouvrages.slice(0, 600).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</datalist>
            <label className="ed">Commentaire interne<textarea value={f.noteInterne} onChange={(e) => set({ noteInterne: e.target.value })} rows={2} /></label>
          </section>
        </div>

        <div>
          <section className="card">
            <div className="card-h"><h2>Aperçu dans un devis</h2></div>
            <div className="kv"><span><b style={{ color: "var(--ink)" }}>{f.label || "Désignation"}</b></span><b>1 {f.unit} · {euro(apercu.total)}</b></div>
            <p className="fx-note">MO {euro(apercu.mo)} ({nb(ouvrage.normativeTime)} h{ouvrage.fixedTime ? ` + ${nb(ouvrage.fixedTime)} h` : ""} × {nb(taux)} €/h){apercu.fournitures ? ` · fournitures ${euro(apercu.fournitures)}` : ""}</p>
          </section>
          {sensibles.length ? (
            <section className="card">
              <div className="card-h"><h2>Exemple en situation</h2></div>
              {sensibles.map((s) => <div className="kv" key={s.nom}><span>{s.nom} · {s.situation}</span><b>× {nb(s.multiplicateur)}</b></div>)}
              <div className="kv"><span>MO en situation</span><b>{euro(exemple.mo)}</b></div>
              <p className="fx-note">{nb(mo.parUnite)} × {sensibles.map((s) => nb(s.multiplicateur)).join(" × ")}{mo.fixe ? ` + ${nb(mo.fixe)} de temps fixe` : ""} (facteurs sur le temps de base seulement)</p>
            </section>
          ) : null}
          <section className="card">
            <div className="card-h"><h2>Contrôles</h2></div>
            <div className="fx-chk">{f.label ? controles.map((c) => <span key={c.texte} className={c.ok ? "" : "no"}>{c.texte}</span>) : <span className="no">Désignation à saisir</span>}</div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
