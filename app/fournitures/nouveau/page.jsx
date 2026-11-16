"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { MODES_PRIX, UNITES, achatParUnite, modeEffectif, arrondiConditionnement, articlesProches, avecPerte, codeInterne, marge, nombre, perteFamille, r2 } from "../../../lib/fournitures-pro";
import { FournituresTabs } from "../FournituresTabs";
import { Thumb, euro, lireImage, nb } from "../commun";
import "../fournitures.css";

// Ajout (ou modification) d'un article (maquette PRO-07.2) : saisie
// assistée par Koji, conditionnement et pertes, plusieurs fournisseurs,
// prix de vente selon le mode, rendement, ouvrages liés, contrôles.
const CONDITIONNEMENTS = ["unité", "boîte", "sac", "seau", "rouleau", "couronne", "lot", "kit", "palette", "bidon", "carton"];
const VIDE = {
  name: "", ref: "", codeInterne: "", famille: "", unit: "m²", uniteCond: "boîte", contenance: "1", venteUnite: false, perte: "",
  fournisseurs: [], prixPublic: "", publicSource: "", modePrix: "public", coef: "", prixManuel: "",
  rendement: { quantite: "", unite: "kg", couvre: "", detail: "", conditions: [] },
  ouvrages: [], synonymes: [], ficheTechnique: "", photos: [], delai: ""
};

function versFormulaire(a) {
  return {
    ...VIDE,
    ...a,
    contenance: String(a.contenance || 1),
    perte: a.perte == null ? "" : String(a.perte),
    prixPublic: a.prixPublic ? String(a.prixPublic) : "",
    coef: a.coef ? String(a.coef) : "",
    prixManuel: a.prixManuel ? String(a.prixManuel) : "",
    fournisseurs: (a.fournisseurs || []).map((f) => ({ ...f, achatCond: String(f.achatCond || r2((f.achat || 0) * (a.contenance || 1)) || "") })),
    rendement: a.rendement ? { ...VIDE.rendement, ...a.rendement, quantite: String(a.rendement.quantite), couvre: String(a.rendement.couvre) } : VIDE.rendement,
    delai: a.delai == null ? "" : String(a.delai)
  };
}

