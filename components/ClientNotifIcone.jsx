import { iconeNotification } from "../lib/notifications-client";

// Icônes des notifications du particulier (tracés de la maquette CLI-04).
const TRACES = {
  devis: "M6 3h9l4 4v14H6zM9 12h6M9 16h6",
  message: "M4 5h16v11H9l-5 4z",
  agenda: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  paiement: "M3 7h18v11H3zM3 11h18M7 15h3",
  lieu: "M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  drapeau: "M5 21V4h11l-1.5 3.5L16 11H5",
  chantier: "M4 20h16M6 20V9l6-4 6 4v11",
  cloche: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"
};

export function ClientNotifIcone({ type, grande = false }) {
  return (
    <span className={`kc3-ic${grande ? " big" : ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TRACES[iconeNotification(type)] || TRACES.cloche} /></svg>
    </span>
  );
}
