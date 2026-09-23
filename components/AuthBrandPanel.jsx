const letters = ["K", "O", "J", "I"];

// Panneau de marque partage par les pages d'authentification (login,
// signup, activate, forgot-password, set-password). Refonte du 24
// septembre : ne parle plus de l'application mobile (retiree, deja
// presente sur la page publique "/") mais du Marketplace — meme accroche
// que la page publique, pour une identite coherente sur tout le site.
// Jamais de chiffre invente (nombre d'entreprises, de chantiers...) tant
// qu'on n'a pas de vraie donnee a afficher.
export function AuthBrandPanel({ tagline } = {}) {
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
