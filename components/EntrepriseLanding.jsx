"use client";

import Link from "next/link";

function ChevronIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ArrowRightIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ color = "currentColor", ...props }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function BathIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A99B84" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5a1 1 0 100-2 1 1 0 000 2" />
    </svg>
  );
}

function RadarTagIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14" />
    </svg>
  );
}

function SparkleIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

function SignatureIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" />
    </svg>
  );
}

function AccountingTagIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

function ProjectsIcon(props) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1E8E5A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 21V5l8-3 8 3v16M4 21h16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4" />
    </svg>
  );
}

function TeamIcon(props) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#3B5BDB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3 3 0 010 6M19 14c2 .6 3 2.5 3 5" />
    </svg>
  );
}

function LibraryIcon(props) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#B7791F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13" />
    </svg>
  );
}

function AccountingIcon(props) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#6D3BD6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

function SignAlertIcon(props) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#C4452D" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" />
    </svg>
  );
}

function InvoiceIcon(props) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1E8E5A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7" />
    </svg>
  );
}

function SendIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 11l18-8-8 18-2-8z" />
    </svg>
  );
}

const NAV_MENU = [
  { label: "Découvrir" },
  { label: "Fonctionnalités", dropdown: true },
  { label: "Métiers", dropdown: true },
  { label: "Comparer", dropdown: true },
  { label: "Tarifs" },
  { label: "Blog" }
];

function RadarRow({ title, badge, place, thumb }) {
  return (
    <div className="ep-radar-row">
      {thumb ? <div className="ep-radar-thumb"><BathIcon /></div> : null}
      <div className="ep-radar-row-text">
        <div className="ep-radar-row-top"><strong>{title}</strong>{badge ? <span className="ep-urgent-badge">{badge}</span> : null}</div>
        <small>{place}</small>
      </div>
      <span className="ep-respond-btn">Répondre</span>
    </div>
  );
}

function FeatureCard({ icon, iconBg, title, sub }) {
  return (
    <div className="ep-feature-card">
      <span className="ep-feature-card-icon" style={{ background: iconBg }}>{icon}</span>
      <div><strong>{title}</strong><small>{sub}</small></div>
    </div>
  );
}

