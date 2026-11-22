import { readDb } from "./db";
import { getSupabaseAdmin } from "./supabase";
import { mapQuote } from "./quote-mapping";
import { getVerifiedPortalUserId } from "./portal-session";
import { normalizeEmail, quoteBelongsToClient } from "./portal-acces";
import { buildWebUser } from "./user-profile";
import { fixObjectText, fixText } from "./text";
import { factureDeSolde, jourDeParis, plusAns } from "./cloture-chantier";
import { listDrafts } from "./radar-offer-draft";
import { ceQuiVousAttend, comparaison, listeProjets } from "./projets-client";
import { MESSAGE_SUSPENDU, compteSuspendu } from "./moderation";

// Koji Client · projets et propositions (CLI-01) : lectures côté serveur.
// Tout part de la session du particulier, jamais d'un identifiant envoyé
// par le navigateur.

// Champs d'un devis qui ne doivent pas quitter le serveur : le mot de passe
// du portail de signature, son empreinte et son sel.
const SECRETS_DEVIS = ["signatureAccessPassword", "signatureAccessPasswordHash", "signatureAccessPasswordSalt"];
export function sansSecrets(devis) {
  const copie = { ...devis };
  for (const cle of SECRETS_DEVIS) delete copie[cle];
  return copie;
}

// Le particulier connecté, ou { erreur, code }.
export async function clientConnecte(request) {
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return { erreur: "Session expirée. Reconnectez-vous.", code: 401 };
  const db = await readDb();
  const user = (db.users || []).find((entry) => entry.id === userId);
  if (!user) return { erreur: "Profil client introuvable.", code: 404 };
  if (compteSuspendu(user)) return { erreur: MESSAGE_SUSPENDU, code: 403 };
  return { db, user };
}

function chantierCourt(row) {
  return {
    id: row.id,
    title: row.reference || "Chantier",
    reference: row.reference || "",
    clientEmail: row.client_email || "",
    clientPhone: "",
    address: [row.street, row.postal_code, row.city].filter(Boolean).join(", "),
    status: row.status || "En attente"
  };
}

// Tous les devis et chantiers, lus une fois avec la clé de service : les
// devis appartiennent au compte de l'entreprise, le particulier n'y a pas
// accès par ses propres droits. Le tri se fait ensuite ici.
export async function chargerDevis() {
  const supabase = getSupabaseAdmin();
  const { data: lignes, error } = await supabase.from("quotes").select("*");
  if (error) throw new Error(`Lecture des devis impossible: ${error.message}`);
  const { data: chantiers } = await supabase.from("chantiers").select("*");
  return {
    devis: (lignes || []).map((row) => mapQuote(row)),
    chantiers: new Map((chantiers || []).map((row) => [row.id, chantierCourt(row)]))
  };
}

// Les devis du particulier, avec leur chantier, leurs tâches et la fin de
// chantier (réception, garantie, dossier remis, avis).
export function devisDuClient(db, user, { devis, chantiers }) {
  const email = normalizeEmail(user.email);
  return devis
    .filter((quote) => quoteBelongsToClient(quote, chantiers.get(quote.projectId), user, email))
    .map((quote) => {
      const cloture = (db.clotures || []).find((c) => c.projectId && c.projectId === quote.projectId) || null;
      const receptionLe = cloture?.pv?.signeLe || "";
      const chantier = chantiers.get(quote.projectId);
      return {
        ...fixObjectText({
          ...sansSecrets(quote),
          status: fixText(quote.status),
          project: chantier ? fixObjectText(chantier) : null,
          tasks: (db.tasks || []).filter((task) => task.quoteId === quote.id || task.projectId === quote.projectId).map((task) => fixObjectText(task))
        }),
        dossierFinLe: cloture?.dossier?.remisLe || "",
        finChantier: {
          receptionLe,
          parfaitJusqua: receptionLe ? plusAns(jourDeParis(receptionLe), 1) : "",
          dossierFinLe: cloture?.dossier?.remisLe || "",
          avisLe: (db.avis || []).find((a) => a.projectId === quote.projectId)?.creeLe || "",
          avisPossible: Boolean(receptionLe || factureDeSolde(db.invoices || [], { projectId: quote.projectId }))
        }
      };
    });
}

// Profils des entreprises positionnées : ce qu'il faut pour la décennale.
async function profilsEntreprises(ids) {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (!uniques.length) return new Map();
  const { data } = await getSupabaseAdmin().from("users").select("*").in("id", uniques);
  return new Map((data || []).map((profile) => [profile.id, buildWebUser({ id: profile.id, email: profile.email || "", profile }).business || {}]));
}

const prenomDe = (user) => String(user.personal?.firstName || user.name || "").trim();

// « Mes projets » : la liste et « Ce qui vous attend ».
export async function vueProjets({ db, user }, maintenant = new Date().toISOString()) {
  const tout = await chargerDevis();
  const devis = devisDuClient(db, user, tout);
  const offres = (db.chantierOffres || []).filter((o) => o.userId === user.id).map((o) => fixObjectText(o));
  const ids = new Set(offres.map((o) => o.id));
  const positions = (db.chantierPositionnements || []).filter((p) => ids.has(p.offerId));
  const messages = (db.chantierOffreMessages || []).filter((m) => ids.has(m.offerId));
  const brouillons = await listDrafts(user.id).catch(() => []);
  const donnees = { devis, offres, positions, messages, brouillons, factures: db.invoices || [], maintenant };
  return { bonjour: fixText(prenomDe(user)), projets: listeProjets(donnees), attendus: ceQuiVousAttend(donnees) };
}

// « Comparer les propositions » d'une demande du particulier, ou null si
// la demande n'est pas la sienne.
export async function vueComparaison({ db, user }, offreId, maintenant = new Date().toISOString()) {
  const offre = (db.chantierOffres || []).find((o) => o.id === offreId && o.userId === user.id);
  if (!offre) return null;
  const positions = (db.chantierPositionnements || []).filter((p) => p.offerId === offre.id);
  const messages = (db.chantierOffreMessages || []).filter((m) => m.offerId === offre.id);
  const entreprises = positions.map((p) => p.entrepriseUserId);
  const [tout, profils] = await Promise.all([chargerDevis(), profilsEntreprises(entreprises)]);
  // Seuls les devis établis pour CETTE demande par une entreprise positionnée.
  const devis = tout.devis.filter((d) => d.chantierOffreId === offre.id && entreprises.includes(d.userId));
  const avis = (db.avis || []).filter((a) => entreprises.includes(a.userId));
  return comparaison(fixObjectText(offre), { positions: positions.map((p) => fixObjectText(p)), messages, devis, avis, profils, maintenant });
}
