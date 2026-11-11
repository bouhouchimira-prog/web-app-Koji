"use client";

import { useEffect, useState } from "react";
import { DM_Sans, Shippori_Mincho } from "next/font/google";
import KojiWordmark from "../components/KojiWordmark";
import KojiMonogram from "../components/KojiMonogram";
import "./choice.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--g0-f" });
const shippori = Shippori_Mincho({ subsets: ["latin"], weight: ["600"], variable: "--g0-fs" });

// SITE-00 (maquette « KOJI Pro pages ») : porte d'entrée de getkoji.io. La
// racine ne vend rien, elle fait choisir entre les deux univers : Entreprise
// (Koji Pro, SITE-01 sur /entreprise) et Particulier (Koji, SITE-02 sur
// /particulier). Le choix est gardé sur l'appareil (localStorage, aucune
// donnée personnelle) : au retour, l'écran « Vous êtes revenu » ouvre
// directement le bon univers. Les liens reçus (devis, visite, message)
// mènent directement à leur page et ne passent jamais par ici.
const UNIVERS_KEY = "koji-univers";

const UNIVERS = {
  pro: { href: "/entreprise", ouvrir: "Ouvrir Koji Pro", changer: "Je suis un particulier avec un projet", autre: "cli" },
  cli: { href: "/particulier", ouvrir: "Ouvrir Koji", changer: "Je suis une entreprise du bâtiment", autre: "pro" }
};

function lireUnivers() {
  try {
    const valeur = window.localStorage.getItem(UNIVERS_KEY);
    return valeur === "pro" || valeur === "cli" ? valeur : null;
  } catch {
    return null;
  }
}

function retenir(univers) {
  try { window.localStorage.setItem(UNIVERS_KEY, univers); } catch { /* navigation privée : rien à retenir */ }
}

function Fleche() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  );
}

export function ChoisissezVotreEspace() {
  // undefined = pas encore lu (premier rendu), null = première visite.
  const [memoire, setMemoire] = useState(undefined);

  useEffect(() => {
    setMemoire(lireUnivers());
  }, []);

  const classes = `g0 ${dmSans.variable} ${shippori.variable}`;

  return (
    <div className={classes}>
      <header className="g0-h">
        <a href="/" className="g0-w" aria-label="Koji, accueil"><KojiWordmark height={18} title="Koji" /></a>
        <span className="g0-dom">getkoji.io</span>
      </header>

      {memoire ? (
        <main className="g0-rem">
          <div className="g0-rem-in">
            <KojiMonogram className="g0-mono" />
            <span className="g0-ey">Vous êtes revenu</span>
            <h1>Bon retour sur Koji.</h1>
            <p>Koji se souvient de votre dernier choix sur cet appareil.</p>
            <a className="g0-btn" href={UNIVERS[memoire].href} onClick={() => retenir(memoire)}>
              {UNIVERS[memoire].ouvrir}<Fleche />
            </a>
            <a
              className="g0-sw"
              href={UNIVERS[UNIVERS[memoire].autre].href}
              onClick={() => retenir(UNIVERS[memoire].autre)}
            >
              {UNIVERS[memoire].changer}
            </a>
          </div>
        </main>
      ) : (
        <main className="g0-m" aria-busy={memoire === undefined}>
          <section className="g0-half g0-pro" aria-labelledby="g0-pro-t">
            <KojiMonogram className="g0-mono" />
            <a className="g0-login" href="/login?type=entreprise" onClick={() => retenir("pro")}>Déjà client ? Se connecter</a>
            <div className="g0-in">
              <span className="g0-ey">Vous faites les travaux</span>
              <h2 id="g0-pro-t">
                <span className="g0-dk">L'application des artisans et entreprises du bâtiment.</span>
                <span className="g0-ph">L'application des artisans du bâtiment.</span>
              </h2>
              <p>
                <span className="g0-dk">Devis guidé par Koji, chantiers, équipe, factures : tout le métier dans une seule application, gratuite pour commencer.</span>
                <span className="g0-ph">Devis, chantiers, équipe, factures.</span>
              </p>
              <ul className="g0-ul">
                <li><b>Trouver</b><span>des chantiers près de chez vous</span></li>
                <li><b>Chiffrer</b><span>un devis juste en dix minutes</span></li>
                <li><b>Conduire</b><span>photos, équipe, fournitures</span></li>
                <li><b>Encaisser</b><span>factures, relances, facture électronique</span></li>
              </ul>
              {/* Lien principal : toute la moitié est cliquable (::after). */}
              <a className="g0-btn g0-main" href="/entreprise" onClick={() => retenir("pro")}>
                Koji pour les entreprises<Fleche />
              </a>
              <small className="g0-ft">Plombier, électricien, carreleur, peintre, maçon, tous corps d'état</small>
            </div>
          </section>

          <section className="g0-half g0-cli" aria-labelledby="g0-cli-t">
            <KojiMonogram className="g0-mono" />
            <a className="g0-login" href="/login?type=particulier" onClick={() => retenir("cli")}>Un projet en cours ? Le retrouver</a>
            <div className="g0-in">
              <span className="g0-ey">Vous avez des travaux à faire</span>
              <h2 id="g0-cli-t">Un prix juste, des entreprises vérifiées.</h2>
              <p>
                {/* Aucun prix côté particulier (décision du 10 nov.) : la
                    maquette promettait « un prix recommandé avant toute
                    visite », retiré. */}
                <span className="g0-dk">Décrivez votre projet, puis recevez les propositions d'entreprises vérifiées près de chez vous. Gratuit.</span>
                <span className="g0-ph">Décrivez, recevez, choisissez, suivez.</span>
              </p>
              <ul className="g0-ul">
                <li><b>Décrire</b><span>vos travaux, avec des photos</span></li>
                <li><b>Recevoir</b><span>des propositions d'entreprises</span></li>
                <li><b>Choisir</b><span>une entreprise vérifiée</span></li>
                <li><b>Suivre</b><span>le chantier et payer par étapes</span></li>
              </ul>
              <a className="g0-btn g0-main" href="/particulier" onClick={() => retenir("cli")}>
                Koji pour les particuliers<Fleche />
              </a>
              <small className="g0-ft">Salle de bain, cuisine, peinture, électricité, plomberie, rénovation</small>
            </div>
          </section>
        </main>
      )}

      <footer className="g0-f">
        <span className="g0-dk">Un lien reçu par SMS ou e-mail (devis à signer, visite, message) vous emmène directement au bon endroit.</span>
        <nav aria-label="Informations">
          <a href="/legal">À propos</a>
          <a href="mailto:contact@getkoji.io">Contact</a>
          <a href="/legal">Mentions légales</a>
          <a href="/legal">Confidentialité</a>
          <span aria-label="Langue : français">FR</span>
        </nav>
      </footer>
    </div>
  );
}
