"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { MODES_PRIX, libelleMode, marge, nombre, paquetsPourSurface } from "../../lib/fournitures-pro";
import { FournituresTabs } from "./FournituresTabs";
import { STATUT_CHANTIER, Thumb, condLibelle, euro, jour, nb, pct } from "./commun";
import { BonsOnglet } from "./BonsOnglet";
import { PartenairesOnglet } from "./PartenairesOnglet";
import { StockOnglet } from "./StockOnglet";
import "./fournitures.css";

// Fournitures (maquette PRO-07) : catalogue de l'entreprise, trois prix par
// article (achat, public, vente selon le mode choisi), marge, commandes par
// chantier ; les autres onglets ouvrent les bons, les partenaires et le stock.
const TAB_IDS = ["catalogue", "chantiers", "bons", "partenaires", "stock"];

function ImportTarif({ fournisseurs, onClose, onDone }) {
  const [supplierId, setSupplierId] = useState(fournisseurs[0]?.id || "");
  const [csv, setCsv] = useState("");
  const [nom, setNom] = useState("");
  const [apercu, setApercu] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  async function lire(event) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { setErreur("Koji lit les tarifs au format CSV (export depuis Excel : Enregistrer sous › CSV)."); return; }
    setErreur("");
    setNom(f.name);
    const texte = await f.text();
    setCsv(texte);
    setBusy(true);
    try {
      setApercu(await apiSend("/api/fournitures/articles", { action: "tarif", supplierId, csv: texte, apercu: true }, "PATCH"));
    } catch (e) { setErreur(e.message); setApercu(null); }
    setBusy(false);
  }

  async function appliquer() {
    setBusy(true);
    try {
      const r = await apiSend("/api/fournitures/articles", { action: "tarif", supplierId, csv }, "PATCH");
      onDone(`${r.misAJour} article${r.misAJour > 1 ? "s" : ""} mis à jour depuis le tarif (${r.lues} lignes lues).`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }

  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Importer un tarif">
        <div className="env-h"><h2>Importer un tarif fournisseur</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <p className="fx-note">Fichier CSV avec au moins une colonne référence et une colonne prix d'achat ou prix public. Koji met à jour les articles dont la référence correspond ; les devis déjà faits ne changent pas.</p>
        <label className="ed">Fournisseur
          <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setApercu(null); }}>
            <option value="">Tous (fournisseur préféré)</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="btn btn-sec">{nom || "Choisir le fichier CSV"}<input type="file" accept=".csv,text/csv" hidden onChange={lire} /></label>
        {apercu ? (
          <div className="fx-sum"><span>{apercu.lues} lignes lues · <b>{apercu.trouvees}</b> article{apercu.trouvees > 1 ? "s" : ""} du catalogue trouvé{apercu.trouvees > 1 ? "s" : ""}</span></div>
        ) : null}
        {apercu?.erreurs?.length ? <p className="fx-note">{apercu.erreurs.join(" · ")}</p> : null}
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn-main" disabled={busy || !apercu?.trouvees} onClick={appliquer}>{busy ? "…" : `Mettre à jour ${apercu?.trouvees || ""} article${apercu?.trouvees > 1 ? "s" : ""}`}</button>
        </div>
      </section>
    </>
  );
}

