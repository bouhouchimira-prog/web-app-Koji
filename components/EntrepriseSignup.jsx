"use client";

import { useState } from "react";
import { apiSend } from "../lib/client-api";
import { EntrepriseAuthTabs, EyeIcon } from "./EntrepriseLogin";
import { SsoButtons } from "./SsoButtons";
import "./entreprise-login.css";

// Inscription Koji Pro (maquette PRO-00, « Ordinateur · créer un compte ») :
// inscription minimale — e-mail, mot de passe, SIREN facultatif (Koji remplit
// la fiche entreprise depuis l'annuaire, lib/sirene.js), case des conditions
// jamais pré-cochée, information sur les données personnelles. Le nom de
// l'entreprise et le reste se complètent au démarrage guidé.
// Inscription par téléphone : pas encore (aucun fournisseur SMS).
export function EntrepriseSignup({ L, onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [siren, setSiren] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError(L.auth.errEmail); return; }
    if (password.length < 8) { setError(L.auth.errPasswordLen); return; }
    const sirenClean = siren.replace(/[\s.]/g, "");
    if (sirenClean && !/^\d{9}$/.test(sirenClean)) { setError("Le SIREN fait 9 chiffres. Vous pouvez aussi le laisser vide."); return; }
    if (!accepted) { setError("Cochez la case pour accepter les conditions d'utilisation."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/signup", {
        email: trimmed,
        password,
        siren: sirenClean,
        acceptedTerms: true,
        accountType: "entreprise"
      });
      onDone?.({ email: trimmed, ...data });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="el">
      <EntrepriseAuthTabs active="signup" />
      <h1 className="el-h">Compte entreprise, gratuit</h1>

      <form className="el-form" onSubmit={handleSubmit} noValidate>
        <div className="el-field">
          <label htmlFor="es-email">E-mail</label>
          <input
            id="es-email"
            type="email"
            className="el-input"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder={L.auth.emailPlaceholder}
            autoComplete="email"
            autoFocus
          />
        </div>
        <div className="el-field">
          <label htmlFor="es-password">Mot de passe</label>
          <div className="el-input-wrap">
            <input
              id="es-password"
              className="el-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              minLength={8}
            />
            <button type="button" className="el-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={L.auth.showHide}>
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>
        <div className="el-field">
          <label htmlFor="es-siren">SIREN · facultatif maintenant</label>
          <input
            id="es-siren"
            className="el-input"
            inputMode="numeric"
            value={siren}
            onChange={(e) => { setSiren(e.target.value); setError(""); }}
            placeholder="Koji remplit votre fiche entreprise"
            autoComplete="off"
            maxLength={14}
          />
        </div>

        <label className="el-ck">
          <input type="checkbox" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setError(""); }} />
          <span>
            <b>J'accepte les <a href="/legal" target="_blank" rel="noopener noreferrer">conditions d'utilisation</a></b>
            <small>et j'ai lu la <a href="/legal" target="_blank" rel="noopener noreferrer">politique de confidentialité</a>. Vos données servent à votre compte Koji ; ABL Expert Renov, éditeur de Koji, en est responsable.</small>
          </span>
        </label>

        {error ? <p className="el-error" role="alert">{error}</p> : null}
        <button type="submit" className="el-btn-primary" disabled={loading}>
          {loading ? L.auth.creating : "Créer mon compte"}
        </button>
      </form>

      <div className="el-or"><span>ou</span></div>
      <SsoButtons profile="entreprise" L={L} variant="stack" />

      <small className="el-note">Ensuite : démarrage guidé, 10 minutes.</small>
    </div>
  );
}
