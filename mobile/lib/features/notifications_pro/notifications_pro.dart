import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/home/notifications/providers/notification_provider.dart';
import 'package:koji/features/home/notifications/repositories/notification_repository.dart';
import 'package:koji/features/koji/koji_assistant.dart' show routeApp;

// Centre de notifications Koji Pro (maquette PRO-23, téléphone) : un fait,
// une action. Réunit les notifications du site (/api/notifications) et
// celles de l'app (table Supabase notifications). Mêmes règles que
// lib/notifications-pro.js : catégorie, groupes par jour, archivage à 30 j.
const notificationsCentreRoute = '/notifications';
String notificationDetailRoute(String id) => '/notifications/detail/$id';

String categorieDe(String type) {
  if (RegExp(r'^(quote|avenant|signature)\.').hasMatch(type)) return 'devis';
  if (RegExp(r'^(invoice|payment|paiement)\.|paiement|acompte').hasMatch(type)) return 'paiement';
  if (RegExp(r'^(radar|marketplace)\.').hasMatch(type)) return type.contains('rdv') ? 'rdv' : 'radar';
  if (RegExp(r'^(client\.note|company\.note|message|reseau\.message|task\.client_note|task\.company_reply)').hasMatch(type)) return 'message';
  if (RegExp(r'^(rdv|calendar|visite)\.').hasMatch(type)) return 'rdv';
  if (RegExp(r'^(worker|company\.worker|company\.time|attendance|task\.)').hasMatch(type)) return 'equipe';
  if (type.contains('reserve')) return 'reserve';
  if (RegExp(r'^(avis|site\.avis)').hasMatch(type)) return 'avis';
  if (type.startsWith('document.')) return 'document';
  if (type.startsWith('site.')) return 'message';
  return 'info';
}

const _icones = {
  'devis': Icons.description_outlined, 'paiement': Icons.payments_outlined, 'radar': Icons.place_outlined, 'message': Icons.chat_bubble_outline,
  'rdv': Icons.event_outlined, 'equipe': Icons.group_outlined, 'reserve': Icons.warning_amber_outlined, 'avis': Icons.star_outline,
  'document': Icons.insert_drive_file_outlined, 'info': Icons.info_outline,
};
const libellesCategorie = {
  'devis': 'Devis', 'paiement': 'Paiement', 'radar': 'Radar', 'message': 'Message', 'rdv': 'Rendez-vous',
  'equipe': 'Équipe', 'reserve': 'Réserve', 'avis': 'Avis', 'document': 'Document', 'info': 'Info',
};

const _moisLongs = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const _joursCourts = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const _moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

DateTime _jour(DateTime d) => DateTime(d.year, d.month, d.day);

bool estArchivee(Json n, DateTime maintenant) {
  if (n['archived'] == true) return true;
  final c = DateTime.tryParse('${n['createdAt']}');
  return c != null && maintenant.difference(c).inDays > 30;
}

String groupeDe(DateTime quand, DateTime maintenant) {
  final ecart = _jour(maintenant).difference(_jour(quand)).inDays;
  if (ecart <= 0) return "Aujourd'hui";
  if (ecart == 1) return 'Hier';
  final lundi = _jour(maintenant).subtract(Duration(days: maintenant.weekday - 1));
  if (!_jour(quand).isBefore(lundi)) return 'Cette semaine';
  return '${_moisLongs[quand.month - 1]} ${quand.year}';
}

String heureListe(DateTime quand, DateTime maintenant) {
  final g = groupeDe(quand, maintenant);
  if (g == "Aujourd'hui" || g == 'Hier') return '${quand.hour.toString().padLeft(2, '0')}:${quand.minute.toString().padLeft(2, '0')}';
  if (g == 'Cette semaine') return _joursCourts[quand.weekday - 1];
  return '${quand.day} ${_moisCourts[quand.month - 1]}';
}

class CentreNotificationsRepository {
  CentreNotificationsRepository(this._api, this._app);
  final KojiProApi _api;
  final NotificationRepository? _app;

