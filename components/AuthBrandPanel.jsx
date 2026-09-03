const letters = ["K", "O", "J", "I"];

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76c.37.2.8.2 1.18 0l10.94-6.32-2.38-2.37-9.74 8.69ZM.5 1.56A1.5 1.5 0 0 0 0 2.73v18.54c0 .48.19.92.5 1.17l.07.06 10.38-10.37v-.24L.57 1.5.5 1.56ZM22.28 10.5l-2.91-1.68-2.67 2.67 2.67 2.67 2.93-1.69a1.33 1.33 0 0 0 0-1.97ZM4.36.24 15.3 6.56l-2.38 2.38L3.18.25A1.38 1.38 0 0 1 4.36.24Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83ZM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
    </svg>
  );
}

export function AuthBrandPanel({ showStoreBadges = true, tagline } = {}) {
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
      {showStoreBadges ? (
        <div className="brand-store-block">
          <p className="brand-store-label">{"Bient\u00F4t disponible sur"}</p>
          <div className="brand-store-badges">
            <div className="brand-store-badge">
              <GooglePlayIcon />
              <span>
                <small>Disponible sur</small>
                Google Play
              </span>
            </div>
            <div className="brand-store-badge">
              <AppleIcon />
              <span>
                <small>{"T\u00E9l\u00E9charger sur"}</small>
                App Store
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
