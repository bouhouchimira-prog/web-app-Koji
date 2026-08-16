// Shared shape/logic for the Contacts module, used by app/api/contacts,
// app/api/contacts/[id]/history and app/api/chantier-contacts so the three
// routes stay consistent without duplicating this in each one.

export const CONTACT_ROLES = ["client", "prospect", "equipe", "sous_traitant", "architecte", "fournisseur", "donneur_ordre", "autre"];

// Same normalization rules as ensureClientPortalAccess in
// app/api/signatures/[token]/route.js, so a contact dedups against the same
// notion of "same person" the signature flow already uses.
export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeSiret(value) {
  return String(value || "").replace(/\D/g, "");
}

export function contactDisplayName(contact) {
  if (!contact) return "";
  if (contact.type === "societe") return contact.companyName || "";
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

// Non-blocking duplicate hint: any one of email/phone/siret matching an
// existing, non-archived contact (other than excludeId) counts as "similar".
export function findSimilarContacts(contacts, { email, phone, siret } = {}, excludeId = "") {
  const email_ = normalizeEmail(email);
  const phone_ = normalizePhone(phone);
  const siret_ = normalizeSiret(siret);
  if (!email_ && !phone_ && !siret_) return [];
  return contacts.filter((contact) => {
    if (contact.id === excludeId || contact.archived) return false;
    if (email_ && normalizeEmail(contact.email) === email_) return true;
    if (phone_ && normalizePhone(contact.phone) === phone_) return true;
    if (siret_ && normalizeSiret(contact.siret) === siret_) return true;
    return false;
  });
}
