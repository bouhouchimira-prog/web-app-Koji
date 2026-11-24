// Client d'un chantier ajouté à la main (retours du build 64, sprint 2).
//
// Le chantier ne portait que l'e-mail du client : la liste affichait le
// début de cet e-mail à la place d'un nom, et le client n'entrait jamais dans
// le carnet de contacts. Le client devient un contact du carnet (db.contacts),
// rattaché au chantier par db.chantierContacts avec le rôle « client » : un
// seul endroit pour son nom, son téléphone et son e-mail, lu par la liste des
// chantiers, la fiche et les contacts.
import { contactDisplayName } from "./contacts.js";
import { correspondAuContact } from "./contacts-pro.js";
import { fixText } from "./text.js";

export const ROLE_CLIENT = "client";

const propre = (v, max = 160) => fixText(String(v || "")).trim().slice(0, max);

// « Marie Lefèvre » → prénom Marie, nom Lefèvre ; un seul mot → nom.
export function decouperNom(nom) {
  const mots = propre(nom).split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { firstName: "", lastName: mots[0] || "" };
  return { firstName: mots[0], lastName: mots.slice(1).join(" ") };
}

export function clientDuChantier(db, userId, projectId) {
  const lien = (db.chantierContacts || []).find((l) => l.userId === userId && l.projectId === projectId && l.roleOnSite === ROLE_CLIENT);
  if (!lien) return null;
  return (db.contacts || []).find((c) => c.id === lien.contactId && c.userId === userId) || null;
}

// Ce que la liste et la fiche montrent du client.
export function resumeClient(contact) {
  if (!contact) return { clientName: "", clientPhone: "", contactId: "" };
  return { clientName: contactDisplayName(contact), clientPhone: contact.phone || "", contactId: contact.id };
}

// Rattache le client au chantier : le contact existant (même e-mail ou même
// téléphone) est repris et complété sans rien écraser, sinon il est créé.
// Renvoie le contact, ou null si rien n'a été saisi.
export function rattacherClient(db, userId, projectId, { nom = "", email = "", telephone = "", adresse = "" } = {}, maintenant = new Date().toISOString()) {
  const n = propre(nom);
  const e = propre(email).toLowerCase();
  const t = propre(telephone, 40);
  if (!userId || !projectId || (!n && !e && !t)) return null;
  db.contacts = db.contacts || [];
  db.chantierContacts = db.chantierContacts || [];

  let contact = clientDuChantier(db, userId, projectId)
    || db.contacts.find((c) => c.userId === userId && !c.archived && correspondAuContact(c, { email: e, phone: t }));
  if (contact) {
    if (n && !contactDisplayName(contact)) Object.assign(contact, decouperNom(n));
    if (e && !contact.email) contact.email = e;
    if (t && !contact.phone) contact.phone = t;
    if (!(contact.roles || []).includes(ROLE_CLIENT)) contact.roles = [...(contact.roles || []), ROLE_CLIENT];
    contact.updatedAt = maintenant;
  } else {
    contact = {
      id: `contact-${Date.parse(maintenant) || Date.now()}-${db.contacts.length}`, userId, type: "particulier",
      ...decouperNom(n), companyName: "", phone: t, email: e, address: propre(adresse, 240),
      roles: [ROLE_CLIENT], source: "chantier", sourceQuoteIds: [], archived: false, archivedAt: "", createdAt: maintenant, updatedAt: maintenant
    };
    db.contacts.unshift(contact);
  }
  if (!db.chantierContacts.some((l) => l.userId === userId && l.contactId === contact.id && l.projectId === projectId)) {
    db.chantierContacts.unshift({ id: `cc-${Date.parse(maintenant) || Date.now()}-${db.chantierContacts.length}`, userId, contactId: contact.id, projectId, roleOnSite: ROLE_CLIENT, addedAt: maintenant });
  }
  return contact;
}

// Chantiers déjà créés avec le seul e-mail du client : leur client entre dans
// le carnet à la première ouverture des contacts. Renvoie le nombre de
// chantiers rattachés (0 = rien à écrire).
export function importerClientsDesChantiers(db, userId, chantiers = [], maintenant = new Date().toISOString()) {
  let rattaches = 0;
  for (const c of chantiers) {
    if (!c.clientEmail || clientDuChantier(db, userId, c.projectId)) continue;
    if (rattacherClient(db, userId, c.projectId, { email: c.clientEmail, adresse: c.address }, maintenant)) rattaches += 1;
  }
  return rattaches;
}
