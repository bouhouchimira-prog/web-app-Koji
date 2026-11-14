"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiSend } from "../lib/client-api";
import { REGLES_MOT_DE_PASSE, masquerEmail, verifierMotDePasse } from "../lib/password-rules";
import { EyeIcon } from "./EntrepriseLogin";
import "./entreprise-login.css";

// Écrans courts autour de la connexion Koji Pro (maquette PRO-00.1), dans le
// gabarit components/EntrepriseAuthLayout.jsx :
// - Mot de passe oublié : un seul champ, message identique qu'un compte
//   existe ou non, lien valable 30 minutes ;
// - Nouveau mot de passe : trois règles cochées au fur et à mesure, autres
//   appareils déconnectés (dit avant), connexion immédiate ;
// - Compte activé : invitation au démarrage guidé, « Plus tard » ;
// - Lien expiré ou déjà utilisé : champ pour en recevoir un nouveau.
// Pas de « code par SMS » : aucun fournisseur SMS aujourd'hui.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Ico({ warn = false }) {
  return (
    <span className={`el-ico${warn ? " warn" : ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {warn ? <path d="M12 7v6M12 17h.01" /> : <path d="M4 12l5 5L20 6" />}
      </svg>
    </span>
  );
}

function CheckMini() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
  );
}

function Envoye({ email, children }) {
  return (
    <div className="el-sent" role="status">
      <CheckMini />
      <div>
        <b>Lien envoyé à {masquerEmail(email) || email}</b>
        <small>{children}</small>
      </div>
    </div>
  );
}

// Champ e-mail + envoi d'un lien (mot de passe oublié, lien expiré).
function DemandeLien({ action, emailInitial = "", bouton, intro = null }) {
  const [email, setEmail] = useState(emailInitial);
  const [state, setState] = useState({ status: "idle", error: "" });

  useEffect(() => { if (emailInitial) setEmail(emailInitial); }, [emailInitial]);

  async function submit(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setState({ status: "idle", error: "Entrez une adresse e-mail valide." });
      return;
    }
    setState({ status: "sending", error: "" });
    try {
      // Réponse identique qu'un compte existe ou non : une erreur ici ne
      // vient que du réseau ou du serveur, jamais de l'adresse.
      await action(trimmed);
      setState({ status: "sent", error: "" });
    } catch {
      setState({ status: "idle", error: "Envoi impossible pour le moment. Vérifiez la connexion puis réessayez." });
    }
  }

  return (
    <form className="el-form" onSubmit={submit} noValidate>
      {intro}
      <div className="el-field">
        <label htmlFor="el-lien-email">E-mail</label>
        <input
          id="el-lien-email"
          type="email"
          className="el-input"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setState({ status: "idle", error: "" }); }}
          placeholder="vous@exemple.fr"
          autoComplete="email"
        />
      </div>
      {state.error ? <p className="el-error" role="alert">{state.error}</p> : null}
      <button type="submit" className="el-btn-primary" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Envoi…" : bouton}
      </button>
      {state.status === "sent" ? (
        <Envoye email={email.trim().toLowerCase()}>Rien reçu ? Vérifiez vos indésirables, puis réessayez dans quelques minutes.</Envoye>
      ) : null}
    </form>
  );
}

export function MotDePasseOublie() {
  return (
    <div className="el">
      <Link className="el-back" href="/login?type=entreprise">‹ Retour à la connexion</Link>
      <h1 className="el-h">Mot de passe oublié</h1>
      <p className="el-p">Indiquez l'e-mail du compte. Si un compte existe, vous recevez un lien valable 30 minutes.</p>
      <DemandeLien
        bouton="Envoyer le lien"
        action={(email) => apiSend("/api/auth/forgot-password", { email, accountType: "entreprise" })}
      />
    </div>
  );
}

// Lien expiré ou déjà utilisé. `mode` : "reset" (nouveau lien de mot de
// passe) ou "activation" (nouvel e-mail d'activation).
export function LienExpire({ mode = "reset", emailInitial = "" }) {
  return (
    <div className="el el-done">
      <Ico warn />
      <h1 className="el-h">Ce lien ne fonctionne plus</h1>
      <p className="el-p">Il a expiré ou a déjà servi. Aucune donnée n'est perdue : demandez-en un nouveau.</p>
      <DemandeLien
        emailInitial={emailInitial}
        bouton="Recevoir un nouveau lien"
        action={(email) => (mode === "activation"
          ? apiSend("/api/auth/resend-activation", { email })
          : apiSend("/api/auth/forgot-password", { email, accountType: "entreprise" }))}
      />
      <Link className="el-center-link" href="/login?type=entreprise">Revenir à la connexion</Link>
    </div>
  );
}

function heure(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// `app` : "pro" quand la demande vient de l'app Koji Pro (lien &app=pro,
// lib/reset-app.js). La personne est sur son téléphone : on lui dit de
// retourner dans l'app, au lieu de la connecter au site.
export function NouveauMotDePasse({ token, app = null }) {
  const depuisApp = app === "pro";
  const [lien, setLien] = useState({ status: "loading", email: "", expiresAt: null });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ status: "idle", error: "" });

  useEffect(() => {
    if (!token) { setLien({ status: "expired", email: "", expiresAt: null }); return; }
    fetch(`/api/auth/set-password?token=${encodeURIComponent(token)}&type=entreprise`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Lien invalide");
        setLien({ status: "ok", email: data.email || "", expiresAt: data.expiresAt || null });
      })
      .catch(() => setLien({ status: "expired", email: "", expiresAt: null }));
  }, [token]);

  const regles = verifierMotDePasse(password, lien.email);
  const pret = regles.ok && confirm === password;

  async function submit(event) {
    event.preventDefault();
    if (!regles.ok) { setState({ status: "idle", error: "Le mot de passe ne respecte pas encore les trois règles." }); return; }
    if (confirm !== password) { setState({ status: "idle", error: "Les deux mots de passe ne sont pas identiques." }); return; }
    setState({ status: "saving", error: "" });
    try {
      const data = await apiSend("/api/auth/set-password", { token, mode: "reset", password, accountType: "entreprise" });
      const email = data.email || lien.email;
      if (depuisApp) {
        setState({ status: "done", error: "", email });
        return;
      }
      // Connexion immédiate avec le nouveau mot de passe.
      try {
        const session = await apiSend("/api/auth/login", { email, password, accountType: "entreprise" });
        window.localStorage.setItem("koji-user", JSON.stringify(session.user));
        window.location.assign("/");
      } catch {
        window.location.assign(`/login?type=entreprise&email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      if (/expir|invalide/i.test(error.message || "")) setLien({ status: "expired", email: lien.email, expiresAt: null });
      else setState({ status: "idle", error: error.message || "Le mot de passe n'a pas pu être enregistré." });
    }
  }

  if (lien.status === "loading") return <p className="el-note">Vérification du lien…</p>;
  if (lien.status === "expired") return <LienExpire mode="reset" emailInitial={lien.email} />;
  if (state.status === "done") {
    return (
      <div className="el el-done">
        <Ico />
        <h1 className="el-h">Mot de passe enregistré</h1>
        <p className="el-p">
          Retournez dans l'app <b>Koji Pro</b> et connectez-vous avec {state.email ? <b>{state.email}</b> : "votre adresse e-mail"} et ce nouveau mot de passe.
        </p>
        <small className="el-note">Vous pouvez fermer cette page.</small>
      </div>
    );
  }

  return (
    <div className="el">
      <h1 className="el-h">Nouveau mot de passe</h1>
      <p className="el-p">
        Pour le compte <b>{lien.email}</b>. Les autres appareils connectés seront déconnectés.
      </p>
      <form className="el-form" onSubmit={submit} noValidate>
        <div className="el-field">
          <label htmlFor="el-new">Nouveau mot de passe</label>
          <div className="el-input-wrap">
            <input
              id="el-new"
              className="el-input"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setState({ status: "idle", error: "" }); }}
              autoComplete="new-password"
              autoFocus
            />
            <button type="button" className="el-eye-btn" onClick={() => setShow((v) => !v)} aria-label="Afficher ou masquer le mot de passe">
              <EyeIcon open={show} />
            </button>
          </div>
        </div>
        <ul className="el-rules" aria-label="Règles du mot de passe">
          {REGLES_MOT_DE_PASSE.map((regle) => (
            <li key={regle.id} className={regles[regle.id] ? "ok" : undefined}>
              <CheckMini />{regle.label}
            </li>
          ))}
        </ul>
        <div className="el-field">
          <label htmlFor="el-confirm">Confirmer</label>
          <input
            id="el-confirm"
            className="el-input"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setState({ status: "idle", error: "" }); }}
            autoComplete="new-password"
          />
        </div>
        {state.error ? <p className="el-error" role="alert">{state.error}</p> : null}
        <button type="submit" className="el-btn-primary" disabled={state.status === "saving" || !pret}>
          {state.status === "saving" ? "Enregistrement…" : depuisApp ? "Enregistrer" : "Enregistrer et me connecter"}
        </button>
        {lien.expiresAt ? (
          <small className="el-note">Lien valable jusqu'à {heure(lien.expiresAt)}. Après : refaire « Mot de passe oublié ».</small>
        ) : null}
      </form>
    </div>
  );
}

