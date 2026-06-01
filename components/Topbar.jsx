export function Topbar({
  eyebrow,
  title,
  children
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </header>
  );
}
