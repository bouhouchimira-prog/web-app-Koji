"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { METIERS_DEMARRAGE } from "../../../lib/demarrage";
import { etatTaux, tauxMinimumDetail } from "../../../lib/bibliotheque-pro";
import { MODES_COMPTE } from "../../../lib/fournitures-pro";
import familles from "../../../data/ouvrage-families.json";
import { BibliothequeTabs } from "../BibliothequeTabs";
import "../../fournitures/fournitures.css";

// Mes prix (maquette PRO-08.2) : le seul endroit où se règlent les prix de
// vente. Taux vendu par métier, ce que Koji a appris des factures, règle des
// fournitures, majorations, calculateur du taux minimum, coût d'une heure.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0);
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
const METIERS = METIERS_DEMARRAGE.filter((m) => m.familles.length);
const defautMetier = (m) => familles.find((f) => m.familles.includes(f.code))?.hourlyRateDefault || 0;
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;

// Majorations proposées par la maquette, gardées dans defaultSurcharges avec
// les autres majorations du compte.
const MAJ = {
  alea: { id: "sc-alea", label: "Provision aléas de chantier", percent: 5 },
  min: { id: "sc-min", label: "Intervention minimum", kind: "minimum", montant: 150 },
  dep: { id: "sc-dep", label: "Déplacement", kind: "fixe", montant: 40 }
};

