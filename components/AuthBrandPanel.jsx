const letters = ["K", "\u00D4", "J", "I"];

export function AuthBrandPanel() {
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
    </section>
  );
}
