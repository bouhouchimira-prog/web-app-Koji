"use client";

import Link from "next/link";

function ChevronIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Menu du haut (24 septembre) : structure prete, contenu (pages
// Fonctionnalites/Metiers/Comparer, Tarifs, Blog...) a remplir plus tard
// par Amira — pour l'instant ces entrees ne menent nulle part (pas de lien
// mort vers une page qui n'existe pas encore).
const NAV_MENU = [
  { label: "Découvrir" },
  { label: "Fonctionnalités", dropdown: true },
  { label: "Métiers", dropdown: true },
  { label: "Comparer", dropdown: true },
  { label: "Tarifs" },
  { label: "Blog" }
];

// Page publique affichee sur "/" pour un visiteur non connecte (23
// septembre) — premiere version, volontairement courte : Amira ajoutera
// plus de sections plus tard. Met en avant le Marketplace/Radar des
// Chantiers (trouver des chantiers pres de chez soi) comme argument
// principal, avant le reste de l'outil (devis, factures, suivi).
export function PublicLanding() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <img src="/koji-logo-blue.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <nav className="landing-nav-menu" aria-label="Menu">
          {NAV_MENU.map((item) => (
            <button type="button" className="landing-nav-menu-item" key={item.label}>
              {item.label}
              {item.dropdown ? <ChevronIcon /> : null}
            </button>
          ))}
        </nav>
        <div className="landing-nav-actions">
          <Link href="/login" className="landing-nav-link">Connexion</Link>
          <Link href="/signup" className="landing-nav-cta">Essai gratuit</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-text">
            <span className="landing-pill">
              <span className="landing-pill-dot" />
              Chantiers publiés en direct, près de chez vous
            </span>
            <p className="landing-eyebrow">MARKETPLACE BTP</p>
            <h1>
              Trouvez des chantiers,<br />
              <em>près de chez vous.</em>
            </h1>
            <p className="landing-subtitle">
              Les particuliers publient leurs travaux sur Koji, les entreprises du BTP les découvrent autour d'elles et répondent en quelques clics. Devis, facturation et suivi de chantier suivent, dans le même outil.
            </p>
            <div className="landing-cta-row">
              <Link href="/login?type=particulier" className="landing-btn-primary">Publier une offre</Link>
              <Link href="/signup?type=entreprise" className="landing-btn-secondary">Je suis une entreprise →</Link>
            </div>
            <p className="landing-trust">Publication d'offre gratuite et illimitée</p>
          </div>

          <div className="landing-hero-visual" aria-hidden="true">
            <div className="landing-radar">
              <div className="landing-radar-ring landing-radar-ring-1" />
              <div className="landing-radar-ring landing-radar-ring-2" />
              <div className="landing-radar-ring landing-radar-ring-3" />
              <div className="landing-radar-center" />
              <div className="landing-radar-pin landing-radar-pin-1">
                <span>Salle de bain · 5 m²</span>
              </div>
              <div className="landing-radar-pin landing-radar-pin-2">
                <span>Toiture · Urgent</span>
              </div>
              <div className="landing-radar-pin landing-radar-pin-3">
                <span>Cuisine complète</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-feature landing-feature-featured">
          <span className="landing-feature-icon">📍</span>
          <strong>Marketplace de proximité</strong>
          <p>Des chantiers repérés autour de votre zone d'activité, dès qu'ils sont publiés — le cœur de Koji.</p>
        </div>
        <div className="landing-features-secondary">
          <div className="landing-feature">
            <span className="landing-feature-icon">✨</span>
            <strong>Devis chiffrés par IA</strong>
            <p>Décrivez le chantier, l'assistant koji prépare un devis prêt à envoyer.</p>
          </div>
          <div className="landing-feature">
            <span className="landing-feature-icon">📋</span>
            <strong>Suivi jusqu'à la facture</strong>
            <p>Chantiers, équipe et facturation dans le même outil, du premier contact à la fin des travaux.</p>
          </div>
        </div>
      </section>

      <section className="landing-app">
        <div className="landing-app-card">
          <div className="landing-app-text">
            <strong>Koji sur le chantier</strong>
            <p>L'application mobile Koji arrive bientôt, pour suivre vos chantiers directement depuis le terrain.</p>
          </div>
          <div className="landing-app-badges">
            <span className="landing-app-badge">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.365 1.43c0 1.14-.475 2.18-1.24 2.94-.87.87-2.24 1.55-3.34 1.46-.14-1.1.44-2.25 1.24-3.02.85-.83 2.3-1.44 3.34-1.38zM20.5 17.17c-.56 1.29-.83 1.87-1.55 3.02-1 1.6-2.4 3.6-4.15 3.62-1.55.02-1.95-1.02-4.05-1-2.1.02-2.55 1.03-4.1 1.01-1.75-.02-3.08-1.82-4.08-3.42C0.02 16.9-.68 12.44 1.4 9.4c1.02-1.48 2.65-2.42 4.25-2.44 1.6-.03 2.6 1.1 4.05 1.1 1.4 0 2.15-1.1 4.05-1.06 1.7.04 3.5.93 4.5 2.4-3.95 2.17-3.32 7.83 2.25 9.77-.15.35-.35.7-.5 1z"/></svg>
              Bientôt sur l'App Store
            </span>
            <span className="landing-app-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.6 2.2c-.4.4-.6.9-.6 1.5v16.6c0 .6.2 1.1.6 1.5l.1.1L13 12.6v-.2L3.7 2.1l-.1.1zM16.8 15.4l-3.1-3.1v-.2l3.1-3.1 3.6 2c1 .6 1 1.6 0 2.2l-3.6 2.2zM14.4 12.2l-10.4 10.4c.4.2.9.2 1.5-.1l12.3-7-3.4-3.3zM4 1.5c.5-.2 1-.2 1.5.1l12.3 7-3.4 3.4L4 1.5z"/></svg>
              Bientôt sur Google Play
            </span>
          </div>
        </div>
      </section>

      <section className="landing-journey">
        <div className="landing-journey-card">
          <p className="landing-journey-eyebrow">Pour les entreprises du BTP</p>
          <h2>
            Trouvez votre premier client,<br />
            <em>réalisez votre premier chantier</em><br />
            via Koji.
          </h2>
          <p className="landing-journey-subtitle">
            Parcourez les chantiers publiés près de chez vous sur le Marketplace, répondez à ceux qui vous intéressent, puis chiffrez et suivez le chantier sans changer d'outil.
          </p>
          <Link href="/signup?type=entreprise" className="landing-journey-btn">
            Créer mon compte entreprise <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="landing-dual-cta">
        <div className="landing-dual-cta-col">
          <p className="landing-dual-cta-eyebrow">Particuliers</p>
          <h2>Testez Koji 100% gratuit pour trouver le meilleur artisan pour vos travaux.</h2>
          <Link href="/login?type=particulier" className="landing-dual-cta-btn">Publier une offre</Link>
        </div>
        <div className="landing-dual-cta-divider" aria-hidden="true" />
        <div className="landing-dual-cta-col">
          <p className="landing-dual-cta-eyebrow">Artisans</p>
          <h2>Vous êtes un artisan ? Trouvez des clients via Koji.</h2>
          <Link href="/signup?type=entreprise" className="landing-dual-cta-btn">Essai gratuit entreprise</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-nav-brand landing-nav-brand-dark">
              <img src="/koji-logo.svg" alt="Koji" />
              <span>Koji</span>
            </div>
            <p>Le Marketplace BTP français qui met en relation particuliers et entreprises près de chez eux — devis IA, facturation et suivi de chantier suivent, dans le même outil.</p>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-title">Marketplace</span>
            <Link href="/login?type=particulier">Publier une offre</Link>
            <Link href="/signup?type=entreprise">Trouver des chantiers</Link>
            <button type="button">Comment ça marche</button>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-title">Gestion BTP</span>
            <button type="button">Devis par IA</button>
            <button type="button">Facturation</button>
            <button type="button">Suivi de chantier</button>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-title">Ressources</span>
            <Link href="/aide">Aide</Link>
            <button type="button">Blog</button>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-title">Légal</span>
            <Link href="/legal">Mentions légales</Link>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Koji</span>
          <span>Fait avec passion pour les artisans</span>
        </div>
      </footer>
    </main>
  );
}
