"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "../../lib/client-api";
import { nombre, r2 } from "../../lib/fournitures-pro";
import { aujourdhui, euro, jour, jourLong, nb } from "./commun";

// Onglet Partenaires Koji (maquette PRO-07.3) : fournisseurs de proximité
// avec des prix réservés aux utilisateurs Koji. Koji est rémunéré par le
// fournisseur : c'est dit sur la fiche ; le montant n'est jamais affiché.
function Recommander({ onClose }) {
  const [f, setF] = useState({ nom: "", ville: "", contact: "", message: "" });
  const [etat, setEtat] = useState("");
  async function envoyer() {
    setEtat("…");
    try { await apiSend("/api/fournitures/partenaires", { action: "recommander", ...f }); setEtat("ok"); } catch (e) { setEtat(e.message); }
  }
  return (
    <>
      <div className="env-scrim" onClick={onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Recommander un fournisseur">
        <div className="env-h"><h2>Recommander un fournisseur</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        {etat === "ok" ? <p className="notice" role="status">Merci : l'équipe Koji contactera ce fournisseur.</p> : (
          <>
            <label className="ed">Nom du fournisseur<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></label>
            <label className="ed">Ville<input value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} /></label>
            <label className="ed">Contact (e-mail ou téléphone)<input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
            <label className="ed">Message<textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
            {etat && etat !== "…" ? <p className="err" role="alert">{etat}</p> : null}
            <div className="env-act"><button type="button" className="btn btn-sec" onClick={onClose}>Annuler</button><button type="button" className="btn btn-main" disabled={!f.nom.trim() || etat === "…"} onClick={envoyer}>Recommander</button></div>
          </>
        )}
      </section>
    </>
  );
}

