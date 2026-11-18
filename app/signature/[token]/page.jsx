"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import KojiWordmark from "../../../components/KojiWordmark";
import { CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { SignatureDevisClient } from "../../../components/SignatureDevisClient";
import { formulaireRetractation } from "../../../lib/signature-lieu";
import "../../client/cli02.css";
import "./signature.css";

// Koji Client · signer par lien, sans compte (maquette CLI-07). Le client
// reçoit le devis par e-mail avec un identifiant et un mot de passe ; la
// session de signature est vérifiée par le serveur (sinon retour à
// /signature/login). Trois états : signer, signé (« Et maintenant »), lien
// qui n'ouvre plus de devis. La signature passe par le même composant et
// le même enregistrement que l'onglet Devis de Koji Client
// (components/SignatureDevisClient, lib/signature-en-ligne.js) : mention
// TVA (PRO-03.5), une seule version signable et « Ce qui change »
// (PRO-03.6), rétractation et démarrage anticipé (PRO-03.7).

const AIDE_KOJI = "mailto:contact@getkoji.io";
const TRACES = {
  dl: "M12 4v11M7 10l5 5 5-5M5 20h14",
  ok: "M4 12l5 5L20 6",
  warn: "M12 4l9 16H3zM12 10v4M12 17v.5",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5"
};
const Icone = ({ nom }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TRACES[nom]} /></svg>;

function DocDevis({ devis, entreprise }) {
  const [ecarts, setEcarts] = useState(false);
  return (
    <div className="kc2-doc">
      <div className="kc2-dh"><b>{devis.titre}</b><span>{[entreprise, devis.date, devis.validite].filter(Boolean).join(" · ")}</span></div>
      {devis.objet ? <p className="kc-s">{devis.objet}</p> : null}
      <table className="kc2-lines">
        <thead><tr><th>Travaux</th><th>Montant HT</th></tr></thead>
        <tbody>
          {devis.lignes.map((l) => (
            <tr key={l.cle}>
              <td>{l.libelle}{[l.quantite && l.quantite !== "1" ? l.quantite : "", l.note].filter(Boolean).length ? <small>{[l.quantite && l.quantite !== "1" ? l.quantite : "", l.note].filter(Boolean).join(" · ")}</small> : null}</td>
              <td>{l.montantHt}</td>
            </tr>
          ))}
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
      <div className="kc2-ent"><b>{devis.entreprise.nom}</b>{devis.entreprise.detail ? <span>{devis.entreprise.detail}</span> : null}</div>
    </div>
  );
}

function Retractation({ quote, token, onRetracte }) {
  const [ouvert, setOuvert] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const fin = quote.retractationJusquau || "";
  if (!fin || quote.retracteLe) return null;
  const possible = fin >= aujourdhui;

  async function seRetracter() {
    setEnvoi(true);
    setErreur("");
    const r = await fetch(`/api/signatures/${encodeURIComponent(token)}/retractation`, { method: "POST" });
    if (r.status === 401) { window.location.replace(`/signature/login?signatureToken=${encodeURIComponent(token)}`); return; }
    const data = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { setErreur(data.error || "La rétractation n'a pas pu être enregistrée."); return; }
    onRetracte(data.quote || {});
  }

  return (
    <>
      <button type="button" className="kc2-lien" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>Je changerai d'avis : où est le formulaire ?</button>
      {ouvert ? (
        <div className="ksg-form-r">
          <p>{possible ? `Vous pouvez annuler sans motif jusqu'au ${new Date(`${fin}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })} inclus.` : "Le délai de rétractation est terminé."}</p>
          {possible ? <p>Le formulaire est à la dernière page de votre exemplaire. Vous pouvez aussi l'envoyer à l'entreprise, ou annuler ici.</p> : null}
          {formulaireRetractation({ entreprise: quote.company?.name, adresse: quote.company?.address, email: quote.company?.email }).map((l, i) => <p key={i} style={i === 0 ? {} : { fontWeight: 400 }}>{l}</p>)}
          {possible ? (
            confirmer ? (
              <div className="kc2-form" style={{ marginTop: 6 }}>
                <p>Confirmez-vous l'annulation de ce devis ? L'entreprise en sera prévenue et vous rembourse les sommes versées sous 14 jours.</p>
                <div className="kc2-actions">
                  <button type="button" className="kc-sec" onClick={() => setConfirmer(false)}>Garder le devis</button>
                  <button type="button" className="kc-sec" onClick={seRetracter} disabled={envoi}>{envoi ? "Envoi…" : "Je me rétracte"}</button>
                </div>
              </div>
            ) : <button type="button" className="kc-sec" style={{ marginTop: 6 }} onClick={() => setConfirmer(true)}>Me rétracter</button>
          ) : null}
          {erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null}
        </div>
      ) : null}
    </>
  );
}

export default function SignatureParLien() {
  const { token } = useParams();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | invalide | erreur
  const [quote, setQuote] = useState(null);
  const [vue, setVue] = useState(null);
  const [contact, setContact] = useState(null);
  const [acces, setAcces] = useState(null);
  const [detail, setDetail] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch(`/api/signatures/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) { window.location.replace(`/signature/login?signatureToken=${encodeURIComponent(token)}`); return; }
        const data = await r.json().catch(() => ({}));
        if (!vivant) return;
        if (r.status === 404 || r.status === 410) { setContact(data.entreprise || null); setEtat("invalide"); return; }
        if (!r.ok || !data.vue) throw new Error(data.error || "Lecture impossible.");
        setQuote(data.quote);
        setVue(data.vue);
        setEtat("pret");
      })
      .catch(() => { if (vivant) setEtat("erreur"); });
    return () => { vivant = false; };
  }, [token]);

  async function signer(donnees) {
    const r = await fetch(`/api/signatures/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees)
    });
    if (r.status === 401) { window.location.replace(`/signature/login?signatureToken=${encodeURIComponent(token)}`); return; }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Signature impossible.");
    setQuote((q) => ({ ...data.quote, company: q?.company || data.quote?.company }));
    if (data.vue) setVue(data.vue);
    setAcces(data.clientAccess || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const devis = vue?.devis;
  const entreprise = devis?.entreprise?.nom || "";
  const retracte = Boolean(quote?.retracteLe);
  const signe = etat === "pret" && devis?.etat === "signe" && !retracte;
  const aSigner = etat === "pret" && devis?.etat === "a_signer" && devis.signature;
  const nePlusSigner = etat === "pret" && !signe && !aSigner && !retracte;
  const pdf = devis?.pdf || "";

  const barre = etat === "invalide" || nePlusSigner
    ? ["Lien non valide", "déjà utilisé, expiré ou remplacé"]
    : retracte ? ["Devis annulé", entreprise]
      : signe ? ["Devis signé", devis.signeLe.replace(" à ", " · ")]
        : ["Signer le devis", entreprise ? `${entreprise} · lien reçu par e-mail` : "lien reçu par e-mail"];

  let corps = null;
  if (etat === "chargement") {
    corps = <p className="kc-s">Chargement du devis…</p>;
  } else if (etat === "erreur") {
    corps = (
      <div className="ksg-ok">
        <p className="kc-p">Le devis n'a pas pu être chargé. Vérifiez votre connexion et rechargez la page.</p>
        <button type="button" className="kc-sec" onClick={() => window.location.reload()}>Recharger</button>
      </div>
    );
  } else if (etat === "invalide" || nePlusSigner) {
    const ecrire = contact?.email || quote?.company?.email || "";
    corps = (
      <div className="ksg-c">
        <div className="ksg-ok">
          <span className="ksg-ico warn"><Icone nom="warn" /></span>
          <h1>Ce lien n'ouvre plus de devis</h1>
          <p className="kc-p">Il a déjà servi, il a expiré, ou l'entreprise a envoyé une nouvelle version.</p>
          <div className="ksg-why">
            <div><b>Déjà signé ?</b><span>Votre exemplaire vous a été envoyé par e-mail au moment de la signature.</span></div>
            <div><b>Lien expiré ?</b><span>Un lien de signature vaut 30 jours, comme le devis. L'entreprise peut vous renvoyer le devis.</span></div>
            <div><b>Nouvelle version ?</b><span>Utilisez le lien et le mot de passe du dernier e-mail reçu ; les versions précédentes ne se signent plus.</span></div>
          </div>
          <div className="kc-info">Vous avez un compte Koji Client avec l'e-mail donné à l'entreprise ? Le devis à signer y est aussi.</div>
          <a className="kc-sec" href="/login?type=particulier">Se connecter à Koji Client</a>
          <p className="kc-n">Une question ?{" "}
            {ecrire ? <><a className="kc-lien" href={`mailto:${ecrire}`}>Écrire à {contact?.nom || quote?.company?.name || "l'entreprise"}</a> · </> : null}
            <a className="kc-lien" href={AIDE_KOJI}>Aide Koji</a>
          </p>
        </div>
      </div>
    );
  } else if (retracte) {
    corps = (
      <div className="ksg-c">
        <div className="ksg-ok">
          <span className="ksg-ico warn"><Icone nom="warn" /></span>
          <h1>Devis annulé</h1>
          <p className="kc-p">Vous vous êtes rétracté le {new Date(quote.retracteLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}. L'entreprise est prévenue et vous rembourse les sommes versées sous 14 jours.</p>
          <p className="kc-n">Une question ? <a className="kc-lien" href={AIDE_KOJI}>Aide Koji</a></p>
        </div>
      </div>
    );
  } else if (signe) {
    corps = (
      <div className="ksg-c">
        <div className="ksg-ok">
          <span className="ksg-ico"><Icone nom="ok" /></span>
          <h1 className="kc-d">Devis signé</h1>
          <h1 className="kc-t">Merci, c'est signé.</h1>
          <p className="kc-p">{vue.apres?.texte}</p>
          <div className="ksg-pc">
            <div><b>{devis.titre}</b><small>{[entreprise, devis.totalTtc + " TTC"].join(" · ")}</small></div>
            <a className="kc-sec" href={pdf} download><Icone nom="dl" />Télécharger</a>
          </div>
          {vue.apres?.etapes?.length ? (
            <div className="ksg-next">
              <span className="kc-ey">Et maintenant</span>
              <ol>{vue.apres.etapes.map((e) => <li key={e.titre}><b>{e.titre}</b> · {e.texte}</li>)}</ol>
            </div>
          ) : null}
          <a className="kc-btn" href={acces?.loginUrl || "/login?type=particulier"}>Suivre mon chantier dans Koji Client</a>
          <Retractation quote={quote} token={token} onRetracte={(q) => setQuote((avant) => ({ ...avant, ...q }))} />
        </div>
      </div>
    );
  } else if (aSigner) {
    corps = (
      <div className="kc2-g">
        <div className="kc2-main">
          <div className="kc2-price kc-t" style={{ flexDirection: "column" }}>
            <span>{devis.titre}</span>
            <b>{devis.totalTtc}</b>
            <small>{["TTC", devis.totaux.find((t) => /^TVA/.test(t.libelle))?.libelle.split(" · ")[0], devis.acompte ? `${devis.acompte.detail.split(" · ")[0]} à la signature` : ""].filter(Boolean).join(" · ")}</small>
          </div>
          <button type="button" className="kc2-row kc-t" onClick={() => setDetail((v) => !v)} aria-expanded={detail}>
            <div><strong>{detail ? "Masquer le devis" : "Lire le devis complet"}</strong><small>{devis.lignes.length} ligne{devis.lignes.length > 1 ? "s" : ""} · PDF à télécharger</small></div>
            <span className="chev">{detail ? "˄" : "›"}</span>
          </button>
          <div className={`kc2-docwrap${detail ? " ouvert" : ""}`}>
            <DocDevis devis={devis} entreprise={entreprise} />
            <a className="kc-sec kc-t" href={pdf} download style={{ marginTop: 10 }}>Télécharger le PDF</a>
          </div>
        </div>
        <div className="kc2-side ksg-form">
          <h2 className="ksg-h kc-d">Signer le devis</h2>
          <p className="kc-p kc-d">{vue.intro}</p>
          <SignatureDevisClient
            regles={devis.signature}
            identite={{ nom: vue.nom, emailMasque: vue.emailMasque }}
            onSigner={signer}
            libelleSignature="Signez ici à la souris, ou au doigt sur votre téléphone"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${CHARTE_CLIENT} kc kc2 sans-barre`}>
      <header className="ksg-top">
        <span className="kc-w"><KojiWordmark height={13} /></span>
        <span className="ksg-sub">Signature en ligne · sans compte</span>
        {pdf && (aSigner || signe) ? <a className="ksg-dl" href={pdf} download><Icone nom="dl" />Télécharger le PDF</a> : null}
      </header>
      <header className="ksg-bar">
        <div><strong>{barre[0]}</strong>{barre[1] ? <small>{barre[1]}</small> : null}</div>
      </header>
      <main className="kc-m"><div className="kc2-in">{corps}</div></main>
    </div>
  );
}
