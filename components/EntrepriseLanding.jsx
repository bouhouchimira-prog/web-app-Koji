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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
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

function SignatureIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" />
    </svg>
  );
}

function CoinIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM15 9.6a3.2 3.2 0 100 4.8M8.5 11h5M8.5 13h5" />
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

function ProjectsIcon(props) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1E8E5A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 21V5l8-3 8 3v16M4 21h16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4" />
    </svg>
  );
}

function TeamIcon(props) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#3B5BDB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3 3 0 010 6M19 14c2 .6 3 2.5 3 5" />
    </svg>
  );
}

function LibraryIcon(props) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#B7791F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13" />
    </svg>
  );
}

function AccountingIcon(props) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#6D3BD6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

function SignAlertIcon(props) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#C4452D" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" />
    </svg>
  );
}

function InvoiceIcon(props) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1E8E5A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7" />
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

function DevisLine({ label, qty, status }) {
  return (
    <div className="ep-devis-line">
      <span className="ep-devis-line-label">{label}</span>
      <span className="ep-devis-line-qty">{qty}</span>
      <span className={`ep-devis-line-tag${status === "À vérifier" ? " warn" : ""}`}>{status}</span>
    </div>
  );
}

function BentoCard({ icon, iconBg, title, text, children }) {
  return (
    <div className="ep-bento-card">
      <div className="ep-bento-visual">{children}</div>
      <div className="ep-bento-head">
        <span className="ep-bento-icon" style={{ background: iconBg }}>{icon}</span>
        <span>{title}</span>
      </div>
      <p>{text}</p>
    </div>
  );
}