function Commander({ partenaire, articles, onClose }) {
  const router = useRouter();
  const [qtes, setQtes] = useState({});
  const [livraisonLe, setLivraisonLe] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const lignes = articles.map((a) => {
    const paquets = Math.max(0, Math.round(nombre(qtes[a.ref])));
    const cont = a.contenance > 0 ? a.contenance : 1;
    const quantite = r2(paquets * cont);
    return { ...a, paquets, quantite, total: r2(quantite * a.prixKoji) };
  }).filter((l) => l.paquets > 0);
  const total = r2(lignes.reduce((s, l) => s + l.total, 0));
  async function creer() {
    setBusy(true);
    try {
      const { bons } = await apiSend("/api/fournitures/bons", {
        livraisonLe,
        lignes: lignes.map((l) => ({ name: l.designation, ref: l.ref, unit: l.unite === "m2" ? "m²" : l.unite, quantite: l.quantite, paquets: l.paquets, uniteCond: String(l.conditionnement).replace(/[\d.,]+.*$/, "").trim(), contenance: l.contenance || 1, prixHt: l.prixKoji, partenaireId: partenaire.id }))
      });
      router.push(`/fournitures?tab=bons&bon=${bons[0].id}`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }
  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel wide" role="dialog" aria-modal="true" aria-label={`Commander chez ${partenaire.nom}`}>
        <div className="env-h"><h2>Commander · {partenaire.nom}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <p className="fx-note">Quantités en conditionnements. Le bon porte un numéro Koji et le code partenaire ; il est créé en brouillon, rien ne part avant votre envoi.</p>
        <div className="tbl"><table><tbody>
          {articles.map((a) => (
            <tr key={a.ref}><td><div className="n2">{a.designation}</div><div className="sm">{a.ref} · {a.conditionnement}</div></td><td className="r">{euro(a.prixKoji)}/{a.unite === "m2" ? "m²" : a.unite}</td>
              <td className="r"><input type="number" min="0" step="1" value={qtes[a.ref] || ""} onChange={(e) => setQtes({ ...qtes, [a.ref]: e.target.value })} aria-label={`Nombre de ${a.conditionnement || "conditionnements"} pour ${a.designation}`} style={{ width: 70, height: 32, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} /></td></tr>
          ))}
        </tbody></table></div>
        <label className="ed">Livraison souhaitée<input type="date" min={aujourdhui()} value={livraisonLe} onChange={(e) => setLivraisonLe(e.target.value)} /></label>
        <div className="fx-sum"><span>{lignes.length} ligne{lignes.length > 1 ? "s" : ""}</span><b>Total HT · prix Koji {euro(total)}</b></div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act"><button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button><button type="button" className="btn btn-main" disabled={busy || !lignes.length} onClick={creer}>{busy ? "…" : "Préparer le bon"}</button></div>
      </section>
    </>
  );
}

function Fiche({ id, onBack, onAjoute }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [busy, setBusy] = useState("");
  const [commander, setCommander] = useState(false);
  const charger = () => apiGet(`/api/fournitures/partenaires?id=${encodeURIComponent(id)}`).then(setData).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (data?.articles || []).filter((a) => !q || `${a.designation} ${a.ref}`.toLowerCase().includes(q));
  }, [data, recherche]);
  async function ajouter(ref) {
    setBusy(ref);
    try { await apiSend("/api/fournitures/partenaires", { action: "ajouter", partenaireId: id, ref }); await charger(); onAjoute?.(); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  if (erreur && !data) return <p className="err" role="alert">{erreur}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  const p = data.partenaire;
  return (
    <>
      <div className="head" style={{ marginTop: 0 }}>
        <div className="stack">
          <span className="eyebrow"><button type="button" className="link" onClick={onBack}>Partenaires Koji</button></span>
          <h2 style={{ margin: 0 }}>{p.nom} <span className="fx-badge">Partenaire Koji</span></h2>
          <span className="muted">{[p.metiers, p.zone, p.livraison ? `livraison ${p.livraison}` : "", p.franco ? `franco ${p.franco}` : ""].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="hact">
          {p.email ? <a className="btn btn-sec" href={`mailto:${p.email}`}>Contacter</a> : null}
          <button type="button" className="btn btn-main" disabled={!p.prixAJour} onClick={() => setCommander(true)}>Commander</button>
        </div>
      </div>
      <div className="kpis">
        <div><div className="l">Mercuriale Koji</div><div className="v">{p.articles}</div><div className="s">articles{p.validite ? ` · valable jusqu'au ${jourLong(p.validite)}` : ""}</div></div>
        <div><div className="l">Écart moyen</div><div className="v">{p.ecart != null ? `${p.ecart > 0 ? "+ " : "− "}${Math.abs(p.ecart)} %` : "—"}</div><div className="s">prix Koji vs prix public</div></div>
        <div><div className="l">Dans mon catalogue</div><div className="v">{p.dansCatalogue}</div><div className="s">articles ajoutés</div></div>
        <div><div className="l">Commandes</div><div className="v">{p.commandes}</div><div className="s">depuis Koji{p.commandes ? ` · ${euro(p.commandesHt)} HT` : ""}</div></div>
      </div>
      <p className="notice" role="note">Prix Koji : réservés aux utilisateurs Koji, fixés par le fournisseur. Koji est rémunéré par le fournisseur sur les commandes passées depuis l'application. Tu peux négocier ton propre tarif en direct et le saisir dans ton catalogue.</p>
      {!p.prixAJour ? <p className="err" role="alert">Prix à mettre à jour : la mercuriale n'est plus valable, commande désactivée.</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      <label className="fx-search" style={{ marginLeft: 0, maxWidth: 360 }}><input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher dans la mercuriale" aria-label="Rechercher dans la mercuriale" /></label>
      <div className="tbl">
        <table>
          <thead><tr><th>Article</th><th>Unité</th><th className="r">Prix Koji HT</th><th className="r">Public HT</th><th aria-label="Action" /></tr></thead>
          <tbody>
            {liste.map((a) => (
              <tr key={a.ref}>
                <td><div className="n2">{a.designation}</div><div className="sm">{a.ref} · {a.conditionnement}</div></td>
                <td>{a.unite === "m2" ? "m²" : a.unite}</td>
                <td className="r b">{euro(a.prixKoji)}</td>
                <td className="r sm2">{a.prixPublic > 0 ? euro(a.prixPublic) : "—"}</td>
                <td className="r">{a.dansCatalogue ? <span className="fx-etat ok">Dans mon catalogue</span> : <button type="button" className="btn btn-sec" disabled={busy === a.ref || !p.prixAJour} onClick={() => ajouter(a.ref)}>{busy === a.ref ? "…" : "Ajouter"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fx-note">« Ajouter » copie l'article dans ton catalogue avec le prix Koji comme prix d'achat ; vente au prix public par défaut. Ton fournisseur préféré sur tes autres articles ne change pas.</p>
      {commander ? <Commander partenaire={p} articles={data.articles} onClose={() => setCommander(false)} /> : null}
    </>
  );
}

export function PartenairesOnglet({ onAjoute }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [selId, setSelId] = useState("");
  const [reco, setReco] = useState(false);
  useEffect(() => { apiGet("/api/fournitures/partenaires").then(setData).catch((e) => setErreur(e.message)); }, []);
  if (erreur) return <p className="err" role="alert">{erreur}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (selId) return <Fiche id={selId} onBack={() => setSelId("")} onAjoute={onAjoute} />;
  return (
    <>
      <p className="fx-note">Fournisseurs de proximité avec des prix réservés aux utilisateurs Koji. Koji est rémunéré par le fournisseur sur les commandes passées depuis l'application.</p>
      {data.partenaires.length === 0 ? (
        <div className="empty">Pas encore de partenaire Koji près de tes chantiers. Les premiers fournisseurs rejoignent Koji ; tu peux en recommander un.</div>
      ) : (
        <div className="fx-grid2">
          {data.partenaires.map((p) => (
            <button type="button" key={p.id} className="card" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => setSelId(p.id)}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span className="thumb" style={{ width: 44, height: 44, fontWeight: 700 }}>{p.initiales}</span>
                <div><div className="n2">{p.nom} <span className="fx-badge">Partenaire Koji</span></div><div className="sm">{[p.metiers, p.zone, p.livraison ? `livraison ${p.livraison}` : ""].filter(Boolean).join(" · ")}</div></div>
              </div>
              <p className="fx-note" style={{ margin: "10px 0 0" }}>{nb(p.articles, 0)} articles · {p.prixAJour ? `prix valables jusqu'au ${jour(p.validite)}` : "prix à mettre à jour"}{p.misAJour ? ` · mise à jour le ${jour(p.misAJour)}` : ""}</p>
            </button>
          ))}
        </div>
      )}
      <section className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>Tu connais un fournisseur qui voudrait rejoindre Koji ?</span>
        <button type="button" className="btn btn-sec" onClick={() => setReco(true)}>Le recommander</button>
      </section>
      {reco ? <Recommander onClose={() => setReco(false)} /> : null}
    </>
  );
}
