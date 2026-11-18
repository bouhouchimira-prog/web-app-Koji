"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ClientTopbar, CHARTE_CLIENT } from "../../../../components/ClientTopbar";
import { SignatureDevisClient } from "../../../../components/SignatureDevisClient";
import { ClientFinChantier } from "../../../../components/ClientFinChantier";
import { ClientAccordRealisation } from "../../../../components/ClientAccordRealisation";
import { ClientSousTraitant } from "../../../../components/ClientSousTraitant";
import { ListePaiements } from "../../../../components/PaiementsClient";
import "../../../../components/client-fin-chantier.css";
import "../../cli02.css";

// Koji Client · « signer, suivre, payer » (maquette CLI-02). Un devis ou un
// chantier du particulier en quatre onglets : Devis (lecture, versions,
// signature), Chantier (avancement, ouvrages, signaler, écrire), Paiements
// (factures, sans paiement en ligne), Documents. ?onglet=devis|chantier|
// paiements|documents. Tout vient de GET /api/client/chantier/[id] (mêmes
// libellés dans l'app Koji). Les fonctions de l'ancienne page sont gardées :
// validation d'un ouvrage, notes et fil par ouvrage, alerte (générale ou sur
// un ouvrage), fin de chantier et avis, accord réalisation, sous-traitant,
// messages de l'entreprise.

const ONGLETS = [["devis", "Devis"], ["chantier", "Chantier"], ["paiements", "Paiements"], ["documents", "Documents"]];

const TRACES = {
  maison: "M4 20h16M6 20V9l6-4 6 4v11",
  photo: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  message: "M4 5h16v11H9l-5 4z",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5",
  dl: "M12 4v11M7 10l5 5 5-5M5 20h14",
  ok: "M4 12l5 5L20 6"
};
const Icone = ({ nom }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TRACES[nom]} /></svg>;

const TYPES_ALERTE = [
  { value: "autre", label: "Autre chose à signaler" },
  { value: "degat", label: "Dégât matériel" },
  { value: "fuite", label: "Fuite ou dégât des eaux" },
  { value: "incendie", label: "Incendie ou fumée" },
  { value: "urgence", label: "Urgence" }
];

function compteLocal() {
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function fichierEnDataUrl(file) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result || ""));
    lecteur.onerror = reject;
    lecteur.readAsDataURL(file);
  });
}

const jourCourt = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso)) : "");