function LigneTaux({ m, taux, valideLe, nbOuvrages, factures, onSave }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(String(taux || ""));
  const e = etatTaux({ taux, valideLe: valideLe ? jour(valideLe) : "", defaut: defautMetier(m) });
  return (
    <div className="fx-row">
      <span className="t">
        <b>{m.activite}</b>
        <small>{nbOuvrages} ouvrage{nbOuvrages > 1 ? "s" : ""} · {e.texte}{factures ? ` · factures : ${factures} €` : ""}</small>
      </span>
      {e.etat !== "valide" ? <span className={`fx-etat ${e.etat === "a_regler" ? "late" : "wait"}`}>{e.etat === "a_regler" ? "à régler" : "à confirmer"}</span> : null}
      {edition ? (
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="number" min="0" max="500" step="1" value={valeur} onChange={(x) => setValeur(x.target.value)} aria-label={`Taux ${m.activite}`} style={{ width: 80, height: 34, padding: "0 8px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} /> € HT/h
          <button type="button" className="btn btn-main" disabled={!(Number(valeur) > 0)} onClick={async () => { await onSave(m.metier, Number(valeur)); setEdition(false); }}>Valider</button>
        </span>
      ) : (
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <b>{taux ? `${taux} € HT` : "—"}</b><span className="sm2">/h</span>
          {taux && e.etat === "a_confirmer" ? <button type="button" className="link" onClick={() => onSave(m.metier, taux)}>Confirmer</button> : null}
          <button type="button" className="link" onClick={() => { setValeur(String(taux || defautMetier(m) || "")); setEdition(true); }}>Modifier</button>
        </span>
      )}
    </div>
  );
}

export default function MesPrixPage() {
  const [taux, setTaux] = useState(null);
  const [ouvrages, setOuvrages] = useState([]);
  const [analyse, setAnalyse] = useState(null);
  const [nbFournitures, setNbFournitures] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet("/api/entreprise/taux").then(setTaux).catch(() => setTaux({ taux: {}, valides: {} }));
    apiGet("/api/ouvrages").then((d) => setOuvrages(d.ouvrages || [])).catch(() => {});
    apiGet("/api/bibliotheque/factures").then(setAnalyse).catch(() => {});
    Promise.all([apiGet("/api/auth/profile"), apiGet("/api/fournitures/articles").catch(() => null)]).then(([{ user }, four]) => {
      const b = user?.business || {};
      const surcharges = Array.isArray(b.defaultSurcharges) ? b.defaultSurcharges : [];
      const trouve = (k) => surcharges.find((s) => s.id === MAJ[k].id);
      setNbFournitures(four?.articles?.length ?? null);
      setForm({
        surcharges,
        maj: Object.fromEntries(Object.keys(MAJ).map((k) => [k, { ...MAJ[k], ...(trouve(k) || {}), on: Boolean(trouve(k)) && trouve(k).mode !== "excluded" }])),
        afficher: surcharges.length ? surcharges.some((s) => s.mode === "client") : true,
        modeFournitures: four?.reglage?.modeDefaut || "public",
        pourcent: four?.reglage?.coef ? String(Math.round((four.reglage.coef - 1) * 100)) : "15",
        coutHoraire: b.coutHoraire ? String(b.coutHoraire) : "",
        calcul: { charges: "", revenu: "", heuresParSemaine: "30", semaines: "44", ...(b.calculTaux || {}) },
        dailyRate: String(b.dailyRate ?? ""),
        hoursPerDay: String(b.hoursPerDay ?? 7),
        defaultVatRate: String(b.defaultVatRate ?? 20)
      });
    }).catch((e) => setMessage(e.message || "Chargement impossible."));
  }, []);

  const parMetier = useMemo(() => {
    const compte = new Map();
    for (const o of ouvrages) {
      const fam = o.familyCode || String(o.code || "").split("-")[0];
      const m = METIERS.find((x) => x.familles.includes(fam));
      if (m) compte.set(m.metier, (compte.get(m.metier) || 0) + 1);
    }
    return compte;
  }, [ouvrages]);
  const lignesTaux = METIERS.filter((m) => parMetier.get(m.metier) || taux?.taux?.[m.metier]);
  const facturesPar = new Map((analyse?.metiers || []).map((x) => [x.metier, x]));
  const appris = (analyse?.metiers || []).filter((x) => x.proposition?.action === "appliquer" && x.regle > 0 && x.confiance !== "faible");
  const calc = form ? tauxMinimumDetail(form.calcul) : null;
  const tauxRegles = Object.values(taux?.taux || {}).filter((t) => t > 0);

  async function enregistrerTaux(metier, valeur) {
    const map = { ...(taux?.taux || {}), [metier]: valeur };
    try {
      const r = await apiSend("/api/entreprise/taux", { taux: map, valider: [metier] }, "PUT");
      setTaux(r);
      setMessage(`Taux ${METIERS.find((m) => m.metier === metier)?.activite} : ${valeur} € HT/h, validé.`);
    } catch (e) { setMessage(e.message); }
  }

  async function appliquerAppris() {
    try {
      const r = await apiSend("/api/bibliotheque/factures", { action: "appliquer", metiers: appris.map((x) => ({ metier: x.metier, taux: x.taux })) }, "PATCH");
      setAnalyse(r);
      setTaux(await apiGet("/api/entreprise/taux"));
      setMessage("Taux mis à jour d'après vos factures.");
    } catch (e) { setMessage(e.message); }
  }

  async function enregistrer(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const mode = (on) => (on ? (form.afficher ? "client" : "internal") : "excluded");
      const connus = new Set(Object.values(MAJ).map((x) => x.id));
      const autres = form.surcharges.filter((s) => !connus.has(s.id)).map((s) => ({ ...s, mode: s.mode === "excluded" ? "excluded" : form.afficher ? "client" : "internal" }));
      const maj = Object.entries(form.maj).map(([k, x]) => ({
        id: MAJ[k].id,
        label: x.label,
        mode: mode(x.on),
        calculationBase: "total_lots",
        ...(MAJ[k].kind ? { kind: MAJ[k].kind, montant: Math.max(0, Number(x.montant) || 0), percent: 0 } : { percent: Math.max(0, Number(x.percent) || 0) })
      }));
      const r = await apiSend("/api/auth/profile", {
        business: {
          defaultSurcharges: [...maj, ...autres],
          coutHoraire: Number(form.coutHoraire) > 0 ? Number(form.coutHoraire) : null,
          calculTaux: form.calcul,
          dailyRate: Math.max(0, Number(form.dailyRate) || 0),
          hoursPerDay: Math.max(1, Number(form.hoursPerDay) || 7),
          defaultVatRate: Math.max(0, Number(form.defaultVatRate) || 0)
        }
      }, "PATCH");
      try { window.localStorage.setItem("koji-user", JSON.stringify(r.user)); } catch { /* confort */ }
      await apiSend("/api/fournitures/articles", { action: "reglage", modeDefaut: form.modeFournitures, coef: form.modeFournitures === "coefficient" ? 1 + (Number(form.pourcent) || 0) / 100 : undefined }, "PATCH");
      setForm((f) => ({ ...f, surcharges: [...maj, ...autres] }));
      setMessage("Prix enregistrés. Ils s'appliquent aux prochains devis.");
    } catch (e) { setMessage(e.message || "Enregistrement impossible."); }
    setBusy(false);
  }

  const setCalc = (k, v) => setForm((f) => ({ ...f, calcul: { ...f.calcul, [k]: v } }));
  const setMaj = (k, patch) => setForm((f) => ({ ...f, maj: { ...f.maj, [k]: { ...f.maj[k], ...patch } } }));

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><Link className="link" href="/bibliotheque-ouvrages">Bibliothèque</Link> · ce que vous vendez</span>
          <h1>Mes prix</h1>
        </div>
      </div>
      <BibliothequeTabs current="prix" counts={{ ouvrages: ouvrages.length || undefined, fournitures: nbFournitures ?? undefined }} />
      {message ? <p className="notice" role="status">{message}</p> : null}
      {!form || !taux ? <p className="muted">Chargement…</p> : (
        <form className="fx-form" onSubmit={enregistrer}>
          <div>
            <section className="card">
              <div className="card-h"><h2>Taux horaire vendu, par métier</h2><span className="sm2">temps × taux = main-d'œuvre de chaque ligne</span></div>
              {lignesTaux.length === 0 ? <p className="fx-note">Aucun métier pour l'instant : ajoutez des ouvrages ou réglez vos taux au démarrage.</p> : lignesTaux.map((m) => (
                <LigneTaux key={m.metier} m={m} taux={taux.taux?.[m.metier] || 0} valideLe={taux.valides?.[m.metier] || ""} nbOuvrages={parMetier.get(m.metier) || 0} factures={facturesPar.get(m.metier)?.taux} onSave={enregistrerTaux} />
              ))}
              <p className="fx-note">Métier sans taux : Koji utilise la valeur indiquée et le signale « à régler » ; jamais de devis sans prix. Autres travaux (préparation, démolition…) : {Number(form.dailyRate) > 0 ? `${Math.round(Number(form.dailyRate) / Math.max(1, Number(form.hoursPerDay) || 7))} € HT/h` : "taux de l'entreprise à régler ci-dessous"}.</p>
            </section>

            {appris.length ? (
              <section className="card">
                <div className="card-h"><h2>Ce que Koji a appris</h2></div>
                {appris.map((x) => <p key={x.metier} className="fx-note" style={{ fontSize: 13 }}>{x.activite} : {x.taux} €/h d'après vos factures, {x.regle} €/h réglé. Vos devis {x.activite.toLowerCase()} sont trop bas d'environ {x.ecart} %.</p>)}
                <button type="button" className="btn btn-sec" style={{ alignSelf: "flex-start" }} onClick={appliquerAppris}>Mettre à jour</button>
              </section>
            ) : null}

            <section className="card">
              <div className="card-h"><h2>Prix des fournitures</h2></div>
              {Object.entries(MODES_COMPTE).map(([k, label]) => (
                <label key={k} className="fx-row" style={{ cursor: "pointer" }}>
                  <span className="t"><b><input type="radio" name="modeFournitures" checked={form.modeFournitures === k} onChange={() => setForm({ ...form, modeFournitures: k })} /> {label}</b>
                    <small>{k === "public" ? "le prix affiché par le fournisseur · par défaut" : k === "coefficient" ? "par exemple + 15 %" : "aucune marge sur les fournitures"}</small></span>
                  {k === "coefficient" && form.modeFournitures === "coefficient" ? <span>+ <input type="number" min="0" max="400" value={form.pourcent} onChange={(e) => setForm({ ...form, pourcent: e.target.value })} aria-label="Pourcentage sur achat" style={{ width: 64, height: 32, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} /> %</span> : null}
                </label>
              ))}
              <p className="fx-note">S'applique aux articles laissés « au prix public » ; un prix manuel ou un coefficient propre à l'article ne change pas.</p>
            </section>

            <section className="card">
              <div className="card-h"><h2>Majorations</h2><span className="sm2">ajoutées par Koji si cochées</span></div>
              {[
                ["alea", `${form.maj.alea.label.replace("Provision aléas de chantier", "Aléas")} · `, "percent", "% du total HT"],
                ["min", "Intervention minimum · ", "montant", "€ HT"],
                ["dep", "Déplacement · forfait par chantier · ", "montant", "€ HT"]
              ].map(([k, label, champ, suffixe]) => (
                <div className="fx-row" key={k}>
                  <button type="button" className={`ck${form.maj[k].on ? " on" : ""}`} aria-pressed={form.maj[k].on} onClick={() => setMaj(k, { on: !form.maj[k].on })}><Coche />{label.replace(/ · $/, "")}</button>
                  <span><input type="number" min="0" step="1" value={form.maj[k][champ]} onChange={(e) => setMaj(k, { [champ]: e.target.value })} aria-label={label.replace(/ · $/, "")} style={{ width: 70, height: 30, margin: "0 6px", padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} />{suffixe}</span>
                </div>
              ))}
              {form.surcharges.filter((s) => !Object.values(MAJ).some((x) => x.id === s.id)).map((s) => (
                <div className="fx-row" key={s.id}>
                  <button type="button" className={`ck${s.mode !== "excluded" ? " on" : ""}`} aria-pressed={s.mode !== "excluded"} onClick={() => setForm((f) => ({ ...f, surcharges: f.surcharges.map((x) => (x.id === s.id ? { ...x, mode: x.mode === "excluded" ? "client" : "excluded" } : x)) }))}><Coche />{s.label} · {s.percent} %{s.calculationBase === "chiffrage_cumule" ? " sur le cumul" : ""}</button>
                  <button type="button" className="link" onClick={() => setForm((f) => ({ ...f, surcharges: f.surcharges.filter((x) => x.id !== s.id) }))}>Retirer</button>
                </div>
              ))}
              <div className="fx-row">
                <button type="button" className={`ck${form.afficher ? " on" : ""}`} aria-pressed={form.afficher} onClick={() => setForm({ ...form, afficher: !form.afficher })}><Coche />Afficher les majorations sur le devis</button>
                <span className="sm2">sinon réparties dans les prix des lignes</span>
              </div>
            </section>

            <section className="card">
              <div className="card-h"><h2>Réglages des devis</h2></div>
              <div className="fx-grid3">
                <label className="ed">Prix de la journée, autres travaux (€ HT)<input type="number" min="0" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} /></label>
                <label className="ed">Heures par jour<input type="number" min="1" value={form.hoursPerDay} onChange={(e) => setForm({ ...form, hoursPerDay: e.target.value })} /></label>
                <label className="ed">TVA par défaut (%)<input type="number" min="0" value={form.defaultVatRate} onChange={(e) => setForm({ ...form, defaultVatRate: e.target.value })} /></label>
              </div>
            </section>
            <div className="ed-act"><button type="submit" className="btn btn-main" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer mes prix"}</button></div>
          </div>

          <div>
            <section className="card">
              <div className="card-h"><h2>Calculer depuis mes factures</h2></div>
              <p className="fx-note">Le plus juste : vos vrais prix. Importez 3 à 10 factures de travaux récentes, Koji en déduit votre taux par métier.</p>
              <Link className="btn btn-sec" href="/bibliotheque-ouvrages/factures">Déposer des factures</Link>
              <p className="fx-note">PDF, photo ou export CSV de votre ancien logiciel</p>
              {analyse?.fichiers?.length ? (
                <div className="kv"><span>Dernière analyse · {analyse.fichiers.length} facture{analyse.fichiers.length > 1 ? "s" : ""} · {analyse.lignes.total} lignes · {jour(analyse.majLe)}</span><Link className="link" href="/bibliotheque-ouvrages/factures">Voir le résultat</Link></div>
              ) : null}
            </section>
            <section className="card">
              <div className="card-h"><h2>Calculer mon taux</h2></div>
              <p className="fx-note">Le taux sous lequel vous perdez de l'argent.</p>
              <label className="ed">Charges de l'année · loyer, véhicule, assurances, logiciels (€)<input type="number" min="0" value={form.calcul.charges} onChange={(e) => setCalc("charges", e.target.value)} /></label>
              <label className="ed">Revenu que vous voulez vous verser, avant impôt (€)<input type="number" min="0" value={form.calcul.revenu} onChange={(e) => setCalc("revenu", e.target.value)} /></label>
              <div className="fx-grid2">
                <label className="ed">Heures facturées par semaine<input type="number" min="1" value={form.calcul.heuresParSemaine} onChange={(e) => setCalc("heuresParSemaine", e.target.value)} /></label>
                <label className="ed">Semaines travaillées<input type="number" min="1" max="52" value={form.calcul.semaines} onChange={(e) => setCalc("semaines", e.target.value)} /></label>
              </div>
              {calc ? (
                <div className="fx-sum" style={{ flexDirection: "column" }}>
                  <span>Votre taux minimum <b style={{ fontSize: 20 }}>{calc.taux} € HT/h</b></span>
                  <span className="fx-note">{euro(calc.total)} ÷ {calc.heures.toLocaleString("fr-FR")} h facturées{tauxRegles.length ? ` · vos taux actuels (${Math.min(...tauxRegles)} à ${Math.max(...tauxRegles)} €) sont ${Math.min(...tauxRegles) >= calc.taux ? "au-dessus" : "en partie en dessous"}` : ""}</span>
                </div>
              ) : null}
              <p className="fx-note">Indicatif, pour un artisan seul. Votre comptable peut affiner.</p>
            </section>
            <section className="card">
              <div className="card-h"><h2>Ce que me coûte une heure</h2></div>
              <label className="ed">Coût horaire moyen, charges comprises (€) · facultatif<input type="number" min="0" value={form.coutHoraire} onChange={(e) => setForm({ ...form, coutHoraire: e.target.value })} /></label>
              <p className="fx-note">Sert à afficher vos marges. Sans ce chiffre, Koji n'affiche pas de marge plutôt qu'une marge fausse.</p>
            </section>
          </div>
        </form>
      )}
    </Shell>
  );
}
