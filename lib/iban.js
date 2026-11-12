// IBAN saisi au démarrage guidé (étape 6) : on vérifie la clé (ISO 13616,
// modulo 97) pour éviter une faute de frappe sur les factures.
export function normaliserIban(saisie) {
  return String(saisie || "").replace(/\s+/g, "").toUpperCase();
}

export function ibanValide(saisie) {
  const iban = normaliserIban(saisie);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("FR") && iban.length !== 27) return false;
  const reordonne = iban.slice(4) + iban.slice(0, 4);
  let reste = 0;
  for (const c of reordonne) {
    const valeur = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const chiffre of valeur) reste = (reste * 10 + Number(chiffre)) % 97;
  }
  return reste === 1;
}

// « FR7630006000011234567890189 » → « FR76 3000 6000 0112 3456 7890 189 ».
export function formaterIban(saisie) {
  return normaliserIban(saisie).replace(/(.{4})/g, "$1 ").trim();
}
