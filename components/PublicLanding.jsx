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

function SparkleIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8DCCB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
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

function PlusIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function AssistantTagIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E6B94F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}

function PhotoTagIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E6B94F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8" />
    </svg>
  );
}

function DevisTagIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E6B94F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7" />
    </svg>
  );
}

function SendIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 11l18-8-8 18-2-8z" />
    </svg>
  );
}

function RadarSearchIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E6B94F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14" />
    </svg>
  );
}

function SignatureIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E6B94F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" />
    </svg>
  );
}

const NAV_MENU = [
  { label: "Découvrir" },
  { label: "Fonctionnalités", dropdown: true },
  { label: "Métiers", dropdown: true },
  { label: "Comparer", dropdown: true },
  // Seul lien reellement cable du menu pour l'instant (24 oct) — la page
  // publique /abonnement existe desormais ; les autres entrees restent de
  // simples boutons decoratifs (aucune page a cibler pour l'instant).
  { label: "Tarifs", href: "/abonnement" },
  { label: "Blog" }
];

function AssistantBubble({ children }) {
  return (
    <div className="ld-bubble-row">
      <span className="ld-bubble-avatar"><SparkleIcon /></span>
      <div className="ld-bubble ld-bubble-assistant">{children}</div>
    </div>
  );
}

function UserBubble({ children }) {
  return (
    <div className="ld-bubble-row ld-bubble-row-end">
      <div className="ld-bubble ld-bubble-user">{children}</div>
    </div>
  );
}

function ChoicePills({ children }) {
  return <div className="ld-choice-pills">{children}</div>;
}

function ChoicePill({ selected, children }) {
  return (
    <span className={`ld-choice-pill${selected ? " selected" : ""}`}>
      {selected ? <CheckIcon color="#D9A93E" /> : null}{children}
    </span>
  );
}

function OfferThumb({ dashed }) {
  return dashed ? (
    <div className="ld-offer-thumb ld-offer-thumb-dashed"><PlusIcon /></div>
  ) : (
    <div className="ld-offer-thumb"><BathIcon /></div>
  );
}