export function CompteActive({ token }) {
  const [etat, setEtat] = useState({ status: "loading", email: "" });

  useEffect(() => {
    if (!token) { setEtat({ status: "expired", email: "" }); return; }
    fetch(`/api/auth/activate?token=${encodeURIComponent(token)}&type=entreprise`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Activation impossible");
        setEtat({ status: "ok", email: data.email || "" });
      })
      .catch(() => setEtat({ status: "expired", email: "" }));
  }, [token]);

  if (etat.status === "loading") return <p className="el-note">Activation de votre compte…</p>;
  if (etat.status === "expired") return <LienExpire mode="activation" />;

  const login = `/login?type=entreprise${etat.email ? `&email=${encodeURIComponent(etat.email)}` : ""}`;
  return (
    <div className="el el-done">
      <Ico />
      <h1 className="el-h">Compte activé</h1>
      <p className="el-p">
        Votre adresse {etat.email ? <b>{etat.email}</b> : null} est confirmée. Il reste 10 minutes de démarrage guidé pour que Koji connaisse votre entreprise, vos métiers et vos prix.
      </p>
      <Link className="el-btn-primary" href={`${login}&next=${encodeURIComponent("/demarrage")}`}>Commencer le démarrage guidé</Link>
      <Link className="el-btn-sec" href={login}>Plus tard, aller à l'accueil</Link>
      <small className="el-note">Vous pouvez déjà faire un devis : Koji demandera ce qui manque au moment utile.</small>
    </div>
  );
}
