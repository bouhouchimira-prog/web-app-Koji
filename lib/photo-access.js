// Les photos d'une offre Radar des Chantiers ne sont pas visibles d'office
// par une entreprise (decisions du 4 septembre) : c'est le particulier qui
// les debloque, entreprise par entreprise, dans la discussion. Meme logique
// que hasConfirmedRdv (lib/rdv.js) : pas de collection dediee, on scanne les
// messages deja stockes d'un fil (offre, entreprise) a la recherche d'un
// message "photo_grant".
export function hasPhotoAccess(messages, offerId, entrepriseUserId) {
  return (messages || []).some(
    (m) => m.offerId === offerId &&
      m.entrepriseUserId === entrepriseUserId &&
      m.kind === "photo_grant"
  );
}
