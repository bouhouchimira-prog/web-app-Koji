export function StatusPill({ value }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("signe") || normalized.includes("cours") ? "success" : normalized.includes("attente") || normalized.includes("brouillon") ? "warning" : "";

  return <span className={`pill ${tone}`}>{value}</span>;
}
