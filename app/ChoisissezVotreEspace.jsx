"use client";

import Link from "next/link";
import { DM_Sans } from "next/font/google";
import "./choice.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--f" });

function KojiLogo() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M6 8v24M6 20l12-12M6 20l12 12M24 8v24M24 8h8M24 32h8" fill="none" stroke="#E9B44C" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChoisissezVotreEspace() {
  const SIGNUP_PARTICULIER = "/login?type=particulier";
  const SIGNUP_ENTREPRISE = "/login?type=entreprise";
  const CONTACT = "mailto:contact@getkoji.io";

  return (
    <div className={`cv ${dmSans.variable}`}>
      <header className="cv-top">
        <a className="cv-logo" href="/">
          <KojiLogo />
          Koji
        </a>
        <ul>
          <li><a href="#decouvrir">Découvrir</a></li>
          <li><a href="#fonctions">Fonctionnalités ▾</a></li>
          <li><a href="/profile/entreprise">Métiers ▾</a></li>
          <li><a href="#comparer">Comparer ▾</a></li>
          <li><a href="/entreprise#tarifs">Tarifs</a></li>
        </ul>
        <span className="cv-right">
          <a className="cv-login" href="/login">Connexion</a>
          <a className="cv-cta" href={SIGNUP_PARTICULIER}>Publier une offre →</a>
        </span>
      </header>

      <main className="cv-split">
        {/* Particuliers - Radar */}
        <section className="cv-half cv-radar">
          <span className="cv-pill">
            <i></i> Publication gratuite et illimitée
          </span>
          <div className="cv-kicker">Particuliers · Radar des chantiers</div>
          <h1>Décrivez votre chantier. <em>Les artisans viennent à vous.</em></h1>
          <p className="cv-note">Publiez votre projet en quelques messages et comparez les offres.</p>
          <div className="cv-btns">
            <a className="cv-btn cv-btn-y" href={SIGNUP_PARTICULIER}>Publier mon chantier →</a>
            <a className="cv-btn cv-btn-o" href="/aide">Comment ça marche</a>
          </div>
          <div className="cv-chips">
            <span>Photos</span>
            <span>Devis comparés</span>
            <span>Artisans près de chez vous</span>
          </div>
        </section>

        {/* Entreprises - Koji Pro */}
        <section className="cv-half cv-pro">
          <span className="cv-pill">Gratuit pour commencer</span>
          <div className="cv-kicker">Artisans et entreprises · Koji Pro</div>
          <h1>Devis avec IA. <mark>Chantiers autour de vous.</mark></h1>
          <p className="cv-note">Chiffrez plus vite, trouvez vos prochains chantiers, encaissez sans relancer.</p>
          <div className="cv-btns">
            <a className="cv-btn cv-btn-y" href={SIGNUP_ENTREPRISE}>Créer mon compte →</a>
            <a className="cv-btn cv-btn-o" href="/entreprise#tarifs">Voir les tarifs</a>
          </div>
          <div className="cv-chips">
            <span>Devis avec IA</span>
            <span>Chantiers autour de vous</span>
            <span>Factures</span>
          </div>
        </section>
      </main>

      <footer className="cv-bf">
        <div className="cv-fl">
          <KojiLogo />
          Koji
        </div>
        <nav className="cv-fn">
          <a href="#decouvrir">Découvrir</a>
          <a href="#fonctions">Fonctionnalités</a>
          <a href="/profile/entreprise">Métiers</a>
          <a href="/entreprise#tarifs">Tarifs</a>
          <a href={CONTACT}>contact@getkoji.io</a>
        </nav>
        <span className="cv-fc">© 2026 koji · Marketplace BTP</span>
      </footer>
    </div>
  );
}