  /// Les deux sources ; une source indisponible n'empêche pas l'autre.
  Future<List<Json>> toutes() async {
    final out = <Json>[];
    try {
      final r = await _api.get('/api/notifications');
      for (final n in (r['notifications'] as List? ?? const []).whereType<Map>()) {
        final m = Map<String, dynamic>.from(n);
        out.add({...m, 'source': 'web', 'createdAt': '${m['createdAt'] ?? ''}'});
      }
    } catch (_) {}
    try {
      for (final n in await (_app?.getAll(includeArchived: true) ?? Future.value(const []))) {
        out.add({
          'id': n.id, 'source': 'app', 'type': n.type, 'title': n.title, 'message': n.message, 'read': n.read, 'archived': n.archived,
          'createdAt': n.createdAt.toIso8601String(), 'quoteId': n.quoteId, 'projectId': n.projectId, 'actionUrl': n.actionUrl, 'actionLabel': n.actionLabel,
        });
      }
    } catch (_) {}
    for (final n in out) {
      n['categorie'] = categorieDe('${n['type'] ?? ''}');
    }
    out.sort((a, b) => '${b['createdAt']}'.compareTo('${a['createdAt']}'));
    return out;
  }

  Future<void> lue(Json n) async {
    if (n['source'] == 'web') {
      await _api.patch('/api/notifications', {'id': n['id'], 'action': 'read'});
    } else {
      await _app?.markRead('${n['id']}');
    }
  }

  Future<void> toutLu(List<Json> liste) async {
    try {
      await _api.patch('/api/notifications', {'action': 'read-all'});
    } catch (_) {}
    try {
      await _app?.markAllRead();
    } catch (_) {}
  }

  Future<void> archiver(Json n) async {
    if (n['source'] == 'web') {
      await _api.patch('/api/notifications', {'id': n['id'], 'action': 'archive'});
    } else {
      await _app?.archive('${n['id']}');
    }
  }
}

final centreNotificationsRepositoryProvider = Provider<CentreNotificationsRepository>((ref) {
  NotificationRepository? app;
  try {
    app = ref.watch(notificationRepositoryProvider);
  } catch (_) {
    app = null;
  }
  return CentreNotificationsRepository(ref.watch(kojiProApiProvider), app);
});
final centreNotificationsProvider = FutureProvider.autoDispose<List<Json>>((ref) => ref.watch(centreNotificationsRepositoryProvider).toutes());

String _s(Object? v) => v == null ? '' : '$v';

class NotificationsCentreScreen extends ConsumerStatefulWidget {
  const NotificationsCentreScreen({super.key, this.maintenant});
  final DateTime? maintenant;
  @override
  ConsumerState<NotificationsCentreScreen> createState() => _NotificationsCentreScreenState();
}

class _NotificationsCentreScreenState extends ConsumerState<NotificationsCentreScreen> {
  String _onglet = 'toutes';

