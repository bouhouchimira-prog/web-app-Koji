// Support Pro (maquette PRO-24.8) : règles pures. Les demandes viennent des
// signalements envoyés depuis koji-web (db.technicalReports : page, message,
// compte, statut « nouveau »).
import type { Ligne } from './client'

const s = (v: unknown) => String(v ?? '')

export const CATEGORIES_PRO: { cat: string; re: RegExp; urgent?: boolean }[] = [
  { cat: 'facturation', re: /factur|chorus|tva|avoir|encaiss/i, urgent: true },
  { cat: 'connexion', re: /connexion|connecter|mot de passe|identifiant|code/i, urgent: true },
  { cat: 'vérifications', re: /d[ée]cennale|attestation|urssaf|kbis|rc ?pro|document/i },
  { cat: 'abonnement', re: /abonnement|offre|stripe|paiement|carte|jeton/i },
  { cat: 'devis', re: /devis|ouvrage|biblioth/i },
  { cat: 'radar', re: /radar|marketplace|chantier/i },
  { cat: 'application', re: /app|iphone|android|mobile/i }
]

export function categoriePro(r: Ligne) {
  const texte = `${s(r.message)} ${s(r.page)}`
  const c = CATEGORIES_PRO.find((x) => x.re.test(texte))
  return { categorie: c?.cat || 'autre', urgent: Boolean(c?.urgent) }
}

export const estResolu = (statut: string) => /trait|resolu|résolu|ferm|clos/i.test(statut)

// Même sujet : autres demandes ouvertes sur la même page ou la même catégorie.
export function similaires(r: Ligne, toutes: Ligne[]) {
  const cat = categoriePro(r).categorie
  return toutes.filter((x) => s(x.id) !== s(r.id) && !estResolu(s(x.status)) && (s(x.page) === s(r.page) || categoriePro(x).categorie === cat))
}

export const MODELES_PRO: Record<string, string> = {
  'vérifications': "Bonjour,\n\nMerci pour votre message. Pour envoyer votre attestation, ouvrez Paramètres puis Mes documents et choisissez le fichier (PDF ou photo). Si l'envoi ne passe toujours pas, répondez à ce message avec le fichier en pièce jointe : nous le déposerons pour vous.\n\nL'équipe Koji",
  facturation: "Bonjour,\n\nMerci pour votre message. Nous regardons votre facture et revenons vers vous rapidement. Pouvez-vous nous indiquer son numéro et le message d'erreur affiché ?\n\nL'équipe Koji",
  connexion: "Bonjour,\n\nMerci pour votre message. Utilisez « Mot de passe oublié » sur la page de connexion : un lien vous est envoyé par e-mail. S'il n'arrive pas, regardez dans les courriers indésirables puis répondez-nous.\n\nL'équipe Koji",
  suppression: "Bonjour,\n\nNous avons bien reçu votre demande de suppression. Elle est traitée sous 30 jours ; vos devis signés et factures restent conservés le temps prévu par la loi.\n\nL'équipe Koji",
  autre: "Bonjour,\n\nMerci pour votre message. Nous regardons et revenons vers vous rapidement.\n\nL'équipe Koji"
}

export function modelePro(categorie: string) {
  return MODELES_PRO[categorie] || MODELES_PRO.autre
}
