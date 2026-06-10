import Link from "next/link";

export function AppHeader({ title = "Koji", subtitle, backHref }) {
  return (
    <header className="app-header">
      {backHref ? (
        <Link href={backHref} className="round-icon" aria-label="Retour">
          ‹
        </Link>
      ) : (
        <div className="round-icon">≡</div>
      )}
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="round-icon">•</div>
    </header>
  );
}