// Signaler quelque chose (avant la réception) : arrive à l'entreprise comme
// une alerte, sur tout le chantier ou sur un ouvrage.
function AlerteForm({ vue, taches = [], tache = null, onFermer }) {
  const [type, setType] = useState("autre");
  const [message, setMessage] = useState("");
  const [choix, setChoix] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [etat, setEtat] = useState("");

  async function envoyer(e) {
    e.preventDefault();
    if (!message.trim() || envoi) return;
    setEnvoi(true);
    setEtat("");
    const cibles = tache ? [tache] : taches.filter((t) => choix.includes(t.id));
    const compte = compteLocal();
    try {
      const r = await fetch("/api/urgent-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client",
          senderName: compte?.name || compte?.email?.split("@")[0] || "Client",
          type,
          message: message.trim(),
          projectId: vue.projectId || "",
          quoteId: vue.id,
          taskIds: cibles.map((t) => t.id),
          taskLabels: cibles.map((t) => t.libelle)
        })
      });
      if (!r.ok) throw new Error();
      setMessage("");
      setChoix([]);
      setEtat("envoye");
    } catch {
      setEtat("erreur");
    } finally {
      setEnvoi(false);
    }
  }

  if (etat === "envoye") {
    return (
      <div className="kc2-form">
        <p className="kc2-ok" role="status">C'est envoyé : {vue.entreprise} est prévenue et vous répond.</p>
        <button type="button" className="kc-sec" onClick={onFermer}>Fermer</button>
      </div>
    );
  }
  return (
    <form className="kc2-form" onSubmit={envoyer}>
      <label>De quoi s'agit-il ?
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES_ALERTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label>{tache ? `Votre message sur « ${tache.libelle} »` : "Votre message"}
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} placeholder="Ce que vous avez remarqué, où, depuis quand." />
      </label>
      {!tache && taches.length ? (
        <fieldset className="kc2-form" style={{ border: 0, padding: 0, gap: 8 }}>
          <legend className="kc-s" style={{ marginBottom: 6 }}>Ouvrages concernés (facultatif)</legend>
          {taches.map((t) => (
            <label className="kc-ck" key={t.id}>
              <input type="checkbox" checked={choix.includes(t.id)} onChange={() => setChoix((l) => (l.includes(t.id) ? l.filter((x) => x !== t.id) : [...l, t.id]))} />
              <span aria-hidden="true"><Icone nom="ok" /></span>
              <span className="kc2-ck-t">{t.libelle}{t.lot ? <small>{t.lot}</small> : null}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {etat === "erreur" ? <p className="kc-alerte" role="alert">Le message n'est pas parti. Réessayez.</p> : null}
      <div className="kc2-actions">
        <button type="button" className="kc-sec" onClick={onFermer}>Annuler</button>
        <button type="submit" className="kc-btn sm" disabled={!message.trim() || envoi}>{envoi ? "Envoi…" : "Envoyer"}</button>
      </div>
    </form>
  );
}

// Un ouvrage : état, validation demandée par l'équipe, fil de notes,
// ajout d'une note, d'une photo ou d'un document, signalement.
function TacheClient({ tache, vue, onValide }) {
  const [ouvert, setOuvert] = useState(false);
  const [fil, setFil] = useState([]);
  const [note, setNote] = useState({ type: "Note", titre: "", texte: "", fichier: "", url: "" });
  const [envoi, setEnvoi] = useState(false);
  const [alerte, setAlerte] = useState(false);
  const [erreur, setErreur] = useState("");
  const champFichier = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    fetch(`/api/task-replies?taskId=${encodeURIComponent(tache.id)}`)
      .then((r) => r.json())
      .then((d) => setFil(d.documents || []))
      .catch(() => {});
  }, [ouvert, tache.id]);

  async function choisirFichier(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fichierEnDataUrl(file);
    setNote((n) => ({ ...n, fichier: file.name, url, titre: n.titre || file.name }));
  }

  async function envoyerNote(e) {
    e.preventDefault();
    if (!note.titre.trim() && !note.texte.trim() && !note.url) return;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch("/api/client/task-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: tache.id, projectId: vue.projectId, type: note.type, title: note.titre.trim() || note.texte.trim().slice(0, 60) || note.type, fileName: note.fichier || "", url: note.url, notes: note.texte })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "La note n'est pas partie.");
      if (data.document) setFil((l) => [data.document, ...l]);
      setNote({ type: "Note", titre: "", texte: "", fichier: "", url: "" });
      if (champFichier.current) champFichier.current.value = "";
    } catch (error) {
      setErreur(error.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function valider() {
    const r = await fetch("/api/client/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: tache.id, action: "client-validate" }) });
    if (r.ok) onValide();
  }

  return (
    <div className="kc2-tache">
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <div><b>{tache.libelle}</b><small>{[tache.lot, tache.detail].filter(Boolean).join(" · ")}</small></div>
        <span className={`kc-st${tache.etape === 3 ? "" : " o"}`}>{tache.aValider ? "À valider" : tache.etiquette}</span>
      </button>
      {ouvert ? (
        <div className="kc2-corps">
          {tache.aValider ? (
            <div className="kc-info">
              L'équipe a terminé cet ouvrage. Confirmez-vous que le travail est correct ?
              <button type="button" className="kc-btn sm" style={{ marginTop: 10 }} onClick={valider}>Valider l'ouvrage</button>
            </div>
          ) : null}
          {fil.length ? (
            <div className="kc2-fil">
              {fil.map((d) => (
                <div key={d.id} className={`kc2-msg ${d.source === "company" ? "in" : "out"}`}>
                  <small>{d.source === "company" ? d.senderName || vue.entreprise : "Vous"}{d.createdAt ? ` · ${jourCourt(d.createdAt)}` : ""}{d.type && d.source !== "company" ? ` · ${d.type}` : ""}</small>
                  {d.title && d.title !== d.notes ? <b>{d.title}</b> : null}
                  {d.notes ? <p>{d.notes}</p> : null}
                  {d.url ? <a href={d.url} download={d.fileName || d.title} target="_blank" rel="noreferrer">Ouvrir le fichier</a> : null}
                </div>
              ))}
            </div>
          ) : null}
          <form className="kc2-form" onSubmit={envoyerNote}>
            <label>Ajouter une note, une photo ou un document
              <select value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>
                {["Note", "Photo", "Document", "Réclamation"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <input value={note.titre} onChange={(e) => setNote({ ...note, titre: e.target.value })} placeholder="Titre" aria-label="Titre" maxLength={120} />
            <textarea value={note.texte} onChange={(e) => setNote({ ...note, texte: e.target.value })} rows={2} placeholder="Votre message" aria-label="Votre message" maxLength={2000} />
            <input ref={champFichier} type="file" accept="image/*,.pdf" hidden onChange={choisirFichier} />
            {erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null}
            <div className="kc2-actions">
              <button type="button" className="kc-sec" onClick={() => champFichier.current?.click()}>{note.fichier ? note.fichier : "Joindre un fichier"}</button>
              <button type="submit" className="kc-btn sm" disabled={envoi || (!note.titre.trim() && !note.texte.trim() && !note.url)}>{envoi ? "Envoi…" : "Envoyer"}</button>
            </div>
          </form>
          {alerte
            ? <AlerteForm vue={vue} tache={tache} onFermer={() => setAlerte(false)} />
            : <button type="button" className="kc2-lien" onClick={() => setAlerte(true)}>Signaler un problème sur cet ouvrage</button>}
        </div>
      ) : null}
    </div>
  );
}

function LigneDoc({ d }) {
  const contenu = (
    <>
      <span className="ic"><Icone nom="doc" /></span>
      <div><strong>{d.titre}</strong><small>{d.detail}</small></div>
      {d.lien ? <span className="kc2-dl"><Icone nom="dl" /></span> : null}
    </>
  );
  return d.lien
    ? <a className="kc2-row" href={d.lien} download aria-label={`Télécharger : ${d.titre}`}>{contenu}</a>
    : <div className="kc2-row off">{contenu}</div>;
}

// Le devis lisible en entier (cw-doc).
function DocDevis({ devis, entreprise }) {
  const [ecarts, setEcarts] = useState(false);
  const lots = [...new Set(devis.lignes.map((l) => l.lot).filter(Boolean))];
  const parLot = lots.length > 1;
  return (
    <div className="kc2-doc">
      <div className="kc2-dh"><b>{devis.titre}</b><span>{[entreprise, devis.date, devis.validite].filter(Boolean).join(" · ")}</span></div>
      {devis.objet ? <p className="kc-s">{devis.objet}</p> : null}
      <table className="kc2-lines">
        <thead><tr><th>Travaux</th><th className="q">Qté</th><th>Montant HT</th></tr></thead>
        <tbody>
          {(parLot ? lots : [null]).map((lot) => [
            parLot ? <tr className="kc2-lot" key={`lot-${lot}`}><td colSpan={3}>{lot}</td></tr> : null,
            ...devis.lignes.filter((l) => !parLot || l.lot === lot).map((l) => (
              <tr key={l.cle}><td>{l.libelle}{l.note ? <small>{l.note}</small> : null}</td><td className="q">{l.quantite}</td><td>{l.montantHt}</td></tr>
            ))
          ])}
        </tbody>
      </table>
      <div className="kc2-tot">
        {devis.totaux.map((t) => <div key={t.libelle} className={t.fort ? "big" : ""}><span>{t.libelle}</span><b>{t.montant}</b></div>)}
      </div>
      {devis.changements ? (
        <>
          <button type="button" className="kc2-lien" onClick={() => setEcarts((v) => !v)} aria-expanded={ecarts}>{devis.changements.texte}</button>
          {ecarts ? (
            <div className="kc2-ecarts">
              {devis.changements.lignes.map((l, i) => <div key={i}><span><em>{l.type}</em>{l.libelle}</span><b>{l.ecart} TTC</b></div>)}
              <div><span>{devis.changements.avant.titre}</span><b>{devis.changements.avant.total} TTC</b></div>
              <p>{devis.changements.note}</p>
            </div>
          ) : null}
        </>
      ) : null}
      {devis.entreprise?.detail ? <div className="kc2-ent"><b>{devis.entreprise.nom}</b><span>{devis.entreprise.detail}</span></div> : null}
    </div>
  );
}

function Contact({ contact, libelle, classe = "kc-sec" }) {
  if (!contact) return null;
  return contact.externe
    ? <a className={classe} href={contact.lien}>{libelle}</a>
    : <Link className={classe} href={contact.lien}>{libelle}</Link>;
}

function OngletDevis({ vue, onSigne }) {
  const { devis } = vue;
  const [detail, setDetail] = useState(false);
  const [merci, setMerci] = useState("");

  async function signer(donnees) {
    const r = await fetch(`/api/client/chantier/${encodeURIComponent(vue.id)}/signer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(donnees)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "La signature n'a pas pu être enregistrée.");
    setMerci(`Merci, c'est signé.${data.exemplaire?.envoye ? " Votre exemplaire part par e-mail." : ""}`);
    onSigne(data.vue);
  }

  const prixTel = (
    <div className="kc2-price kc-t" style={{ flexDirection: "column" }}>
      <span>{vue.titre}</span>
      <b>{devis.totalTtc} TTC</b>
      <small>
        {devis.acompte ? `${devis.acompte.detail.split(" · ")[0]} : ${devis.acompte.montant}` : devis.titre}
        {devis.changements ? <> · <button type="button" className="kc2-lien" onClick={() => setDetail(true)}>ce qui change depuis la version {devis.version - 1}</button></> : null}
      </small>
    </div>
  );

  let cote;
  if (devis.etat === "a_signer" && devis.signature) {
    cote = (
      <>
        {devis.acompte ? (
          <div className="kc2-price kc-d" style={{ flexDirection: "column" }}><span>{devis.acompte.titre}</span><b>{devis.acompte.montant}</b><small>{devis.acompte.detail}</small></div>
        ) : (
          <div className="kc2-price kc-d" style={{ flexDirection: "column" }}><span>Total du devis</span><b>{devis.totalTtc}</b><small>TTC</small></div>
        )}
        <SignatureDevisClient
          regles={devis.signature}
          onSigner={signer}
          suite={<Contact contact={vue.contact} libelle="Poser une question à l'entreprise" />}
          note={`Le devis est établi et signé avec ${vue.entreprise}. ${devis.signature.preuve}`}
        />
      </>
    );
  } else {
    cote = (
      <>
        {merci ? <p className="kc2-ok" role="status">{merci}</p> : null}
        <div className="kc2-price kc-d" style={{ flexDirection: "column" }}>
          <span>{devis.titreEcran}{devis.signeLe ? ` le ${devis.signeLe}` : ""}</span>
          <b>{devis.totalTtc}</b>
          <small>TTC{devis.signataire ? ` · signé par ${devis.signataire}` : ""}</small>
        </div>
        {devis.retractation ? <div className="kc-info">{devis.retractation.texte}</div> : null}
        {devis.etat === "autre" ? <div className="kc-info">Ce devis n'est pas encore envoyé pour signature par l'entreprise.</div> : null}
        <a className="kc-btn sm kc2-plein" href={devis.pdf} download>{devis.etat === "signe" ? "Télécharger le devis signé" : "Télécharger le devis"}</a>
        <Contact contact={vue.contact} libelle="Poser une question à l'entreprise" />
        {devis.etat === "signe" ? <p className="kc-n">Le devis est établi et signé avec {vue.entreprise}. Koji conserve la preuve de signature (date, heure, appareil).</p> : null}
      </>
    );
  }

  return (
    <div className="kc2-g">
      <div className="kc2-main">
        {prixTel}
        <button type="button" className="kc2-row kc-t" onClick={() => setDetail((v) => !v)} aria-expanded={detail}>
          <span className="ic"><Icone nom="doc" /></span>
          <div><strong>{detail ? "Masquer le détail du devis" : "Lire le devis complet"}</strong><small>{devis.lignes.length} ligne{devis.lignes.length > 1 ? "s" : ""} · {devis.titre}</small></div>
          <span className="chev">{detail ? "˄" : "›"}</span>
        </button>
        <div className={`kc2-docwrap${detail ? " ouvert" : ""}`}><DocDevis devis={devis} entreprise={vue.entreprise} /></div>
      </div>
      <div className="kc2-side">{cote}</div>
    </div>
  );
}

function ActionsChantier({ vue, alerte, setAlerte }) {
  const c = vue.chantier;
  return (
    <>
      {c.prochaine ? (
        <div className="kc2-row">
          <span className="ic"><Icone nom="maison" /></span>
          <div><strong>{c.prochaine.titre}</strong><small>{c.prochaine.texte}</small></div>
        </div>
      ) : null}
      {c.signaler?.mode === "alerte" ? (
        alerte ? <AlerteForm vue={vue} taches={c.taches} onFermer={() => setAlerte(false)} /> : (
          <button type="button" className="kc2-row" onClick={() => setAlerte(true)}>
            <span className="ic"><Icone nom="photo" /></span>
            <div><strong>Signaler quelque chose</strong><small>{c.signaler.sousTitre}</small></div>
            <span className="chev">›</span>
          </button>
        )
      ) : c.signaler?.mode === "reserve" ? (
        <a className="kc2-row" href="#avis">
          <span className="ic"><Icone nom="photo" /></span>
          <div><strong>Signaler quelque chose</strong><small>{c.signaler.sousTitre}</small></div>
          <span className="chev">›</span>
        </a>
      ) : null}
      {vue.contact ? (
        vue.contact.externe ? (
          <a className="kc2-row" href={vue.contact.lien}>
            <span className="ic"><Icone nom="message" /></span>
            <div><strong>Écrire à l'entreprise</strong><small>{vue.contact.sousTitre}</small></div>
            <span className="chev">›</span>
          </a>
        ) : (
          <Link className="kc2-row" href={vue.contact.lien}>
            <span className="ic"><Icone nom="message" /></span>
            <div><strong>Écrire à l'entreprise</strong><small>{vue.contact.sousTitre}</small></div>
            <span className="chev">›</span>
          </Link>
        )
      ) : null}
    </>
  );
}

function OngletChantier({ vue, messages, recharger }) {
  const c = vue.chantier;
  const [alerte, setAlerte] = useState(false);
  if (!c) return <p className="kc2-vide">Le suivi du chantier commence après la signature du devis.</p>;
  return (
    <div className="kc2-g">
      <div className="kc2-main">
        <div className="kc2-prog" role="progressbar" aria-valuenow={c.avancement.pourcent} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement"><i style={{ width: `${c.avancement.pourcent}%` }} /></div>
        <small className="kc-s">{c.avancement.texte}</small>
        <div className="kc-t" style={{ flexDirection: "column", gap: 10 }}><ActionsChantier vue={vue} alerte={alerte} setAlerte={setAlerte} /></div>
        {c.etapes.length ? (
          <div className="kc2-steps">
            {c.etapes.map((e, i) => (
              <div key={`${e.titre}-${i}`} className={`kc2-st${e.etat === "fait" ? " ok" : e.etat === "en_cours" ? " on" : ""}`}>
                <span>{e.etat === "fait" ? <Icone nom="ok" /> : i + 1}</span>
                <div><b>{e.titre}</b><small>{e.detail}</small></div>
              </div>
            ))}
          </div>
        ) : null}
        {c.taches.length ? (
          <>
            <h2 className="kc2-h2">Ouvrages du chantier</h2>
            <div className="kc2-taches">{c.taches.map((t) => <TacheClient key={t.id} tache={t} vue={vue} onValide={recharger} />)}</div>
          </>
        ) : null}
        <ClientFinChantier quote={{ id: vue.id, finChantier: vue.finChantier || {} }} entreprise={vue.entreprise} />
        <ClientAccordRealisation quoteId={vue.id} entreprise={vue.entreprise} />
        <ClientSousTraitant quoteId={vue.id} />
        {messages.length ? (
          <>
            <h2 className="kc2-h2">Messages de l'entreprise</h2>
            <div className="kc2-fil">
              {messages.map((m) => (
                <div key={m.id} className="kc2-msg in" style={{ maxWidth: "100%", alignSelf: "stretch" }}>
                  <small>{m.channel === "email" ? "E-mail" : "SMS"} · {m.createdAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(m.createdAt)) : ""}</small>
                  <p>{m.subject || m.text}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="kc2-side kc-d">
        <ActionsChantier vue={vue} alerte={alerte} setAlerte={setAlerte} />
        <p className="kc-n">{c.note}</p>
      </div>
    </div>
  );
}

function OngletPaiements({ vue }) {
  const p = vue.paiements;
  return (
    <div className="kc2-g">
      <div className="kc2-main"><ListePaiements paiements={p} /></div>
      <div className="kc2-side">
        {p.aPayer ? (
          <>
            <div className="kc2-price" style={{ flexDirection: "column" }}><span>{p.aPayer.titre}</span><b>{p.aPayer.montant}</b><small>{p.aPayer.detail}</small></div>
            <a className="kc-btn sm kc2-plein" href={p.aPayer.pdf} download>Télécharger la facture</a>
          </>
        ) : p.lignes.length ? <div className="kc-info">Rien à payer pour le moment.</div> : null}
        <p className="kc-n">{p.note}</p>
      </div>
    </div>
  );
}

function OngletDocuments({ vue }) {
  return (
    <>
      <div className="kc2-docs">{vue.documents.liste.map((d) => <LigneDoc key={d.id} d={d} />)}</div>
      <p className="kc-n">{vue.documents.note}</p>
    </>
  );
}

function PageChantier() {
  const { id } = useParams();
  const router = useRouter();
  const params = useSearchParams();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | introuvable | deconnecte | erreur
  const [vue, setVue] = useState(null);
  const [messages, setMessages] = useState([]);
  // Onglet gardé après la signature (sinon la page passerait sur Chantier).
  const [ongletGarde, setOngletGarde] = useState("");

  const charger = useCallback(() => {
    fetch(`/api/client/chantier/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) { setEtat("deconnecte"); return; }
        if (r.status === 404) { setEtat("introuvable"); return; }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lecture impossible.");
        setVue(data);
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, [id]);

  useEffect(() => { if (id) charger(); }, [id, charger]);

  useEffect(() => {
    if (!vue?.projectId) return;
    fetch(`/api/project-messages?projectId=${encodeURIComponent(vue.projectId)}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []))
      .catch(() => {});
  }, [vue?.projectId]);

  const demande = params.get("onglet");
  const onglet = ONGLETS.some(([cle]) => cle === demande) ? demande : ongletGarde || vue?.ongletParDefaut || "devis";
  const lienOnglet = (cle) => `/client/chantier/${encodeURIComponent(id || "")}?onglet=${cle}`;

  let titre = "Chantier";
  let sousTitre = "";
  let h1 = "";
  if (etat === "pret") {
    const suite = vue.chantier?.titre?.startsWith("Votre chantier · ") ? vue.chantier.titre.replace("Votre chantier · ", "") : "";
    const titres = {
      devis: [vue.devis.titreEcran, `${vue.entreprise}${vue.devis.version > 1 ? ` · version ${vue.devis.version}` : ""}`, vue.devis.titreEcran],
      chantier: ["Votre chantier", [vue.titre, suite].filter(Boolean).join(" · "), vue.chantier?.titre || "Votre chantier"],
      paiements: ["Paiements", vue.titre, "Paiements"],
      documents: ["Documents", vue.titre, "Documents"]
    };
    [titre, sousTitre, h1] = titres[onglet];
  } else if (etat === "introuvable") {
    titre = "Devis introuvable";
  }
  const sansBarre = etat === "pret" && onglet === "devis" && vue.devis.etat === "a_signer";

  let corps = null;
  if (etat === "deconnecte") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Votre session a expiré. Connectez-vous pour retrouver votre chantier.</p>
        <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
      </div>
    );
  } else if (etat === "introuvable") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Ce devis n'existe pas, ou il n'est pas rattaché à votre compte.</p>
        <Link className="kc-btn" href="/client">Retour à mes projets</Link>
      </div>
    );
  } else if (etat === "erreur") {
    corps = (
      <div className="kc-body" style={{ maxWidth: 520 }}>
        <p className="kc-p">Le chantier n'a pas pu être chargé.</p>
        <button type="button" className="kc-sec" onClick={() => { setEtat("chargement"); charger(); }}>Réessayer</button>
      </div>
    );
  } else if (etat === "chargement") {
    corps = <div className="kc-body"><p className="kc-s">Chargement…</p></div>;
  }

  return (
    <div className={`${CHARTE_CLIENT} kc kc2${sansBarre ? " sans-barre" : ""}`}>
      <ClientTopbar titre={titre} sousTitre={sousTitre} backHref="/client" sansBarre={sansBarre} />
      <main className="kc-m">
        {corps || (
          <div className="kc2-in">
            <span className="kc-ey kc-d">{vue.surTitre}</span>
            <h1 className="kc-h kc-d">{h1}</h1>
            <nav className="kc2-sub" aria-label="Sections du chantier">
              {ONGLETS.map(([cle, libelle]) => (
                <a key={cle} href={lienOnglet(cle)} className={onglet === cle ? "on" : ""} aria-current={onglet === cle ? "page" : undefined}
                  onClick={(e) => { e.preventDefault(); router.replace(lienOnglet(cle), { scroll: false }); }}>{libelle}</a>
              ))}
            </nav>
            {onglet === "devis" ? <OngletDevis vue={vue} onSigne={(nouvelle) => { setOngletGarde("devis"); if (nouvelle) setVue(nouvelle); else charger(); }} /> : null}
            {onglet === "chantier" ? <OngletChantier vue={vue} messages={messages} recharger={charger} /> : null}
            {onglet === "paiements" ? <OngletPaiements vue={vue} /> : null}
            {onglet === "documents" ? <OngletDocuments vue={vue} /> : null}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageChantier />
    </Suspense>
  );
}
