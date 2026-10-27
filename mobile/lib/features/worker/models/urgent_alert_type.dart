import 'package:flutter/material.dart';

/// The 5 urgent-alert types, mirroring web's TYPE_LABELS
/// (app/api/urgent-alerts/route.js) so both apps agree on the same values.
/// Distinct from the worker "report" kinds (reclamation/retard/blocage/
/// commentaire/depassement) — those are task-progress feedback, these are
/// safety alerts (degat, fuite, urgence, incendie, autre).
enum UrgentAlertType {
  degat('degat', 'Dégât', Icons.broken_image_outlined),
  fuite('fuite', 'Fuite d\'eau', Icons.water_drop_outlined),
  urgence('urgence', 'Urgence', Icons.warning_amber_rounded),
  incendie('incendie', 'Incendie', Icons.local_fire_department_outlined),
  autre('autre', 'Autre', Icons.report_gmailerrorred_outlined);

  const UrgentAlertType(this.value, this.label, this.icon);

  final String value;
  final String label;
  final IconData icon;
}
