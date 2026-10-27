/// A standalone diagnostic/intervention report (not tied to a devis),
/// mirroring web's app/api/interventions/route.js record shape.
/// Flutter-native — see koji-main/supabase/migrations/0004_interventions.sql.
class Intervention {
  final String id;
  final String userId;
  final String reference;
  final String client;
  final String? site;
  final DateTime date;
  final String? entreprise;
  final String? equipement;
  final String? constat;
  final String? analyse;
  final String? preconisations;
  final String? signature; // signer's typed name
  final String? signatureImagePath; // storage path in intervention-signatures
  final Map<String, dynamic> companySnapshot;
  final String? projectId;
  final String status; // a_faire | en_cours | terminee | facturee | archivee
  final String? invoiceId;
  final String? taskId;
  final DateTime? completedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Intervention({
    required this.id,
    required this.userId,
    required this.reference,
    required this.client,
    this.site,
    required this.date,
    this.entreprise,
    this.equipement,
    this.constat,
    this.analyse,
    this.preconisations,
    this.signature,
    this.signatureImagePath,
    this.companySnapshot = const {},
    this.projectId,
    this.status = InterventionStatus.aFaire,
    this.invoiceId,
    this.taskId,
    this.completedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Intervention.fromMap(Map<String, dynamic> map) {
    return Intervention(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      reference: (map['reference'] as String?) ?? '',
      client: (map['client'] as String?) ?? '',
      site: map['site'] as String?,
      date: DateTime.parse(map['date'] as String),
      entreprise: map['entreprise'] as String?,
      equipement: map['equipement'] as String?,
      constat: map['constat'] as String?,
      analyse: map['analyse'] as String?,
      preconisations: map['preconisations'] as String?,
      signature: map['signature'] as String?,
      signatureImagePath: map['signature_image_path'] as String?,
      companySnapshot:
          (map['company_snapshot'] as Map?)?.cast<String, dynamic>() ?? const {},
      projectId: map['project_id'] as String?,
      status: (map['status'] as String?) ?? InterventionStatus.aFaire,
      invoiceId: map['invoice_id'] as String?,
      taskId: map['task_id'] as String?,
      completedAt: map['completed_at'] != null
          ? DateTime.tryParse(map['completed_at'] as String)
          : null,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Map<String, dynamic> toInsertMap() {
    return {
      'reference': reference,
      'client': client,
      if (site != null) 'site': site,
      'date': date.toIso8601String().split('T').first,
      if (entreprise != null) 'entreprise': entreprise,
      if (equipement != null) 'equipement': equipement,
      if (constat != null) 'constat': constat,
      if (analyse != null) 'analyse': analyse,
      if (preconisations != null) 'preconisations': preconisations,
      if (signature != null) 'signature': signature,
      if (signatureImagePath != null) 'signature_image_path': signatureImagePath,
      'company_snapshot': companySnapshot,
      if (projectId != null) 'project_id': projectId,
      'status': status,
    };
  }
}

abstract class InterventionStatus {
  static const aFaire = 'a_faire';
  static const enCours = 'en_cours';
  static const terminee = 'terminee';
  static const facturee = 'facturee';
  static const archivee = 'archivee';

  static String label(String value) => switch (value) {
        enCours => 'En cours',
        terminee => 'Terminée',
        facturee => 'Facturée',
        archivee => 'Archivée',
        _ => 'À faire',
      };
}
