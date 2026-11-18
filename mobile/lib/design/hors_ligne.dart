import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

/// Bandeau hors ligne (maquette PRO-19), en haut de toutes les pages Pro.
/// Les visites et les envois mis en file d'attente partent au retour du
/// réseau (VisiteStore, SyncWorker).
class BandeauHorsLigne extends StatefulWidget {
  const BandeauHorsLigne({super.key, required this.child, this.connectivity});
  final Widget child;
  final Connectivity? connectivity;
  @override
  State<BandeauHorsLigne> createState() => _BandeauHorsLigneState();
}

class _BandeauHorsLigneState extends State<BandeauHorsLigne> {
  bool _horsLigne = false;
  StreamSubscription<List<ConnectivityResult>>? _sub;

  bool _aucun(List<ConnectivityResult> r) => r.isEmpty || r.every((x) => x == ConnectivityResult.none);

  @override
  void initState() {
    super.initState();
    final c = widget.connectivity ?? Connectivity();
    try {
      c.checkConnectivity().then((r) { if (mounted) setState(() => _horsLigne = _aucun(r)); }).catchError((_) {});
      _sub = c.onConnectivityChanged.listen((r) { if (mounted) setState(() => _horsLigne = _aucun(r)); }, onError: (_) {});
    } catch (_) {
      // Plateforme sans connectivité (tests) : on reste « en ligne ».
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_horsLigne) return widget.child;
    return Column(children: [
      Material(
        color: const Color(0xFF5B5F66),
        child: SafeArea(
          bottom: false,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: const Text('Hors ligne · vos visites et envois en attente partiront au retour du réseau', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
      Expanded(child: MediaQuery.removePadding(context: context, removeTop: true, child: widget.child)),
    ]);
  }
}