function StepCard({ step, title, sub, icon }) {
  return (
    <div className="ld-step-glass">
      <span className="ld-step-glass-icon">{icon}</span>
      <div>
        <span className="ld-step-glass-label">Étape {step}</span>
        <strong>{title}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function DevisRow({ initials, color, name, date, price, cta, highlight }) {
  return (
    <div className={`ld-devis-mini-row${highlight ? " highlight" : ""}`}>
      <span className="ld-devis-mini-avatar" style={{ background: color }}>{initials}</span>
      <div className="ld-devis-mini-text"><strong>{name}</strong><small>{date}</small></div>
      <span className="ld-devis-mini-price">{price}</span>
      <span className={highlight ? "ld-devis-mini-cta accept" : "ld-devis-mini-cta"}>{cta}</span>
    </div>
  );
}

// Page publique affichee sur "/" pour un visiteur non connecte — v2, 18
// oct (design plus compact d'Amira, fond bleu koji sur toute la page,
// remplace la v1 plus longue). Garde la meme logique de routage que la v1 :
// "Publier une offre" -> /login?type=particulier, "Decouvrir koji Pro" ->
// /entreprise.
export function PublicLanding() {
  return (
    <main className="ld">
      <header className="ld-nav">
        <div className="ld-nav-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <nav className="ld-nav-menu" aria-label="Menu">
          {NAV_MENU.map((item) => (
            item.href ? (
              <Link href={item.href} className="ld-nav-menu-item" key={item.label}>
                {item.label}
              </Link>
            ) : (
              <button type="button" className="ld-nav-menu-item" key={item.label}>
                {item.label}
                {item.dropdown ? <ChevronIcon /> : null}
              </button>
            )
          ))}
        </nav>
        <div className="ld-nav-actions">
          <Link href="/login?type=entreprise" className="ld-nav-link">Connexion</Link>
          <Link href="/login?type=particulier" className="ld-nav-cta">
            Publier une offre<ArrowRightIcon width="16" height="16" />
          </Link>
        </div>
      </header>

      <section className="ld-hero">
        <div className="ld-hero-text">
          <span className="ld-pill">
            <span className="ld-pill-dot" />
            Chantiers publiés en direct, près de chez vous
          </span>
          <p className="ld-eyebrow">Marketplace BTP · Particuliers</p>
          <h1>
            Publiez votre<br />
            chantier, <em>les artisans<br />viennent à vous.</em>
          </h1>
          <div className="ld-tag-row">
            <span className="ld-tag"><AssistantTagIcon />Assistant IA</span>
            <span className="ld-tag"><PhotoTagIcon />Photos</span>
            <span className="ld-tag"><DevisTagIcon />Devis comparés</span>
          </div>
          <div className="ld-cta-row">
            <Link href="/login?type=particulier" className="ld-btn-primary">
              Publier une offre<ArrowRightIcon />
            </Link>
            <a href="#radar-des-entreprises" className="ld-btn-secondary">Comment ça marche</a>
          </div>
          <p className="ld-trust">
            <span className="ld-trust-icon"><CheckIcon color="#3DDC97" /></span>
            Publication d'offre gratuite et illimitée
          </p>
        </div>

        <div className="ld-hero-visual" aria-hidden="true">
          <div className="ld-hero-window">
            <div className="ld-hero-window-bar">
              <span className="ld-dot ld-dot-red" /><span className="ld-dot ld-dot-yellow" /><span className="ld-dot ld-dot-green" />
              <span className="ld-hero-window-url">particulier.kojibuild.com</span>
            </div>
            <div className="ld-hero-window-body">
              <div className="ld-hero-chat">
                <AssistantBubble>Bonjour ! Quels travaux souhaitez-vous faire dans la salle de bain ?</AssistantBubble>
                <UserBubble>Remplacer ma baignoire par une douche.</UserBubble>
                <ChoicePills>
                  <ChoicePill selected>Douche à l'italienne</ChoicePill>
                  <ChoicePill selected>Carrelage</ChoicePill>
                  <ChoicePill>Plomberie</ChoicePill>
                  <ChoicePill>Je ne sais pas</ChoicePill>
                </ChoicePills>
                <div className="ld-chat-input">Écrivez votre message…<span><SendIcon width="14" height="14" stroke="#FFFFFF" /></span></div>
              </div>
              <div className="ld-hero-offer">
                <span className="ld-offer-label">Votre offre</span>
                <div className="ld-offer-title">Salle de bain<small>5 m² · Paris 11e</small></div>
                <div className="ld-offer-list">
                  {["Dépose de l'existant", "Douche à l'italienne", "Carrelage sol et murs", "Plomberie"].map((label) => (
                    <div key={label} className="ld-offer-list-row"><CheckIcon color="#1E8E5A" />{label}</div>
                  ))}
                </div>
                <div className="ld-offer-thumbs">
                  <OfferThumb /><OfferThumb /><OfferThumb dashed />
                </div>
                <button type="button" className="ld-offer-publish" tabIndex={-1}>Publier mon offre</button>
              </div>
            </div>
          </div>
          <div className="ld-hero-radar" />
          <span className="ld-float-chip ld-float-chip-1">Plombier · 3 km</span>
          <span className="ld-float-chip ld-float-chip-2 success"><CheckIcon color="#1E8E5A" />Offre publiée · Salle de bain</span>
          <span className="ld-float-chip ld-float-chip-3 gold">
            <span className="ld-avatar-stack"><i>AL</i><i>MV</i><i>RS</i></span>3 entreprises intéressées
          </span>
        </div>
      </section>

      <section className="ld-steps-glass">
        <StepCard step={1} title="Décrivez" sub="Assistant IA · conseils · ouvrages" icon={<AssistantTagIcon stroke="#16233F" />} />
        <StepCard step={2} title="Photographiez" sub="2 à 4 photos · facultatif" icon={<PhotoTagIcon stroke="#16233F" />} />
        <StepCard step={3} title="Publiez" sub="Gratuit · illimité · visible des entreprises" icon={<SendIcon width="24" height="24" stroke="#16233F" />} />
      </section>

      <section className="ld-twocol" id="radar-des-entreprises">
        <div className="ld-glass-card ld-radar-card">
          <div className="ld-glass-text">
            <p className="ld-eyebrow ld-eyebrow-gold">Radar des entreprises</p>
            <h2>Trouvez une entreprise <em>près de chez vous.</em></h2>
            <span className="ld-glass-sub">Par métier · Par distance · Offre proposée</span>
          </div>
          <div className="ld-mini-radar" aria-hidden="true">
            <div className="ld-radar-rings">
              <span className="ld-radar-ring r1" /><span className="ld-radar-ring r2" /><span className="ld-radar-ring r3" /><span className="ld-radar-ring r4" />
              <span className="ld-radar-sweep" /><span className="ld-radar-center" />
            </div>
            <span className="ld-radar-pin p1">Plombier · 3 km</span>
            <span className="ld-radar-pin p2">Carreleur · 5 km</span>
            <span className="ld-radar-pin p3">Peintre · 7 km</span>
          </div>
        </div>

        <div className="ld-glass-card ld-devis-card-v2">
          <p className="ld-eyebrow ld-eyebrow-gold">Les devis</p>
          <h2>Chaque entreprise fixe son tarif. <em>Vous choisissez.</em></h2>
          <span className="ld-glass-sub">Comparaison · Messages · Signature en ligne</span>
          <div className="ld-devis-mini-list">
            <DevisRow initials="AL" color="#2B4A8F" name="Atelier Lumière" date="Début 12 nov." price="4 850 €" cta="Voir" />
            <DevisRow initials="MV" color="#B7791F" name="Maison Valmy" date="Début 3 déc." price="6 320 €" cta="Accepter" highlight />
            <DevisRow initials="RS" color="#1E8E5A" name="Rénov'Sud" date="Début 20 nov." price="5 480 €" cta="Voir" />
          </div>
        </div>
      </section>

      <section className="ld-pro-strip">
        <div className="ld-pro-strip-card">
          <div className="ld-pro-strip-left">
            <p className="ld-eyebrow ld-eyebrow-gold">Vous êtes une entreprise ?</p>
            <h2>Trouvez un chantier, <em>créez votre devis.</em></h2>
          </div>
          <div className="ld-pro-strip-tags">
            <span><RadarSearchIcon />Radar des chantiers</span>
            <span><DevisTagIcon />Devis IA</span>
            <span><SignatureIcon />Signature</span>
          </div>
          <Link href="/entreprise" className="ld-nav-cta">
            Découvrir koji Pro<ArrowRightIcon width="16" height="16" />
          </Link>
        </div>
      </section>

      <footer className="ld-footer">
        <div className="ld-nav-brand ld-nav-brand-dark">
          <img src="/koji-logo.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <div className="ld-footer-links">
          <span>Découvrir</span> · <span>Fonctionnalités</span> · <Link href="/abonnement">Tarifs</Link> · <span>Blog</span> · <a href="mailto:contact@kojibuild.com">contact@kojibuild.com</a>
        </div>
        <span className="ld-footer-copy">© {new Date().getFullYear()} koji</span>
      </footer>
    </main>
  );
}