function NouvelArticle() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") || "";
  const [data, setData] = useState(null);
  const [ouvragesBib, setOuvragesBib] = useState([]);
  const [f, setF] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [scanTexte, setScanTexte] = useState("");
  const [scanPhoto, setScanPhoto] = useState("");
  const [scanNote, setScanNote] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [lien, setLien] = useState({ code: "", conso: "1" });
  const [synonyme, setSynonyme] = useState("");
  const [nouveauFournisseur, setNouveauFournisseur] = useState("");

  useEffect(() => {
    apiGet("/api/fournitures/articles").then((d) => {
      setData(d);
      const a = id ? d.articles.find((x) => x.id === id) : null;
      if (a) setF(versFormulaire(a));
      else if (params.get("nom")) setF((x) => ({ ...x, name: params.get("nom").slice(0, 160) }));
    }).catch((e) => setErreur(e.message));
    apiGet("/api/ouvrages").then((d) => setOuvragesBib(Array.isArray(d.ouvrages) ? d.ouvrages : [])).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const fournisseurs = data?.fournisseurs || [];
  const contenance = nombre(f.contenance, 1) || 1;
  const perte = f.perte === "" ? perteFamille(f.famille) : nombre(f.perte);
  const article = {
    ...f,
    contenance,
    perte,
    prixPublic: nombre(f.prixPublic),
    coef: nombre(f.coef) || null,
    prixManuel: nombre(f.prixManuel),
    fournisseurs: f.fournisseurs.map((x) => ({ ...x, achat: nombre(x.achatCond) > 0 ? achatParUnite(x.achatCond, contenance) : nombre(x.achat) }))
  };
  const m = marge(article, { coefCompte: data?.reglage?.coef });
  const pref = article.fournisseurs.find((x) => x.prefere) || article.fournisseurs[0];
  const prefNom = fournisseurs.find((x) => x.id === pref?.supplierId)?.name || "";
  const exemplePose = 5.8;
  const exempleAvecPerte = avecPerte(exemplePose, perte);
  const exemple = arrondiConditionnement(exempleAvecPerte, contenance, f.venteUnite);
  const proches = useMemo(() => (data && f.name.length > 6 ? articlesProches(f.name, data.articles, id) : []), [data, f.name, id]);
  const lie = f.ouvrages[0];
  const posee = lie ? r2(exemplePose * nombre(lie.conso, 1)) : exemplePose;
  const qDevis = perte > 0 ? avecPerte(posee, perte) : posee;

  async function scanner() {
    setScanBusy(true);
    setScanNote("");
    try {
      const { proposition, remarque } = await apiSend("/api/fournitures/scanner", { photo: scanPhoto || undefined, texte: scanTexte || undefined });
      setF((x) => ({
        ...x,
        ...versFormulaire({ ...x, ...proposition, fournisseurs: proposition.fournisseurs.length ? proposition.fournisseurs : x.fournisseurs, rendement: proposition.rendement || null }),
        codeInterne: x.codeInterne || proposition.codeInterne,
        photos: x.photos
      }));
      setScanNote([
        "Koji a rempli l'article : vérifiez chaque champ avant d'enregistrer.",
        proposition.publicSource ? `Prix public : ${proposition.publicSource}.` : "Prix public non trouvé.",
        proposition.fournisseurLu ? `Fournisseur lu « ${proposition.fournisseurLu} » : absent de vos fournisseurs.` : "",
        remarque
      ].filter(Boolean).join(" "));
    } catch (e) { setScanNote(e.message); }
    setScanBusy(false);
  }

  async function photoScan(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { setScanPhoto(await lireImage(file, 1600)); } catch (e) { setScanNote(e.message); }
  }

  async function ajouterPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || f.photos.length >= 4) return;
    try { const p = await lireImage(file, 900); set({ photos: [...f.photos, p] }); } catch (e) { setErreur(e.message); }
  }

  async function creerFournisseur() {
    const nom = nouveauFournisseur.trim();
    if (!nom) return;
    try {
      const { supplier } = await apiSend("/api/suppliers", { name: nom });
      setData((d) => ({ ...d, fournisseurs: [...d.fournisseurs, { id: supplier.id, name: supplier.name }].sort((a, b) => a.name.localeCompare(b.name, "fr")) }));
      set({ fournisseurs: [...f.fournisseurs, { supplierId: supplier.id, ref: f.ref, achatCond: "", prefere: !f.fournisseurs.length }] });
      setNouveauFournisseur("");
    } catch (e) { setErreur(e.message); }
  }

  function majFournisseur(i, patch) {
    set({ fournisseurs: f.fournisseurs.map((x, j) => (j === i ? { ...x, ...patch } : patch.prefere ? { ...x, prefere: false } : x)) });
  }

  async function enregistrer(autre) {
    setBusy(true);
    setErreur("");
    const corps = {
      ...f,
      contenance,
      perte: f.perte === "" ? null : nombre(f.perte),
      prixPublic: nombre(f.prixPublic),
      coef: nombre(f.coef) || null,
      prixManuel: nombre(f.prixManuel),
      fournisseurs: f.fournisseurs.map((x) => ({ supplierId: x.supplierId, ref: x.ref, achatCond: nombre(x.achatCond), prefere: x.prefere })),
      rendement: nombre(f.rendement.quantite) > 0 && nombre(f.rendement.couvre) > 0 ? { ...f.rendement, quantite: nombre(f.rendement.quantite), couvre: nombre(f.rendement.couvre) } : null,
      delai: f.delai === "" ? null : nombre(f.delai),
      codeInterne: f.codeInterne || codeInterne(f.name, (data?.articles || []).map((a) => a.codeInterne).filter(Boolean))
    };
    try {
      const r = id ? await apiSend("/api/fournitures/articles", { id, ...corps }, "PATCH") : await apiSend("/api/fournitures/articles", corps);
      if (autre) {
        setData((d) => ({ ...d, articles: [...d.articles, r.article] }));
        setF(VIDE);
        setScanNote(`« ${r.article.name} » enregistré. Article suivant :`);
        setScanTexte("");
        setScanPhoto("");
        window.scrollTo({ top: 0 });
        setBusy(false);
        if (id) router.replace("/fournitures/nouveau");
        return;
      }
      router.push("/fournitures");
    } catch (e) { setErreur(e.message); setBusy(false); }
  }

  const controles = [
    { ok: !f.venteUnite ? contenance > 0 && f.uniteCond !== "" : true, texte: "Conditionnement renseigné" },
    { ok: nombre(f.prixPublic) > 0, texte: nombre(f.prixPublic) > 0 ? `Prix public trouvé${f.publicSource ? ` (${f.publicSource})` : ""}` : "Prix public absent : coefficient du compte appliqué" },
    { ok: Boolean(pref), texte: pref ? "Fournisseur préféré défini" : "Aucun fournisseur : l'article ne sortira pas sur un bon" },
    ...proches.map((p) => ({ ok: false, texte: `Article proche : « ${p.name} » · variante de teinte ou doublon ?` }))
  ];

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><Link className="link" href="/fournitures">Fournitures</Link></span>
          <h1>{id ? "Modifier l'article" : "Nouvel article"}</h1>
          <span className="muted">{id ? "Les devis déjà faits gardent leurs prix." : "Brouillon · non proposé par Koji tant qu'il n'est pas enregistré"}</span>
        </div>
        <div className="hact">
          <Link className="btn btn-sec" href="/fournitures">Annuler</Link>
          <button type="button" className="btn btn-sec" disabled={busy || !f.name.trim()} onClick={() => enregistrer(true)}>Enregistrer et créer un autre</button>
          <button type="button" className="btn btn-main" disabled={busy || !f.name.trim()} onClick={() => enregistrer(false)}>{busy ? "…" : "Enregistrer l'article"}</button>
        </div>
      </div>
      <FournituresTabs current="catalogue" />
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}

      <div className="fx-scan">
        <p><b>Photo de l'étiquette, ligne de facture fournisseur ou lien produit : Koji remplit l'article.</b><br />
          <input type="text" value={scanTexte} onChange={(e) => setScanTexte(e.target.value)} placeholder="Coller la ligne de facture ou le lien produit" aria-label="Ligne de facture ou lien produit" style={{ width: "100%", marginTop: 8, height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
          {scanNote ? <span className="fx-note" role="status" style={{ display: "block", marginTop: 6 }}>{scanNote}</span> : null}
        </p>
        {scanPhoto ? <Thumb src={scanPhoto} size={56} /> : null}
        <label className="btn btn-sec">Photo<input type="file" accept="image/*" capture="environment" hidden onChange={photoScan} /></label>
        <button type="button" className="btn btn-main" disabled={scanBusy || (!scanPhoto && !scanTexte.trim())} onClick={scanner}>{scanBusy ? "Lecture…" : "Scanner"}</button>
      </div>

      <div className="fx-form">
        <div>
          <section className="card">
            <div className="card-h"><h2>Article</h2></div>
            <div className="fx-grid2">
              <label className="ed" style={{ gridColumn: "1 / -1" }}>Désignation<input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Grès cérame 60 × 60 rectifié, anthracite" /></label>
              <label className="ed">Code interne · proposé, modifiable<input value={f.codeInterne} onChange={(e) => set({ codeInterne: e.target.value.toUpperCase() })} placeholder={codeInterne(f.name || "Article")} /></label>
              <label className="ed">Famille<input value={f.famille} onChange={(e) => set({ famille: e.target.value })} placeholder="Carrelage · grès cérame" /></label>
              <label className="ed">Unité de vente au client<select value={f.unit} onChange={(e) => set({ unit: e.target.value })}>{UNITES.map((u) => <option key={u}>{u}</option>)}</select></label>
              <div className="ed">TVA<div className="selv">Taux du devis</div></div>
            </div>
          </section>

          <section className="card">
            <div className="card-h"><h2>Conditionnement et pertes</h2></div>
            <div className="fx-grid4">
              <label className="ed">Conditionnement<select value={f.uniteCond} onChange={(e) => set({ uniteCond: e.target.value, venteUnite: e.target.value === "unité" ? true : f.venteUnite })}>{CONDITIONNEMENTS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label className="ed">Contenance · {f.unit} par {f.uniteCond}<input type="number" min="0.01" step="0.01" value={f.contenance} onChange={(e) => set({ contenance: e.target.value })} /></label>
              <label className="ed">Vente à l'unité<select value={f.venteUnite ? "oui" : "non"} onChange={(e) => set({ venteUnite: e.target.value === "oui" })}><option value="non">Non · {f.uniteCond} entière</option><option value="oui">Oui</option></select></label>
              <label className="ed">Perte · % {f.perte === "" ? "· défaut famille" : ""}<input type="number" min="0" max="50" step="1" value={f.perte} placeholder={String(perteFamille(f.famille))} onChange={(e) => set({ perte: e.target.value })} /></label>
            </div>
            <p className="fx-note"><b>Exemple</b> · {nb(exemplePose)} {f.unit} posés → {nb(exempleAvecPerte)} {f.unit} → {exemple.paquets} {f.uniteCond}{exemple.paquets > 1 && !/s$/.test(f.uniteCond) ? "s" : ""}{!f.venteUnite && contenance !== 1 ? ` (${nb(exemple.quantite)} ${f.unit})` : ""}<br />la commande est arrondie au conditionnement ; le client paie les {f.unit} posés + perte, l'écart reste en stock ou se rend.</p>
          </section>

          <section className="card">
            <div className="card-h"><h2>Fournisseurs et prix d'achat</h2></div>
            {f.fournisseurs.length ? (
              <div className="tbl fx-four">
                <table>
                  <thead><tr><th>Fournisseur</th><th>Référence</th><th className="r">Achat HT</th><th>Par</th><th aria-label="Préféré" /><th aria-label="Retirer" /></tr></thead>
                  <tbody>
                    {f.fournisseurs.map((x, i) => {
                      const unitaire = nombre(x.achatCond) > 0 ? achatParUnite(x.achatCond, contenance) : 0;
                      return (
                        <tr key={i}>
                          <td><select value={x.supplierId} onChange={(e) => majFournisseur(i, { supplierId: e.target.value })} aria-label="Fournisseur">{fournisseurs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                          <td><input value={x.ref} onChange={(e) => majFournisseur(i, { ref: e.target.value })} aria-label="Référence fournisseur" /></td>
                          <td className="r"><input type="number" min="0" step="0.01" value={x.achatCond} onChange={(e) => majFournisseur(i, { achatCond: e.target.value })} aria-label={`Prix d'achat HT par ${f.uniteCond}`} style={{ textAlign: "right" }} /></td>
                          <td className="sm2">{f.uniteCond}{unitaire && contenance !== 1 ? ` · ${euro(unitaire)}/${f.unit}` : ""}</td>
                          <td>{x.prefere ? <span className="fx-etat ok">Préféré</span> : <button type="button" className="link" onClick={() => majFournisseur(i, { prefere: true })}>Définir préféré</button>}</td>
                          <td><button type="button" className="link" onClick={() => set({ fournisseurs: f.fournisseurs.filter((_, j) => j !== i) })} aria-label="Retirer ce fournisseur">Retirer</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="fx-note">Aucun fournisseur. Sans fournisseur ni prix, l'article reste « à compléter » et ne sort pas sur les bons.</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              {fournisseurs.length ? <button type="button" className="btn btn-sec" onClick={() => set({ fournisseurs: [...f.fournisseurs, { supplierId: fournisseurs[0].id, ref: f.ref, achatCond: "", prefere: !f.fournisseurs.length }] })}>Ajouter un fournisseur</button> : null}
              <input value={nouveauFournisseur} onChange={(e) => setNouveauFournisseur(e.target.value)} placeholder="Nouveau fournisseur (nom)" aria-label="Nom du nouveau fournisseur" style={{ height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
              <button type="button" className="btn btn-sec" disabled={!nouveauFournisseur.trim()} onClick={creerFournisseur}>Créer</button>
            </div>
          </section>

          <section className="card">
            <div className="card-h"><h2>Prix de vente au client</h2></div>
            <div className="fx-grid2">
              <label className="ed">Prix public HT · €/{f.unit}{f.publicSource ? ` · ${f.publicSource}` : ""}<input type="number" min="0" step="0.01" value={f.prixPublic} onChange={(e) => set({ prixPublic: e.target.value, publicSource: "" })} /></label>
              <div className="ed">Mode
                <div className="seg3" role="group" aria-label="Mode de prix">
                  {Object.entries(MODES_PRIX).map(([k, label]) => <button key={k} type="button" className={f.modePrix === k ? "on" : ""} aria-pressed={f.modePrix === k} onClick={() => set({ modePrix: k })}>{label}</button>)}
                </div>
              </div>
              {f.modePrix === "coefficient" ? <label className="ed">Coefficient sur achat<input type="number" min="1" max="5" step="0.05" value={f.coef} placeholder={String(data?.reglage?.coef || 1.3)} onChange={(e) => set({ coef: e.target.value })} /></label> : null}
              {f.modePrix === "manuel" ? <label className="ed">Prix manuel HT · €/{f.unit}<input type="number" min="0" step="0.01" value={f.prixManuel} onChange={(e) => set({ prixManuel: e.target.value })} /></label> : null}
            </div>
            <div className="fx-sum"><span>Vente HT</span><b>{euro(m.vente)}/{f.unit} · marge {euro(m.euros)}{m.pct != null ? ` · ${m.pct} %` : ""}</b></div>
          </section>

          <section className="card">
            <div className="card-h"><h2>Rendement · indiqué sur l'emballage</h2></div>
            <p className="fx-note">Facultatif. Pour les produits qui se consomment au m² ou au ml : colle, enduit, peinture, mortier, joint. Koji le lit sur la photo du paquet.</p>
            <div className="fx-grid3">
              <label className="ed">Quantité du conditionnement<input type="number" min="0" step="0.1" value={f.rendement.quantite} onChange={(e) => set({ rendement: { ...f.rendement, quantite: e.target.value } })} placeholder="25" /></label>
              <label className="ed">Unité<select value={f.rendement.unite} onChange={(e) => set({ rendement: { ...f.rendement, unite: e.target.value } })}><option>kg</option><option>l</option></select></label>
              <label className="ed">Couvre · m²<input type="number" min="0" step="0.1" value={f.rendement.couvre} onChange={(e) => set({ rendement: { ...f.rendement, couvre: e.target.value } })} placeholder="5" /></label>
              <label className="ed" style={{ gridColumn: "1 / -1" }}>Conditions<input value={f.rendement.detail} onChange={(e) => set({ rendement: { ...f.rendement, detail: e.target.value } })} placeholder="peigne 8 mm, carreaux jusqu'à 30 × 30" /></label>
            </div>
            {f.rendement.conditions.length ? (
              <div className="tbl"><table><thead><tr><th>Autres conditions (même produit)</th><th className="r">Couvre</th><th className="r">Soit</th><th aria-label="Retirer" /></tr></thead><tbody>
                {f.rendement.conditions.map((c, i) => (
                  <tr key={i}><td>{c.label}</td><td className="r">{nb(c.couvre)} m² / {f.uniteCond}</td><td className="r">{nombre(f.rendement.quantite) > 0 ? `${nb(nombre(f.rendement.quantite) / c.couvre)} ${f.rendement.unite}/m²` : "—"}</td><td><button type="button" className="link" onClick={() => set({ rendement: { ...f.rendement, conditions: f.rendement.conditions.filter((_, j) => j !== i) } })}>Retirer</button></td></tr>
                ))}
              </tbody></table></div>
            ) : null}
            <AjoutCondition onAjout={(c) => set({ rendement: { ...f.rendement, conditions: [...f.rendement.conditions, c] } })} />
          </section>

          <section className="card">
            <div className="card-h"><h2>Utilisation et Koji</h2></div>
            <div className="ob-sec">
              <div className="lab">Ouvrages liés · consommation par unité d'ouvrage</div>
              {f.ouvrages.map((o, i) => (
                <div className="kv" key={o.code}><span>{o.code} {o.label}</span><b>{nb(o.conso)} {f.unit}/{o.unite || "u"} <button type="button" className="link" onClick={() => set({ ouvrages: f.ouvrages.filter((_, j) => j !== i) })}>retirer</button></b></div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input list="fx-ouvrages" value={lien.code} onChange={(e) => setLien({ ...lien, code: e.target.value })} placeholder="Code de l'ouvrage (CAR-010)" aria-label="Code de l'ouvrage" style={{ flex: 1, minWidth: 180, height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
                <datalist id="fx-ouvrages">{ouvragesBib.slice(0, 400).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</datalist>
                <input type="number" min="0" step="0.01" value={lien.conso} onChange={(e) => setLien({ ...lien, conso: e.target.value })} aria-label="Consommation par unité d'ouvrage" style={{ width: 90, height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
                <button type="button" className="btn btn-sec" disabled={!lien.code.trim()} onClick={() => {
                  const o = ouvragesBib.find((x) => String(x.code).toUpperCase() === lien.code.trim().toUpperCase());
                  set({ ouvrages: [...f.ouvrages.filter((x) => x.code !== lien.code.trim().toUpperCase()), { code: lien.code.trim().toUpperCase(), label: o?.label || "", conso: nombre(lien.conso, 1) || 1, unite: o?.unit || "" }] });
                  setLien({ code: "", conso: "1" });
                }}>+ lier</button>
              </div>
              <p className="fx-note">C'est ce lien qui fait sortir l'article dans le devis et sur la liste par fournisseur.</p>
            </div>
            <div className="ob-sec">
              <div className="lab">Synonymes</div>
              <div className="fx-chips">{f.synonymes.map((s) => <span key={s}>{s}<button type="button" aria-label={`Retirer ${s}`} onClick={() => set({ synonymes: f.synonymes.filter((x) => x !== s) })}>×</button></span>)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={synonyme} onChange={(e) => setSynonyme(e.target.value)} placeholder="carrelage gris foncé" aria-label="Synonyme" style={{ flex: 1, height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
                <button type="button" className="btn btn-sec" disabled={!synonyme.trim()} onClick={() => { set({ synonymes: [...new Set([...f.synonymes, synonyme.trim()])] }); setSynonyme(""); }}>+ ajouter</button>
              </div>
            </div>
            <div className="fx-grid2">
              <label className="ed">Fiche technique · lien<input value={f.ficheTechnique} onChange={(e) => set({ ficheTechnique: e.target.value })} placeholder="https://… ou classement U4P3" /></label>
              <label className="ed">Délai d'approvisionnement · jours ouvrés<input type="number" min="0" max="120" value={f.delai} onChange={(e) => set({ delai: e.target.value })} /></label>
            </div>
            <div className="ob-sec">
              <div className="lab">Photos du produit</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {f.photos.map((p, i) => <button key={i} type="button" onClick={() => set({ photos: f.photos.filter((_, j) => j !== i) })} aria-label="Retirer la photo" style={{ padding: 0, border: 0, background: "none" }}><Thumb src={p} size={56} /></button>)}
                {f.photos.length < 4 ? <label className="link">+ ajouter<input type="file" accept="image/*" hidden onChange={ajouterPhoto} /></label> : null}
                <span className="fx-note">photo fournisseur, ou prise sur chantier</span>
              </div>
            </div>
          </section>
        </div>

        <div>
          <section className="card">
            <div className="card-h"><h2>Aperçu dans un devis</h2></div>
            <div className="kv"><span><b style={{ color: "var(--ink)" }}>{f.name || "Désignation"}</b></span><b>{nb(qDevis)} {f.unit}</b></div>
            <div className="kv"><span>{lie ? `fourniture de la ligne ${lie.code}` : "fourniture"} · {nb(posee)} {f.unit}{perte ? ` + ${nb(perte)} %` : ""} · {euro(m.vente)}/{f.unit}{modeEffectif(article) === "public" ? " prix public" : ""}</span><b>{euro(qDevis * m.vente)}</b></div>
          </section>
          <section className="card">
            <div className="card-h"><h2>Sur le bon de commande</h2></div>
            <div className="kv"><span>{prefNom || "Fournisseur à choisir"}</span><b>{arrondiConditionnement(qDevis, contenance, f.venteUnite).paquets} {f.uniteCond}{arrondiConditionnement(qDevis, contenance, f.venteUnite).paquets > 1 && !/s$/.test(f.uniteCond) ? "s" : ""} · {euro(arrondiConditionnement(qDevis, contenance, f.venteUnite).quantite * (pref ? achatParUnite(pref.achatCond || 0, contenance) || pref.achat || 0 : 0))} HT</b></div>
            <div className="kv"><span>Livraison</span><b>{f.delai !== "" ? `${f.delai} jours ouvrés` : "délai non renseigné"}</b></div>
          </section>
          <section className="card">
            <div className="card-h"><h2>Contrôles</h2></div>
            <div className="fx-chk">{controles.map((c) => <span key={c.texte} className={c.ok ? "" : "no"}>{c.texte}</span>)}</div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function AjoutCondition({ onAjout }) {
  const [label, setLabel] = useState("");
  const [couvre, setCouvre] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Peigne 10 mm · 30 × 60 à 60 × 60" aria-label="Condition" style={{ flex: 1, minWidth: 200, height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
      <input type="number" min="0" step="0.1" value={couvre} onChange={(e) => setCouvre(e.target.value)} placeholder="m²" aria-label="Surface couverte" style={{ width: 80, height: 36, padding: "0 10px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
      <button type="button" className="link" disabled={!label.trim() || !(nombre(couvre) > 0)} onClick={() => { onAjout({ label: label.trim(), couvre: nombre(couvre) }); setLabel(""); setCouvre(""); }}>+ ajouter une condition</button>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><NouvelArticle /></Suspense>;
}
