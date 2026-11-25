"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { FACTEURS_FICHE, NIVEAUX_SENSIBILITE, facteursSensibles, libelleConfiance, moOuvrage, niveauSensibilite, prochainCode, rechercherOuvrages, tauxOuvrage, tauxParDefaut } from "../../lib/bibliotheque-pro";
import familles from "../../data/ouvrage-families.json";
import { BibliothequeTabs } from "./BibliothequeTabs";
import "../fournitures/fournitures.css";

// Bibliothèque (maquette PRO-08) : ouvrages de main-d'œuvre (temps × taux
// du métier + temps fixe), facteurs de situation, fournitures liées et ce
// qui sert à Koji (synonymes, déclenche, questions). Source Koji ou Moi.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const nb = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(n) || 0);
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso)) : "");
const famCode = (o) => o.familyCode || String(o.code || "").split("-")[0];
const nomFamille = (code) => familles.find((f) => f.code === code)?.name || code || "Autre";
const NOMS_CHAMPS = { label: "libellé", unit: "unité", normativeTime: "temps", fixedTime: "temps fixe", hourlyRate: "taux", coefficient: "coefficient", discount: "réduction", sensitivities: "facteurs", synonyms: "synonymes", triggers: "déclenche", questions: "questions" };

function FicheOuvrage({ ouvrage, ouvrages, tauxFamille, tauxDefaut, articles, onSaved, onDuplique, choisi, onFermer }) {
  const [f, setF] = useState(null);
  const [synonyme, setSynonyme] = useState("");
  const [histo, setHisto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    setF({
      normativeTime: String(ouvrage.normativeTime ?? ""),
      fixedTime: String(ouvrage.fixedTime ?? 0),
      hourlyRate: Number(ouvrage.hourlyRate) > 0 && ouvrage.tauxSource !== "metier" ? String(ouvrage.hourlyRate) : "",
      sensitivities: { ...(ouvrage.sensitivities || {}) },
      synonyms: [...(ouvrage.synonyms || [])]
    });
    setNote("");
    setHisto(false);
  }, [ouvrage]);
  if (!f) return null;

  const essai = { ...ouvrage, normativeTime: Number(f.normativeTime) || 0, fixedTime: Number(f.fixedTime) || 0, hourlyRate: Number(f.hourlyRate) || 0, sensitivities: f.sensitivities };
  const taux = tauxOuvrage(essai, { tauxFamille, tauxDefaut });
  const mo = moOuvrage(essai, taux);
  const situations = facteursSensibles(essai);
  const liees = articles.filter((a) => (a.ouvrages || []).some((o) => o.code === ouvrage.code)).map((a) => ({ a, lien: a.ouvrages.find((o) => o.code === ouvrage.code) }));
  const parCode = new Map(ouvrages.map((o) => [o.code, o]));
  const moi = Boolean(ouvrage.userId);
  const questions = ouvrage.questions?.length ? ouvrage.questions : (ouvrage.parameters || []).map((p) => `${p.name.charAt(0).toUpperCase()}${p.name.slice(1)} ?`);

  async function enregistrer() {
    setBusy(true);
    try {
      const r = await apiSend("/api/ouvrages", {
        id: ouvrage.id,
        perso: true,
        normativeTime: Number(f.normativeTime) || 0,
        fixedTime: Number(f.fixedTime) || 0,
        hourlyRate: Number(f.hourlyRate) || 0,
        sensitivities: f.sensitivities,
        synonyms: f.synonyms
      }, "PATCH");
      onSaved(r.ouvrages);
      setNote("Enregistré dans votre bibliothèque.");
    } catch (e) { setNote(e.message); }
    setBusy(false);
  }

  return (
    <aside className={`ob-detail${choisi ? " choisi" : ""}`} aria-label={`Ouvrage ${ouvrage.code}`}>
      <button type="button" className="link bib-fermer" onClick={onFermer}>← Retour à la liste</button>
      <div className="ob-h">
        <span className="code">{ouvrage.code} · {nomFamille(famCode(ouvrage))}</span>
        <h2>{ouvrage.label}</h2>
        <span className="muted">{moi ? (ouvrage.copiedFromCode || ouvrage.ajusteLe ? `Source Koji · ajusté par toi le ${jour(ouvrage.ajusteLe || ouvrage.updatedAt)}` : `Source : Moi · créé le ${jour(ouvrage.createdAt)}`) : "Source Koji"} · {libelleConfiance(ouvrage.confidence)}</span>
      </div>
      <div className="ob-grid">
        <div className="ed">Unité<div className="selv">{ouvrage.unit}</div></div>
        <label className="ed">Temps de base · h / {ouvrage.unit}<input type="number" min="0" step="0.01" value={f.normativeTime} onChange={(e) => setF({ ...f, normativeTime: e.target.value })} /></label>
        <label className="ed">Taux horaire · €/h<input type="number" min="0" step="1" value={f.hourlyRate} placeholder={`${tauxFamille || tauxDefaut || "—"} € · métier`} onChange={(e) => setF({ ...f, hourlyRate: e.target.value })} /></label>
        <label className="ed">Temps fixe · h / intervention<input type="number" min="0" step="0.1" value={f.fixedTime} onChange={(e) => setF({ ...f, fixedTime: e.target.value })} /></label>
      </div>
      <div className="fx-sum"><span>MO / {ouvrage.unit}</span><b>{euro(mo.parUnite)}{mo.fixe > 0 ? ` · + ${euro(mo.fixe)} par intervention` : ""}</b></div>
      <div className="ob-sec">
        <div className="lab">Facteurs de situation · appliqués par Koji selon le chantier</div>
        {FACTEURS_FICHE.map((fac) => {
          const s = situations.find((x) => x.key === fac.key);
          return (
            <div className="kv" key={fac.key}>
              <span>{fac.nom}{s ? ` · ${s.situation}` : ""}</span>
              <b style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {s ? `× ${nb(s.multiplicateur)}` : ""}
                <select value={niveauSensibilite(f.sensitivities[fac.key]).id} onChange={(e) => setF({ ...f, sensitivities: { ...f.sensitivities, [fac.key]: NIVEAUX_SENSIBILITE.find((x) => x.id === e.target.value).valeur } })} aria-label={`Sensibilité ${fac.nom}`}>
                  {NIVEAUX_SENSIBILITE.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </b>
            </div>
          );
        })}
      </div>
      <div className="ob-sec">
        <div className="lab">Fournitures liées · par {ouvrage.unit}</div>
        {liees.length ? liees.map(({ a, lien }) => (
          <div className="kv" key={a.id}><span>{a.name}{a.perte ? ` (perte ${nb(a.perte)} %)` : ""}</span><b>{nb(Number(lien.conso || 1) * (1 + Number(a.perte || 0) / 100))} {a.unit}</b></div>
        )) : <p className="fx-note">Aucune fourniture liée.</p>}
        <Link className="link" href="/fournitures">Lier depuis Fournitures</Link>
      </div>
      <div className="ob-sec">
        <div className="lab">Pour Koji</div>
        <div className="kv"><span>Synonymes</span><b>{f.synonyms.join(", ") || "—"}</b></div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={synonyme} onChange={(e) => setSynonyme(e.target.value)} placeholder="ajouter un synonyme" aria-label="Synonyme" style={{ flex: 1, height: 32, padding: "0 8px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
          <button type="button" className="link" disabled={!synonyme.trim()} onClick={() => { setF({ ...f, synonyms: [...new Set([...f.synonyms, synonyme.trim()])] }); setSynonyme(""); }}>+ ajouter</button>
        </div>
        <div className="kv"><span>Déclenche</span><b>{(ouvrage.triggers || []).map((c) => `${parCode.get(c)?.label?.split(",")[0] || c} (${c})`).join(" · ") || "—"}</b></div>
        <div className="kv"><span>Question à poser</span><b>{questions.join(" ") || "—"}</b></div>
      </div>
      {histo ? (
        <div className="ob-sec">
          <div className="lab">Historique</div>
          {(ouvrage.historique || []).length ? [...ouvrage.historique].reverse().map((h) => <div className="kv" key={h.date}><span>{jour(h.date)}</span><b>{h.champs.map((c) => NOMS_CHAMPS[c] || c).join(", ")}</b></div>) : <p className="fx-note">{moi ? "Aucune modification notée." : "Ouvrage du socle Koji, jamais modifié par vous."}</p>}
        </div>
      ) : null}
      {note ? <p className="fx-note" role="status">{note}</p> : null}
      <div className="ed-act">
        <button type="button" className="btn btn-sec" onClick={() => onDuplique(ouvrage)}>Dupliquer</button>
        <button type="button" className="btn btn-sec" onClick={() => setHisto((h) => !h)}>Historique</button>
        <button type="button" className="btn btn-main" disabled={busy} onClick={enregistrer}>{busy ? "…" : "Enregistrer"}</button>
      </div>
    </aside>
  );
}

function Import({ onClose, onDone, codes }) {
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const lignes = texte.split(/\r?\n/).map((l) => l.split(/\t|;/).map((x) => x.trim())).filter((c) => c.length >= 4 && c[1]);
  async function importer() {
    setBusy(true);
    let n = 0;
    const pris = [...codes];
    try {
      for (const [code, label, fam, unit, temps, taux] of lignes) {
        const familyCode = familles.find((x) => x.code === String(fam).toUpperCase() || x.name.toLowerCase() === String(fam).toLowerCase())?.code || "";
        const c = code || prochainCode(familyCode || "PERSO", pris);
        pris.push(c);
        await apiSend("/api/ouvrages", { code: c, label, family: nomFamille(familyCode) || fam || "Autre", familyCode, unit: unit || "u", normativeTime: Number(String(temps).replace(",", ".")) || 0, hourlyRate: Number(String(taux || "").replace(",", ".")) || 0, confidence: "B" });
        n += 1;
      }
      onDone(`${n} ouvrage${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}.`);
    } catch (e) { setErreur(`${n} importé(s), puis : ${e.message}`); setBusy(false); }
  }
  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Importer des ouvrages">
        <div className="env-h"><h2>Importer des ouvrages</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <p className="fx-note">Une ligne par ouvrage, colonnes séparées par une tabulation ou un point-virgule (copié depuis Excel) : code (facultatif) ; désignation ; famille ; unité ; temps en h ; taux (facultatif).</p>
        <label className="ed">Lignes<textarea rows={10} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"ELEC-210;Poser une prise de courant encastrée;ELEC;u;0,5;"} /></label>
        <p className="fx-note">{lignes.length} ouvrage{lignes.length > 1 ? "s" : ""} lu{lignes.length > 1 ? "s" : ""}.</p>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act"><button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button><button type="button" className="btn btn-main" disabled={busy || !lignes.length} onClick={importer}>{busy ? "Import…" : "Importer"}</button></div>
      </section>
    </>
  );
}