// Interface "Koji Pro" (entreprises du BTP) — v2, 18 oct (design plus
// compact d'Amira, remplace la v1 plus longue). Accessible depuis
// "Decouvrir koji Pro" sur la page d'accueil particulier et depuis
// /entreprise directement.
export function EntrepriseLanding() {
  return (
    <main className="ep">
      <header className="ep-nav ep-nav-light">
        <div className="ep-nav-brand ep-nav-brand-dark">
          <img src="/koji-logo.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <nav className="ep-nav-menu ep-nav-menu-dark" aria-label="Menu">
          {NAV_MENU.map((item) => (
            <button type="button" className="ep-nav-menu-item ep-nav-menu-item-dark" key={item.label}>
              {item.label}
              {item.dropdown ? <ChevronIcon /> : null}
            </button>
          ))}
        </nav>
        <div className="ep-nav-actions">
          <Link href="/login?type=entreprise" className="ep-nav-link ep-nav-link-dark">Connexion</Link>
          <Link href="/login?type=particulier" className="ep-nav-cta">
            Publier une offre<ArrowRightIcon width="16" height="16" />
          </Link>
        </div>
      </header>

      <section className="ep-hero ep-hero-light">
        <div className="ep-hero-glow" aria-hidden="true" />
        <div className="ep-hero-text">
          <span className="ep-pill ep-pill-light"><span className="ep-pill-dot ep-pill-dot-light" />Chantiers publiés en direct, près de chez vous</span>
          <p className="ep-eyebrow">Koji Pro · Entreprises du BTP</p>
          <h1 className="ep-h1-light">Trouvez un<br />chantier, <em>créez votre<br />devis.</em></h1>
          <div className="ep-tag-row">
            <span className="ep-tag"><RadarTagIcon />Radar</span>
            <span className="ep-tag"><SparkleIcon />Devis IA</span>
            <span className="ep-tag"><SignatureIcon />Signature</span>
            <span className="ep-tag"><AccountingTagIcon />Compta</span>
          </div>
          <div className="ep-cta-row">
            <Link href="/signup?type=entreprise" className="ep-btn-primary">
              Essai gratuit<ArrowRightIcon />
            </Link>
            <a href="#trouver-un-chantier" className="ep-btn-secondary-light">Voir les chantiers près de moi</a>
          </div>
          <p className="ep-trust ep-trust-light">
            <span className="ep-trust-icon ep-trust-icon-light"><CheckIcon color="#1E8E5A" /></span>
            Essai gratuit pour découvrir tous les outils
          </p>
        </div>

        <div className="ep-hero-visual" aria-hidden="true">
          <div className="ep-hero-window">
            <div className="ep-hero-window-bar">
              <span className="ep-dot ep-dot-red" /><span className="ep-dot ep-dot-yellow" /><span className="ep-dot ep-dot-green" />
              <span className="ep-hero-window-url">entreprise.kojibuild.com</span>
            </div>
            <div className="ep-hero-window-body">
              <div className="ep-hero-rail">
                <span className="rail-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6" /></svg></span>
                <span className="rail-item active"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14" /></svg></span>
                <span className="rail-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg></span>
                <span className="rail-item"><AccountingIcon stroke="#8A8F9C" /></span>
                <span className="rail-item"><LibraryIcon stroke="#8A8F9C" /></span>
                <span className="rail-item"><AccountingIcon stroke="#8A8F9C" /></span>
              </div>
              <div className="ep-hero-radar-panel">
                <div className="ep-radar-head">
                  <strong>Radar des chantiers</strong>
                  <span className="ep-km-pill"><i />30 km</span>
                </div>
                <div className="ep-radar-filters">
                  <span className="ep-choice-pill selected"><CheckIcon color="#D9A93E" />Tous les métiers</span>
                  <span className="ep-choice-pill">Urgent</span>
                </div>
                <RadarRow title="Toiture" badge="Urgent" place="Lyon 3e · 4 km" />
                <RadarRow title="Salle de bain" place="5 m² · Lyon 6e · 6 km" thumb />
                <RadarRow title="Cuisine" place="Lyon 2e · 8 km" thumb />
              </div>
              <div className="ep-hero-devis-panel">
                <div className="ep-radar-head"><strong>Devis avec l'IA</strong><span className="ep-ia-pill">IA</span></div>
                <small className="ep-devis-sub">Salle de bain · Lyon 6e</small>
                <div className="ep-devis-check-list">
                  {["Dépose existant", "Étanchéité douche", "Carrelage"].map((label) => (
                    <div key={label} className="ep-devis-check-row"><span>{label}</span><span className="ep-check-dot"><CheckIcon color="#1E8E5A" /></span></div>
                  ))}
                  <div className="ep-devis-check-row"><span>Chauffe-eau</span><span className="ep-devis-line-tag warn">À chiffrer</span></div>
                </div>
                <button type="button" className="ep-send-devis-btn" tabIndex={-1}>Envoyer le devis</button>
              </div>
            </div>
          </div>
          <span className="ep-float-chip ep-float-chip-1 gold"><i />Nouveau chantier · Toiture · Urgent</span>
          <span className="ep-float-chip ep-float-chip-2 success"><CheckIcon color="#1E8E5A" />Devis signé · 4 850 €</span>
        </div>
      </section>

      <section className="ep-twocol" id="trouver-un-chantier">
        <div className="ep-info-card">
          <div className="ep-info-card-text">
            <p className="ep-eyebrow">Trouver un chantier</p>
            <h2>Les chantiers viennent <em>jusqu'à vous.</em></h2>
            <span className="ep-info-sub">Secteur · Urgent · Photos · Un clic pour répondre</span>
          </div>
          <div className="ep-mini-radar-wrap" aria-hidden="true">
            <div className="ep-mini-radar">
              <div className="ep-radar-rings">
                <span className="ep-radar-ring r1" /><span className="ep-radar-ring r2" /><span className="ep-radar-ring r3" /><span className="ep-radar-ring r4" />
                <span className="ep-radar-sweep" /><span className="ep-radar-center" />
              </div>
            </div>
            <span className="ep-mini-radar-pin p1">Toiture · Urgent</span>
            <span className="ep-mini-radar-pin p2">Salle de bain · 5 m²</span>
          </div>
        </div>

        <div className="ep-info-card highlight">
          <div className="ep-info-card-text">
            <span className="ep-recommended-pill">RECOMMANDÉ</span>
            <p className="ep-eyebrow">Créer un devis</p>
            <h2>Un devis <em>sans ressaisie.</em></h2>
            <span className="ep-info-sub">Avec l'IA · Ou à la main · Votre taux</span>
          </div>
          <div className="ep-mini-checklist">
            <div className="ep-devis-check-row"><span>Dépose existant</span><span className="ep-check-dot"><CheckIcon color="#1E8E5A" /></span></div>
            <div className="ep-devis-check-row"><span>Étanchéité douche</span><span className="ep-check-dot"><CheckIcon color="#1E8E5A" /></span></div>
            <div className="ep-devis-check-row"><span>Carrelage</span><span className="ep-check-dot"><CheckIcon color="#1E8E5A" /></span></div>
            <div className="ep-devis-check-row"><span>Chauffe-eau</span><span className="ep-devis-line-tag warn">À chiffrer</span></div>
          </div>
        </div>
      </section>

      <section className="ep-section ep-tools-section">
        <div className="ep-section-head">
          <p className="ep-eyebrow">Tout dans un seul outil</p>
          <h2>Le reste du métier, <em>au même endroit.</em></h2>
        </div>
        <div className="ep-feature-grid">
          <FeatureCard icon={<ProjectsIcon />} iconBg="#E6F5EE" title="Suivi de chantier" sub="Avancement · Interventions · Récap client" />
          <FeatureCard icon={<TeamIcon />} iconBg="#E8ECFD" title="Équipes & planning" sub="Calendrier · Zéro doublon · Gain de temps" />
          <FeatureCard icon={<LibraryIcon />} iconBg="#FDF3DC" title="Bibliothèque koji" sub="Prix du marché · Temps normatifs" />
          <FeatureCard icon={<AccountingIcon />} iconBg="#EEE5FD" title="Comptabilité" sub="Exports · Factures · Comptable" />
          <FeatureCard icon={<SignAlertIcon />} iconBg="#FBE9E5" title="Signature en ligne" sub="Lien · Mobile · Instantané" />
          <FeatureCard icon={<InvoiceIcon />} iconBg="#E6F5EE" title="Devis → facture" sub="Même lignes · Sans ressaisie" />
        </div>
      </section>

      <section className="ep-section">
        <div className="ep-pro-cta">
          <div className="ep-pro-cta-text">
            <p className="ep-eyebrow ep-eyebrow-gold">Koji Pro</p>
            <h2>Prêt à trouver <em>votre prochain chantier ?</em></h2>
          </div>
          <div className="ep-pro-cta-actions">
            <Link href="/signup?type=entreprise" className="ep-btn-primary">
              Essai gratuit<ArrowRightIcon />
            </Link>
            <Link href="/login?type=particulier" className="ep-pro-switch">
              Vous êtes un particulier ? <em>Publier une offre</em>
            </Link>
          </div>
        </div>
      </section>

      <footer className="ep-footer">
        <div className="ep-nav-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <div className="ep-footer-links">
          <span>Découvrir</span> · <span>Fonctionnalités</span> · <span>Tarifs</span> · <span>Blog</span> · <a href="mailto:contact@kojibuild.com">contact@kojibuild.com</a>
        </div>
        <span className="ep-footer-copy">© {new Date().getFullYear()} koji</span>
      </footer>
    </main>
  );
}
