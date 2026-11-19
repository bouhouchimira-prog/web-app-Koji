"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { euros, euros2 } from "../../lib/intervention-rapide";
import "./urgences.css";

// Urgences côté artisan (maquette PRO-17, « Ordinateur » et « Être
// disponible ») : disponibilité jusqu'à une heure, zone, urgences et prix,
// urgences proposées (accepter / refuser librement), départ, chiffres du
// jour. Données : /api/urgences. L'écran se rafraîchit seul (5 s quand on
// est disponible ou qu'une urgence est en cours, 30 s sinon).
const Trace = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const COCHE = "M4 12l5 5L20 6";
const SERRURE = "Serrurerie : demandez une pièce d'identité et un justificatif de domicile avant d'ouvrir la porte.";

function Anneau({ finLe }) {
  const [reste, setReste] = useState(() => Math.max(0, Math.round((Date.parse(finLe) - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setReste(Math.max(0, Math.round((Date.parse(finLe) - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [finLe]);
  const tour = 176;
  return (
    <svg className="ur-ring" viewBox="0 0 64 64" role="timer" aria-label={`${reste} secondes pour accepter`}>
      <circle cx="32" cy="32" r="28" stroke="#3A3F43" strokeWidth="5" fill="none" />
      <circle cx="32" cy="32" r="28" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeDasharray={tour} strokeDashoffset={tour - (tour * Math.min(60, reste)) / 60} transform="rotate(-90 32 32)" />
      <text x="32" y="38" textAnchor="middle" fill="#FFFFFF" stroke="none" fontSize="17" fontWeight="700">{`0:${String(Math.min(59, reste)).padStart(2, "0")}`}</text>
    </svg>
  );
}

function Alerte({ p, busy, onAgir }) {
  const [minutes, setMinutes] = useState(String(p.minutes || 15));
  return (
    <div className="ur-alert" role="alertdialog" aria-label={`Nouvelle urgence : ${p.titre}`}>
      <div className="ur-at">
        <div><span className="ur-ey">Nouvelle urgence</span><h2>{p.titre}</h2><small>{p.quartier} · {p.distance} · environ {p.minutes} min</small></div>
        <Anneau finLe={p.finLe} />
      </div>
      {p.photo ? <div className="ur-ph"><div className="ph-i"><img src={p.photo} alt="Photo du client" /><span className="ph-k">Photo du client</span></div></div> : null}
      <div className="ur-dl">{p.details.map((d) => <div key={d.libelle}><span>{d.libelle}</span><b>{d.valeur}</b></div>)}</div>
      <div className="ur-pr"><div><span>Votre prix</span><b>{p.prix.montant}</b><small>{p.prix.detail}</small></div></div>
      <label className="ur-min">J'arrive dans <input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Minutes avant d'arriver" /> min</label>
      {p.serrure ? <small className="ur-fine" style={{ textAlign: "left" }}>{SERRURE}</small> : null}
      <div className="ur-bt">
        <button type="button" className="ur-no" disabled={Boolean(busy)} onClick={() => onAgir({ action: "refuser", id: p.id })}>Refuser</button>
        <button type="button" className="ur-yes" disabled={Boolean(busy)} onClick={() => onAgir({ action: "accepter", id: p.id, minutes: Number(minutes) || p.minutes })}>{busy === `accepter:${p.id}` ? "…" : "Accepter"}</button>
      </div>
      <small className="ur-fine">Proposée aux {p.proposeeA > 1 ? `${p.proposeeA} artisans disponibles les plus proches` : "artisans disponibles les plus proches"} · le premier qui accepte</small>
    </div>
  );
}

function EnCours({ e, busy, onAgir, onPartir }) {
  const [minutes, setMinutes] = useState(String(e.minutes || 15));
  if (e.etat === "acceptee") {
    return (
      <div className="card ur-ec">
        <div className="card-h"><h2>{e.titre}</h2><span className="tag tag-o">Acceptée</span></div>
        <p className="rd-p">{e.quartier} · arrivée annoncée vers {e.arriveeVers}. En attente de la confirmation du client : son adresse exacte et son téléphone arrivent à ce moment.</p>
        <button type="button" className="link" style={{ alignSelf: "flex-start" }} disabled={Boolean(busy)} onClick={() => onAgir({ action: "retirer", id: e.id })}>Je ne peux plus y aller</button>
      </div>
    );
  }
  return (
    <div className="card ur-ec on">
      <div className="card-h"><h2>{e.titre}</h2><span className="tag tag-e">Confirmée par le client</span></div>
      <p className="rd-p">{e.quartier} · le client attend votre arrivée vers {e.arriveeVers}. Son adresse et son téléphone sont dans l'intervention.</p>
      {e.serrure ? <p className="sm2" style={{ margin: 0 }}>{SERRURE}</p> : null}
      {e.parti ? (
        <Link className="btn btn-main" href={`/interventions/rapide/${e.interventionId}`}>Ouvrir l'intervention</Link>
      ) : (
        <div className="ur-part">
          <label className="ur-min dark">J'arrive dans <input inputMode="numeric" value={minutes} onChange={(ev) => setMinutes(ev.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Minutes avant d'arriver" /> min</label>
          <button type="button" className="btn btn-main" disabled={Boolean(busy)} onClick={() => onPartir(e, Number(minutes) || e.minutes)}>Je pars</button>
          <Link className="link" href={`/interventions/rapide/${e.interventionId}`}>Ouvrir l'intervention</Link>
        </div>
      )}
    </div>
  );
}

function Reglages({ v, busy, onEnregistrer, onAnnuler }) {
  const r = v.reglages;
  const [adresse, setAdresse] = useState(r.zone?.adresse || "");
  const [rayonKm, setRayon] = useState(r.zone?.rayonKm || 8);
  const [demiHeure, setDemiHeure] = useState(r.demiHeure ? String(r.demiHeure) : "");
  const [prix, setPrix] = useState(() => Object.fromEntries(r.categories.map((c) => [c.id, c.prix ? String(c.prix) : ""])));
  const [choisies, setChoisies] = useState(() => Object.fromEntries(r.categories.map((c) => [c.id, c.choisie])));
  return (
    <div className="ur-form">
      <div className="ur-f2">
        <label className="ur-fl">Adresse de départ<input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse ou ville" /></label>
        <label className="ur-fl">Rayon<select value={rayonKm} onChange={(e) => setRayon(Number(e.target.value))}>{v.rayons.map((k) => <option key={k} value={k}>{k} km</option>)}</select></label>
      </div>
      <span className="lab" style={{ marginTop: 12 }}>Urgences de mes métiers et mon prix (déplacement et 1re demi-heure, TTC)</span>
      {r.categories.map((c) => (
        <div key={c.id} className={`ur-pl${c.autorisee ? "" : " off"}`}>
          <label><input type="checkbox" disabled={!c.autorisee} checked={Boolean(choisies[c.id]) && c.autorisee} onChange={(e) => { setChoisies({ ...choisies, [c.id]: e.target.checked }); if (e.target.checked && !prix[c.id] && c.prixIntervention) setPrix({ ...prix, [c.id]: String(c.prixIntervention) }); }} /><span className="ur-ic"><Trace d={c.icone} /></span>{c.label}</label>
          {c.autorisee ? <span className="ur-eur"><input inputMode="decimal" aria-label={`Prix ${c.label}`} disabled={!choisies[c.id]} value={prix[c.id]} onChange={(e) => setPrix({ ...prix, [c.id]: e.target.value })} /> €</span> : <small className="sm2">{c.raison}</small>}
        </div>
      ))}
      <label className="ur-fl" style={{ maxWidth: 260, marginTop: 10 }}>Demi-heure suivante (€ TTC)<input inputMode="decimal" value={demiHeure} onChange={(e) => setDemiHeure(e.target.value)} /></label>
      <small className="sm2" style={{ display: "block", marginTop: 8 }}>Pièces sur devis signé avant travaux. Le client voit votre prix avant de confirmer.</small>
      <div className="ur-acts">
        <button type="button" className="btn btn-sec" onClick={onAnnuler}>Annuler</button>
        <button type="button" className="btn btn-main" disabled={Boolean(busy)} onClick={() => onEnregistrer({ action: "reglages", adresse, rayonKm, demiHeure, prix: Object.fromEntries(Object.entries(prix).filter(([k]) => choisies[k])) })}>Enregistrer</button>
      </div>
    </div>
  );
}

function Interrupteur({ r, acces, busy, onBasculer }) {
  const [jusqua, setJusqua] = useState(r.heureParDefaut || "20:00");
  return (
    <div className={`ur-on web${r.actif ? "" : " off"}`}>
      <div>
        <b>{r.actif ? "Je reçois les urgences" : "Je ne reçois pas d'urgences"}</b>
        {r.actif ? <small>jusqu'à {r.jusqua}{r.zone ? ` · ${r.zone.rayonKm} km autour de ${r.zone.adresse}` : ""}</small> : (
          <small>jusqu'à <input type="time" value={jusqua} onChange={(e) => setJusqua(e.target.value)} aria-label="Heure de fin" disabled={!acces.ok} /></small>
        )}
      </div>
      <button type="button" role="switch" aria-checked={r.actif} aria-label="Recevoir les urgences" className={`ur-sw${r.actif ? " on" : ""}`} disabled={Boolean(busy) || (!r.actif && !acces.ok)} onClick={() => onBasculer(r.actif ? { action: "disponible", actif: false } : { action: "disponible", actif: true, jusqua })}><i /></button>
    </div>
  );
}

const TAGS = { valide: "tag-val", attente: "tag tag-o", encours: "tag tag-e", muet: "sm2" };

function UrgencesVue() {
  const router = useRouter();
  const [v, setV] = useState(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState("");
  const [edition, setEdition] = useState(false);
  const enCoursRef = useRef(false);

  const charger = useCallback(() => apiGet("/api/urgences").then((d) => { setV(d); setErreur(""); }).catch((e) => setErreur(e.message)), []);
  useEffect(() => { charger(); }, [charger]);

  // Rafraîchissement régulier : urgences proposées et urgences en cours.
  const actif = Boolean(v?.reglages?.actif || v?.enCours?.length);
  useEffect(() => {
    const t = setInterval(() => {
      if (enCoursRef.current) return;
      apiGet("/api/urgences?alertes=1").then((d) => setV((x) => (x ? { ...x, ...d } : x))).catch(() => {});
    }, actif ? 5000 : 30000);
    return () => clearInterval(t);
  }, [actif]);

  async function agir(corps) {
    setBusy(`${corps.action}:${corps.id || ""}`);
    enCoursRef.current = true;
    try {
      const d = await apiSend("/api/urgences", corps);
      setV(d);
      setErreur("");
      if (corps.action === "reglages") setEdition(false);
    } catch (e) {
      setErreur(e.message);
      charger();
    }
    enCoursRef.current = false;
    setBusy("");
  }
  async function partir(e, minutes) {
    setBusy(`partir:${e.id}`);
    try {
      const d = await apiSend("/api/urgences", { action: "partir", id: e.id, minutes });
      router.push(`/interventions/rapide/${d.interventionId}`);
    } catch (er) { setErreur(er.message); setBusy(""); }
  }

  if (!v) return <div className="ur">{erreur ? <p className="err" role="alert">{erreur}</p> : <p className="muted">Chargement…</p>}</div>;
  const r = v.reglages;
  const choisies = r.categories.filter((c) => c.choisie);
  const regle = Boolean(r.zone && choisies.length && r.demiHeure);
  return (
    <div className="ur">
      <div className="head">
        <div className="stack"><span className="eyebrow">Urgences · dépannages dans votre zone, acceptés en un geste</span><h1>Urgences</h1></div>
        <div className="hact"><Interrupteur key={`${r.actif}-${r.heureParDefaut}`} r={r} acces={regle ? v.acces : { ok: false }} busy={busy} onBasculer={agir} /></div>
      </div>
      {erreur ? <p className="err" role="alert">{erreur} <button type="button" className="link" onClick={() => setErreur("")}>Fermer</button></p> : null}
      {!v.acces.ok ? <p className="ur-msg">{v.acces.raison} {v.acces.abonnement ? <Link className="link" href="/parametres/abonnement">Voir les offres</Link> : <Link className="link" href="/profil">Mon profil</Link>}</p> : !regle ? <p className="ur-msg">Réglez votre zone, vos urgences et vos prix pour pouvoir les recevoir.</p> : null}

      {v.propositions.length ? <div className="ur-alerts">{v.propositions.map((p) => <Alerte key={p.id} p={p} busy={busy} onAgir={agir} />)}</div> : null}
      {v.prises?.map((p) => <p key={p.id} className="ur-msg">{p.titre} · {p.quartier} : prise par un autre artisan.</p>)}
      {v.enCours.map((e) => <EnCours key={e.id} e={e} busy={busy} onAgir={agir} onPartir={partir} />)}

      <div className="ur-g">
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-h"><h2>Ce que je reçois</h2>{edition ? null : <button type="button" className="link" onClick={() => setEdition(true)}>Modifier</button>}</div>
            {edition ? <Reglages v={v} busy={busy} onEnregistrer={agir} onAnnuler={() => setEdition(false)} /> : (
              <>
                <div className="kv"><span>Zone</span><b>{r.zone ? `${r.zone.rayonKm} km autour de ${r.zone.adresse || "votre zone de travail"}` : "à régler"}</b></div>
                <div className="kv"><span>Disponible</span><b>{r.actif ? `jusqu'à ${r.jusqua}` : "non"}</b></div>
                <span className="lab" style={{ marginTop: 12 }}>Urgences de mes métiers</span>
                <div className="ur-chips">{r.categories.map((c) => <span key={c.id} className={`ur-chip${c.choisie ? " on" : ""}`}>{c.choisie ? <Trace d={COCHE} /> : null}{c.label}</span>)}</div>
              </>
            )}
          </div>
          <div className="card">
            <div className="card-h"><h2>Mes prix d'urgence</h2>{edition ? null : <button type="button" className="link" onClick={() => setEdition(true)}>Mes prix</button>}</div>
            {choisies.length ? (
              <table className="ur-t"><thead><tr><th>Urgence</th><th className="num">Mon prix</th></tr></thead>
                <tbody>{choisies.map((c) => <tr key={c.id}><td><span className="ur-ic"><Trace d={c.icone} /></span><b>{c.label}</b></td><td className="num"><b>{euros(c.prix)}</b></td></tr>)}</tbody>
              </table>
            ) : <p className="rd-p">Aucune urgence choisie pour l'instant.</p>}
            <small className="sm2" style={{ display: "block", marginTop: 10 }}>Déplacement et première demi-heure, TTC{r.demiHeure ? ` ; demi-heure suivante ${euros(r.demiHeure)}` : ""} ; pièces sur devis signé avant travaux. Le client voit votre prix avant de confirmer.</small>
          </div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-h"><h2>Aujourd'hui</h2></div>
            <div className="ur-kw"><div><span>Urgences</span><b>{v.chiffres.urgences}</b></div><div><span>Facturé</span><b>{v.chiffres.factureTexte}</b></div><div><span>Arrivée moyenne</span><b>{v.chiffres.arriveeTexte}</b></div></div>
          </div>
          <div className="card">
            <div className="card-h"><h2>Interventions</h2><Link className="link" href="/interventions/rapide">Tout voir</Link></div>
            {v.interventions.length ? (
              <table className="ur-t"><tbody>{v.interventions.map((i) => (
                <tr key={i.id} className={i.interventionId ? "lien" : ""} onClick={() => i.interventionId && router.push(`/interventions/rapide/${i.interventionId}`)}>
                  <td className="sm2">{i.quand}</td>
                  <td><b>{i.titre}</b><small>{i.client}</small></td>
                  <td className="num">{i.montant ? euros2(i.montant) : "—"}</td>
                  <td>{i.statut.genre === "valide" ? <span className="tag-val"><Trace d={COCHE} />{i.statut.texte}</span> : <span className={TAGS[i.statut.genre]}>{i.statut.texte}</span>}</td>
                </tr>
              ))}</tbody></table>
            ) : <p className="rd-p">Les urgences que vous acceptez apparaîtront ici, avec leur facture.</p>}
          </div>
        </div>
      </div>
      <p className="ur-note">{v.note}</p>
    </div>
  );
}

export default function UrgencesPro() {
  return (
    <Shell variant="pro">
      <UrgencesVue />
    </Shell>
  );
}