  void _rafraichir() {
    ref.invalidate(centreNotificationsProvider);
    ref.invalidate(notificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(centreNotificationsProvider);
    final maintenant = widget.maintenant ?? DateTime.now();
    final liste = a.value ?? const <Json>[];
    final actives = liste.where((n) => !estArchivee(n, maintenant)).toList();
    final nonLues = actives.where((n) => n['read'] != true).toList();
    final visibles = _onglet == 'archivees' ? liste.where((n) => estArchivee(n, maintenant)).toList() : _onglet == 'nonlues' ? nonLues : actives;
    final p = context.koji;
    final enfants = <Widget>[];
    String? groupe;
    for (final n in visibles) {
      final quand = DateTime.tryParse(_s(n['createdAt']))?.toLocal() ?? maintenant;
      final g = groupeDe(quand, maintenant);
      if (g != groupe) {
        groupe = g;
        enfants.add(Padding(padding: const EdgeInsets.only(top: 12, bottom: 4), child: Text(g.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .6, color: p.muted))));
      }
      final lue = n['read'] == true;
      enfants.add(InkWell(
        onTap: () async {
          await context.push(notificationDetailRoute(_s(n['id'])), extra: n);
          _rafraichir();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: p.lineSoft))),
          child: Row(children: [
            Container(width: 32, height: 32, decoration: BoxDecoration(border: Border.all(color: p.line)), child: Icon(_icones[n['categorie']] ?? Icons.info_outline, size: 17)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_s(n['title']).isEmpty ? 'Notification' : _s(n['title']), style: TextStyle(fontWeight: lue ? FontWeight.w500 : FontWeight.w700, color: p.heading)),
              if (_s(n['message']).isNotEmpty) Text(_s(n['message']).split('\n').first, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: p.muted)),
            ])),
            const SizedBox(width: 8),
            Text(heureListe(quand, maintenant), style: TextStyle(fontSize: 12, color: p.muted)),
            if (!lue) ...[const SizedBox(width: 8), Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF171B1E), shape: BoxShape.circle))],
          ]),
        ),
      ));
    }
    return KojiPage(
      title: 'Notifications',
      subtitle: nonLues.isEmpty ? 'tout est lu' : '${nonLues.length} non lue${nonLues.length > 1 ? 's' : ''}',
      appBarOnPhone: true,
      actions: [
        if (nonLues.isNotEmpty)
          TextButton(
            onPressed: () async {
              await ref.read(centreNotificationsRepositoryProvider).toutLu(nonLues);
              _rafraichir();
            },
            child: const Text('Tout marquer lu'),
          ),
      ],
      onRefresh: () async => _rafraichir(),
      main: [
        KojiSegmented<String>(
          options: {'toutes': 'Toutes', 'nonlues': 'Non lues ${nonLues.length}', 'archivees': 'Archivées'},
          value: _onglet,
          onChanged: (v) => setState(() => _onglet = v),
        ),
        if (a.isLoading && liste.isEmpty)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator()))
        else if (visibles.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Text(_onglet == 'archivees' ? 'Aucune notification archivée.' : _onglet == 'nonlues' ? 'Tout est lu.' : "Aucune notification pour l'instant.", style: TextStyle(color: p.muted)),
          )
        else
          ...enfants,
      ],
    );
  }
}

/// Détail : le fait, l'objet lié, une action principale au plus.
class NotificationDetailProScreen extends ConsumerStatefulWidget {
  const NotificationDetailProScreen({super.key, required this.notification});
  final Json notification;
  @override
  ConsumerState<NotificationDetailProScreen> createState() => _NotificationDetailProScreenState();
}

class _NotificationDetailProScreenState extends ConsumerState<NotificationDetailProScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.notification['read'] != true) {
      ref.read(centreNotificationsRepositoryProvider).lue(widget.notification).catchError((_) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.notification;
    final cat = _s(n['categorie']).isEmpty ? categorieDe(_s(n['type'])) : _s(n['categorie']);
    final quand = DateTime.tryParse(_s(n['createdAt']))?.toLocal();
    final route = routeApp(_s(n['actionUrl']));
    final p = context.koji;
    return KojiPage(
      title: libellesCategorie[cat] ?? 'Notification',
      subtitle: quand == null ? '' : '${quand.day}/${quand.month.toString().padLeft(2, '0')} · ${quand.hour.toString().padLeft(2, '0')}:${quand.minute.toString().padLeft(2, '0')}',
      appBarOnPhone: true,
      main: [
        Text(_s(n['title']), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: p.heading)),
        if (_s(n['message']).isNotEmpty) Text(_s(n['message']), style: TextStyle(fontSize: 15, height: 1.5, color: p.ink)),
        if (_s(n['actionUrl']).isNotEmpty)
          route != null
              ? KojiButton(label: _s(n['actionLabel']).isEmpty ? 'Ouvrir' : _s(n['actionLabel']), expand: true, variant: KojiButtonVariant.gold, onPressed: () => context.push(route))
              : Text('${_s(n['actionLabel']).isEmpty ? 'Action' : _s(n['actionLabel'])} : sur le site getkoji.io', style: TextStyle(fontSize: 12, color: p.muted)),
        TextButton(
          onPressed: () async {
            await ref.read(centreNotificationsRepositoryProvider).archiver(n);
            if (context.mounted) context.pop();
          },
          child: const Text('Archiver'),
        ),
      ],
    );
  }
}

/// Nombre de non lues (les deux sources), pour la cloche.
final nonLuesCentreProvider = Provider.autoDispose<int>((ref) {
  final maintenant = DateTime.now();
  return ref.watch(centreNotificationsProvider).maybeWhen(
        data: (l) => l.where((n) => n['read'] != true && !estArchivee(n, maintenant)).length,
        orElse: () => ref.watch(unreadNotificationsCountProvider),
      );
});