function Bibliotheque() {
  const params = useSearchParams();
  const [ouvrages, setOuvrages] = useState(null);
  const [tauxFam, setTauxFam] = useState({});
  const [tauxDefaut, setTauxDefaut] = useState(0);
  const [articles, setArticles] = useState([]);
  const [recherche, setRecherche] = useState(params.get("q") || "");
  const [famille, setFamille] = useState(params.get("famille") || "");
  const [selId, setSelId] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [importOuvert, setImportOuvert] = useState(false);

  useEffect(() => {
    apiGet("/api/ouvrages").then((d) => setOuvrages(d.ouvrages || [])).catch((e) => setErreur(e.message));
    apiGet("/api/entreprise/taux").then((d) => setTauxFam(d.parFamille || {})).catch(() => {});
    apiGet("/api/auth/profile").then(({ user }) => {
      const b = user?.business || {};
      setTauxDefaut(Number(b.dailyRate) > 0 ? Math.round(Number(b.dailyRate) / Math.max(1, Number(b.hoursPerDay) || 7)) : 0);
    }).catch(() => {});
    apiGet("/api/fournitures/articles").then((d) => setArticles(d.articles || [])).catch(() => {});
  }, []);

  const liste = useMemo(() => {
    const base = rechercherOuvrages(ouvrages || [], recherche);
    return famille && !recherche ? base.filter((o) => famCode(o) === famille || o.family === famille) : base;
  }, [ouvrages, recherche, famille]);
  const comptes = useMemo(() => {
    const m = new Map();
    for (const o of ouvrages || []) m.set(famCode(o), (m.get(famCode(o)) || 0) + 1);
    return familles.filter((f) => m.has(f.code)).map((f) => ({ ...f, n: m.get(f.code) }));
  }, [ouvrages]);
  // Taux du métier, sinon celui du profil (celui du devis), sinon la
  // référence de la famille (retours du build 64, même règle que l'app).
  const defautDe = (o) => tauxParDefaut({ tauxProfil: tauxDefaut, defautFamille: familles.find((f) => f.code === famCode(o))?.hourlyRateDefault });
  const tauxDe = (o) => Number(tauxFam[famCode(o)]) || defautDe(o);
  const sel = (ouvrages || []).find((o) => o.id === selId) || liste[0] || null;
  const principal = Object.entries(tauxFam).find(([, t]) => t > 0);

  async function dupliquer(o) {
    try {
      const code = prochainCode(famCode(o), (ouvrages || []).map((x) => x.code));
      const { ouvrage, ouvrages: maj } = await apiSend("/api/ouvrages", { ...o, id: undefined, userId: undefined, historique: undefined, ...(o.tauxSource === "metier" ? { hourlyRate: 0, tauxSource: undefined } : {}), code, label: `${o.label} (copie)`, copiedFromCode: o.code, confidence: o.confidence || "C" });
      setOuvrages(maj);
      setSelId(ouvrage.id);
      setMessage(`${code} créé, copie de ${o.code}.`);
    } catch (e) { setMessage(e.message); }
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{ouvrages ? `${ouvrages.length} ouvrages · ${articles.length} fournitures${principal ? ` · ${nomFamille(principal[0]).split(",")[0].toLowerCase()} à ${principal[1]} €/h` : ""}` : "Bibliothèque"}</span>
          <h1>Bibliothèque</h1>
        </div>
        <div className="hact">
          <Link className="btn btn-sec" href="/bibliotheque-ouvrages/factures">Importer des factures</Link>
          <button type="button" className="btn btn-sec" onClick={() => setImportOuvert(true)} disabled={!ouvrages}>Importer</button>
          <Link className="btn btn-main" href="/bibliotheque-ouvrages/nouveau">Nouvel ouvrage</Link>
        </div>
      </div>
      <BibliothequeTabs current="ouvrages" counts={{ ouvrages: ouvrages?.length, fournitures: articles.length, prix: Object.keys(tauxFam).length || undefined }}>
        <label className="fx-search"><input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher : « carreler », « VMC », CAR-010" aria-label="Rechercher un ouvrage" /></label>
      </BibliothequeTabs>
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!ouvrages ? <p className="muted">Chargement…</p> : (
        <div className="fp-layout bib-grid">
          <nav className="card" aria-label="Familles" style={{ padding: 12 }}>
            <div className="lab sm2" style={{ marginBottom: 6 }}>Familles</div>
            <button type="button" className={`fx-row${!famille ? " on" : ""}`} style={{ width: "100%", background: "none", border: 0, cursor: "pointer", font: "inherit", fontWeight: !famille ? 700 : 400 }} onClick={() => setFamille("")}><span>Toutes</span><span className="sm2">{ouvrages.length}</span></button>
            {comptes.map((f) => (
              <button type="button" key={f.code} className="fx-row" style={{ width: "100%", background: "none", border: 0, cursor: "pointer", font: "inherit", textAlign: "left", fontWeight: famille === f.code ? 700 : 400 }} onClick={() => { setFamille(f.code); setRecherche(""); }}>
                <span>{f.name}</span><span className="sm2">{f.n}</span>
              </button>
            ))}
          </nav>
          <div className="tbl bib-tbl">
            {liste.length === 0 ? <div className="empty">Aucun ouvrage ne correspond. <Link className="link" href="/bibliotheque-ouvrages/nouveau">Créer un ouvrage</Link></div> : (
              <table>
                <thead><tr><th>Code</th><th>Ouvrage</th><th className="r">Temps</th><th className="r">MO / u</th><th>Conf.</th></tr></thead>
                <tbody>
                  {liste.slice(0, 400).map((o) => (
                    <tr key={o.id} className={sel?.id === o.id ? "sel" : ""} onClick={() => { setSelId(o.id); if (window.matchMedia("(max-width: 1100px)").matches) setTimeout(() => document.querySelector(".bib-grid > :nth-child(3)")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }}>
                      <td className="n" style={{ whiteSpace: "nowrap" }}>{o.code}</td>
                      <td><div className="n2">{o.label}</div>{o.userId ? <span className="mode">Moi</span> : null}</td>
                      <td className="r" style={{ whiteSpace: "nowrap" }}>{o.billingMode === "fixed" ? "forfait" : `${nb(o.normativeTime)} h/${o.unit || "u"}`}</td>
                      <td className="r b" style={{ whiteSpace: "nowrap" }}>{o.billingMode === "fixed" ? euro(o.fixedAmountHt) : euro(moOuvrage(o, tauxOuvrage(o, { tauxFamille: tauxDe(o), tauxDefaut })).parUnite)}</td>
                      <td title={libelleConfiance(o.confidence)}>{o.confidence || "C"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {liste.length > 400 ? <p className="fx-note" style={{ padding: 10 }}>{liste.length - 400} autres : affinez la recherche.</p> : null}
          </div>
          {sel ? (
            <FicheOuvrage
              ouvrage={sel}
              ouvrages={ouvrages}
              tauxFamille={Number(tauxFam[famCode(sel)]) || 0}
              tauxDefaut={defautDe(sel)}
              articles={articles}
              onSaved={(l) => setOuvrages(l)}
              onDuplique={dupliquer}
              choisi={Boolean(selId)}
              onFermer={() => setSelId("")}
            />
          ) : null}
        </div>
      )}
      {importOuvert ? <Import codes={(ouvrages || []).map((o) => o.code)} onClose={() => setImportOuvert(false)} onDone={(m) => { setImportOuvert(false); setMessage(m); apiGet("/api/ouvrages").then((d) => setOuvrages(d.ouvrages || [])); }} /> : null}
    </Shell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Bibliotheque /></Suspense>;
}