function ProgressRow({ label, pct, color }) {
  return (
    <div className="ep-progress-row">
      <div className="ep-progress-top"><span>{label}</span><span>{pct}%</span></div>
      <div className="ep-progress-track"><div className="ep-progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

// Interface "Koji Pro" (entreprises du BTP) — page marketing dediee, 18 oct,
// d'apres le board SiteEntreprise.dc.html de l'artifact (suite de l'accueil
// particulier/marketplace, meme canvas). Accessible depuis "Decouvrir koji
// Pro" sur la page d'accueil particulier (components/PublicLanding.jsx) et
// depuis /entreprise directement. Jamais de prix invente dans les mockups
// illustratifs (meme discipline que partout ailleurs dans l'app).
export function EntrepriseLanding() {
  return (
    <main className="ep">
      <header className="ep-nav">
        <div className="ep-nav-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <span>Koji</span>
        </div>
        <nav className="ep-nav-menu" aria-label="Menu">
          {NAV_MENU.map((item) => (
            <button type="button" className="ep-nav-menu-item" key={item.label}>
              {item.label}
              {item.dropdown ? <ChevronIcon /> : null}
            </button>
          ))}
        </nav>
        <div className="ep-nav-actions">
          <Link href="/login?type=entreprise" className="ep-nav-link">Connexion</Link>
          <Link href="/login?type=particulier" className="ep-nav-cta">
            Publier une offre<ArrowRightIcon width="16" height="16" />
          </Link>
        </div>
      </header>

      <section className="ep-hero">
        <div className="ep-hero-text">
          <span className="ep-pill"><span className="ep-pill-dot" />Chantiers publiés en direct, près de chez vous</span>
          <p className="ep-eyebrow">Koji Pro · pour les entreprises du BTP</p>
          <h1>Trouvez un<br />chantier, <em>créez votre<br />devis.</em></h1>
          <p className="ep-hero-sub">
            Les particuliers publient leurs travaux, vous les découvrez autour de chez vous et vous répondez avec un devis. Suivi de chantier, équipes, comptabilité et signature suivent, dans le même outil.
          </p>
          <div className="ep-cta-row">
            <Link href="/signup?type=entreprise" className="ep-btn-primary">
              Essai gratuit<ArrowRightIcon />
            </Link>
            <a href="#trouver-un-chantier" className="ep-btn-secondary">Voir les chantiers près de moi</a>
          </div>
          <p className="ep-trust">
            <span className="ep-trust-icon"><CheckIcon color="#3DDC97" /></span>
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
                <span className="rail-item"><FolderIcon color="#8A8F9C" stroke="#8A8F9C" /></span>
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

      <section className="ep-stats">
        <div className="ep-stat"><span className="ep-stat-icon"><PinIcon /></span><div><strong>Des chantiers autour de vous</strong><small>Le radar affiche les offres de votre secteur</small></div></div>
        <div className="ep-stat"><span className="ep-stat-icon"><SparkleIcon /></span><div><strong>Un devis en quelques minutes</strong><small>Avec l'IA ou à la main, à votre rythme</small></div></div>
        <div className="ep-stat"><span className="ep-stat-icon"><SignatureIcon /></span><div><strong>Signature en ligne</strong><small>Votre client signe depuis son téléphone</small></div></div>
      </section>

      <section className="ep-section ep-radar-feature" id="trouver-un-chantier">
        <div className="ep-radar-feature-visual" aria-hidden="true">
          <div className="ep-radar-rings">
            <span className="ep-radar-ring r1" /><span className="ep-radar-ring r2" /><span className="ep-radar-ring r3" /><span className="ep-radar-ring r4" />
            <span className="ep-radar-sweep" /><span className="ep-radar-center" />
          </div>
          <span className="ep-radar-pin p1">Salle de bain · 5 m²</span>
          <span className="ep-radar-pin p2">Toiture · Urgent</span>
          <span className="ep-radar-pin p3">Cuisine complète</span>
        </div>
        <div className="ep-radar-feature-text">
          <p className="ep-eyebrow">Trouver un chantier</p>
          <h2>Les chantiers viennent <em>jusqu'à vous.</em></h2>
          <div className="ep-feature-list">
            <div className="ep-feature-row">
              <span className="ep-feature-icon"><PinIcon /></span>
              <div><strong>Les offres de votre secteur</strong><p>Le radar affiche les chantiers publiés autour de vous, avec le type de travaux, la surface et les photos.</p></div>
            </div>
            <div className="ep-feature-row">
              <span className="ep-feature-icon"><SendIcon stroke="#8F6A12" /></span>
              <div><strong>Vous répondez en quelques clics</strong><p>Un chantier vous plaît ? Vous envoyez votre devis. Il ne vous plaît pas ? Vous passez au suivant.</p></div>
            </div>
            <div className="ep-feature-row">
              <span className="ep-feature-icon"><CoinIcon /></span>
              <div><strong>Votre tarif, vos règles</strong><p>Chaque entreprise chiffre selon son propre taux. Aucun prix n'est annoncé au client à votre place.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ep-section ep-devis-feature">
        <div className="ep-devis-feature-visual">
          <div className="ep-devis-card">
            <div className="ep-devis-card-head">
              <div><small>DEVIS 2026_1097</small><strong>Salle de bain · Lyon 6e</strong></div>
              <span className="ep-draft-pill">Brouillon</span>
            </div>
            <div className="ep-ai-note"><SparkleIcon stroke="#3B5BDB" color="#3B5BDB" />L'IA a lu l'offre du client et préparé 4 lignes. Une ligne reste à chiffrer.</div>
            <small className="ep-lot-label">LOT 1 · SALLE DE BAIN</small>
            <div>
              <DevisLine label="Dépose de la baignoire" qty="1 u" status="Bibliothèque" />
              <DevisLine label="Étanchéité sous douche" qty="5 m²" status="Bibliothèque" />
              <DevisLine label="Carrelage sol et murs" qty="18 m²" status="Bibliothèque" />
              <DevisLine label="Plomberie, alimentation" qty="1 fft" status="À vérifier" />
            </div>
            <div className="ep-devis-card-foot">
              <small>3 lignes chiffrées · 1 à vérifier</small>
              <button type="button" className="ep-send-devis-btn" tabIndex={-1}><SendIcon />Envoyer au client</button>
            </div>
          </div>
        </div>
        <div className="ep-devis-feature-text">
          <p className="ep-eyebrow">Créer un devis</p>
          <h2>Du chantier au devis, <em>sans ressaisie.</em></h2>
          <div className="ep-devis-choice-row">
            <div className="ep-devis-choice-card highlight">
              <div className="ep-devis-choice-head"><span className="ep-bento-icon" style={{ background: "#FDF3DC" }}><SparkleIcon /></span><span className="ep-recommended-pill">RECOMMANDÉ</span></div>
              <strong>Devis avec l'IA</strong>
              <p>Décrivez le chantier : l'IA prépare les lots et les lignes à partir de votre bibliothèque.</p>
            </div>
            <div className="ep-devis-choice-card">
              <div className="ep-devis-choice-head"><span className="ep-bento-icon" style={{ background: "#F3EEE6" }}><SignatureIcon /></span></div>
              <strong>Devis manuel</strong>
              <p>Construisez votre devis ligne par ligne, avec votre bibliothèque de prix à portée de main.</p>
            </div>
          </div>
          <ul className="ep-check-list">
            <li><CheckIcon color="#1E8E5A" />Chaque ligne vient de votre bibliothèque, ou est marquée « à chiffrer » : rien n'est inventé.</li>
            <li><CheckIcon color="#1E8E5A" />Vous gardez la main sur chaque ligne, chaque quantité, chaque taux.</li>
            <li><CheckIcon color="#1E8E5A" />Conditions de paiement, acompte et IBAN prêts en un clic.</li>
            <li><CheckIcon color="#1E8E5A" />Envoi au client par lien de signature : il signe depuis son téléphone.</li>
          </ul>
        </div>
      </section>

      <section className="ep-section">
        <div className="ep-section-head">
          <p className="ep-eyebrow">Tout dans un seul outil</p>
          <h2>Le reste du métier, <em>au même endroit.</em></h2>
          <p className="ep-section-sub">Une fois le chantier trouvé et le devis signé, koji vous accompagne jusqu'à la facture.</p>
        </div>
        <div className="ep-bento">
          <BentoCard icon={<ProjectsIcon />} iconBg="#E6F5EE" title="Suivez vos travaux, du devis à la facture" text="Un tableau par chantier : avancement, interventions, documents et échanges avec le client. Vous savez où vous en êtes, sans appeler personne.">
            <ProgressRow label="Cuisine · Paris 11e" pct={70} color="#1E8E5A" />
            <ProgressRow label="Toiture · Lyon 3e" pct={35} color="#C48F26" />
            <ProgressRow label="Salle de bain · Nantes" pct={90} color="#3B5BDB" />
          </BentoCard>

          <BentoCard icon={<TeamIcon />} iconBg="#E8ECFD" title="Organisez vos équipes, gagnez du temps et de l'argent" text="Planifiez les interventions de chacun sur un seul calendrier. Fini les doubles réservations : tout le monde sait où il est attendu demain.">
            <div className="ep-calendar">
              <div className="ep-calendar-days"><span /><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span></div>
              <div className="ep-calendar-row"><em>Éq. A</em><i className="busy">Cuisine</i><i className="busy">Cuisine</i><i className="busy gold">Toit</i><i /><i className="busy gold">Toit</i></div>
              <div className="ep-calendar-row"><em>Éq. B</em><i /><i className="busy green">SdB</i><i className="busy green">SdB</i><i className="busy green">SdB</i><i /></div>
              <div className="ep-calendar-row"><em>Karim</em><i className="busy blue">Devis</i><i /><i className="busy blue">Devis</i><i className="busy blue">RDV</i><i /></div>
            </div>
          </BentoCard>

          <BentoCard icon={<LibraryIcon />} iconBg="#FDF3DC" title="Les prix du marché, sous la main" text="La bibliothèque koji regroupe ouvrages et temps normatifs. Elle chiffre avec votre propre taux, pour des devis rapides et cohérents.">
            <div className="ep-price-list">
              {[["Pose carrelage sol", "1,2 h / m²"], ["Dépose baignoire", "2,5 h"], ["Enduit de lissage", "0,6 h / m²"]].map(([label, time]) => (
                <div key={label} className="ep-price-row"><span>{label}</span><small>{time}</small><span className="ep-price-add">+</span></div>
              ))}
            </div>
          </BentoCard>
        </div>
        <div className="ep-bento">
          <BentoCard icon={<AccountingIcon />} iconBg="#EEE5FD" title="Un comptable qui vous dit merci" text="Factures, dépenses et exports sont classés au bon endroit. Le travail de votre comptable devient simple, organisé et rapide.">
            <div className="ep-mini-row"><span>Facture 2026-014</span><em className="good">Exportée</em></div>
            <div className="ep-mini-row"><span>Achat fournitures</span><em className="warn">À classer</em></div>
            <div className="ep-send-accountant"><SendIcon stroke="#fff" /> Envoyer au comptable</div>
          </BentoCard>

          <BentoCard icon={<SignAlertIcon />} iconBg="#FBE9E5" title="Faites signer sans courir après le client" text="Votre client reçoit un lien, relit le devis et signe en ligne depuis son téléphone. Vous êtes prévenu dès que c'est fait.">
            <div className="ep-sign-head"><small>DEVIS À SIGNER</small><em className="good">Signé</em></div>
            <div className="ep-sign-scribble">
              <svg width="160" height="54" viewBox="0 0 190 64" fill="none" aria-hidden="true">
                <path d="M8 44c10-26 18-34 22-26s-12 30-4 30 14-22 22-22 2 18 12 18 14-14 22-14 6 12 16 12 20-18 30-18 12 10 22 8 14-6 20-10" stroke="#16233F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ep-sign-caption"><SignatureIcon stroke="#6B7280" />Signature électronique · depuis le téléphone du client</div>
          </BentoCard>

          <BentoCard icon={<InvoiceIcon />} iconBg="#E6F5EE" title="De devis signé à facture, sans tout retaper" text="Une fois le devis signé, la facture se prépare à partir des mêmes lignes. Moins de saisie, moins d'erreurs, plus de temps pour le chantier.">
            <div className="ep-devis-to-facture">
              <div className="ep-df-card"><small>DEVIS</small><strong>2026_1097</strong><em className="good">Signé</em></div>
              <span className="ep-df-arrow"><ArrowRightIcon width="16" height="16" stroke="#16233F" /></span>
              <div className="ep-df-card"><small>FACTURE</small><strong>2026-018</strong><em className="neutral">Brouillon</em></div>
            </div>
            <p className="ep-df-caption">Le devis signé devient une facture en brouillon</p>
          </BentoCard>
        </div>
      </section>

      <section className="ep-section">
        <div className="ep-pro-cta">
          <div className="ep-pro-cta-text">
            <p className="ep-eyebrow ep-eyebrow-gold">Koji Pro</p>
            <h2>Prêt à trouver <em>votre prochain chantier ?</em></h2>
            <div className="ep-pro-tags">
              <span><PinIcon color="#D9A93E" stroke="#D9A93E" />Radar des chantiers</span>
              <span><SparkleIcon color="#D9A93E" stroke="#D9A93E" />Devis avec l'IA</span>
              <span><SignatureIcon color="#D9A93E" stroke="#D9A93E" />Signature électronique</span>
            </div>
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
          <span>Découvrir</span>
          <span>Fonctionnalités</span>
          <span>Métiers</span>
          <span>Tarifs</span>
          <span>Blog</span>
          <a href="mailto:contact@kojibuild.com">contact@kojibuild.com</a>
        </div>
        <span className="ep-footer-copy">© {new Date().getFullYear()} koji · Marketplace BTP</span>
      </footer>
    </main>
  );
}
