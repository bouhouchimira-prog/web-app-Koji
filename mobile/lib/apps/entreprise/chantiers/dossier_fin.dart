import 'package:koji/apps/entreprise/chantiers/cloture.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';

/// Dossier de fin de chantier (maquette PRO-02.5, téléphone) : les huit
/// lignes du dossier et ce qui manque. Le site applique les mêmes règles
/// (lib/dossier-fin.js) sur sa liste ordinateur.

String _s(dynamic v) => v == null ? '' : '$v';

class ElementDossier {
  const ElementDossier(this.id, this.titre, this.detail, {required this.ok});
  final String id, titre, detail;
  final bool ok;
}

const _court = {
  'Acompte initial': 'acompte',
  'Facture intermédiaire': 'situation',
  'Facture finale': 'solde',
};

List<ElementDossier> elementsDossierTelephone({
  Map<String, dynamic>? cloture,
  Map<String, dynamic>? devis,
  List<String> avenants = const [],
  List<Map<String, dynamic>> factures = const [],
  Map<String, dynamic>? factureSolde,
  List<Map<String, dynamic>> photos = const [],
  List<Map<String, dynamic>> pieces = const [],
  Map<String, dynamic>? decennale,
  List<Reserve> reserves = const [],
  required String aujourdhui,
}) {
  final pv = cloture?['pv'] is Map ? cloture!['pv'] as Map : null;
  final signeLe = _s(pv?['signeLe']);
  final apres = photos.where((p) => _s(p['phase']) == 'apres').length;
  final avantApres =
      photos.where((p) => {'avant', 'apres'}.contains(_s(p['phase']))).length;
  final signe = devis != null &&
      (_s(devis['status']) == 'Signe' || _s(devis['signatureStatus']) == 'Signe');
  final types = <String>{
    for (final f in factures)
      if ((f['amountTtc'] is num ? f['amountTtc'] as num : 0) > 0)
        _court[_s(f['type'])] ?? 'facture'
  };
  final notices =
      pieces.where((p) => _s(p['kind']) == 'notice').map((p) => _s(p['titre']));
  final plans = pieces.where((p) => _s(p['kind']) == 'plan').toList();
  final assureur = _s(decennale?['insurer']);
  final jusqua = _s(decennale?['until']);
  final decOk = assureur.isNotEmpty &&
      jusqua.length >= 10 &&
      jusqua.substring(0, 10).compareTo(aujourdhui) >= 0;
  final ouvertes = reserves.where((r) => r.statut != 'levee').toList();

  return [
    ElementDossier('pv', 'Procès-verbal de réception',
        signeLe.isEmpty ? 'à faire signer' : 'signé le ${dateCourte(jourLocal(signeLe))}',
        ok: signeLe.isNotEmpty),
    ElementDossier('photos', 'Photos avant / après',
        avantApres == 0 ? 'aucune photo avant / après' : '$avantApres photo${avantApres > 1 ? 's' : ''}',
        ok: apres > 0),
    ElementDossier(
        'devis',
        avenants.isEmpty
            ? 'Devis signé'
            : 'Devis et avenant${avenants.length > 1 ? 's' : ''} signés',
        signe
            ? [_s(devis['quoteNumber']), ...avenants].where((s) => s.isNotEmpty).join(' · ')
            : 'devis non signé',
        ok: signe),
    ElementDossier(
        'factures',
        'Factures et paiements',
        factureSolde != null
            ? types.join(', ')
            : types.isEmpty
                ? 'aucune facture'
                : '${types.join(', ')} · solde à émettre',
        ok: factureSolde != null),
    ElementDossier('notices', 'Garanties et notices',
        notices.isEmpty ? 'notices à ajouter depuis le site' : notices.join(', '),
        ok: notices.isNotEmpty),
    ElementDossier(
        'decennale',
        'Attestation décennale',
        assureur.isEmpty
            ? 'à renseigner dans le profil'
            : decOk
                ? 'à jour'
                : 'à mettre à jour',
        ok: decOk),
    ElementDossier('plan', 'Plan des réseaux',
        plans.isEmpty ? 'à ajouter' : plans.map((p) => _s(p['titre'])).join(', '),
        ok: plans.isNotEmpty),
    ElementDossier(
        'reserves',
        'Réserves levées',
        reserves.isEmpty
            ? 'aucune réserve'
            : ouvertes.isEmpty
                ? 'toutes levées'
                : '${ouvertes.map((r) => r.numero).join(', ')} en attente',
        ok: ouvertes.isEmpty),
  ];
}
