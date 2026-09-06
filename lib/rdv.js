// Un RDV est confirme pour un fil (offre, entreprise) des qu'un message
// rdv_response avec rdvStatus "accepted" existe dans ce fil — pas de
// collection dediee, on scanne les messages deja stockes (meme logique que
// le reste de la messagerie Radar des Chantiers).
export function hasConfirmedRdv(messages, offerId, entrepriseUserId) {
  return (messages || []).some(
    (m) => m.offerId === offerId &&
      m.entrepriseUserId === entrepriseUserId &&
      m.kind === "rdv_response" &&
      m.rdvStatus === "accepted"
  );
}