function FicheArticle({ article, reglage, onSaved }) {
  const [mode, setMode] = useState(article.modePrix);
  const [prixManuel, setPrixManuel] = useState(String(article.prixManuel || article.vente || ""));
  const [coef, setCoef] = useState(String(article.coef || reglage.coef));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    setMode(article.modePrix);
    setPrixManuel(String(article.prixManuel || article.vente || ""));
    setCoef(String(article.coef || reglage.coef));
    setNote("");
  }, [article, reglage.coef]);

  const essai = { ...article, modePrix: mode, prixManuel: nombre(prixManuel), coef: nombre(coef) };
  const m = marge(essai, { coefCompte: reglage.coef });
  const unite = article.uniteCond && article.contenance === 1 ? article.uniteCond : article.unit;
  const pref = article.fournisseurs.find((f) => f.prefere) || article.fournisseurs[0];
  const r = article.rendement;

  async function enregistrer() {
    setBusy(true);
    try {
      const { article: maj } = await apiSend("/api/fournitures/articles", { id: article.id, modePrix: mode, prixManuel: nombre(prixManuel), coef: nombre(coef) }, "PATCH");
      onSaved(maj);
      setNote("Enregistré.");
    } catch (e) { setNote(e.message); }
    setBusy(false);
  }

  return (
    <aside className="ob-detail" aria-label={`Article ${article.name}`}>
      <div className="ph-big">
        <Thumb src={article.imageUrl || article.photos?.find((p) => p.startsWith("https://")) || ""} size={96} />
        <div className="ph-s"><Link className="link" href={`/fournitures/nouveau?id=${article.id}`}>+ photo</Link></div>
      </div>
      <div className="ob-h">
        <span className="code">{[article.codeInterne || article.ref, article.famille].filter(Boolean).join(" · ")}</span>
        <h2>{article.name}</h2>
        <span className="muted">{[pref?.supplierName || "Fournisseur à choisir", `conditionnement ${condLibelle(article)}`].join(" · ")}</span>
      </div>
      <div className="ob-grid">
        <div className="ed">Prix d'achat HT<div className="selv">{article.achat > 0 ? `${euro(article.achat)} / ${unite}` : "—"}</div></div>
        <div className="ed">Prix public HT<div className="selv">{article.prixPublic > 0 ? `${euro(article.prixPublic)} / ${unite}` : "—"}</div></div>
      </div>
      <div className="ob-sec">
        <div className="lab">Prix de vente au client</div>
        <div className="seg3" role="group" aria-label="Mode de prix">
          {Object.entries(MODES_PRIX).map(([id, label]) => (
            <button key={id} type="button" className={mode === id ? "on" : ""} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>
        {mode === "public" && !(article.prixPublic > 0) ? <p className="fx-note">Pas de prix public : Koji applique le coefficient du compte (× {nb(reglage.coef)}).</p> : null}
        {mode === "coefficient" ? <label className="ed">Coefficient sur achat<input type="number" min="1" max="5" step="0.05" value={coef} onChange={(e) => setCoef(e.target.value)} /></label> : null}
        {mode === "manuel" ? <label className="ed">Prix de vente HT<input type="number" min="0" step="0.01" value={prixManuel} onChange={(e) => setPrixManuel(e.target.value)} aria-label={`Prix de vente HT en € par ${unite}`} /></label> : null}
        <div className="kv"><span>Prix de vente HT</span><b>{euro(m.vente)} / {unite}</b></div>
        <div className="kv"><span>Marge</span><b>{euro(m.euros)} · {pct(m.pct)}</b></div>
        {m.ecartPublic != null && Math.abs(m.ecartPublic) >= 0.01 ? <p className="fx-note">{m.ecartPublic < 0 ? `sous le prix public de ${euro(-m.ecartPublic)}` : `au-dessus du prix public de ${euro(m.ecartPublic)}`}</p> : null}
      </div>
      {r ? (
        <div className="ob-sec">
          <div className="lab">Rendement · indiqué sur l'emballage</div>
          <div className="kv"><span>1 {article.uniteCond || "conditionnement"} de {nb(r.quantite)} {r.unite}</span><b>= {nb(r.couvre)} m²</b></div>
          <p className="fx-note">soit {nb(r.quantite / r.couvre)} {r.unite}/m²{r.detail ? ` · ${r.detail}` : ""}</p>
          {(r.conditions || []).map((c) => <div className="kv" key={c.label}><span>{c.label}</span><b>{nb(c.couvre)} m² / {article.uniteCond || "u"}</b></div>)}
          <p className="fx-note">Dans un devis : 14,2 m² → {nb(paquetsPourSurface(14.2, r.couvre).exact)} {article.uniteCond || "u"} → <b>{paquetsPourSurface(14.2, r.couvre).paquets}</b> commandés.</p>
        </div>
      ) : null}
      <div className="ob-sec">
        <div className="lab">Utilisation</div>
        <div className="kv"><span>Ouvrages liés</span><b>{article.ouvrages.length ? article.ouvrages.map((o) => o.code).join(", ") : "aucun"}</b></div>
        <div className="kv"><span>Perte famille</span><b>{nb(article.perte)} %{article.uniteCond && article.contenance === 1 ? ` · vendu au ${article.uniteCond}` : article.venteUnite ? " · vendu à l'unité" : ""}</b></div>
      </div>
      <div className="ob-sec">
        <div className="lab">Fournisseurs</div>
        {article.fournisseurs.length ? article.fournisseurs.map((f) => (
          <div className="kv" key={`${f.supplierId}-${f.ref}`}><span>{f.supplierName || "Fournisseur"}</span><b>{euro(f.achat)}{f.prefere ? " · préféré" : ""}</b></div>
        )) : <p className="fx-note">Aucun fournisseur : l'article ne sortira pas sur un bon.</p>}
        <Link className="link" href={`/fournitures/nouveau?id=${article.id}`}>+ Ajouter un fournisseur</Link>
      </div>
      {article.historique.length > 1 ? (
        <div className="ob-sec">
          <div className="lab">Historique des prix</div>
          {article.historique.slice(-4).reverse().map((h) => <div className="kv" key={`${h.date}-${h.achat}`}><span>{jour(h.date)}</span><b>{euro(h.achat)}</b></div>)}
        </div>
      ) : null}
      {note ? <p className="fx-note" role="status">{note}</p> : null}
      <div className="ed-act">
        <Link className="btn btn-sec" href={`/fournitures/nouveau?id=${article.id}`}>Modifier</Link>
        <button type="button" className="btn btn-main" onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
      </div>
    </aside>
  );
}

function FournituresPage() {
  const params = useSearchParams();
  const [tab, setTab] = useState(TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "catalogue");
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [selId, setSelId] = useState("");
  const [importOuvert, setImportOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [nonce, setNonce] = useState(0);

  function charger() {
    apiGet("/api/fournitures/articles").then(setData).catch((e) => setErreur(e.message || "Fournitures indisponibles."));
  }
  useEffect(charger, []);

  function changerTab(id) {
    setTab(id);
    setNonce((n) => n + 1);
    const p = new URLSearchParams(window.location.search);
    if (id === "catalogue") p.delete("tab"); else p.set("tab", id);
    p.delete("bon");
    window.history.replaceState(null, "", `/fournitures${p.toString() ? `?${p}` : ""}`);
  }

  const articles = useMemo(() => data?.articles || [], [data]);
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const l = !q ? articles : articles.filter((a) => [a.name, a.ref, a.codeInterne, a.supplierName, ...(a.synonymes || []), ...a.fournisseurs.map((f) => `${f.supplierName} ${f.ref}`)].join(" ").toLowerCase().includes(q));
    return [...l].sort((a, b) => (a.manques.length ? 1 : 0) - (b.manques.length ? 1 : 0) || a.name.localeCompare(b.name, "fr"));
  }, [articles, recherche]);
  const sel = articles.find((a) => a.id === selId) || liste.find((a) => !a.manques.length) || null;
  const c = data?.chiffres;
  const chantiers = data?.commandesParChantier || [];
  const aPreparer = chantiers.find((x) => x.statut === "a_commander" || x.statut === "a_completer");
  const nbFournisseurs = data?.fournisseurs?.length || 0;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{data ? `${articles.length} article${articles.length > 1 ? "s" : ""} · ${nbFournisseurs} fournisseur${nbFournisseurs > 1 ? "s" : ""} · vente au prix public par défaut` : "Fournitures"}</span>
          <h1>Fournitures</h1>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-sec" onClick={() => setImportOuvert(true)} disabled={!data}>Importer un tarif</button>
          <Link className="btn btn-sec" href="/fournitures/nouveau">Nouvel article</Link>
          <Link className="btn btn-main" href={aPreparer ? `/fournitures/chantier?projet=${aPreparer.projectId}` : "/fournitures?tab=chantiers"} onClick={(e) => { if (!aPreparer) { e.preventDefault(); changerTab("chantiers"); } }}>Préparer les commandes</Link>
        </div>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}

      <div className="kpis">
        <div><div className="l">À commander</div><div className="v">{c ? c.aCommander : "—"}</div><div className="s">{c?.aCommander ? `chantier${c.aCommander > 1 ? "s" : ""} · ${euro(c.aCommanderHt)} HT` : "rien à commander"}</div></div>
        <div><div className="l">Commandé</div><div className="v">{c ? c.commandes : "—"}</div><div className="s">{c?.prochaineLivraison ? `livraison ${new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(new Date(`${c.prochaineLivraison}T12:00:00Z`))}` : c?.commandes ? "livraison à confirmer" : "aucun bon en cours"}</div></div>
        <div><div className="l">Articles incomplets</div><div className="v">{c ? c.incomplets : "—"}</div><div className="s">prix ou fournisseur manquant</div></div>
        <div><div className="l">Marge moyenne</div><div className="v">{c?.margeMoyenne != null ? `${c.margeMoyenne} %` : "—"}</div><div className="s">{c?.margeSource === "bons" ? "sur les 30 derniers jours" : "sur le catalogue"}</div></div>
      </div>

      <FournituresTabs current={tab} onTab={changerTab} counts={{ catalogue: articles.length, chantiers: chantiers.length, fournisseurs: nbFournisseurs }}>
        {tab === "catalogue" ? (
          <label className="fx-search"><span className="sr-only">Rechercher</span><input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Article, référence, fournisseur" aria-label="Rechercher un article" /></label>
        ) : null}
      </FournituresTabs>

      {tab === "catalogue" ? (
        <div className="fp-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div className="tbl">
              {!data ? <p className="muted" style={{ padding: 16 }}>Chargement…</p> : liste.length === 0 ? (
                <div className="empty">{recherche ? "Aucun article ne correspond." : <>Aucun article pour l'instant. <Link className="link" href="/fournitures/nouveau">Ajouter un article</Link> ou importer un tarif.</>}</div>
              ) : (
                <table>
                  <thead><tr><th>Article</th><th>Fournisseur</th><th className="r">Achat HT</th><th className="r">Public HT</th><th className="r">Vente HT</th><th className="r">Marge</th><th>Prix</th></tr></thead>
                  <tbody>
                    {liste.map((a) => {
                      const incomplet = a.manques.length > 0;
                      const pref = a.fournisseurs.find((f) => f.prefere);
                      return (
                        <tr key={a.id} className={`${sel?.id === a.id ? "sel" : ""}${incomplet ? " warn" : ""}`} onClick={() => setSelId(a.id)}>
                          <td><div className="pr-a"><Thumb src={a.imageUrl} /><div><div className="n2">{a.name}</div><div className="sm">{a.codeInterne || a.ref || "—"} · {condLibelle(a)}</div></div></div></td>
                          <td>{pref?.supplierName || "À choisir"}</td>
                          <td className="r">{a.achat > 0 ? euro(a.achat) : "—"}</td>
                          <td className="r sm2">{a.prixPublic > 0 ? euro(a.prixPublic) : "—"}</td>
                          <td className="r b">{incomplet ? <Link className="link" href={`/fournitures/nouveau?id=${a.id}`} onClick={(e) => e.stopPropagation()}>Compléter</Link> : euro(a.vente)}</td>
                          <td className="r">{incomplet ? "—" : pct(a.marge.pct)}</td>
                          <td><span className="mode">{incomplet ? "—" : libelleMode(a, { coefCompte: data.reglage.coef })}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <section className="card" style={{ padding: 20 }}>
              <div className="card-h"><h2>Commandes par chantier</h2><button type="button" className="link" onClick={() => changerTab("chantiers")}>Tout voir</button></div>
              {chantiers.length === 0 ? <p className="fx-note">Aucun chantier avec des fournitures au devis.</p> : chantiers.slice(0, 3).map((x) => (
                <Link className="kv" key={x.projectId} href={`/fournitures/chantier?projet=${x.projectId}`}>
                  <span><b style={{ fontWeight: 600, color: "var(--ink)" }}>{x.title}</b><br />{[x.fournisseurs.length > 1 ? `${x.fournisseurs.length} fournisseurs` : x.fournisseurs[0], `${euro(x.totalHt)} HT`].filter(Boolean).join(" · ")}</span>
                  <b>{STATUT_CHANTIER[x.statut](x)}</b>
                </Link>
              ))}
            </section>
          </div>
          {sel && data ? <FicheArticle article={sel} reglage={data.reglage} onSaved={(maj) => setData((d) => ({ ...d, articles: d.articles.map((a) => (a.id === maj.id ? maj : a)) }))} /> : null}
        </div>
      ) : null}

      {tab === "chantiers" ? (
        <div className="tbl">
          {!data ? <p className="muted" style={{ padding: 16 }}>Chargement…</p> : chantiers.length === 0 ? <div className="empty">Aucun chantier avec des fournitures au devis. Les fournitures choisies sur les lignes du devis et les articles liés aux ouvrages apparaissent ici.</div> : (
            <table>
              <thead><tr><th>Chantier</th><th>Devis</th><th>Fournisseurs</th><th className="r">Achat HT</th><th>État</th><th aria-label="Action" /></tr></thead>
              <tbody>
                {chantiers.map((x) => (
                  <tr key={x.projectId}>
                    <td className="n">{x.title}<div className="sm">{x.address}</div></td>
                    <td className="sm2">{x.quote?.numero ? `${x.quote.numero} · ${x.quote.signe ? "signé" : "estimation"}` : "—"}</td>
                    <td className="sm2">{x.fournisseurs.join(", ") || "—"}</td>
                    <td className="r">{euro(x.totalHt)}</td>
                    <td><span className={`fx-etat ${x.statut === "a_completer" ? "late" : x.statut === "a_commander" ? "wait" : x.statut === "livre" ? "ok" : ""}`}>{STATUT_CHANTIER[x.statut](x)}</span></td>
                    <td className="r"><Link className="btn btn-sec" href={`/fournitures/chantier?projet=${x.projectId}`}>Ouvrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === "bons" ? <BonsOnglet key={nonce} /> : null}
      {tab === "partenaires" ? <PartenairesOnglet key={nonce} onAjoute={charger} /> : null}
      {tab === "stock" ? <StockOnglet /> : null}

      {importOuvert && data ? <ImportTarif fournisseurs={data.fournisseurs} onClose={() => setImportOuvert(false)} onDone={(m) => { setImportOuvert(false); setMessage(m); charger(); }} /> : null}
    </Shell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><FournituresPage /></Suspense>;
}
