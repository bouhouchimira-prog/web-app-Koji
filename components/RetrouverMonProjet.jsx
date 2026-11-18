"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import KojiWordmark from "./KojiWordmark";
import { CHARTE_CLIENT } from "./ClientTopbar";
import { adresseMasquee } from "../lib/profil-client";
import "../app/client/cli03.css";

// Koji Client · « Retrouver mon projet » (maquette CLI-05). La maquette
// prévoit le téléphone et un code par SMS : Koji n'a pas de fournisseur
// SMS, le code arrive par e-mail (« recevoir par e-mail » de la maquette).
// POST /api/auth/particulier-code puis /api/auth/particulier-code/verifier,
// qui ouvre la même session que la connexion par mot de passe. Celle-ci
// reste accessible (lien discret), avec Google.

const PAUSE_S = 60;

export function RetrouverMonProjet() {
  const router = useRouter();
  const [etape, setEtape] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [attente, setAttente] = useState(0);

  useEffect(() => {
    if (attente <= 0) return undefined;
    const t = window.setTimeout(() => setAttente((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [attente]);
  // Le champ du code visible (ordinateur ou téléphone) prend le curseur.
  const curseurCode = () => [...document.querySelectorAll(".kc3-code input")].find((x) => x.offsetParent !== null)?.focus();
  useEffect(() => { if (etape === "code") curseurCode(); }, [etape]);

  async function demander(event, renvoi = false) {
    event?.preventDefault();
    const adresse = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) { setErreur("Saisissez l'adresse e-mail donnée en publiant votre demande."); return; }
    setEnvoi(true);
    setErreur("");
    setInfo("");
    try {
      const r = await fetch("/api/auth/particulier-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adresse }) });
      if (!r.ok) throw new Error();
      setEtape("code");
      setCode("");
      setAttente(PAUSE_S);
      if (renvoi) setInfo("Nouveau code envoyé. Le précédent ne fonctionne plus.");
    } catch {
      setErreur("L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  async function verifier(event) {
    event?.preventDefault();
    if (code.length !== 6) return;
    setEnvoi(true);
    setErreur("");
    setInfo("");
    try {
      const r = await fetch("/api/auth/particulier-code/verifier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.account) throw new Error(data.error || "Code incorrect ou expiré.");
      window.localStorage.setItem("koji-user", JSON.stringify(data.account));
      router.push("/client");
    } catch (e) {
      setErreur(e.message || "Code incorrect ou expiré.");
      setCode("");
      setEnvoi(false);
      window.setTimeout(curseurCode, 0);
    }
  }

  const masquee = adresseMasquee(email) || email.trim();
  const cases = Array.from({ length: 6 }, (_, i) => code[i] || "");

  const formulaireEmail = (tel) => (
    <form className="kc3-spc" onSubmit={(e) => demander(e)} noValidate>
      {tel ? <h3 className="kc-ph">Retrouver mon projet</h3> : <div><span className="kc-ey">Koji Client</span><h1 className="kc-h">Retrouver mon projet</h1></div>}
      <p className="kc-p">{tel ? "L'adresse e-mail que vous avez donnée en publiant votre demande. Vous recevez un code, pas de mot de passe à retenir." : "L'adresse e-mail donnée en publiant votre demande. Un code arrive par e-mail ; aucun mot de passe."}</p>
      <div className="kc-fld">
        <label htmlFor={`kc3-email-${tel ? "t" : "d"}`}>Adresse e-mail</label>
        <input id={`kc3-email-${tel ? "t" : "d"}`} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErreur(""); }} autoComplete="email" inputMode="email" placeholder="vous@exemple.fr" />
      </div>
      {erreur ? <p className="kc3-err" role="alert">{erreur}</p> : null}
      <button type="submit" className={tel ? "kc-btn" : "kc-btn sm"} disabled={envoi || !email.trim()}>{envoi ? "Envoi…" : "Recevoir un code"}</button>
      <p className="kc-s">Nouveau sur Koji ? <Link className="kc3-lien" href="/login?type=particulier&mode=inscription">Décrire un projet</Link> : créez votre accès, puis décrivez vos travaux.</p>
      {tel ? <p className="kc-s">Un lien reçu par e-mail (devis à signer) ouvre directement le document, sans cette étape.</p> : null}
      <div className="kc3-autre">
        <Link className="kc3-lien kc-s" href="/login?type=particulier&mode=motdepasse">Se connecter avec un mot de passe ou Google</Link>
      </div>
    </form>
  );

  const formulaireCode = (tel) => (
    <form className="kc3-spc" onSubmit={verifier}>
      {tel ? null : <div><span className="kc-ey">Envoyé à {masquee}</span><h1 className="kc-h">Code reçu</h1></div>}
      <p className="kc-p">Si cette adresse correspond à un compte Koji, un code à 6 chiffres vient d'y être envoyé.</p>
      <div className="kc3-code">
        {cases.map((c, i) => <i key={i} className={c ? "plein" : i === code.length ? "ici" : ""} aria-hidden="true">{c}</i>)}
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErreur(""); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          aria-label="Code à 6 chiffres"
        />
      </div>
      <p className="kc-s">
        Valable 10 minutes · {attente > 0
          ? <span>renvoyer dans {attente} s</span>
          : <button type="button" className="kc3-lien" onClick={() => demander(null, true)} disabled={envoi}>renvoyer</button>}
        {" · "}<button type="button" className="kc3-lien" onClick={() => { setEtape("email"); setErreur(""); setInfo(""); }}>changer d'adresse</button>
      </p>
      {info ? <p className="kc3-ok" role="status">{info}</p> : null}
      {erreur ? <p className="kc3-err" role="alert">{erreur}</p> : null}
      <button type="submit" className={tel ? "kc-btn" : "kc-btn sm"} disabled={envoi || code.length !== 6}>{envoi ? "Vérification…" : "Ouvrir mon projet"}</button>
      <div className="kc3-autre">
        <span className="kc-s">Rien reçu ? Regardez dans les indésirables, ou <Link className="kc3-lien" href="/login?type=particulier&mode=motdepasse">connectez-vous avec un mot de passe</Link>.</span>
      </div>
    </form>
  );

  return (
    <div className={`${CHARTE_CLIENT} kc sans-barre`}>
      <header className={`${CHARTE_CLIENT} kc-top`}>
        <Link href="/particulier" className="kc-w" aria-label="Koji, accueil"><KojiWordmark height={13} /></Link>
        <nav aria-hidden="true" />
        <span className="kc-u">Particulier</span>
      </header>
      {etape === "code" ? (
        <header className={`${CHARTE_CLIENT} kc-bar`}>
          <button type="button" className="kc-b" aria-label="Retour" onClick={() => setEtape("email")}>‹</button>
          <div><strong>Code reçu</strong><small>envoyé à {masquee}</small></div>
        </header>
      ) : (
        <header className={`${CHARTE_CLIENT} kc-ptop`}>
          <Link href="/particulier" className="kc-w" aria-label="Koji, accueil"><KojiWordmark height={13} /></Link>
        </header>
      )}
      <main className="kc-m">
        <div className="kc-d">
          <div className="kc3-sp">
            {etape === "code" ? formulaireCode(false) : formulaireEmail(false)}
            <aside className="kc3-a">
              <h3>Sans compte à créer</h3>
              <p>Votre adresse e-mail sert de clé : elle n'est jamais montrée aux entreprises avant qu'un rendez-vous soit confirmé.</p>
              <h3>Depuis un lien</h3>
              <p>Les liens reçus par e-mail (devis à signer) ouvrent directement le document concerné.</p>
            </aside>
          </div>
        </div>
        <div className="kc-t kc-body">
          {etape === "code" ? formulaireCode(true) : formulaireEmail(true)}
        </div>
      </main>
    </div>
  );
}
