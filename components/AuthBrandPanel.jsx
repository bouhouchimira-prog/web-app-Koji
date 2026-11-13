import { DM_Sans } from "next/font/google";
import KojiWordmark from "./KojiWordmark";
import "./auth-hero-enterprise.css";
import "./auth-pro.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--f" });

const letters = ["K", "O", "J", "I"];

function CheckIcon({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function SparkleIcon({ color }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

function GiftIcon({ color }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3" />
    </svg>
  );
}

function PinIcon({ color }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5" />
    </svg>
  );
}

function BathIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5a1 1 0 100-2 1 1 0 000 2" />
    </svg>
  );
}

function SwapArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// Scene flottante "Assistant koji" + offre en cours de publication
// (panneau particulier / Koji) — même principe : purement illustratif.
function ParticulierScene() {
  return (
    <div className="auth-hero-scene">
      <div className="auth-hero-card" style={{ "--rise-delay": "0.1s", left: 0, top: 0, width: 360, padding: 20, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#1E8E5A" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "#16233F" }}>Assistant koji</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: "#16233F", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px" }}>
            <SparkleIcon color="#E8DCCB" />
          </div>
          <div style={{ background: "#F4F1EB", borderRadius: "4px 14px 14px 14px", padding: "10px 13px", fontSize: 13, lineHeight: 1.5, color: "#16233F", fontWeight: 500 }}>
            Quels travaux souhaitez-vous faire dans la salle de bain ?
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: "#16233F", color: "#FFFFFF", borderRadius: "14px 4px 14px 14px", padding: "10px 13px", fontSize: 13, lineHeight: 1.5, fontWeight: 500, maxWidth: "78%" }}>
            Remplacer ma baignoire par une douche.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 38 }}>
          {["Douche à l'italienne", "Carrelage"].map((label) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 15, background: "#16233F", color: "#FFFFFF", fontSize: 12, fontWeight: 700 }}>
              <CheckIcon color="#D9A93E" />{label}
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 12px", borderRadius: 15, border: "1px solid #DAD5CC", color: "#16233F", fontSize: 12, fontWeight: 600 }}>Plomberie</span>
        </div>
      </div>

      <div className="auth-hero-card" style={{ "--rise-delay": "0.3s", left: 250, top: 206, width: 240, padding: 18, background: "#16233F", display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)" }}>VOTRE OFFRE</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#FFFFFF" }}>Salle de bain · 5 m²</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: "linear-gradient(135deg,#3A4B73,#F3EEE6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BathIcon color="#A99B84" />
          </div>
          <div style={{ width: 50, height: 50, borderRadius: 12, border: "1.5px dashed rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </div>
        </div>
        <button type="button" tabIndex={-1} style={{ height: 40, borderRadius: 13, border: 0, background: "linear-gradient(180deg,#E6B94F,#CB9A2E)", color: "#16233F", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", cursor: "default" }}>
          Publier mon offre <SwapArrowIcon />
        </button>
      </div>

      <div className="auth-hero-card" style={{ "--rise-delay": "0.5s", left: 250, top: -18, width: "auto", padding: "11px 17px", display: "flex", alignItems: "center", gap: 10, borderLeft: "4px solid #1E8E5A", whiteSpace: "nowrap", boxShadow: "0 14px 34px rgba(22,35,63,0.14)" }}>
        <CheckIcon color="#1E8E5A" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#16233F" }}>Offre publiée</span>
      </div>
    </div>
  );
}

const PARTICULIER_PILLS = [
  { label: "Gratuit et illimité", icon: GiftIcon },
  { label: "Partout en France", icon: PinIcon },
  { label: "Vous choisissez le devis", icon: CheckIcon }
];

// Panneau Koji Pro, repris de la maquette PRO-00 (.g2-brand) ; sur
// téléphone, bandeau graphite (.g2-mb) : mot-symbole et phrase de marque.
function EntrepriseBrand() {
  return (
    <section className={`auth-hero-themed entreprise auth-brand-pro ${dmSans.variable}`} aria-label="Koji">
      <a href="/" className="auth-brand-pro-w" aria-label="Koji, accueil"><KojiWordmark height={20} /></a>
      <p className="auth-brand-pro-m">Décrivez le chantier. Koji le chiffre.</p>
      <h2>Décrivez le chantier.<br />Koji le chiffre.</h2>
      <ul>
        <li>Radar des chantiers près de chez vous</li>
        <li>Devis guidé, envoyé en 10 minutes</li>
        <li>Chantier, photos, factures au même endroit</li>
      </ul>
      <small>getkoji.io</small>
    </section>
  );
}

// Panneau de marque particulier (18 oct), repris du design fourni par Amira
// (artifact ConnexionParticulier.dc.html). Jamais de chiffre ni de prix
// invente dans ce décor.
function ParticulierHero() {
  return (
    <section className="auth-hero-themed particulier" aria-label="Koji">
      <div className="auth-hero-topbar">
        <div className="auth-hero-brand">
          {/* Logo dore/clair, illisible sur le fond clair sans ce fond fonce. */}
          <span className="auth-hero-logo-chip"><img src="/koji-logo.svg" alt="" /></span>
          <span>Koji</span>
        </div>
        <span className="auth-hero-domain-pill">particulier.getkoji.io</span>
      </div>
      <div className="auth-hero-pitch">
        <p className="auth-hero-eyebrow">Espace particulier</p>
        <h2>Publiez votre chantier <em>en quelques questions.</em></h2>
      </div>
      <ParticulierScene />
      <div className="auth-hero-pills">
        {PARTICULIER_PILLS.map(({ label, icon: Icon }, index) => (
          <span key={label} className="auth-hero-pill" style={{ "--pill-delay": `${0.55 + index * 0.1}s` }}>
            <Icon color="#8F6A12" />{label}
          </span>
        ))}
      </div>
    </section>
  );
}

// Panneau de marque partage par les pages d'authentification (login,
// signup, activate, forgot-password, set-password). Refonte du 24
// septembre : ne parle plus de l'application mobile (retiree, deja
// presente sur la page publique "/") mais du Marketplace — meme accroche
// que la page publique, pour une identite coherente sur tout le site.
// Jamais de chiffre invente (nombre d'entreprises, de chantiers...) tant
// qu'on n'a pas de vraie donnee a afficher.
//
// Photo de fond (public/auth-brand-photo.jpg, 24 sept) : Wesley Pacifico
// sur Unsplash, licence Unsplash (gratuite, usage commercial autorise,
// attribution non requise) — https://unsplash.com/photos/MThcHX1xBAs
//
// `profile` (18 oct, nouveau, optionnel) : "entreprise" | "particulier" |
// absent. Seul app/login/page.jsx le fournit, une fois le profil choisi sur
// l'ecran de choix — bascule alors vers le decor thematique ci-dessus. Tous
// les autres appelants (signup/forgot-password/activate/set-password)
// n'ont jamais passe ce prop et gardent donc le panneau generique
// exactement comme avant, aucune regression possible pour ces pages.
export function AuthBrandPanel({ tagline, profile } = {}) {
  if (profile === "entreprise") return <EntrepriseBrand />;
  if (profile === "particulier") return <ParticulierHero />;

  return (
    <section className="auth-brand auth-brand-animated">
      <div className="brand-hero" aria-label="Koji">
        <div className="brand-hero-logo">
          <img src="/koji-logo.svg" alt="Koji" />
        </div>
        <div className="brand-hero-letters">
          {letters.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="hero-letter"
              style={{ "--delay": `${0.55 + index * 0.24}s` }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
      {tagline ? <p className="brand-tagline">{tagline}</p> : null}

      <div className="brand-pitch">
        <p className="brand-pitch-eyebrow">MARKETPLACE BTP</p>
        <h2>
          Trouvez des chantiers,<br />
          <em>près de chez vous.</em>
        </h2>
        <p className="brand-pitch-sub">
          Les particuliers publient leurs travaux, les entreprises du BTP les découvrent autour d'elles et répondent en quelques clics.
        </p>
      </div>

      <div className="brand-stats">
        <div className="brand-stat">
          <span className="brand-stat-icon">📍</span>
          Partout en France
        </div>
        <div className="brand-stat">
          <span className="brand-stat-icon">⚡</span>
          Réponse en quelques clics
        </div>
        <div className="brand-stat">
          <span className="brand-stat-icon">🆓</span>
          Gratuit et illimité
        </div>
      </div>
    </section>
  );
}
