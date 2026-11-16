"use client";

// Petits morceaux communs aux écrans Fournitures.
export const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
export const pct = (n) => (n == null ? "—" : `${n} %`);
export const nb = (n, max = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: max }).format(Number(n) || 0);
export const qte = (n, unit = "") => `${nb(n)} ${unit || ""}`.trim();
export const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
export const jourLong = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
export const jourSemaine = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
export const aujourdhui = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
export const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;

export function Thumb({ src = "", size = 40 }) {
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></svg>}
    </span>
  );
}

// Conditionnement lisible : « boîte 1,44 m² », « sac 25 kg », « unité ».
export function condLibelle(a = {}) {
  if (a.uniteCond && Number(a.contenance) > 0 && Number(a.contenance) !== 1) return `${a.uniteCond} ${nb(a.contenance)} ${a.unit}`;
  if (a.uniteCond) return a.uniteCond;
  return a.packaging || "unité";
}

export const STATUT_CHANTIER = {
  a_completer: (c) => `À compléter ${c.aCompleter}`,
  a_commander: () => "À commander",
  commande: (c) => (c.prochaineLivraison ? `Commandé, livraison ${jourSemaine(c.prochaineLivraison)}` : "Commandé"),
  livre: () => "Livré",
  aucun: () => "Rien à commander"
};

// Lecture d'un fichier image en data URL réduite (photos de chantier, bons).
export function lireImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture de la photo impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Photo illisible."));
      img.onload = () => {
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
