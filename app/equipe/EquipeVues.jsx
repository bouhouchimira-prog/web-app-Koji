"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "../../lib/client-api";
import { ajouterJours, heuresDecimales, jourCourt, lundiDe } from "../../lib/equipe-pro";
import { LANGUES } from "../../lib/compte-pro";

// Vues de l'Équipe (maquettes PRO-16 à 16.3). Données : /api/equipe.
const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const Plus = () => <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, stroke: "currentColor", fill: "none", strokeWidth: 2 }}><path d="M12 5v14M5 12h14" /></svg>;
const Alerte = () => <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 16H3zM12 10v4M12 17h.01" /></svg></span>;
const Etoile = () => <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg></span>;

export const initiales = (nom = "") => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase() || "?";
const dateLongue = (jour) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
const dateCourte = (jour) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
const moisAnnee = (jour) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
const h = (min) => heuresDecimales(min).replace(",0 h", " h");
const langueFr = (id) => (LANGUES.find((l) => l.id === id) || LANGUES[0]).fr.replace("par défaut", "français");
const smsLien = (tel, texte) => `sms:${String(tel || "").replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(texte)}`;
const euros = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

export function EnTete({ eyebrow, titre, onglet, aValider, actions }) {
  return (
    <>
      <div className="head">
        <div className="stack"><span className="eyebrow">{eyebrow}</span><h1>{titre}</h1></div>
        <div className="hact">{actions}</div>
      </div>
      {onglet ? (
        <div className="tbar eq-tabs">
          <nav className="wtabs" aria-label="Équipe">
            <Link href="/equipe" className={onglet === "aujourdhui" ? "on" : ""}>Aujourd'hui</Link>
            <Link href="/equipe/heures" className={onglet === "heures" ? "on" : ""}>Heures{aValider ? <span>à valider</span> : null}</Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}

// PRO-16 : qui est où aujourd'hui, ce que Koji a appris.
export function Aujourdhui({ d, recharger, setErreur }) {
  const [masques, setMasques] = useState([]);
  const docs = d.documents || [];
  const appris = (d.appris || []).filter((a) => !masques.includes(a.cle));
  async function plusTard(cle) {
    setMasques((m) => [...m, cle]);
    try { await apiSend("/api/equipe", { action: "masquer-appris", cle }); } catch (e) { setErreur(e.message); }
  }
  if (!d.equipe.length) {
    return (
      <div className="card eq-vide">
        <h2>Votre équipe</h2>
        <p className="eq-p2">Ajoutez vos compagnons : ils reçoivent un lien par SMS, voient leur journée et pointent leurs heures en deux boutons. Aucun prix ne leur est montré.</p>
        <Link className="btn btn-main" href="/equipe/nouveau"><Plus />Ajouter un compagnon</Link>
      </div>
    );
  }
  return (
    <>
      <div className="eq-kp">
        <div><span>Sur chantier</span><b>{d.kpis.surChantier} sur {d.kpis.total}</b></div>
        <div><span>Heures cette semaine</span><b>{h(d.kpis.heuresSemaine)}</b></div>
        <div>
          <span>Document{docs.length > 1 ? "s" : ""} à renouveler</span><b>{docs.length}</b>
          {docs[0] ? <small>{docs[0].document.replace(/^./, (c) => c.toLowerCase())} de {docs[0].nom.split(" ")[0]}, {dateCourte(docs[0].jusqua)}{docs[0].expire ? " (expiré)" : ""}</small> : <small>rien dans le mois</small>}
        </div>
      </div>
      <div className="eq-g2">
        <div className="card">
          <div className="card-h"><h2>Qui est où, aujourd'hui</h2><span className="sm2">{dateLongue(d.aujourdhui)}</span></div>
          {d.equipe.map((w) => (
            <Link key={w.id} href={`/equipe/${w.id}`} className={`eq-row ${w.statut === "conge" ? "off" : ""}`}>
              <span className="eq-av">{initiales(w.nom)}</span>
              <div className="w"><strong>{w.nom}</strong><small>{w.metier || w.roleLabel}</small></div>
              <div className="c">{w.chantier || <span className="sm2">—</span>}</div>
              {w.statut === "arrive" ? <span className="eq-ok"><Check />{w.texte}</span> : w.statut === "pas_arrive" ? <span className="tag tag-o">{w.texte}</span> : <span className="sm2">{w.texte}</span>}
            </Link>
          ))}
          <Link className="link eq-more" href="/calendrier">Voir le planning de la semaine</Link>
        </div>
        <div className="card">
          <div className="card-h"><h2>Ce que Koji a appris</h2></div>
          {appris.length ? appris.map((a) => (
            <div key={a.cle} style={{ paddingBottom: 12 }}>
              <div className="eq-lr"><span>{a.titre}</span><b>{a.resume}</b></div>
              <p className="eq-p2">{a.texte}</p>
              <div className="eq-act">
                <button type="button" className="link" onClick={() => plusTard(a.cle)}>Plus tard</button>
                <Link className="btn btn-main" href={`/bibliotheque-ouvrages?q=${encodeURIComponent(a.code || a.lot)}`}>Mettre à jour mes prix</Link>
              </div>
            </div>
          )) : <p className="eq-p2 muted">Quand les heures passées sur un ouvrage dépassent nettement le temps prévu au devis, Koji vous le montre ici, avec le temps réel par unité à reporter dans votre bibliothèque.</p>}
        </div>
      </div>
    </>
  );
}

// PRO-16.2 : feuille de la semaine, correction, validation, rappel, comptable.
export function Heures({ semaine, setSemaine, setErreur, setMessage, onChange, aValider }) {
  const [s, setS] = useState(null);
  const [edition, setEdition] = useState(null);
  const [busy, setBusy] = useState("");
  const [cache, setCache] = useState([]);
  const [rappel, setRappel] = useState(null);
  const [comptable, setComptable] = useState(null);
  const charger = () => apiGet(`/api/equipe?semaine=${semaine}`).then(setS).catch((e) => setErreur(e.message));
  useEffect(() => { setS(null); charger(); }, [semaine]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <><EnTete eyebrow="Semaine" titre="Heures" onglet="heures" aValider={aValider} /><p className="muted">Chargement…</p></>;
  const g = s.grille;
  const manquant = s.remarques.find((r) => r.type === "manquant" && !cache.includes(r.date));
  const douteux = s.remarques.filter((r) => r.type === "depart");
  const noms = new Map(g.lignes.map((l) => [l.workerId, l.nom]));

  async function enregistrer(conge = false) {
    setBusy("case");
    try {
      await apiSend("/api/equipe", { action: "corriger", workerId: edition.workerId, date: edition.date, minutes: Number(String(edition.valeur).replace(",", ".")) * 60, conge });
      setEdition(null);
      await charger();
      onChange?.();
    } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  async function valider() {
    setBusy("valider");
    try { await apiSend("/api/equipe", { action: "valider", lundi: g.lundi }); setMessage("Semaine validée : les heures comptent dans la marge des chantiers."); await charger(); onChange?.(); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  async function envoyerRappel() {
    setBusy("rappel");
    try { const r = await apiSend("/api/equipe", { action: "rappel", date: rappel.date, workerIds: rappel.workerIds }); setRappel({ ...rappel, envoye: r }); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  async function envoyerComptable() {
    setBusy("comptable");
    try { const r = await apiSend("/api/equipe", { action: "comptable", lundi: g.lundi, to: comptable }); setMessage(`Heures envoyées à ${r.to}.`); setComptable(null); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  const caseTexte = (c) => {
    if (c.statut === "conge") return "congé";
    if (c.statut === "manquant") return "—";
    if (c.statut === "a_venir") return "";
    if (c.statut === "douteux") return `${h(c.minutes)} ?`;
    return h(c.minutes);
  };
  const ordi = new Set(s.depuisOrdinateur || []);
  const fin = ajouterJours(g.lundi, 4);
  return (
    <>
      <EnTete eyebrow={`Semaine du ${dateCourte(g.lundi).replace(/ \S+$/, "")} au ${dateLongue(fin).replace(/^\S+ /, "")}`} titre="Heures" onglet="heures" aValider={!s.validation && g.lignes.length > 0} actions={<button type="button" className="btn btn-sec" onClick={() => setComptable(s.comptableEmail || "")}>Envoyer au comptable</button>} />
      {manquant ? (
        <div className="eq-al">
          <Alerte />
          <div><strong>{manquant.texte}</strong><small>{manquant.detail}</small></div>
          <button type="button" className="link" onClick={() => setCache((c) => [...c, manquant.date])}>Plus tard</button>
          <button type="button" className="btn btn-main" onClick={() => setRappel({ date: manquant.date, workerIds: manquant.workerIds })}>Voir</button>
        </div>
      ) : null}
      {rappel ? (
        <div className="card">
          <div className="card-h"><h2>Rappel de pointage · {dateLongue(rappel.date)}</h2><button type="button" className="link" onClick={() => setRappel(null)}>Fermer</button></div>
          {rappel.envoye ? (
            <>
              <p className="eq-ok-msg">Rappel envoyé dans Koji à {rappel.envoye.envoyes} compagnon{rappel.envoye.envoyes > 1 ? "s" : ""}.</p>
              {rappel.envoye.telephones.map((t) => <a key={t.id} className="btn btn-sec" style={{ marginTop: 8, marginRight: 8 }} href={smsLien(t.telephone, `Bonjour ${t.nom.split(" ")[0]}, tu n'as pas pointé le ${dateCourte(rappel.date)}. Peux-tu indiquer tes heures dans Koji ?`)}>SMS à {t.nom}</a>)}
            </>
          ) : (
            <>
              <p className="eq-p2">{rappel.workerIds.map((id) => noms.get(id)).join(", ")} recevr{rappel.workerIds.length > 1 ? "ont" : "a"} un rappel dans Koji pour indiquer ses heures.</p>
              <div className="eq-act"><button type="button" className="btn btn-main" disabled={busy === "rappel"} onClick={envoyerRappel}>{busy === "rappel" ? "Envoi…" : "Envoyer le rappel"}</button></div>
            </>
          )}
        </div>
      ) : null}
      <div className="eq-nav">
        <button type="button" className="link" onClick={() => setSemaine(ajouterJours(g.lundi, -7))}>‹ Semaine précédente</button>
        {g.lundi !== lundiDe(new Date().toISOString().slice(0, 10)) ? <button type="button" className="link" onClick={() => setSemaine(ajouterJours(g.lundi, 7))}>Semaine suivante ›</button> : null}
      </div>
      <div className="card">
        <div className="eq-scroll">
          <table className="eq-t">
            <thead><tr><th>Compagnon</th>{g.dates.map((dt) => <th key={dt} className="c">{jourCourt(dt)}</th>)}<th className="r">Total</th></tr></thead>
            <tbody>
              {g.lignes.map((l) => (
                <tr key={l.workerId}>
                  <td className="b">{l.nom}</td>
                  {l.cases.map((c) => {
                    const ouvert = edition && edition.workerId === l.workerId && edition.date === c.date;
                    const cls = `c ${c.statut === "conge" ? "off" : ""} ${c.statut === "douteux" ? "pv" : ""} ${c.statut === "corrige" ? "cor" : ""}`;
                    return (
                      <td key={c.date} className={cls}>
                        {ouvert ? (
                          <span className="eq-ed">
                            <input aria-label="Heures" inputMode="decimal" value={edition.valeur} onChange={(e) => setEdition({ ...edition, valeur: e.target.value })} autoFocus />
                            <button type="button" className="btn btn-main" disabled={busy === "case"} onClick={() => enregistrer(false)}>OK</button>
                            <button type="button" className="link" onClick={() => enregistrer(true)}>congé</button>
                            <button type="button" className="link" onClick={() => setEdition(null)}>×</button>
                          </span>
                        ) : (
                          <button type="button" disabled={c.statut === "a_venir" && c.date > new Date().toISOString().slice(0, 10)} title={c.statut === "corrige" ? "Heures corrigées" : ordi.has(`${l.workerId}:${c.date}`) ? "Pointé depuis un ordinateur" : "Corriger"} onClick={() => setEdition({ workerId: l.workerId, date: c.date, valeur: String(Math.round(c.minutes / 6) / 10 || 7).replace(".", ",") })}>
                            <span className={c.statut === "manquant" ? "eq-n" : ""}>{caseTexte(c)}</span>{ordi.has(`${l.workerId}:${c.date}`) ? <sup>ordi</sup> : null}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="r b">{h(l.total)}</td>
                </tr>
              ))}
              {s.sousTraitants.map((st) => <tr key={st.id} className="off"><td>{st.nom} <small>sous-traitant · non compté</small></td>{g.dates.map((dt) => <td key={dt} className="c">—</td>)}<td className="r">—</td></tr>)}
            </tbody>
          </table>
        </div>
        {douteux.map((r) => (
          <div key={`${r.workerId}${r.date}`} className="eq-kj"><Etoile /><div><strong>{r.texte}</strong><small>{r.detail}</small></div></div>
        ))}
        <div className="eq-act">
          <span className="sm2" style={{ marginRight: "auto" }}>{s.validation ? `Semaine validée le ${dateCourte(s.validation.valideLe.slice(0, 10))}. ` : ""}Les heures validées comptent dans la marge de chaque chantier.</span>
          <button type="button" className="btn btn-main" disabled={busy === "valider" || !g.lignes.length} onClick={valider}>{busy === "valider" ? "Validation…" : s.validation ? "Valider à nouveau" : "Valider la semaine"}</button>
        </div>
      </div>
      {comptable !== null ? (
        <div className="card">
          <div className="card-h"><h2>Envoyer au comptable</h2><button type="button" className="link" onClick={() => setComptable(null)}>Fermer</button></div>
          <p className="eq-p2">Heures et absences de la semaine, une ligne par compagnon et par jour (fichier pour tableur). La paie reste chez votre cabinet ou dans son logiciel.</p>
          <div className="eq-f" style={{ marginTop: 10 }}><label htmlFor="eq-cpt">Adresse du comptable</label><input id="eq-cpt" type="email" value={comptable} onChange={(e) => setComptable(e.target.value)} /></div>
          <div className="eq-act"><button type="button" className="btn btn-main" disabled={busy === "comptable"} onClick={envoyerComptable}>{busy === "comptable" ? "Envoi…" : "Envoyer"}</button></div>
        </div>
      ) : null}
      <p className="sm2">Touchez une case pour corriger les heures ou indiquer un congé ; chaque correction est gardée dans l'historique. « ordi » : pointé depuis un ordinateur.</p>
    </>
  );
}

// PRO-16.1 : fiche compagnon.
export function Fiche({ id, setErreur, setMessage }) {
  const router = useRouter();
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState("");
  const charger = () => apiGet(`/api/equipe?id=${encodeURIComponent(id)}`).then(setD).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="muted">Chargement…</p>;
  const f = d.fiche;
  const max = Math.max(40 * 60, ...f.heures.map((x) => x.minutes));
  const auj = new Date().toISOString().slice(0, 10);
  const dans30 = ajouterJours(auj, 30);

  async function action(payload, ok) {
    setBusy(payload.action);
    try { const r = await apiSend("/api/equipe", { id, ...payload }); if (ok) setMessage(ok); await charger(); return r; } catch (e) { setErreur(e.message); }
    finally { setBusy(""); }
  }
  return (
    <>
      <EnTete
        eyebrow={`${f.metier || f.roleLabel}${f.depuis ? ` · dans l'équipe depuis ${moisAnnee(f.depuis)}` : ""}`}
        titre={f.nom}
        actions={f.telephone ? <><a className="btn btn-sec" href={`tel:${f.telephone.replace(/[^\d+]/g, "")}`}>Appeler</a><a className="btn btn-sec" href={smsLien(f.telephone, "")}>Message</a></> : null}
      />
      <div className="eq-g3">
        <div className="card">
          <div className="card-h"><h2>Infos</h2>{edit ? null : <button type="button" className="link" onClick={() => setEdit({ role: f.role, langue: f.langue, telephone: f.telephone, metier: f.metier, coutHoraire: f.coutHoraire || "" })}>Modifier</button>}</div>
          {edit ? (
            <>
              <div className="eq-f"><label htmlFor="eq-r">Rôle</label><select id="eq-r" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(d.roles).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></div>
              <div className="eq-f"><label htmlFor="eq-m">Métier</label><input id="eq-m" value={edit.metier} onChange={(e) => setEdit({ ...edit, metier: e.target.value })} /></div>
              <div className="eq-f"><label htmlFor="eq-l">Langue</label><select id="eq-l" value={edit.langue} onChange={(e) => setEdit({ ...edit, langue: e.target.value })}>{LANGUES.map((l) => <option key={l.id} value={l.id}>{langueFr(l.id)}</option>)}</select></div>
              <div className="eq-f"><label htmlFor="eq-t">Téléphone</label><input id="eq-t" type="tel" value={edit.telephone} onChange={(e) => setEdit({ ...edit, telephone: e.target.value })} /></div>
              <div className="eq-f"><label htmlFor="eq-c">Coût horaire (€), pour vos marges</label><input id="eq-c" inputMode="decimal" value={edit.coutHoraire} onChange={(e) => setEdit({ ...edit, coutHoraire: e.target.value })} /></div>
              <div className="eq-act"><button type="button" className="link" onClick={() => setEdit(null)}>Annuler</button><button type="button" className="btn btn-main" disabled={busy === "modifier"} onClick={async () => { await action({ action: "modifier", ...edit, coutHoraire: Number(String(edit.coutHoraire).replace(",", ".")) || 0 }, "Fiche enregistrée."); setEdit(null); }}>Enregistrer</button></div>
            </>
          ) : (
            <>
              <div className="eq-kv"><span>Rôle</span><b>{f.roleLabel} <small>· {d.roles[f.role].detail}</small></b></div>
              <div className="eq-kv"><span>Langue</span><b>{langueFr(f.langue)}</b></div>
              <div className="eq-kv"><span>Téléphone</span><b>{f.telephone || "—"}</b></div>
              <div className="eq-kv"><span>Coût horaire, pour vos marges</span><b>{f.coutHoraire ? euros(f.coutHoraire) : "—"} <small>· vous seul le voyez</small></b></div>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-h"><h2>Heures, 4 semaines</h2></div>
          {f.heures.map((x) => (
            <div key={x.lundi} className="eq-hr"><span>{x.semaine}</span><span className="eq-tr"><i style={{ width: `${(x.minutes / max) * 100}%` }} /><em style={{ left: `${(35 * 60 / max) * 100}%` }} /></span><b>{h(x.minutes)}</b></div>
          ))}
          <p className="sm2">Trait pointillé : 35 h. {f.semaine.chantiers.length ? `Cette semaine : ${f.semaine.chantiers.join(", ")}.` : ""}</p>
        </div>
        <div className="card">
          <div className="card-h"><h2>Documents</h2></div>
          {f.documents.map((x) => (
            <div key={x.id} className={`eq-hb ${x.jusqua <= dans30 ? "ko" : ""}`}>
              <div><strong>{x.nom}</strong><small>{x.jusqua < auj ? `expiré le ${dateCourte(x.jusqua)}` : x.jusqua <= dans30 ? `expire le ${dateCourte(x.jusqua)}` : `valable jusqu'en ${moisAnnee(x.jusqua)}`}</small></div>
              <button type="button" className="link" onClick={() => action({ action: "retirer-document", documentId: x.id })}>Retirer</button>
            </div>
          ))}
          {doc ? (
            <div style={{ marginTop: 10 }}>
              <div className="eq-f"><label htmlFor="eq-dn">Document</label><input id="eq-dn" placeholder="Carte BTP, formation amiante…" value={doc.nom} onChange={(e) => setDoc({ ...doc, nom: e.target.value })} /></div>
              <div className="eq-f"><label htmlFor="eq-dj">Valable jusqu'au</label><input id="eq-dj" type="date" value={doc.jusqua} onChange={(e) => setDoc({ ...doc, jusqua: e.target.value })} /></div>
              <div className="eq-act"><button type="button" className="link" onClick={() => setDoc(null)}>Annuler</button><button type="button" className="btn btn-main" disabled={busy === "document"} onClick={async () => { await action({ action: "document", ...doc }); setDoc(null); }}>Ajouter</button></div>
            </div>
          ) : <button type="button" className="btn btn-sec" style={{ marginTop: 10 }} onClick={() => setDoc({ nom: "", jusqua: "" })}>Ajouter un document</button>}
          <p className="sm2">Koji vous prévient un mois avant chaque date.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Accès à Koji</h2></div>
        {f.invitation ? (
          <>
            <p className="eq-p2">Lien d'invitation valable jusqu'au {dateCourte(ajouterJours(f.invitation.creeLe.slice(0, 10), 7))}{f.dejaConnecte ? " · déjà ouvert" : ""}. Code pour l'app : <b>{f.invitation.code}</b></p>
            <div className="eq-msg">{f.invitation.message}</div>
            <div className="eq-act" style={{ justifyContent: "flex-start" }}>
              {f.telephone ? <a className="btn btn-main" href={smsLien(f.telephone, f.invitation.message)}>Envoyer par SMS</a> : null}
              <button type="button" className="btn btn-sec" onClick={() => { navigator.clipboard?.writeText(f.invitation.message); setMessage("Message copié."); }}>Copier le message</button>
            </div>
          </>
        ) : (
          <p className="eq-p2">{f.dejaConnecte ? `${f.nom.split(" ")[0]} est connecté à Koji.` : "Aucune invitation en cours."} Renvoyez une invitation s'il change de téléphone.</p>
        )}
        <div className="eq-act">
          <button type="button" className="link" onClick={async () => { if (window.confirm(`Retirer ${f.nom} de l'équipe ? Il n'aura plus accès à Koji ; ses heures restent dans l'historique.`)) { await action({ action: "retirer" }); router.push("/equipe"); } }}>Retirer de l'équipe</button>
          <button type="button" className="btn btn-sec" disabled={busy === "inviter"} onClick={() => action({ action: "inviter" }, "Nouvelle invitation prête.")}>{f.invitation ? "Nouveau lien" : "Renvoyer l'invitation"}</button>
        </div>
      </div>
    </>
  );
}

// PRO-16.3 : ajouter un compagnon (quatre champs, trois rôles, invitation).
export function Ajouter({ roles, setErreur, onFait }) {
  const router = useRouter();
  const [f, setF] = useState({ nom: "", telephone: "", metier: "", langue: "fr", role: "compagnon", email: "" });
  const [busy, setBusy] = useState(false);
  const [fait, setFait] = useState(null);
  const fermer = () => router.push("/equipe");
  async function envoyer() {
    setBusy(true);
    try { const r = await apiSend("/api/equipe", { action: "ajouter", ...f }); setFait(r); onFait?.(); } catch (e) { setErreur(e.message); }
    setBusy(false);
  }
  return (
    <div className="eq-veil" role="dialog" aria-modal="true" aria-label="Ajouter un compagnon" onClick={(e) => { if (e.target === e.currentTarget) fermer(); }}>
      <div className="eq-dlg">
        <div className="card-h"><h2>{fait ? "Invitation prête" : "Ajouter un compagnon"}</h2><button type="button" className="link" onClick={fermer}>Fermer</button></div>
        {fait ? (
          <>
            <p className="eq-p2">{f.nom} est dans l'équipe. Envoyez-lui ce message depuis votre téléphone : il ouvre Koji sans mot de passe{f.email ? " (le lien lui a aussi été envoyé par e-mail)" : ""}.</p>
            <div className="eq-msg">{fait.invitation.message}</div>
            <p className="sm2">Dans l'app Koji Pro, il peut aussi entrer le code <b>{fait.invitation.code}</b>. Lien valable 7 jours.</p>
            <div className="eq-act">
              <Link className="link" href={`/equipe/${fait.id}`}>Ouvrir sa fiche</Link>
              <button type="button" className="btn btn-sec" onClick={() => navigator.clipboard?.writeText(fait.invitation.message)}>Copier le message</button>
              {f.telephone ? <a className="btn btn-main" href={smsLien(f.telephone, fait.invitation.message)}>Envoyer par SMS</a> : null}
            </div>
          </>
        ) : (
          <>
            <div className="eq-f2">
              <div className="eq-f"><label htmlFor="ad-n">Prénom et nom</label><input id="ad-n" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} autoFocus /></div>
              <div className="eq-f"><label htmlFor="ad-t">Téléphone</label><input id="ad-t" type="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></div>
              <div className="eq-f"><label htmlFor="ad-m">Métier</label><input id="ad-m" placeholder="Plaquiste, carreleur…" value={f.metier} onChange={(e) => setF({ ...f, metier: e.target.value })} /></div>
              <div className="eq-f"><label htmlFor="ad-l">Langue</label><select id="ad-l" value={f.langue} onChange={(e) => setF({ ...f, langue: e.target.value })}>{LANGUES.map((l) => <option key={l.id} value={l.id}>{langueFr(l.id).replace(/^./, (c) => c.toUpperCase())}</option>)}</select></div>
            </div>
            <span className="sm2">Ce qu'il peut faire</span>
            <div className="eq-roles">
              {Object.entries(roles).map(([k, r]) => (
                <button key={k} type="button" className={`eq-role ${f.role === k ? "on" : ""}`} onClick={() => setF({ ...f, role: k })} aria-pressed={f.role === k}>
                  <i /><span><strong>{r.label}</strong><small>{r.detail}</small></span>
                </button>
              ))}
            </div>
            <div className="eq-f"><label htmlFor="ad-e">E-mail (facultatif)</label><input id="ad-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <p className="sm2">Il reçoit un SMS avec un lien : pas de mot de passe à retenir, l'application s'ouvre dans sa langue.</p>
            <div className="eq-act"><button type="button" className="link" onClick={fermer}>Annuler</button><button type="button" className="btn btn-main" disabled={busy || !f.nom.trim()} onClick={envoyer}>{busy ? "Envoi…" : "Envoyer l'invitation"}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
