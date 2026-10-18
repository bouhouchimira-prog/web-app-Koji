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

function PinIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5" />
    </svg>
  );
}

function BoltIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function GiftIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3" />
    </svg>
  );
}

function SearchIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D9A93E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14" />
    </svg>
  );
}

function SignatureIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D9A93E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" />
    </svg>
  );
}

function FolderIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7" />
    </svg>
  );
}

function RoomsIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

function AdviceIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13" />
    </svg>
  );
}

function PhotoIcon(props) {
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

function CameraIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8" />
    </svg>
  );
}

function AlertIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B7791F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 100-18 9 9 0 000 18" />
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
    <div className="ld-offer-thumb"><PhotoIcon /></div>
  );
}

// Page publique affichee sur "/" pour un visiteur non connecte — refonte
// du 18 oct d'apres la maquette d'Amira (artifact, board SiteAccueil.dc.html
// du canvas "koji — Dashboards des outils"). Met en avant la publication
// d'offre (cote particulier) comme parcours principal, avec un rappel
// "vous etes une entreprise ?" plus bas plutot qu'un partage 50/50 —
// coherent avec la decision du 17 oct (plus aucun prix/fourchette annonce
// a l'avance, chaque entreprise chiffre selon son propre taux).
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
            <button type="button" className="ld-nav-menu-item" key={item.label}>
              {item.label}
              {item.dropdown ? <ChevronIcon /> : null}
            </button>
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
          <p className="ld-eyebrow">Marketplace BTP · pour les particuliers</p>
          <h1>
            Publiez votre<br />
            chantier, <em>les artisans<br />viennent à vous.</em>
          </h1>
          <p className="ld-hero-sub">
            Racontez vos travaux à l'assistant koji, ajoutez vos photos et publiez votre offre. Les entreprises du BTP la découvrent autour de chez vous et vous envoient leurs devis.
          </p>
          <div className="ld-cta-row">
            <Link href="/login?type=particulier" className="ld-btn-primary">
              Publier une offre<ArrowRightIcon />
            </Link>
            <a href="#comment-ca-marche" className="ld-btn-secondary">Voir comment ça marche</a>
          </div>
          <p className="ld-trust">
            <span className="ld-trust-icon"><CheckIcon color="#1E8E5A" /></span>
            Publication d'offre gratuite et illimitée
          </p>
        </div>

        <div className="ld-hero-visual" aria-hidden="true">
          <div className="ld-hero-window">
            <div className="ld-hero-window-bar">
              <span className="ld-dot ld-dot-red" /><span className="ld-dot ld-dot-yellow" /><span className="ld-dot ld-dot-green" />
              <span className="ld-hero-window-url"><SignatureIconUrl />particulier.kojibuild.com</span>
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
                <div className="ld-chat-input">Écrivez votre message…<span><ArrowRightIcon width="14" height="14" style={{ transform: "rotate(-45deg)" }} /></span></div>
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
          <span className="ld-float-chip ld-float-chip-1">Toiture · Urgent</span>
          <span className="ld-float-chip ld-float-chip-2 success"><CheckIcon color="#1E8E5A" />Offre publiée · Salle de bain</span>
          <span className="ld-float-chip ld-float-chip-3 gold">
            <span className="ld-avatar-stack"><i>AL</i><i>MV</i><i>RS</i></span>3 entreprises intéressées
          </span>
        </div>
      </section>

      <section className="ld-stats">
        <div className="ld-stat">
          <span className="ld-stat-icon"><PinIcon /></span>
          <div><strong>Partout en France</strong><small>Des entreprises près de chez vous</small></div>
        </div>
        <div className="ld-stat">
          <span className="ld-stat-icon"><BoltIcon /></span>
          <div><strong>Réponse en quelques clics</strong><small>Les entreprises vous écrivent vite</small></div>
        </div>
        <div className="ld-stat">
          <span className="ld-stat-icon"><GiftIcon /></span>
          <div><strong>Gratuit et illimité</strong><small>Publiez autant d'offres que vous voulez</small></div>
        </div>
      </section>

      <section className="ld-section" id="comment-ca-marche">
        <div className="ld-section-head">
          <p className="ld-eyebrow">Créer votre offre</p>
          <h2>De l'idée à l'offre publiée, <em>sans prise de tête.</em></h2>
        </div>
        <div className="ld-steps">
          <div className="ld-step-card">
            <div className="ld-step-visual">
              <AssistantBubble>Quels travaux voulez-vous faire ?</AssistantBubble>
              <ChoicePills>
                <ChoicePill selected>Peinture</ChoicePill>
                <ChoicePill>Sol</ChoicePill>
                <ChoicePill>Électricité</ChoicePill>
                <ChoicePill selected>Plomberie</ChoicePill>
                <ChoicePill>Je ne sais pas</ChoicePill>
              </ChoicePills>
            </div>
            <div className="ld-step-head"><span className="ld-step-num">1</span><span>Racontez vos travaux</span></div>
            <p>L'assistant vous pose les bonnes questions, une à la fois. Vous répondez en un clic ou avec vos mots.</p>
          </div>
          <div className="ld-step-card">
            <div className="ld-step-visual ld-step-visual-center">
              <div className="ld-step-photos"><OfferThumb /><OfferThumb /><OfferThumb dashed /></div>
              <small>3 photos ajoutées · vue d'ensemble, fissure, plafond</small>
            </div>
            <div className="ld-step-head"><span className="ld-step-num">2</span><span>Ajoutez vos photos</span></div>
            <p>Quelques photos suffisent pour que les entreprises comprennent votre chantier. Pas de photo ? Ce n'est pas bloquant.</p>
          </div>
          <div className="ld-step-card">
            <div className="ld-step-visual ld-step-visual-list">
              {[["Atelier Lumière", "Devis reçu", true], ["Maison Valmy", "Devis reçu", true], ["Rénov'Sud", "En préparation", false]].map(([name, status, done]) => (
                <div key={name} className="ld-mini-row"><span>{name}</span><em className={done ? "done" : ""}>{status}</em></div>
              ))}
            </div>
            <div className="ld-step-head"><span className="ld-step-num">3</span><span>Publiez et comparez</span></div>
            <p>Votre offre est visible des entreprises du secteur. Elles vous envoient leurs devis, vous choisissez.</p>
          </div>
        </div>
      </section>

      <section className="ld-section ld-assistant">
        <div className="ld-assistant-text">
          <p className="ld-eyebrow">L'assistant koji</p>
          <h2>Un conseiller travaux, <em>pas un formulaire.</em></h2>
          <div className="ld-feature-list">
            <div className="ld-feature-row">
              <span className="ld-feature-icon"><AdviceIcon /></span>
              <div><strong>Des conseils de travaux</strong><p>Dans quel ordre faire les choses, quels matériaux pour une pièce d'eau, ce qu'il vaut mieux traiter avant de repeindre.</p></div>
            </div>
            <div className="ld-feature-row">
              <span className="ld-feature-icon"><RoomsIcon /></span>
              <div><strong>Des pièces et des ouvrages proposés</strong><p>L'assistant liste ce qu'il faudra probablement prévoir. Vous ajoutez, retirez, confirmez.</p></div>
            </div>
            <div className="ld-feature-row">
              <span className="ld-feature-icon"><FolderIcon /></span>
              <div><strong>Un dossier complet, prêt à publier</strong><p>Vos réponses et vos photos sont assemblées en une seule offre, claire pour les entreprises.</p></div>
            </div>
          </div>
          <div className="ld-note">
            <AlertIcon />
            <span>Pas de chiffrage à l'avance : chaque entreprise fixe son tarif. Vous comparez les devis reçus et vous choisissez librement.</span>
          </div>
        </div>
        <div className="ld-assistant-card">
          <div className="ld-assistant-card-head">
            <span className="ld-online"><i />Assistant koji</span>
            <span className="ld-missing-pill">Il manque 2 infos</span>
          </div>
          <AssistantBubble>Pour les murs, je vous conseille de traiter la fissure avant de repeindre : elle risque de réapparaître sinon. Où se situe-t-elle ?</AssistantBubble>
          <UserBubble>Au-dessus de la fenêtre du salon.</UserBubble>
          <AssistantBubble>Merci ! Voici les ouvrages que je prévois. Dites-moi si je dois en retirer ou en ajouter.</AssistantBubble>
          <ChoicePills>
            <ChoicePill selected>Reprise de la fissure</ChoicePill>
            <ChoicePill selected>Enduit de lissage</ChoicePill>
            <ChoicePill selected>Peinture 2 couches</ChoicePill>
            <ChoicePill>Autre, précisez</ChoicePill>
          </ChoicePills>
          <button type="button" className="ld-add-photo-btn" tabIndex={-1}><CameraIcon /> Ajouter des photos</button>
        </div>
      </section>

      <section className="ld-radar-section">
        <div className="ld-radar-text">
          <p className="ld-eyebrow ld-eyebrow-gold">Le radar des chantiers</p>
          <h2>Les entreprises autour de chez vous <em>voient votre chantier.</em></h2>
          <ul>
            <li><CheckIcon color="#D9A93E" />Votre offre apparaît sur le radar des entreprises autour de chez vous.</li>
            <li><CheckIcon color="#D9A93E" />Elles répondent en quelques clics, avec un devis détaillé.</li>
            <li><CheckIcon color="#D9A93E" />Vous gardez la main : vous choisissez, ou vous ne répondez pas.</li>
          </ul>
        </div>
        <div className="ld-radar-visual" aria-hidden="true">
          <div className="ld-radar-rings">
            <span className="ld-radar-ring r1" /><span className="ld-radar-ring r2" /><span className="ld-radar-ring r3" /><span className="ld-radar-ring r4" />
            <span className="ld-radar-sweep" /><span className="ld-radar-center" />
          </div>
          <span className="ld-radar-pin p1">Salle de bain · 5 m²</span>
          <span className="ld-radar-pin p2">Toiture · Urgent</span>
          <span className="ld-radar-pin p3">Cuisine complète</span>
        </div>
      </section>

      <section className="ld-section">
        <div className="ld-section-head" style={{ maxWidth: 820 }}>
          <p className="ld-eyebrow">Les devis</p>
          <h2>Chaque entreprise fixe son tarif. <em>Vous choisissez.</em></h2>
          <p className="ld-section-sub">Un même chantier peut être chiffré très différemment d'une entreprise à l'autre. Comparez les devis côte à côte, posez vos questions par message et signez en ligne.</p>
        </div>
        <div className="ld-devis-row">
          {[
            { initials: "AL", color: "#16233F", name: "Atelier Lumière", price: "4 850 €", date: "Début possible le 12 nov.", cta: "Voir le devis", highlight: false },
            { initials: "MV", color: "#B7791F", name: "Maison Valmy", price: "6 320 €", date: "Début possible le 3 déc.", cta: "Accepter ce devis", highlight: true },
            { initials: "RS", color: "#1E8E5A", name: "Rénov'Sud", price: "5 480 €", date: "Début possible le 20 nov.", cta: "Voir le devis", highlight: false }
          ].map((d) => (
            <div key={d.name} className={`ld-devis-card${d.highlight ? " highlight" : ""}`}>
              <div className="ld-devis-head">
                <span className="ld-devis-avatar" style={{ background: d.color }}>{d.initials}</span>
                <div><strong>{d.name}</strong><small>Entreprise du BTP</small></div>
                {d.highlight ? <span className="ld-devis-chosen">Votre choix</span> : null}
              </div>
              <div className="ld-devis-price">{d.price} <small>TTC</small></div>
              <div className="ld-devis-tags">
                <span className="ld-devis-tag blue">Signature en ligne</span>
                <span className="ld-devis-tag">{d.date}</span>
              </div>
              <button type="button" className={d.highlight ? "ld-devis-btn-primary" : "ld-devis-btn"} tabIndex={-1}>{d.cta}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="ld-section">
        <div className="ld-pro-banner">
          <div className="ld-pro-banner-text">
            <p className="ld-eyebrow ld-eyebrow-gold">Vous êtes une entreprise ?</p>
            <h2>Trouvez un chantier, <em>créez votre devis.</em></h2>
            <p>Les chantiers publiés par les particuliers arrivent sur votre radar. Répondez avec un devis fait en quelques minutes, puis gérez le chantier, vos équipes et votre comptabilité au même endroit.</p>
            <div className="ld-pro-tags">
              <span><SearchIcon />Trouver un chantier</span>
              <span><FolderIconGold />Créer un devis</span>
              <span><SignatureIcon />Faire signer en ligne</span>
            </div>
          </div>
          <div className="ld-pro-banner-cta">
            <Link href="/signup?type=entreprise" className="ld-btn-primary">
              Découvrir koji Pro<ArrowRightIcon />
            </Link>
            <span>Essai gratuit</span>
          </div>
        </div>
      </section>

      <section className="ld-final-cta">
        <h2>Votre chantier mérite <em>les bonnes entreprises.</em></h2>
        <p>Gratuit, illimité, et sans engagement : publiez votre offre en quelques minutes.</p>
        <Link href="/login?type=particulier" className="ld-btn-primary">
          Publier une offre<ArrowRightIcon />
        </Link>
      </section>

      <footer className="ld-footer">
        <div className="ld-nav-brand ld-nav-brand-dark">
          <img src="/koji-logo.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <div className="ld-footer-links">
          <span>Découvrir</span>
          <span>Fonctionnalités</span>
          <span>Métiers</span>
          <span>Tarifs</span>
          <span>Blog</span>
          <a href="mailto:contact@kojibuild.com">contact@kojibuild.com</a>
        </div>
        <span className="ld-footer-copy">© {new Date().getFullYear()} koji · Marketplace BTP</span>
      </footer>
    </main>
  );
}

function SignatureIconUrl() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 5 }}>
      <path d="M6 11h12v10H6zM8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function FolderIconGold(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D9A93E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7" />
    </svg>
  );
}
