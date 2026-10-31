import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing/printing.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/services/devis_pdf_service.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/quote/repository/quote_repository.dart';
import 'package:koji/features/quote/providers/quote_task_provider.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';
import 'package:koji/features/quote/repository/ouvrage_library_repository.dart';
import 'package:koji/features/quote/model/library_ouvrage.dart';
import 'package:koji/features/quote/ouvrage_library_screen.dart';
import 'package:koji/features/fournitures/repository/fourniture_repository.dart';
import 'package:koji/features/fournitures/models/fourniture_model.dart';
import 'package:koji/features/fournitures/add_fourniture_screen.dart';
import 'package:koji/features/subscription/providers/subscription_provider.dart';
import 'package:koji/features/subscription/paywall_screen.dart';
import 'package:intl/intl.dart';

// ─── Data model for one editable line ─────────────────────────────────────────
class _DevisLine {
  String taskId;
  String label;
  String code;
  String famille;
  String unite;

  // Parent ouvrage id when this line is a sous-ouvrage. The recap groups such
  // lines under their parent and shows a summed "Total ouvrage".
  String parentTaskId;

  double qty; // editable
  double tempsHU; // editable – temps h/u
  double tauxHoraire; // from profile
  double conditionCoeff;

  double fournituresQty; // editable – separate fourniture count
  double fournituresUnitPrice; // editable – fournitures €/u

  // Forfait (flat price) — when enabled the line is billed at a single fixed
  // price and the qty/temps/fournitures breakdown is ignored.
  bool forfaitEnabled;
  double forfaitPrice;

  // When true, fournitures are NOT itemised in the client devis/facture. The
  // line total still includes their cost; only the "Fnt : …" detail is hidden.
  bool hideFournitures;

  // Line type, matching the professional devis layout:
  //   'normal'  → billed normally (MO + fournitures count toward the total)
  //   'charge'  → "Fourniture à votre charge": shown to the client but NOT
  //               billed (client supplies it), so it adds 0 to every total
  //   'attente' → "En attente de votre décision": shown but unpriced (0)
  String lineType;

  bool get isCharge => lineType == 'charge';
  bool get isAttente => lineType == 'attente';
  bool get isBillable => lineType == 'normal';

  // Free-form commentaire shown under the line (devis & PDF). Editable from the
  // recap so the entrepreneur can detail the prestation without leaving the page.
  String commentaire;

  // Supplier link for fourniture lines (chosen from the Fournisseurs module).
  String fournisseurId;
  String fournisseurName;

  // A standalone fourniture (material-only) line. Added via
  // _addFournitureToLot, its taskId is prefixed with "fourniture_".
  // Such a line has NO main d'œuvre: its total is simply quantité × prix unitaire.
  bool get isFourniture => taskId.startsWith('fourniture_');

  // A standalone commentaire/note line: it carries text only, no price.
  // Rendered as an italic note inside the lot (like Odoo's "Ajouter une note").
  bool get isComment => taskId.startsWith('comment_');

  // derived
  // Fournitures carry no labour, so their MO unit price is always 0 — even if a
  // temps value was somehow entered/saved on the line.
  double get moUnitPrice =>
      isFourniture ? 0.0 : tempsHU * tauxHoraire * conditionCoeff;
  // A forfait line carries its whole price in MO so it flows into the totals;
  // fournitures are folded into the flat price, so they're zero here.
  // "À votre charge" / "En attente" lines are never billed → 0.
  double get totalMO => (isBillable && !isComment)
      ? (forfaitEnabled ? forfaitPrice : moUnitPrice * qty)
      : 0.0;
  // Fournitures = the products the user explicitly added to this line. For a
  // normal ouvrage, their count is independent from the ouvrage qty/surface.
  // A standalone fourniture still uses the line qty because that line is only
  // the product.
  double get billedFournituresQty => isFourniture ? qty : fournituresQty;
  double get totalFournitures => (isBillable && !forfaitEnabled && !isComment)
      ? fournituresUnitPrice * billedFournituresQty
      : 0.0;
  double get totalLigne => totalMO + totalFournitures;

  _DevisLine({
    required this.taskId,
    required this.label,
    this.code = '',
    this.famille = '',
    this.unite = 'u',
    this.parentTaskId = '',
    this.qty = 1.0,
    this.tempsHU = 0.0,
    this.tauxHoraire = 0.0,
    this.conditionCoeff = 1.0,
    this.fournituresQty = 0.0,
    this.fournituresUnitPrice = 0.0,
    this.forfaitEnabled = false,
    this.forfaitPrice = 0.0,
    this.hideFournitures = false,
    this.lineType = 'normal',
    this.commentaire = '',
    this.fournisseurId = '',
    this.fournisseurName = '',
  });
}

// ─── Screen ────────────────────────────────────────────────────────────────────
class _FournituresSummary {
  final double qty;
  final double total;

  const _FournituresSummary({
    required this.qty,
    required this.total,
  });

  double get unitPrice => qty > 0 ? total / qty : 0.0;
}

class QuoteDetailScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;

  const QuoteDetailScreen({super.key, required this.data});

  @override
  ConsumerState<QuoteDetailScreen> createState() => _QuoteDetailScreenState();
}

class _QuoteDetailScreenState extends ConsumerState<QuoteDetailScreen> {
  bool _isSaving = false;
  bool _isLoadingDetails = false;

  // Header
  String _companyName = 'Koji';
  String _companyAddress = '8 Av. des artisans, Paris';
  String _companyPhone = '01 42 55 000 77';
  String _companyEmail = 'Contact@Koji.fr';
  String _clientName = 'Client';
  String _clientAddress = '';
  String _clientEmail = '';
  String _quoteNumber = '';
  String _quoteDate = '';
  String _quoteValidity = '30 Jours';
  String _siteAddress = '';
  String? _logoPath;
  double _hourlyRate = 0.0;

  // Legal identification (shown in the devis footer / pied de page)
  String _companySiret = '';
  String _companyRcs = '';
  String _companyTva = '';
  String _companyLegalForm = '';

  // Mandatory work info (lieu = siteAddress; dates editable here)
  String _travauxStart = ''; // date de début des travaux
  String _travauxDuration = ''; // durée des travaux
  final _startCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();

  // Free-form notes / mentions the entrepreneur can edit per devis (conditions
  // de paiement, mentions légales, réserves techniques…). Prefilled with a
  // sensible default; persisted in quote metadata and rendered on the PDF.
  static const String _defaultMentions =
      'Modalités de paiement : 30 % à la signature, solde à la réception.\n'
      'Délai d\'exécution : à convenir avec le client.\n'
      'Devis valable 30 jours. TVA applicable selon la réglementation en vigueur.';
  final _mentionsCtrl = TextEditingController(text: _defaultMentions);

  @override
  void dispose() {
    _startCtrl.dispose();
    _durationCtrl.dispose();
    _mentionsCtrl.dispose();
    super.dispose();
  }

  // KOJI devis lines grouped by room
  // Map<roomId, List<_DevisLine>>
  final Map<String, List<_DevisLine>> _linesByRoom = {};
  final List<String> _roomOrder = [];

  // ─── Récapitulatif (professional "LOT" devis) ──────────────────────────────
  // Each room is rendered as a LOT. Per-devis global percentages applied on the
  // sum of the lot totals, then a selectable TVA rate. Persisted in metadata.
  double _coordPct = 10; // Coordination de chantier
  double _aleasPct = 5; // Provision aléas de chantier
  double _decennalePct = 8; // Assurance décennale
  int _tvaRate = 10; // 10 % rénovation (Art. 279-0 bis CGI) or 20 %
  // Per-lot label override: roomId → {'number': int, 'title': String}.
  final Map<String, Map<String, dynamic>> _lotMeta = {};

  @override
  void initState() {
    super.initState();
    // Provisional number until the backend assigns the real sequential one.
    // Format matches the final "YYYY-NNNN" shape (e.g. 2026-0001).
    _quoteNumber = '${DateTime.now().year}-0001';
    _quoteDate = DateFormat('dd/MM/yyyy').format(DateTime.now());

    // Two ways the recap can be opened with an `id`:
    //   1. Direct deep-link from the quotes list (no fresh tasks map) — must
    //      load room/task rows from the database.
    //   2. Re-entry via the edit-flow seeded from a saved quote — `tasks` is
    //      already populated with the user's edits, and pulling from the DB
    //      again would clobber those edits.
    final tasksMap = widget.data['tasks'];
    final hasFreshTasks = tasksMap is Map && tasksMap.isNotEmpty;
    if (widget.data.containsKey('id') && !hasFreshTasks) {
      _loadExistingQuote();
    } else {
      _initFromProvider();
      // Tout-en-un (demande client) : on arrive directement sur le récap depuis
      // la sélection des pièces, SANS passer par « Créer vos ouvrages ». Les
      // pièces choisies deviennent des lots vides prêts à recevoir ouvrages /
      // fournitures / notes via les boutons du lot.
      _seedEmptyLotsFromSelectedRooms();
      // Reuse the number when editing an existing quote; otherwise assign a
      // fresh sequential DEVIS-YYYY-NNNN number from the backend.
      final existingNumber = widget.data['quoteNumber'] as String?;
      if (existingNumber != null && existingNumber.isNotEmpty) {
        _quoteNumber = existingNumber;
      } else {
        _assignAutoNumber();
      }
    }
    _fetchBusinessInfo();
  }

  // Crée un lot vide par pièce sélectionnée à l'étape précédente, pour les
  // pièces qui n'ont pas déjà de lignes. Permet de tout construire dans le récap
  // (ouvrages, sous-ouvrages, fournitures, notes) sans l'écran intermédiaire.
  void _seedEmptyLotsFromSelectedRooms() {
    final raw = widget.data['roomIds'];
    if (raw is! List) return;
    var number = _roomOrder.length;
    for (final r in raw) {
      final roomId = r?.toString() ?? '';
      if (roomId.isEmpty || _roomOrder.contains(roomId)) continue;
      number++;
      _roomOrder.add(roomId);
      _linesByRoom[roomId] = [];
      _lotMeta.putIfAbsent(
        roomId,
        () => {'number': number, 'title': _getRoomLabel(roomId)},
      );
    }
  }

  Future<void> _assignAutoNumber() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;
    try {
      final number = await ref
          .read(quoteRepositoryProvider)
          .generateNextQuoteNumber(user.id);
      if (mounted) setState(() => _quoteNumber = number);
    } catch (_) {/* keep the timestamp fallback already set */}
  }

  // ── Initialize from new quote flow ──────────────────────────────────────────
  _FournituresSummary _summarizeFournitures(dynamic raw) {
    double qty = 0.0;
    double total = 0.0;

    if (raw is Map) {
      raw.forEach((_, value) {
        if (value is Map) {
          final itemQty = (value['quantity'] as num?)?.toDouble() ?? 1.0;
          final unitPrice = (value['unitPrice'] as num?)?.toDouble() ?? 0.0;
          if (itemQty > 0) {
            qty += itemQty;
            total += itemQty * unitPrice;
          }
        }
      });
    }

    return _FournituresSummary(qty: qty, total: total);
  }

  _FournituresSummary _storedFournituresSummary({
    required Map<String, dynamic> inputs,
    required double taskQty,
    required double storedMaterialUnit,
  }) {
    final selected = _summarizeFournitures(inputs['selectedFournitures']);
    if (selected.total > 0) return selected;

    final storedQty = (inputs['fournituresQty'] as num?)?.toDouble();
    final storedTotal = (inputs['fournituresTotal'] as num?)?.toDouble();
    if (storedQty != null && storedQty > 0) {
      return _FournituresSummary(
        qty: storedQty,
        total: storedTotal ?? storedQty * storedMaterialUnit,
      );
    }

    // Legacy quotes stored a material unit price multiplied by the ouvrage qty.
    final legacyTotal = storedMaterialUnit * taskQty;
    return _FournituresSummary(qty: taskQty, total: legacyTotal);
  }

  void _initFromProvider() {
    final tasks = widget.data['tasks'] as Map<String, dynamic>?;
    if (tasks == null) return;

    final client = widget.data['client'] as Map<String, dynamic>?;
    if (client != null) {
      _clientName = client['name'] ?? _clientName;
      _clientAddress = client['address'] ?? _clientAddress;
      _clientEmail = client['email'] ?? _clientEmail;
    }
    _siteAddress = widget.data['siteAddress'] ?? '';

    tasks.forEach((roomId, roomTasksRaw) {
      if (roomTasksRaw is! Map) return;
      final roomTasks = roomTasksRaw as Map<String, dynamic>;
      final lines = <_DevisLine>[];

      roomTasks.forEach((_, taskDataRaw) {
        if (taskDataRaw is! Map) return;
        final td = taskDataRaw as Map<String, dynamic>;

        final qty = (td['quantity'] as num?)?.toDouble() ?? 1.0;
        final inputs = (td['inputs'] is Map)
            ? Map<String, dynamic>.from(td['inputs'] as Map)
            : <String, dynamic>{};
        final selectedFournitures =
            _summarizeFournitures(td['selectedFournitures']);
        final storedFournitures = _storedFournituresSummary(
          inputs: {
            ...inputs,
            if (td['fournituresQty'] != null)
              'fournituresQty': td['fournituresQty'],
            if (td['fournituresTotal'] != null)
              'fournituresTotal': td['fournituresTotal'],
          },
          taskQty: qty,
          storedMaterialUnit:
              (td['fournituresUnitPrice'] as num?)?.toDouble() ?? 0.0,
        );
        final fournitures = selectedFournitures.total > 0
            ? selectedFournitures
            : storedFournitures;

        final forfaitEnabled = td['forfaitEnabled'] == true;
        final forfaitPrice = (td['forfaitPrice'] as num?)?.toDouble() ?? 0.0;

        lines.add(_DevisLine(
          taskId: td['taskId']?.toString() ?? '',
          label: td['label']?.toString() ?? '',
          code: td['code']?.toString() ?? '',
          famille: td['famille']?.toString() ?? '',
          unite: td['unite']?.toString() ?? 'u',
          parentTaskId: td['parentTaskId']?.toString() ?? '',
          qty: qty,
          tempsHU: (td['hours'] as num?)?.toDouble() ?? 0.0,
          tauxHoraire: (td['tauxHoraire'] as num?)?.toDouble() ?? _hourlyRate,
          conditionCoeff: (td['conditionCoeff'] as num?)?.toDouble() ?? 1.0,
          fournituresQty: fournitures.qty,
          fournituresUnitPrice: fournitures.unitPrice,
          forfaitEnabled: forfaitEnabled,
          forfaitPrice: forfaitPrice,
          hideFournitures: td['hideFournitures'] == true,
          lineType: td['lineType']?.toString() ?? 'normal',
          commentaire: td['commentaire']?.toString() ??
              inputs['commentaire']?.toString() ??
              '',
          fournisseurId: td['fournisseurId']?.toString() ??
              inputs['fournisseurId']?.toString() ??
              '',
          fournisseurName: td['fournisseurName']?.toString() ??
              inputs['fournisseurName']?.toString() ??
              '',
        ));
      });

      if (lines.isNotEmpty) {
        _linesByRoom[roomId] = lines;
        _roomOrder.add(roomId);
      }
    });
  }

  // ── Load existing saved quote ────────────────────────────────────────────────
  void _loadExistingQuote() {
    final d = widget.data;
    _quoteNumber = d['quoteNumber'] ?? _quoteNumber;
    _quoteDate = d['date'] ?? _quoteDate;
    _quoteValidity = d['validity'] ?? _quoteValidity;
    final savedMentions = d['mentions'] as String?;
    if (savedMentions != null && savedMentions.trim().isNotEmpty) {
      _mentionsCtrl.text = savedMentions;
    }

    Map<String, dynamic> safe(dynamic v) {
      if (v is Map<String, dynamic>) return v;
      if (v is Map) return Map<String, dynamic>.from(v);
      return {};
    }

    final client = safe(d['client']);
    _clientName = client['name'] ?? '';
    _clientAddress = client['address'] ?? '';
    _clientEmail = client['email'] ?? '';

    final company = safe(d['company']);
    _companyName = company['name'] ?? _companyName;
    _companyAddress = company['address'] ?? _companyAddress;
    _companyPhone = company['phone'] ?? _companyPhone;
    _companyEmail = company['email'] ?? _companyEmail;
    _companySiret = company['siret'] ?? _companySiret;
    _companyRcs = company['rcs'] ?? _companyRcs;
    _companyTva = company['tva'] ?? _companyTva;
    _companyLegalForm = company['formeJuridique'] ?? _companyLegalForm;
    _siteAddress = d['siteAddress'] ?? '';
    _travauxStart = d['travauxStart'] ?? '';
    _travauxDuration = d['travauxDuration'] ?? '';
    _startCtrl.text = _travauxStart;
    _durationCtrl.text = _travauxDuration;

    // Récapitulatif config (global % + TVA + per-lot labels) from metadata.
    final recap = safe(d['recap']);
    _coordPct = (recap['coordPct'] as num?)?.toDouble() ?? _coordPct;
    _aleasPct = (recap['aleasPct'] as num?)?.toDouble() ?? _aleasPct;
    _decennalePct =
        (recap['decennalePct'] as num?)?.toDouble() ?? _decennalePct;
    _tvaRate = (recap['tvaRate'] as num?)?.toInt() ?? _tvaRate;
    final lots = safe(d['lots']);
    lots.forEach((roomId, meta) {
      _lotMeta[roomId] = safe(meta);
    });

    setState(() => _isLoadingDetails = true);
    _fetchDetails(d['id'] as String);
  }

  Future<void> _fetchDetails(String quoteId) async {
    try {
      final repo = ref.read(quoteTaskRepositoryProvider);
      final roomsData = await repo.getQuoteRooms(quoteId);

      for (final r in roomsData) {
        final roomId = r['name'] as String;
        _roomOrder.add(roomId);
        _linesByRoom[roomId] = [];

        final tasksData = await repo.getQuoteTasks(r['id'] as String);
        for (final t in tasksData) {
          // The `inputs` JSON keeps the editable fields the user originally
          // entered (qty, tempsHU, tauxHoraire, code, famille, unite). Without
          // it the recap would silently reset every line to qty:1, hiding the
          // user's edits and making "Mettre à jour" look like a no-op.
          final inputs = (t['inputs'] is Map)
              ? Map<String, dynamic>.from(t['inputs'] as Map)
              : <String, dynamic>{};

          final qty = (inputs['quantity'] as num?)?.toDouble() ?? 1.0;
          final moUnit = (t['unit_price_ht'] as num?)?.toDouble() ?? 0.0;
          final fournUnit = (t['total_price_ht'] as num?)?.toDouble() ?? 0.0;
          final fournitures = _storedFournituresSummary(
            inputs: inputs,
            taskQty: qty,
            storedMaterialUnit: fournUnit,
          );
          final tauxHoraire = (inputs['tauxHoraire'] as num?)?.toDouble() ??
              (_hourlyRate > 0 ? _hourlyRate : 0.0);
          final forfaitEnabled = inputs['forfaitEnabled'] == true;
          // On a forfait line the flat price was saved into unit_price_ht (moUnit).
          final forfaitPrice = (inputs['forfaitPrice'] as num?)?.toDouble() ??
              (forfaitEnabled ? moUnit : 0.0);

          double tempsHU = (inputs['tempsHU'] as num?)?.toDouble() ?? 0.0;
          if (!forfaitEnabled && tempsHU == 0 && tauxHoraire > 0) {
            tempsHU = moUnit / tauxHoraire;
          }

          _linesByRoom[roomId]!.add(_DevisLine(
            taskId: t['task_id']?.toString() ?? '',
            label: t['label']?.toString() ?? '',
            code: inputs['code']?.toString() ?? '',
            famille: inputs['famille']?.toString() ?? '',
            unite: inputs['unite']?.toString() ?? 'u',
            parentTaskId: inputs['parentTaskId']?.toString() ?? '',
            qty: qty,
            tempsHU: tempsHU,
            tauxHoraire: tauxHoraire,
            fournituresQty: forfaitEnabled ? 0.0 : fournitures.qty,
            fournituresUnitPrice: forfaitEnabled ? 0.0 : fournitures.unitPrice,
            forfaitEnabled: forfaitEnabled,
            forfaitPrice: forfaitPrice,
            hideFournitures: inputs['hideFournitures'] == true,
            lineType: inputs['lineType']?.toString() ?? 'normal',
            commentaire: inputs['commentaire']?.toString() ?? '',
            fournisseurId: inputs['fournisseurId']?.toString() ?? '',
            fournisseurName: inputs['fournisseurName']?.toString() ?? '',
          ));
        }
      }
    } catch (e) {
      debugPrint('Error loading quote: $e');
    } finally {
      if (mounted) setState(() => _isLoadingDetails = false);
    }
  }

  Future<void> _fetchBusinessInfo() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;
    final userData = await ref.read(userRepositoryProvider).getUser(user.id);
    if (userData == null || !mounted) return;

    final logoUrl = userData['logo_url'] as String?;
    final biz = userData['business_info'] as Map<String, dynamic>?;

    setState(() {
      _logoPath = logoUrl;
      if (biz != null) {
        _companyName = biz['raisonSociale'] ?? _companyName;
        _companyAddress = biz['address'] ?? _companyAddress;
        _companyPhone = biz['phone'] ?? _companyPhone;
        _companyEmail = biz['emailPro'] ?? _companyEmail;
        _companySiret = biz['siret'] ?? _companySiret;
        _companyRcs = biz['rcs'] ?? _companyRcs;
        _companyTva = biz['tva'] ?? _companyTva;
        _companyLegalForm = biz['formeJuridique'] ?? _companyLegalForm;
        final daily = (biz['dailyRate'] as num?)?.toDouble() ?? 0.0;
        final hpd = (biz['hoursPerDay'] as num?)?.toDouble() ?? 8.0;
        if (daily > 0 && hpd > 0) {
          _hourlyRate = daily / hpd;
          // Backfill tauxHoraire on lines that still have 0
          for (final lines in _linesByRoom.values) {
            for (final l in lines) {
              if (l.tauxHoraire == 0) l.tauxHoraire = _hourlyRate;
            }
          }
        }
      }
    });
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  double get _grandTotalMO =>
      _linesByRoom.values.expand((l) => l).fold(0.0, (s, l) => s + l.totalMO);

  double get _grandTotalFournitures => _linesByRoom.values
      .expand((l) => l)
      .fold(0.0, (s, l) => s + l.totalFournitures);

  /// HT of a single lot (room) = its MO + billed fournitures (charge/attente
  /// lines contribute 0 via the line getters).
  double _lotTotalHT(String roomId) =>
      (_linesByRoom[roomId] ?? const []).fold(0.0, (s, l) => s + l.totalLigne);

  /// Sum of all lot totals (before global %).
  double get _subtotalLots => _grandTotalMO + _grandTotalFournitures;

  // Global provisions, computed on the lot subtotal (editable percentages).
  double get _coordAmount => _subtotalLots * _coordPct / 100;
  double get _aleasAmount => _subtotalLots * _aleasPct / 100;
  double get _decennaleAmount => _subtotalLots * _decennalePct / 100;

  /// TOTAL GÉNÉRAL H.T. = lots + the three provisions.
  double get _grandTotalGeneralHT =>
      _subtotalLots + _coordAmount + _aleasAmount + _decennaleAmount;

  double get _tvaAmount => _grandTotalGeneralHT * _tvaRate / 100;
  double get _grandTotalTTC => _grandTotalGeneralHT + _tvaAmount;

  // ── Save ─────────────────────────────────────────────────────────────────────
  Future<void> _generateQuote() async {
    if (_isSaving) return;
    setState(() => _isSaving = true);

    final user = ref.read(authProvider).value;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Utilisateur non connecté')));
      setState(() => _isSaving = false);
      return;
    }

    final quoteData = _buildQuoteData();
    final existingId = widget.data['id'] as String?;

    // Server-side plan-limit gate (see supabase/migrations/0006_subscription_plans.sql):
    // creating a brand-new devis is checked against the plan's monthly quote
    // count; a manual save on an already-created devis is checked against the
    // trial's one-quote/10-edits cap. Both are no-ops (allowed: true) for
    // paid/unlimited plans and for users past the trial.
    final limits = ref.read(planLimitsProvider);
    final limitResult = existingId == null
        ? await limits.canCreateQuote()
        : await limits.canSaveQuote(existingId);
    if (!limitResult.allowed) {
      if (mounted) {
        setState(() => _isSaving = false);
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Limite atteinte'),
            content: Text(limitResult.reason ??
                'Passez à une formule supérieure pour continuer.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Fermer'),
              ),
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const PaywallScreen()),
                  );
                },
                child: const Text('Voir les formules'),
              ),
            ],
          ),
        );
      }
      return;
    }

    try {
      final quoteId = await ref
          .read(quoteRepositoryProvider)
          .saveQuote(user.id, quoteData, quoteId: existingId);

      if (mounted) {
        ref.read(quoteCreationProvider.notifier).reset();
        if (existingId != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Devis mis à jour'),
              backgroundColor: Color(0xFF15803D),
            ),
          );
        }
        context.go('/quote/success', extra: {
          'quoteId': quoteId,
          'quoteData': {...quoteData, 'id': quoteId},
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  // Construit la map `quoteData` (sans enregistrer) — réutilisée par
  // l'enregistrement ET l'aperçu PDF, pour un rendu identique.
  Map<String, dynamic> _buildQuoteData() {
    // Convert lines back to ExpenseItem format for saving
    final expensesMap = <String, List<Map<String, dynamic>>>{};
    // tasksMap.<room>.<taskId>.inputs is what the repo persists into
    // quote_tasks.inputs — the recap reads it back on next open, so the
    // editable fields must round-trip through here or "Mettre à jour" loses them.
    final tasksMap = <String, Map<String, Map<String, dynamic>>>{};

    // When the user came in via the full edit-flow (room→tasks→recap),
    // the provider holds the rich per-task state (selectedFournitures,
    // selectedProducts, note, photoPaths) that the recap's _DevisLine
    // doesn't track. Merge it back so update doesn't drop fournitures.
    final providerTasks = ref.read(quoteCreationProvider).roomTasks;
    _linesByRoom.forEach((roomId, lines) {
      expensesMap[roomId] = lines
          .map((l) => {
                'id': l.taskId,
                'title': l.label,
                // Forfait: the whole flat price rides in laborCost at qty 1, with no
                // fournitures — matches how room_task_screen emits a forfait line.
                'laborCost': l.forfaitEnabled ? l.forfaitPrice : l.moUnitPrice,
                'materialCost': l.forfaitEnabled ? 0.0 : l.fournituresUnitPrice,
                'materialQuantity':
                    l.forfaitEnabled ? 0.0 : l.billedFournituresQty,
                'quantity': l.forfaitEnabled ? 1.0 : l.qty,
                'unite': l.unite,
                'code': l.code,
                'famille': l.famille,
                'tempsHU': l.forfaitEnabled ? 0.0 : l.tempsHU,
                'tauxHoraire': l.forfaitEnabled ? 0.0 : l.tauxHoraire,
                // Standalone fourniture vs ouvrage, and the special line types — the
                // PDF needs these to split MO/Fournitures and render à charge/en attente.
                'isFourniture': l.isFourniture,
                'hideFournitures': l.hideFournitures,
                'lineType': l.lineType,
                'commentaire': l.commentaire,
                'fournisseurId': l.fournisseurId,
                'fournisseurName': l.fournisseurName,
                'isComment': l.isComment,
              })
          .toList();
      final perRoomProvider = (providerTasks[roomId] is Map)
          ? Map<String, dynamic>.from(providerTasks[roomId] as Map)
          : <String, dynamic>{};

      tasksMap[roomId] = {
        for (final l in lines)
          l.taskId: () {
            final prior = (perRoomProvider[l.taskId] is Map)
                ? Map<String, dynamic>.from(perRoomProvider[l.taskId] as Map)
                : <String, dynamic>{};
            final priorInputs = (prior['inputs'] is Map)
                ? Map<String, dynamic>.from(prior['inputs'] as Map)
                : <String, dynamic>{};
            final selectedFournitures = (prior['selectedFournitures'] is Map)
                ? Map<String, dynamic>.from(prior['selectedFournitures'] as Map)
                : <String, dynamic>{};
            if (!l.forfaitEnabled &&
                selectedFournitures.length == 1 &&
                l.billedFournituresQty > 0) {
              final key = selectedFournitures.keys.first;
              final item = selectedFournitures[key];
              if (item is Map) {
                selectedFournitures[key] = {
                  ...Map<String, dynamic>.from(item),
                  'quantity': l.billedFournituresQty,
                };
              }
            }
            // Recap-level edits win; preserve everything else from the
            // earlier edit-flow state so fournitures/products/notes survive.
            return <String, dynamic>{
              ...prior,
              'taskId': l.taskId,
              'label': l.label,
              'selectedFournitures': selectedFournitures,
              'inputs': {
                ...priorInputs,
                'quantity': l.qty,
                'tempsHU': l.tempsHU,
                'tauxHoraire': l.tauxHoraire,
                'unite': l.unite,
                'code': l.code,
                'famille': l.famille,
                'parentTaskId': l.parentTaskId,
                'forfaitEnabled': l.forfaitEnabled,
                'forfaitPrice': l.forfaitPrice,
                'fournituresQty': l.billedFournituresQty,
                'fournituresUnitPrice': l.fournituresUnitPrice,
                'fournituresTotal': l.totalFournitures,
                'hideFournitures': l.hideFournitures,
                'lineType': l.lineType,
                'commentaire': l.commentaire,
                'fournisseurId': l.fournisseurId,
                'fournisseurName': l.fournisseurName,
              },
              'hours': l.tempsHU,
              'quantity': l.qty,
              'tauxHoraire': l.tauxHoraire,
              'unite': l.unite,
              'code': l.code,
              'famille': l.famille,
              'parentTaskId': l.parentTaskId,
              'lineType': l.lineType,
              'commentaire': l.commentaire,
              'fournisseurId': l.fournisseurId,
              'fournisseurName': l.fournisseurName,
              'forfaitEnabled': l.forfaitEnabled,
              'forfaitPrice': l.forfaitPrice,
              'fournituresQty': l.billedFournituresQty,
              'fournituresUnitPrice': l.fournituresUnitPrice,
              'fournituresTotal': l.totalFournitures,
              'hideFournitures': l.hideFournitures,
            };
          }(),
      };
    });

    // The chantier this devis belongs to. When the flow started from a chantier
    // (chantier_devis_screen → _createDevis → setChantierId), the id lives in the
    // creation provider. Editing an existing devis carries it in widget.data.
    // Without this, saveQuote auto-creates an *orphan* chantier and the devis
    // tasks never surface under the real chantier (planner/dashboard show none).
    final effectiveChantierId = (widget.data['chantier_id'] as String?) ??
        ref.read(quoteCreationProvider).chantierId;

    final quoteData = {
      'quoteNumber': _quoteNumber,
      'createdAt': DateTime.now().toIso8601String(),
      'validity': _quoteValidity,
      'date': _quoteDate,
      'client': {
        'name': _clientName,
        'address': _clientAddress,
        'email': _clientEmail
      },
      'company': {
        'name': _companyName,
        'address': _companyAddress,
        'phone': _companyPhone,
        'email': _companyEmail,
        'siret': _companySiret,
        'rcs': _companyRcs,
        'tva': _companyTva,
        'formeJuridique': _companyLegalForm,
        // Public logo URL so the client signature website can show the
        // entreprise's real logo instead of the default Koji mark.
        'logo': _logoPath,
      },
      'siteAddress': _siteAddress,
      'travauxStart': _startCtrl.text.trim(),
      'travauxDuration': _durationCtrl.text.trim(),
      'mentions': _mentionsCtrl.text.trim(),
      'expenses': expensesMap,
      'tasks': tasksMap,
      // Per-lot HT (roomId → € HT) so the PDF récapitulatif can list each lot.
      'lotTotals': {
        for (final roomId in _roomOrder) roomId: _lotTotalHT(roomId),
      },
      'totals': {
        'moHT': _grandTotalMO,
        'fournituresHT': _grandTotalFournitures,
        'subtotalLots': _subtotalLots,
        'coordPct': _coordPct,
        'coordAmount': _coordAmount,
        'aleasPct': _aleasPct,
        'aleasAmount': _aleasAmount,
        'decennalePct': _decennalePct,
        'decennaleAmount': _decennaleAmount,
        // 'ht' is the TOTAL GÉNÉRAL HT (lots + provisions) — the figure shown on
        // the devis and stored in quotes.total_ht.
        'ht': _grandTotalGeneralHT,
        'tvaRate': _tvaRate,
        'tva': _tvaAmount,
        'ttc': _grandTotalTTC,
      },
      // Récapitulatif config + per-lot labels, persisted in quote metadata.
      'recap': {
        'coordPct': _coordPct,
        'aleasPct': _aleasPct,
        'decennalePct': _decennalePct,
        'tvaRate': _tvaRate,
      },
      'lots': {
        for (final entry in _lotMeta.entries) entry.key: entry.value,
      },
      if (effectiveChantierId != null) 'chantier_id': effectiveChantierId,
    };

    return quoteData;
  }

  // ── Aperçu PDF : génère le devis (sans enregistrer) et l'ouvre en aperçu ────
  Future<void> _previewPdf() async {
    try {
      final quoteData = _buildQuoteData();
      // Le service charge le logo depuis logoPath si besoin (réseau).
      final doc = await DevisPdfService().generate(
        quoteData: quoteData,
        logoPath: _logoPath,
      );
      final Uint8List bytes = await doc.save();
      await Printing.layoutPdf(
        onLayout: (_) async => bytes,
        name: 'Devis_$_quoteNumber.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erreur lors de l\'aperçu : $e')));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
              color: Color(0xFFF1F5F9), shape: BoxShape.circle),
          child: IconButton(
            icon: const Icon(Icons.arrow_back,
                color: Color(0xFF0F172A), size: 20),
            onPressed: () => context.pop(),
          ),
        ),
        centerTitle: true,
        title: const Text(
          'Récapitulatif de votre devis',
          style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 17,
              color: Color(0xFF0F172A)),
        ),
        actions: [
          // Aperçu PDF — voir le devis tel qu'il sera, avant de le générer.
          Container(
            margin: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9), shape: BoxShape.circle),
            child: IconButton(
              icon: const Icon(Icons.visibility_outlined,
                  color: Color(0xFF0F172A), size: 20),
              tooltip: 'Aperçu PDF',
              onPressed: _previewPdf,
            ),
          ),
          // Discussion with the client — only meaningful once the devis exists
          // (has an id), since messages are keyed by quote id.
          if ((widget.data['id'] as String?)?.isNotEmpty == true)
            Container(
              margin: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9), shape: BoxShape.circle),
              child: IconButton(
                icon: const Icon(Icons.forum_outlined,
                    color: Color(0xFF0F172A), size: 20),
                tooltip: 'Discussion',
                onPressed: () => context.push('/quote/messages', extra: {
                  'quoteId': widget.data['id'],
                  'clientName': _clientName,
                }),
              ),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(0xFFE2E8F0)),
        ),
      ),
      body: _isLoadingDetails
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Info banner ───────────────────────────────────────
                  _buildInfoBanner(),
                  const SizedBox(height: 20),

                  // ── Header card ───────────────────────────────────────
                  _buildHeaderCard(),
                  const SizedBox(height: 16),

                  // ── Travaux (mandatory legal info) ────────────────────
                  _buildTravauxCard(),
                  const SizedBox(height: 24),

                  // ── KOJI devis table ──────────────────────────────────
                  if (_linesByRoom.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: Text(
                            'Aucun lot. Ajoutez un lot pour commencer.',
                            style: TextStyle(color: Color(0xFF9CA3AF))),
                      ),
                    )
                  else
                    ..._roomOrder.where((r) => _linesByRoom.containsKey(r)).map(
                          (roomId) => _buildRoomSection(roomId),
                        ),

                  // ── Ajouter un lot (pièce / zone / phase) ─────────────
                  _buildAddLotButton(),

                  const SizedBox(height: 24),

                  // ── Grand totals ──────────────────────────────────────
                  _buildTotalsCard(),
                  const SizedBox(height: 24),

                  // ── Notes & mentions (editable) ───────────────────────
                  _buildMentionsCard(),
                ],
              ),
            ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  // ── Notes & mentions (editable per devis) ───────────────────────────────────
  Widget _buildMentionsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.notes_outlined, size: 18, color: Color(0xFF0F172A)),
              SizedBox(width: 8),
              Text('Notes & mentions',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Conditions de paiement, délais, validité, réserves… Ce texte apparaît sur le devis.',
            style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _mentionsCtrl,
            maxLines: null,
            minLines: 4,
            keyboardType: TextInputType.multiline,
            style: const TextStyle(fontSize: 13, color: Color(0xFF334155)),
            decoration: InputDecoration(
              hintText: 'Saisissez vos mentions personnalisées…',
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.all(12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF0F172A)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Info banner ───────────────────────────────────────────────────────────────
  Widget _buildInfoBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF86EFAC)),
      ),
      child: Row(
        children: [
          const Icon(Icons.edit_note, size: 16, color: Color(0xFF16A34A)),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Choisissez le mode de chaque ligne : « Calculé » (Qté × Temps × tarif) ou « Forfait » (prix fixe saisi dans Prix HT). Les totaux se recalculent en temps réel.',
              style: TextStyle(fontSize: 12, color: Color(0xFF15803D)),
            ),
          ),
          if (_hourlyRate > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '${_hourlyRate.toStringAsFixed(2)} €/h',
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF166534)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Header card ───────────────────────────────────────────────────────────────
  // ── Édition de l'en-tête : entreprise, client, dates, lieu d'exécution ──────
  Future<void> _editHeader() async {
    final nameC = TextEditingController(text: _companyName);
    final addrC = TextEditingController(text: _companyAddress);
    final phoneC = TextEditingController(text: _companyPhone);
    final emailC = TextEditingController(text: _companyEmail);
    final siretC = TextEditingController(text: _companySiret);
    final rcsC = TextEditingController(text: _companyRcs);
    final tvaC = TextEditingController(text: _companyTva);
    final clientNameC = TextEditingController(text: _clientName);
    final clientAddrC = TextEditingController(text: _clientAddress);
    final clientEmailC = TextEditingController(text: _clientEmail);
    final siteC = TextEditingController(text: _siteAddress);
    final validityC = TextEditingController(text: _quoteValidity);

    Widget field(String label, TextEditingController c,
            {TextInputType? kb}) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextField(
            controller: c,
            keyboardType: kb,
            decoration: InputDecoration(
              labelText: label,
              isDense: true,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
          ),
        );

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Modifier l\'en-tête',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                    // Logo
                    GestureDetector(
                      onTap: () async {
                        await _pickAndUploadLogo();
                        setLocal(() {});
                      },
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          image: _logoPath != null
                              ? DecorationImage(
                                  image: NetworkImage(_logoPath!),
                                  fit: BoxFit.cover)
                              : null,
                        ),
                        child: _logoPath == null
                            ? const Icon(Icons.add_a_photo_outlined,
                                size: 20, color: Color(0xFF64748B))
                            : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text('ENTREPRISE',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B))),
                const SizedBox(height: 8),
                field('Nom de l\'entreprise', nameC),
                field('Adresse', addrC),
                field('Téléphone', phoneC, kb: TextInputType.phone),
                field('Email', emailC, kb: TextInputType.emailAddress),
                field('SIRET', siretC),
                field('RCS / SIREN', rcsC),
                field('N° TVA', tvaC),
                const SizedBox(height: 6),
                const Text('CLIENT',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B))),
                const SizedBox(height: 8),
                field('Nom du client', clientNameC),
                field('Adresse du client', clientAddrC),
                field('Email du client', clientEmailC,
                    kb: TextInputType.emailAddress),
                const SizedBox(height: 6),
                const Text('DEVIS',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B))),
                const SizedBox(height: 8),
                field('Lieu d\'exécution', siteC),
                field('Validité', validityC),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Annuler'),
                      ),
                    ),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F172A),
                          foregroundColor: Colors.white,
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Enregistrer'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (ok != true) return;
    setState(() {
      _companyName = nameC.text.trim();
      _companyAddress = addrC.text.trim();
      _companyPhone = phoneC.text.trim();
      _companyEmail = emailC.text.trim();
      _companySiret = siretC.text.trim();
      _companyRcs = rcsC.text.trim();
      _companyTva = tvaC.text.trim();
      _clientName = clientNameC.text.trim().isEmpty
          ? _clientName
          : clientNameC.text.trim();
      _clientAddress = clientAddrC.text.trim();
      _clientEmail = clientEmailC.text.trim();
      _siteAddress = siteC.text.trim();
      _quoteValidity = validityC.text.trim().isEmpty
          ? _quoteValidity
          : validityC.text.trim();
    });
  }

  // Choisit un logo dans la galerie et l'upload — met à jour _logoPath.
  Future<void> _pickAndUploadLogo() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;
    try {
      final img =
          await ImagePicker().pickImage(source: ImageSource.gallery);
      if (img == null) return;
      final url = await ref
          .read(userRepositoryProvider)
          .uploadBusinessLogo(user.id, img.path);
      if (url != null && mounted) setState(() => _logoPath = url);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erreur logo : $e')));
      }
    }
  }

  Widget _buildHeaderCard() {
    return InkWell(
      onTap: _editHeader,
      borderRadius: BorderRadius.circular(16),
      child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        children: [
          // Indice d'édition : tout l'en-tête est modifiable au tap.
          const Row(
            children: [
              Spacer(),
              Icon(Icons.edit_outlined, size: 15, color: Color(0xFF94A3B8)),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Logo
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _logoPath != null
                      ? Colors.white
                      : const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(10),
                  image: _logoPath != null
                      ? DecorationImage(
                          image: NetworkImage(_logoPath!), fit: BoxFit.cover)
                      : null,
                ),
                child: _logoPath == null
                    ? Icon(
                        Icons.business,
                        color: Theme.of(context).colorScheme.surface,
                        size: 22,
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_companyName,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: Color(0xFF0F172A))),
                    const SizedBox(height: 2),
                    Text(_companyAddress,
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFF6B7280))),
                    Text(_companyPhone,
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFF6B7280))),
                  ],
                ),
              ),
              // Quote number box
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3E5D8),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: [
                    const Text('DEVIS N°',
                        style:
                            TextStyle(fontSize: 8, color: Color(0xFFA18B73))),
                    Text(_quoteNumber,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                            color: Color(0xFF0F172A))),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF3F4F6)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('CLIENT',
                      style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFA18B73))),
                  const SizedBox(height: 4),
                  Text(_clientName,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: Color(0xFF0F172A))),
                  if (_clientAddress.isNotEmpty)
                    Text(_clientAddress,
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFF6B7280))),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('DATE',
                      style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFA18B73))),
                  Text(_quoteDate,
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0F172A))),
                  const SizedBox(height: 4),
                  const Text('VALIDITÉ',
                      style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFA18B73))),
                  Text(_quoteValidity,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF0F172A))),
                ],
              ),
            ],
          ),
          if (_siteAddress.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBF6),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF3E5D8)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.location_on_outlined,
                      size: 14, color: Color(0xFFA18B73)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_siteAddress,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0F172A))),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      ),
    );
  }

  // ── Travaux card: lieu (read-only) + dates (editable, mandatory mentions) ─────
  Widget _buildTravauxCard() {
    final lieu = _siteAddress.isNotEmpty ? _siteAddress : _clientAddress;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('TRAVAUX',
              style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFA18B73))),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.place_outlined,
                  size: 14, color: Color(0xFF6B7280)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  lieu.isNotEmpty
                      ? 'Lieu d\'exécution : $lieu'
                      : 'Lieu d\'exécution : —',
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF0F172A)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _startCtrl,
                  keyboardType: TextInputType.datetime,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Date de début',
                    hintText: 'jj/mm/aaaa',
                    isDense: true,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _durationCtrl,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Durée des travaux',
                    hintText: 'ex : 3 semaines',
                    isDense: true,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Room section ──────────────────────────────────────────────────────────────
  // ── Édition rapide depuis le récapitulatif (logique type Odoo) ─────────────
  // Toutes les insertions placent la nouvelle ligne EN HAUT du lot (index 0) et
  // déclenchent un setState : la ligne ajoutée est donc immédiatement visible,
  // jamais « cachée au milieu » comme le signalait le client.

  int _idSeed = 0;
  String _newId(String prefix) {
    _idSeed++;
    return '${prefix}_${DateTime.now().millisecondsSinceEpoch}_$_idSeed';
  }

  void _insertLineAtTop(String roomId, _DevisLine line) {
    setState(() {
      final lines = _linesByRoom.putIfAbsent(roomId, () => []);
      if (!_roomOrder.contains(roomId)) _roomOrder.add(roomId);
      lines.insert(0, line);
    });
  }

  void _removeLine(String roomId, _DevisLine line) {
    setState(() {
      final lines = _linesByRoom[roomId];
      if (lines == null) return;
      // Détacher d'éventuels sous-ouvrages pour ne pas les rendre orphelins.
      for (final l in lines) {
        if (l.parentTaskId == line.taskId) l.parentTaskId = '';
      }
      lines.remove(line);
      if (lines.isEmpty) {
        _linesByRoom.remove(roomId);
        _roomOrder.remove(roomId);
      }
    });
  }

  void _snack(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? const Color(0xFFB91C1C) : const Color(0xFF15803D),
    ));
  }

  // ── Ajouter / créer un LOT (pièce, zone, phase…) ───────────────────────────
  Future<void> _addLot() async {
    final titleCtrl = TextEditingController();
    final defaultNumber = _roomOrder.length + 1;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nouveau lot'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Un lot peut regrouper un type de travaux, une pièce, une zone ou une phase de chantier.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: titleCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Titre du lot',
                hintText: 'Ex. Peinture, Salle de bain, Phase 1…',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Créer')),
        ],
      ),
    );
    if (ok != true) return;
    final title = titleCtrl.text.trim();
    if (title.isEmpty) {
      _snack('Titre du lot requis', error: true);
      return;
    }
    final roomId = _newId('lot');
    setState(() {
      // Nouveau lot inséré EN HAUT pour rester visible immédiatement.
      _roomOrder.insert(0, roomId);
      _linesByRoom[roomId] = [];
      _lotMeta[roomId] = {'number': defaultNumber, 'title': title};
    });
    _snack('Lot « $title » créé');
  }

  // ── Ajouter un commentaire / une note dans un lot ──────────────────────────
  Future<void> _addComment(String roomId) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ajouter un commentaire'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Note visible sur le devis…',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Ajouter')),
        ],
      ),
    );
    if (ok != true) return;
    final text = ctrl.text.trim();
    if (text.isEmpty) return;
    _insertLineAtTop(
      roomId,
      _DevisLine(
        taskId: _newId('comment'),
        label: text,
        commentaire: text,
        qty: 0,
      ),
    );
    _snack('Commentaire ajouté');
  }

  // ── Ajouter un ouvrage depuis l'historique (bibliothèque) ──────────────────
  // Reste DANS le contexte du devis : on n'ouvre PAS l'écran bibliothèque, on
  // propose une feuille « Historique ouvrage » et on insère le choix en haut du
  // lot. Le nouvel ouvrage n'est PAS relié automatiquement à la bibliothèque.
  // Sélecteur d'ouvrage commun aux 3 sources (Historique / Créer / Bibliothèque)
  // — réutilisé par "Ouvrage" et "Sous-ouvrage". Pour la Bibliothèque, on
  // applique le prompt coefficient/réduction comme l'ancien écran "Créer vos
  // ouvrages", et on renvoie un LibraryOuvrage avec le temps effectif.
  Future<LibraryOuvrage?> _pickOuvrage() async {
    return showModalBottomSheet<LibraryOuvrage>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _OuvrageHistorySheet(
        onCreateBlank: () async {
          final created = await _promptNewOuvrage();
          if (!mounted) return;
          if (created != null) Navigator.pop(context, created);
        },
        onOpenLibrary: () async {
          final picked = await Navigator.push<LibraryOuvrage>(
            context,
            MaterialPageRoute(
              builder: (_) => const OuvrageLibraryScreen(pickMode: true),
            ),
          );
          if (!mounted) return;
          if (picked == null) {
            Navigator.pop(context); // referme la feuille sans sélection
            return;
          }
          final adjusted = await _askCoefficientReduction(picked);
          if (!mounted) return;
          Navigator.pop(context, adjusted ?? picked);
        },
      ),
    );
  }

  // Prompt coefficient (×) et réduction (%) appliqués au temps de l'ouvrage,
  // identique à l'ancien écran. Renvoie un LibraryOuvrage au temps effectif.
  Future<LibraryOuvrage?> _askCoefficientReduction(LibraryOuvrage o) async {
    final coeffCtrl = TextEditingController(
        text: (o.coefficient == 0 ? 1.0 : o.coefficient).toString());
    final reducCtrl = TextEditingController(text: '0');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(o.designation, style: const TextStyle(fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Ajustez le coefficient et la réduction pour ce chantier. '
              'Le temps de base reste celui de la bibliothèque.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: coeffCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Coefficient (×)'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: reducCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Réduction (%)'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Ajouter')),
        ],
      ),
    );
    if (ok != true) return null;
    final coeff = double.tryParse(coeffCtrl.text.replaceAll(',', '.')) ?? 1.0;
    final reduc = double.tryParse(reducCtrl.text.replaceAll(',', '.')) ?? 0.0;
    final effectiveTemps = o.tempsHU * coeff * (1 - (reduc / 100.0));
    // Coefficient déjà intégré dans le temps effectif → on le neutralise (1.0).
    return o.copyWith(tempsHU: effectiveTemps, coefficient: 1.0, reduction: 0.0);
  }

  Future<void> _addOuvrageToLot(String roomId) async {
    final selected = await _pickOuvrage();
    if (selected == null) return;
    final coeff = selected.coefficient == 0 ? 1.0 : selected.coefficient;
    _insertLineAtTop(
      roomId,
      _DevisLine(
        // ID propre au devis : pas de lien automatique vers la bibliothèque.
        taskId: _newId('ouvrage'),
        label: selected.designation,
        code: selected.code,
        famille: selected.famille ?? '',
        unite: selected.unite ?? 'u',
        qty: 1.0,
        tempsHU: selected.tempsHU,
        tauxHoraire: selected.tauxHoraire > 0 ? selected.tauxHoraire : _hourlyRate,
        conditionCoeff: coeff,
        commentaire: selected.commentaire ?? '',
      ),
    );
    _snack('Ouvrage ajouté');
  }

  // ── Ajouter un sous-ouvrage rattaché à un ouvrage parent ───────────────────
  // Inséré juste après le parent pour rester visible et regroupé sous lui ; le
  // total de l'ouvrage mère = ligne parent + somme des sous-ouvrages.
  Future<void> _addSousOuvrage(String roomId, String parentTaskId) async {
    final selected = await _pickOuvrage();
    if (selected == null) return;
    final coeff = selected.coefficient == 0 ? 1.0 : selected.coefficient;
    final line = _DevisLine(
      taskId: _newId('ouvrage'),
      label: selected.designation,
      code: selected.code,
      famille: selected.famille ?? '',
      unite: selected.unite ?? 'u',
      parentTaskId: parentTaskId,
      qty: 1.0,
      tempsHU: selected.tempsHU,
      tauxHoraire: selected.tauxHoraire > 0 ? selected.tauxHoraire : _hourlyRate,
      conditionCoeff: coeff,
      commentaire: selected.commentaire ?? '',
    );
    setState(() {
      final lines = _linesByRoom.putIfAbsent(roomId, () => []);
      final parentIdx = lines.indexWhere((l) => l.taskId == parentTaskId);
      if (parentIdx < 0) {
        lines.insert(0, line);
      } else {
        lines.insert(parentIdx + 1, line);
      }
    });
    _snack('Sous-ouvrage ajouté');
  }

  // Formulaire de création rapide d'un nouvel ouvrage (nom, unité, temps, taux).
  // Renvoie un LibraryOuvrage prêt à insérer comme ligne du devis.
  Future<LibraryOuvrage?> _promptNewOuvrage() async {
    final nameC = TextEditingController();
    final tempsC = TextEditingController();
    final tauxC = TextEditingController(text: _hourlyRate.toStringAsFixed(2));
    String unite = 'm²';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Nouvel ouvrage'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameC,
                  autofocus: true,
                  decoration:
                      const InputDecoration(labelText: 'Désignation'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: unite,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Unité'),
                  items: _uniteOptions
                      .map((u) =>
                          DropdownMenuItem(value: u, child: Text(u)))
                      .toList(),
                  onChanged: (v) => setLocal(() => unite = v ?? unite),
                ),
                const SizedBox(height: 10),
                // En forfait : un seul champ « Prix forfait (€) », pas de taux.
                // Sinon : Temps (h/unité) + Taux horaire.
                TextField(
                  controller: tempsC,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                      labelText: unite == 'forfait'
                          ? 'Prix forfait (€)'
                          : 'Temps (h/$unite)'),
                ),
                if (unite != 'forfait') ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: tauxC,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration:
                        const InputDecoration(labelText: 'Taux horaire (€/h)'),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Annuler')),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Créer')),
          ],
        ),
      ),
    );
    if (ok != true) return null;
    final name = nameC.text.trim();
    if (name.isEmpty) return null;
    final entered = double.tryParse(tempsC.text.replaceAll(',', '.')) ?? 0.0;
    // En forfait, le champ saisi est un PRIX : on l'encode comme temps=1 ×
    // taux=prix (coeff 1) → le total de la ligne = ce prix.
    if (unite == 'forfait') {
      return LibraryOuvrage(
        id: '',
        code: '',
        designation: name,
        unite: 'forfait',
        tempsHU: 1.0,
        tauxHoraire: entered,
      );
    }
    return LibraryOuvrage(
      id: '',
      code: '',
      designation: name,
      unite: unite,
      tempsHU: entered,
      tauxHoraire:
          double.tryParse(tauxC.text.replaceAll(',', '.')) ?? _hourlyRate,
    );
  }

  // ── Ajouter une fourniture depuis le module Fournisseurs ───────────────────
  // Chaque fourniture est liée à un fournisseur, un ouvrage (le lot) et une
  // quantité/prix modifiables. La quantité reste éditable ensuite sur la ligne.
  Future<void> _addFournitureToLot(String roomId, {String parentTaskId = ''}) async {
    final selected = await showModalBottomSheet<Fourniture>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _FourniturePickerSheet(),
    );
    if (selected == null) return;
    _insertLineAtTop(
      roomId,
      _DevisLine(
        taskId: _newId('fourniture'),
        label: selected.name,
        famille: selected.category,
        unite: selected.conditionnement ?? 'u',
        parentTaskId: parentTaskId,
        qty: 1.0,
        fournisseurId: selected.fournisseurId ?? '',
        fournisseurName: selected.fournisseurName ?? '',
        // La fourniture seule porte son prix dans qty × prix unitaire.
        // billedFournituresQty == qty pour une ligne fourniture.
        fournituresUnitPrice: selected.prixVenteHT,
      ),
    );
    _snack('Fourniture ajoutée');
  }

  // Unités proposées — alignées sur celles d'Odoo / de la bibliothèque
  // (les captures envoyées par le client : m², ml, Forfait, Heures, kg…).
  static const List<String> _uniteOptions = [
    'u',
    'm²',
    'm',
    'ml',
    'm³',
    'h',
    'j',
    'forfait',
    'ens',
    'kg',
    'L',
    '%',
  ];

  // Sélecteur d'unité d'une ligne (au tap sur la pastille d'unité du champ Qté).
  Future<void> _editUnite(_DevisLine line) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        // Inclure une éventuelle unité personnalisée déjà saisie sur la ligne.
        final options = {
          ..._uniteOptions,
          if (line.unite.isNotEmpty) line.unite,
        }.toList();
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Unité',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: options
                    .map((u) => ChoiceChip(
                          label: Text(u),
                          selected: u == line.unite,
                          onSelected: (_) => Navigator.pop(ctx, u),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () async {
                  final custom = await _promptCustomUnite();
                  if (custom != null && custom.isNotEmpty && ctx.mounted) {
                    Navigator.pop(ctx, custom);
                  }
                },
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Unité personnalisée'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
    if (selected == null) return;
    setState(() => line.unite = selected);
  }

  Future<String?> _promptCustomUnite() async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unité personnalisée'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Ex. m², pack, course…'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('OK')),
        ],
      ),
    );
    return ok == true ? ctrl.text.trim() : null;
  }

  // ── Modifier le commentaire d'une ligne ────────────────────────────────────
  Future<void> _editCommentaire(_DevisLine line) async {
    final ctrl = TextEditingController(text: line.commentaire);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Commentaire de la ligne'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'Détail de la prestation…'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Enregistrer')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() {
      line.commentaire = ctrl.text.trim();
      if (line.isComment) line.label = line.commentaire;
    });
  }

  Widget _buildAddLotButton() {
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: OutlinedButton.icon(
        onPressed: _addLot,
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF0F172A),
          side: const BorderSide(color: Color(0xFFCBD5E1)),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Ajouter un lot',
            style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Future<void> _confirmRemoveLot(String roomId) async {
    final label = _lotLabel(roomId, _roomOrder.indexOf(roomId) + 1);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer le lot'),
        content: Text('Supprimer « $label » et toutes ses lignes ?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Supprimer',
                  style: TextStyle(color: Color(0xFFB91C1C)))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() {
      _linesByRoom.remove(roomId);
      _roomOrder.remove(roomId);
      _lotMeta.remove(roomId);
    });
    _snack('Lot supprimé');
  }

  // Barre d'ajout rapide à l'intérieur d'un lot (ouvrage, fourniture, note).
  Widget _buildLotActions(String roomId) {
    Widget action(IconData icon, String label, VoidCallback onTap) {
      return Expanded(
        child: TextButton.icon(
          onPressed: onTap,
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF2563EB),
            padding: const EdgeInsets.symmetric(vertical: 10),
            visualDensity: VisualDensity.compact,
          ),
          icon: Icon(icon, size: 16),
          label: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          action(Icons.add_box_outlined, 'Ouvrage',
              () => _addOuvrageToLot(roomId)),
          action(Icons.inventory_2_outlined, 'Fourniture',
              () => _addFournitureToLot(roomId)),
          action(Icons.sticky_note_2_outlined, 'Note',
              () => _addComment(roomId)),
        ],
      ),
    );
  }

  // Ligne de commentaire/note (texte seul, sans prix) — éditable / supprimable.
  Widget _buildCommentLine(String roomId, _DevisLine line) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          const Icon(Icons.chat_bubble_outline,
              size: 14, color: Color(0xFFB45309)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              line.label,
              style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: Color(0xFF92400E)),
            ),
          ),
          InkWell(
            onTap: () => _editCommentaire(line),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.edit_outlined,
                  size: 15, color: Color(0xFFB45309)),
            ),
          ),
          InkWell(
            onTap: () => _removeLine(roomId, line),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child:
                  Icon(Icons.close, size: 15, color: Color(0xFFB45309)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoomSection(String roomId) {
    final lines = _linesByRoom[roomId] ?? [];
    final roomTotal = lines.fold(0.0, (s, l) => s + l.totalLigne);

    // Split sous-ouvrages from top-level lines: a line whose parentTaskId
    // matches another line of this room is rendered indented under that parent
    // with a summed "Total ouvrage" (client request — la somme des
    // sous-ouvrages fait le prix de l'ouvrage).
    final ids = lines.map((l) => l.taskId).toSet();
    final childrenByParent = <String, List<_DevisLine>>{};
    final topLines = <_DevisLine>[];
    // Commentaires/notes : rendus à part, en haut du lot (style Odoo).
    final commentLines = <_DevisLine>[];
    for (final l in lines) {
      if (l.isComment) {
        commentLines.add(l);
      } else if (l.parentTaskId.isNotEmpty &&
          l.parentTaskId != l.taskId &&
          ids.contains(l.parentTaskId)) {
        childrenByParent.putIfAbsent(l.parentTaskId, () => []).add(l);
      } else {
        topLines.add(l);
      }
    }

    // Group top-level lines by famille (sous-ouvrages follow their parent).
    final byFamille = <String, List<_DevisLine>>{};
    for (final l in topLines) {
      final fam = l.famille.isEmpty ? 'Général' : l.famille;
      byFamille.putIfAbsent(fam, () => []).add(l);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Room header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    _lotLabel(roomId, _roomOrder.indexOf(roomId) + 1),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.edit_outlined,
                      size: 16, color: Color(0xFFEAD8B1)),
                  onPressed: () =>
                      _editLot(roomId, _roomOrder.indexOf(roomId) + 1),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.delete_outline,
                      size: 16, color: Color(0xFFFCA5A5)),
                  tooltip: 'Supprimer le lot',
                  onPressed: () => _confirmRemoveLot(roomId),
                ),
                const Spacer(),
                Text(
                  '${roomTotal.toStringAsFixed(2)} €',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Color(0xFFEAD8B1)),
                ),
              ],
            ),
          ),

          // ── Commentaires / notes du lot (en haut, style Odoo) ───────────
          ...commentLines.map((c) => _buildCommentLine(roomId, c)),

          // ── Barre d'actions du lot (ajout rapide) ───────────────────────
          _buildLotActions(roomId),

          // Lines by famille
          ...byFamille.entries.map((entry) {
            final famColor = _familleColor(entry.key);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // LOT label
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  color: famColor.withValues(alpha: 0.08),
                  child: Row(
                    children: [
                      Container(
                          width: 3,
                          height: 14,
                          color: famColor,
                          margin: const EdgeInsets.only(right: 8)),
                      Text(
                        entry.key.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: famColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                ...entry.value.map((line) {
                  final children =
                      childrenByParent[line.taskId] ?? const <_DevisLine>[];
                  final childrenTotal = children.fold(
                      0.0, (double s, c) => s + c.totalLigne);
                  final ouvrageTotal = line.totalLigne + childrenTotal;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // The parent card displays the SOMME (its own price +
                      // all its sous-ouvrages) — the ouvrage price the client
                      // expects, not the parent's own 0 €.
                      _buildLineCard(
                          roomId, lines.indexOf(line), line, famColor,
                          childrenTotal: childrenTotal),
                      // Sous-ouvrages: indented under their parent ouvrage.
                      ...children.map((c) => Padding(
                            padding: const EdgeInsets.only(left: 20),
                            child: _buildLineCard(
                                roomId, lines.indexOf(c), c, famColor),
                          )),
                      // Somme : prix de l'ouvrage = ligne + sous-ouvrages.
                      if (children.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(10),
                            border:
                                Border.all(color: const Color(0xFFBFDBFE)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  'TOTAL OUVRAGE — ${line.label}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.3,
                                      color: Color(0xFF1E3A8A)),
                                ),
                              ),
                              Text(
                                '${ouvrageTotal.toStringAsFixed(2)} €',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1E3A8A)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  );
                }),
              ],
            );
          }),

          const SizedBox(height: 8),
        ],
      ),
    );
  }

  // ── Task line card (mobile-friendly) ─────────────────────────────────────────
  // [childrenTotal] > 0 marks a parent ouvrage: every displayed total includes
  // the somme of its sous-ouvrages so the ouvrage price = sum of sub prices.
  Widget _buildLineCard(
      String roomId, int lineIndex, _DevisLine line, Color famColor,
      {double childrenTotal = 0.0}) {
    final displayTotal = line.totalLigne + childrenTotal;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.03),
              blurRadius: 4,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Title row ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            child: Row(
              children: [
                if (line.code.isNotEmpty) ...[
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: famColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(line.code,
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.2,
                            color: famColor)),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    line.label,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A)),
                  ),
                ),
                // Price chip — for charge/attente lines there is no billed total.
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: line.isBillable
                        ? const Color(0xFF0F172A)
                        : const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    line.isBillable
                        ? '${displayTotal.toStringAsFixed(2)} €'
                        : (line.isCharge ? 'À charge' : 'En attente'),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: line.isBillable
                          ? Theme.of(context).colorScheme.surface
                          : const Color(0xFF475569),
                    ),
                  ),
                ),
                // Menu de ligne : type de facturation + édition rapide
                // (commentaire, sous-ouvrage, fourniture, suppression).
                PopupMenuButton<String>(
                  padding: EdgeInsets.zero,
                  icon: const Icon(Icons.more_vert,
                      size: 18, color: Color(0xFF94A3B8)),
                  onSelected: (v) {
                    switch (v) {
                      case 'normal':
                      case 'charge':
                      case 'attente':
                        setState(() =>
                            _linesByRoom[roomId]![lineIndex].lineType = v);
                        break;
                      case 'comment':
                        _editCommentaire(line);
                        break;
                      case 'sousouvrage':
                        _addSousOuvrage(roomId, line.taskId);
                        break;
                      case 'fourniture':
                        _addFournitureToLot(roomId, parentTaskId: line.taskId);
                        break;
                      case 'delete':
                        _removeLine(roomId, line);
                        break;
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(
                        value: 'comment', child: Text('Commentaire…')),
                    if (!line.isFourniture)
                      const PopupMenuItem(
                          value: 'sousouvrage',
                          child: Text('Ajouter un sous-ouvrage')),
                    const PopupMenuItem(
                        value: 'fourniture',
                        child: Text('Ajouter une fourniture')),
                    const PopupMenuDivider(),
                    const PopupMenuItem(value: 'normal', child: Text('Normale')),
                    const PopupMenuItem(
                        value: 'charge',
                        child: Text('Fourniture à votre charge')),
                    const PopupMenuItem(
                        value: 'attente',
                        child: Text('En attente de votre décision')),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                        value: 'delete',
                        child: Text('Supprimer',
                            style: TextStyle(color: Color(0xFFB91C1C)))),
                  ],
                ),
              ],
            ),
          ),

          // Fournisseur lié (ligne fourniture) — traçabilité du module Fournisseurs.
          if (line.isFourniture && line.fournisseurName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
              child: Row(
                children: [
                  const Icon(Icons.store_outlined,
                      size: 13, color: Color(0xFF64748B)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Fournisseur : ${line.fournisseurName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            ),

          // Commentaire de ligne (détail de la prestation) — éditable via le menu.
          if (line.commentaire.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Text(
                line.commentaire,
                style: const TextStyle(
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF64748B)),
              ),
            ),

          // A non-billable line shows a tag and hides the qty/temps editor.
          if (!line.isBillable)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Text(
                  line.isCharge
                      ? 'Fourniture à votre charge — non facturée'
                      : 'En attente de votre décision — non chiffrée',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFB45309)),
                ),
              ),
            ),

          if (line.isBillable)
            Container(height: 1, color: const Color(0xFFF1F5F9)),

          // ── Editable inputs row ──────────────────────────────────────
          if (line.isBillable)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Column(
                children: [
                  // ── Mode selector: Calculé (Qté × Temps × tarif) vs Forfait
                  // (prix fixe saisi à la main). C'est un choix explicite : on
                  // ne devine plus le forfait à partir d'un prix saisi.
                  // Une fourniture seule n'a pas de main d'œuvre → pas de choix.
                  if (!line.isFourniture)
                    _forfaitModeToggle(
                      forfaitEnabled: line.forfaitEnabled,
                      onChanged: (enabled) => setState(() {
                        final l = _linesByRoom[roomId]![lineIndex];
                        l.forfaitEnabled = enabled;
                        // En repassant en "Calculé", on efface le prix forfait
                        // pour éviter qu'il refasse surface plus tard.
                        if (!enabled) l.forfaitPrice = 0.0;
                      }),
                    ),
                  if (!line.isFourniture) const SizedBox(height: 10),
                  Row(
                    children: [
                      // Mode Forfait (ouvrage) : on N'AFFICHE QUE le Prix HT.
                      // Mode Calculé : on N'AFFICHE QUE Qté + Temps (pas de Prix).
                      // Fourniture : Qté + Prix u. HT (jamais de Temps).
                      if (line.isFourniture || !line.forfaitEnabled) ...[
                        // Qté — la pastille d'unité est cliquable (sélecteur).
                        _inputField(
                          label: 'Qté',
                          sublabel: line.unite,
                          value: line.qty,
                          onChanged: (v) => setState(
                              () => _linesByRoom[roomId]![lineIndex].qty = v),
                          onSublabelTap: () =>
                              _editUnite(_linesByRoom[roomId]![lineIndex]),
                        ),
                      ],
                      if (!line.isFourniture && !line.forfaitEnabled) ...[
                        const SizedBox(width: 8),
                        _inputField(
                          label: 'Temps h/${line.unite}',
                          sublabel: 'h',
                          value: line.tempsHU,
                          onChanged: (v) => setState(() =>
                              _linesByRoom[roomId]![lineIndex].tempsHU = v),
                        ),
                      ],
                      // Prix HT : fourniture (prix unitaire) ou ouvrage forfait.
                      if (line.isFourniture || line.forfaitEnabled) ...[
                        if (line.isFourniture) const SizedBox(width: 8),
                        _inputField(
                          label: line.isFourniture ? 'Prix u. HT' : 'Prix HT',
                          sublabel: '€',
                          value: line.isFourniture
                              ? line.fournituresUnitPrice
                              : line.forfaitPrice,
                          onChanged: (v) => setState(() {
                            final l = _linesByRoom[roomId]![lineIndex];
                            if (l.isFourniture) {
                              l.fournituresUnitPrice = v;
                            } else {
                              l.forfaitPrice = v;
                            }
                          }),
                        ),
                      ],
                    ],
                  ),
                  if (!line.isFourniture &&
                      !line.forfaitEnabled &&
                      line.fournituresUnitPrice > 0) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _inputField(
                          label: 'Fnt Qte',
                          sublabel: 'u',
                          value: line.fournituresQty,
                          onChanged: (v) => setState(() =>
                              _linesByRoom[roomId]![lineIndex].fournituresQty =
                                  v),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

          // ── Computed results row ────────────────────────────────────
          if (line.isBillable)
            Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                borderRadius:
                    BorderRadius.vertical(bottom: Radius.circular(12)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${displayTotal.toStringAsFixed(2)} €',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildLineBreakdown(line, childrenTotal: childrenTotal),
                ],
              ),
            ),
        ],
      ),
    );
  }

  // ── Line breakdown: shows HOW the total is computed ──────────────────────────
  // Labor part:  Qté × Temps × tarif effectif (taux × coefficient) = MO
  // Fournitures: shown only when there is a material cost on the line.
  Widget _buildLineBreakdown(_DevisLine line, {double childrenTotal = 0.0}) {
    final effectiveRate = line.tauxHoraire * line.conditionCoeff;

    String fmt(double v) {
      final s = v.toStringAsFixed(2);
      return s.replaceAll('.', ',');
    }

    final parts = <String>[];
    // Parent ouvrage: its displayed total includes the somme of its
    // sous-ouvrages — make that explicit in the breakdown.
    if (childrenTotal > 0) {
      parts.add('Sous-ouvrages : ${fmt(childrenTotal)} €');
    }
    if (line.forfaitEnabled) {
      // Flat-price line: no MO/fournitures math, just the forfait amount.
      parts.add('Forfait : ${fmt(line.forfaitPrice)} €');
    } else {
      // A standalone fourniture has no main d'œuvre, so never show the MO line.
      if (!line.isFourniture && line.tempsHU > 0 && effectiveRate > 0) {
        parts.add(
          'MO : ${fmt(line.qty)} × ${fmt(line.tempsHU)} h × ${fmt(effectiveRate)} € = ${fmt(line.totalMO)} €',
        );
      }
      // Fnt line appears only when the user added fourniture products to the
      // line (totalFournitures > 0). It reflects exactly the products chosen,
      // each with its own +/− quantity. No product ⇒ no Fnt line.
      final showLegacyFntBreakdown = line.taskId == '__legacy_fnt_breakdown__';
      if (line.totalFournitures > 0 && !line.hideFournitures) {
        parts.add(
          'Fnt : ${fmt(line.billedFournituresQty)} x ${fmt(line.fournituresUnitPrice)} € = ${fmt(line.totalFournitures)} €',
        );
      } else if (showLegacyFntBreakdown &&
          line.totalFournitures > 0 &&
          line.hideFournitures) {
        parts.add('Fournitures incluses');
      }
      if (showLegacyFntBreakdown &&
          line.totalFournitures > 0 &&
          !line.hideFournitures) {
        parts.add(
          'Fnt : ${fmt(line.qty)} × ${fmt(line.fournituresUnitPrice)} € = ${fmt(line.totalFournitures)} €',
        );
      } else if (line.totalFournitures > 0 && line.hideFournitures) {
        parts.add('Fournitures incluses');
      }
    }
    if (parts.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: parts
          .map((p) => Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  p,
                  style: const TextStyle(
                    fontSize: 11,
                    height: 1.3,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ))
          .toList(),
    );
  }

  // ── Small labeled input ───────────────────────────────────────────────────────
  Widget _inputField({
    required String label,
    required String sublabel,
    required double value,
    required void Function(double) onChanged,
    bool enabled = true,
    VoidCallback? onSublabelTap,
  }) {
    final display = value > 0
        ? value.toStringAsFixed(2).replaceAll(RegExp(r'\.?0+$'), '')
        : '';
    // Champ grisé et non éditable quand il n'est pas pertinent dans le mode
    // courant (ex. Temps en mode forfait, Prix HT en mode calculé).
    final bgColor =
        enabled ? const Color(0xFFF6FCF8) : const Color(0xFFF1F5F9);
    final borderColor =
        enabled ? const Color(0xFFCFEAD9) : const Color(0xFFE2E8F0);
    final textColor =
        enabled ? const Color(0xFF15803D) : const Color(0xFF94A3B8);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  color: Color(0xFF94A3B8))),
          const SizedBox(height: 6),
          Container(
            height: 42,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderColor),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    enabled: enabled,
                    controller: TextEditingController.fromValue(
                      TextEditingValue(
                        text: display,
                        selection:
                            TextSelection.collapsed(offset: display.length),
                      ),
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: textColor),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                    ),
                    onChanged: (v) => onChanged(double.tryParse(v) ?? 0.0),
                  ),
                ),
                // Pastille d'unité : cliquable quand un sélecteur est fourni
                // (champ Qté) → ouvre la liste d'unités type Odoo.
                InkWell(
                  onTap: onSublabelTap,
                  borderRadius: BorderRadius.circular(6),
                  child: Padding(
                    padding: EdgeInsets.only(
                        right: onSublabelTap != null ? 6 : 10,
                        left: 4,
                        top: 4,
                        bottom: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(sublabel,
                            style: TextStyle(
                                fontSize: 11,
                                color: onSublabelTap != null
                                    ? const Color(0xFF2563EB)
                                    : const Color(0xFF94A3B8),
                                fontWeight: FontWeight.w600)),
                        if (onSublabelTap != null)
                          const Icon(Icons.arrow_drop_down,
                              size: 16, color: Color(0xFF2563EB)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Sélecteur de mode de chiffrage de la ligne : "Calculé" (Qté × Temps × tarif)
  // ou "Forfait" (prix fixe saisi dans Prix HT). Choix explicite de l'utilisateur.
  Widget _forfaitModeToggle({
    required bool forfaitEnabled,
    required void Function(bool) onChanged,
  }) {
    Widget segment(String text, bool selected, VoidCallback onTap) {
      return Expanded(
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? const Color(0xFF15803D) : Colors.transparent,
              borderRadius: BorderRadius.circular(7),
            ),
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Text('MODE',
            style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                color: Color(0xFF94A3B8))),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                segment('Calculé', !forfaitEnabled, () => onChanged(false)),
                segment('Forfait', forfaitEnabled, () => onChanged(true)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // Label of a lot ("LOT n – Titre") from _lotMeta, falling back to order/room.
  String _lotLabel(String roomId, int index) {
    final meta = _lotMeta[roomId];
    final number = (meta?['number'] as num?)?.toInt() ?? index;
    final title = (meta?['title']?.toString().trim().isNotEmpty == true)
        ? meta!['title'].toString()
        : _getRoomLabel(roomId);
    return 'LOT $number – $title';
  }

  // Dialog to edit a lot's number and title.
  Future<void> _editLot(String roomId, int defaultNumber) async {
    final meta = _lotMeta[roomId];
    final numCtrl = TextEditingController(
        text: ((meta?['number'] as num?)?.toInt() ?? defaultNumber).toString());
    final titleCtrl = TextEditingController(
        text: (meta?['title']?.toString().trim().isNotEmpty == true)
            ? meta!['title'].toString()
            : _getRoomLabel(roomId));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Modifier le LOT'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: numCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Numéro de lot'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(labelText: 'Titre du lot'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Enregistrer')),
        ],
      ),
    );
    if (ok == true) {
      setState(() {
        _lotMeta[roomId] = {
          'number': int.tryParse(numCtrl.text.trim()) ?? defaultNumber,
          'title': titleCtrl.text.trim(),
        };
      });
    }
  }

  // ── Totals card (récapitulatif) ───────────────────────────────────────────────
  Widget _buildTotalsCard() {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('RÉCAPITULATIF',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF94A3B8))),
            ),
          ),
          // One row per LOT with its HT.
          ..._roomOrder.asMap().entries.map((e) => _totalRow(
              _lotLabel(e.value, e.key + 1),
              _lotTotalHT(e.value),
              const Color(0xFF334155))),
          const Divider(height: 1, indent: 16, endIndent: 16),
          // Global provisions — editable percentages.
          _percentRow('Coordination de chantier', _coordPct, _coordAmount,
              (v) => setState(() => _coordPct = v)),
          _percentRow('Provision aléas de chantier', _aleasPct, _aleasAmount,
              (v) => setState(() => _aleasPct = v)),
          _percentRow('Assurance décennale', _decennalePct, _decennaleAmount,
              (v) => setState(() => _decennalePct = v)),
          const Divider(height: 1, indent: 16, endIndent: 16),
          _totalRow('TOTAL GÉNÉRAL H.T.', _grandTotalGeneralHT,
              const Color(0xFF0F172A),
              bold: true, bigger: true),
          // TVA with selectable rate (10 % rénovation / 20 %).
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(children: [
                  const Text('TVA',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF6B7280))),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: DropdownButton<int>(
                      value: _tvaRate,
                      isDense: true,
                      underline: const SizedBox.shrink(),
                      items: const [
                        DropdownMenuItem(value: 10, child: Text('10 %')),
                        DropdownMenuItem(value: 20, child: Text('20 %')),
                      ],
                      onChanged: (v) =>
                          setState(() => _tvaRate = v ?? _tvaRate),
                    ),
                  ),
                ]),
                Text('${_tvaAmount.toStringAsFixed(2)} €',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6B7280))),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('TOTAL GÉNÉRAL T.T.C.',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: Theme.of(context).colorScheme.surface,
                    )),
                Text(
                  '${_grandTotalTTC.toStringAsFixed(2)} €',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      color: Color(0xFFEAD8B1)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // An editable global-percentage row ("Coordination de chantier (10%)  …€").
  Widget _percentRow(
      String label, double pct, double amount, ValueChanged<double> onPct) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(children: [
              Flexible(
                child: Text(label,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF334155))),
              ),
              const SizedBox(width: 6),
              SizedBox(
                width: 46,
                child: TextFormField(
                  initialValue: _fmtPct(pct),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  textAlign: TextAlign.center,
                  decoration: const InputDecoration(
                    isDense: true,
                    suffixText: '%',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                  ),
                  style: const TextStyle(fontSize: 12),
                  onChanged: (v) =>
                      onPct(double.tryParse(v.replaceAll(',', '.')) ?? 0),
                ),
              ),
            ]),
          ),
          const SizedBox(width: 8),
          Text('${amount.toStringAsFixed(2)} €',
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF334155))),
        ],
      ),
    );
  }

  static String _fmtPct(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  Widget _totalRow(String label, double value, Color color,
      {bool bold = false, bool bigger = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: bigger ? 14 : 13,
                  fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                  color: color)),
          Text(
            '${value.toStringAsFixed(2)} €',
            style: TextStyle(
                fontSize: bigger ? 16 : 13,
                fontWeight: FontWeight.bold,
                color: color),
          ),
        ],
      ),
    );
  }

  // ── Bottom bar ────────────────────────────────────────────────────────────────
  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 32),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.06),
              blurRadius: 16,
              offset: const Offset(0, -4)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isSaving ? null : _generateQuote,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F172A),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: _isSaving
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Theme.of(context).colorScheme.surface,
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                    widget.data.containsKey('id')
                        ? 'Mettre à jour'
                        : 'Générer le Devis',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  String _getRoomLabel(String id) {
    switch (id) {
      case 'salon':
        return 'Salon';
      case 'cuisine':
        return 'Cuisine';
      case 'chambre':
        return 'Chambre';
      case 'salle_de_bain':
        return 'Salle de bain';
      case 'bureau':
        return 'Bureau';
      case 'exterieur':
        return 'Extérieur';
      default:
        if (id.isEmpty) return 'Pièce';
        return id[0].toUpperCase() + id.substring(1);
    }
  }

  Color _familleColor(String famille) {
    switch (famille.toLowerCase()) {
      case 'carrelage':
        return const Color(0xFFB45309);
      case 'peinture':
        return const Color(0xFF7C3AED);
      case 'plomberie':
        return const Color(0xFF0369A1);
      case 'electricité':
      case 'electricite':
        return const Color(0xFFD97706);
      case 'menuiserie':
        return const Color(0xFF166534);
      case 'démolition':
      case 'demolition':
        return const Color(0xFFB91C1C);
      default:
        return const Color(0xFF475569);
    }
  }
}

extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return '';
    return '${this[0].toUpperCase()}${substring(1)}';
  }
}

// ─── Bottom sheet : Historique des ouvrages (bibliothèque) ───────────────────
// Liste les ouvrages déjà créés (recherche incluse) sans quitter le devis. Le
// client voulait que ces ouvrages soient rangés dans un historique consultable,
// pas affichés en permanence dans le récapitulatif.
class _OuvrageHistorySheet extends ConsumerStatefulWidget {
  // Créer un ouvrage vierge (éditable directement dans le récap).
  final VoidCallback onCreateBlank;
  // Ouvrir la Bibliothèque d'ouvrages (sélection avec coefficient / réduction).
  final VoidCallback onOpenLibrary;
  const _OuvrageHistorySheet(
      {required this.onCreateBlank, required this.onOpenLibrary});

  @override
  ConsumerState<_OuvrageHistorySheet> createState() =>
      _OuvrageHistorySheetState();
}

class _OuvrageHistorySheetState extends ConsumerState<_OuvrageHistorySheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final asyncOuvrages = ref.watch(ouvrageLibraryProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Ajouter un ouvrage',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  TextButton.icon(
                    onPressed: widget.onCreateBlank,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Créer'),
                  ),
                ],
              ),
            ),
            // Bibliothèque d'ouvrages — sélection dans la bibliothèque partagée
            // (avec prompt coefficient / réduction), comme l'ancien écran.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: widget.onOpenLibrary,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFEA580C),
                    side: const BorderSide(color: Color(0x4DEA580C)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(Icons.menu_book_outlined, size: 18),
                  label: const Text('Bibliothèque d\'ouvrages',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                autofocus: true,
                onChanged: (v) => setState(() => _query = v.toLowerCase()),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search, size: 20),
                  hintText: 'Rechercher un ouvrage…',
                  isDense: true,
                  filled: true,
                  fillColor: const Color(0xFFF1F5F9),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: asyncOuvrages.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                    child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Erreur : $e',
                      style: const TextStyle(color: Color(0xFFB91C1C))),
                )),
                data: (ouvrages) {
                  final filtered = ouvrages.where((o) {
                    if (_query.isEmpty) return true;
                    return o.designation.toLowerCase().contains(_query) ||
                        o.code.toLowerCase().contains(_query) ||
                        (o.famille ?? '').toLowerCase().contains(_query);
                  }).toList();
                  if (filtered.isEmpty) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('Aucun ouvrage dans l\'historique.',
                            style: TextStyle(color: Color(0xFF94A3B8))),
                      ),
                    );
                  }
                  return ListView.separated(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final o = filtered[i];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(o.designation,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(
                          [
                            if (o.code.isNotEmpty) o.code,
                            if ((o.famille ?? '').isNotEmpty) o.famille,
                            '${o.tempsHU.toStringAsFixed(2)} h/${o.unite ?? 'u'}',
                          ].join(' · '),
                          style: const TextStyle(fontSize: 11),
                        ),
                        trailing: const Icon(Icons.add_circle_outline,
                            color: Color(0xFF15803D)),
                        onTap: () => Navigator.pop(context, o),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Bottom sheet : Sélection d'une fourniture (module Fournisseurs) ──────────
class _FourniturePickerSheet extends ConsumerStatefulWidget {
  const _FourniturePickerSheet();

  @override
  ConsumerState<_FourniturePickerSheet> createState() =>
      _FourniturePickerSheetState();
}

class _FourniturePickerSheetState
    extends ConsumerState<_FourniturePickerSheet> {
  String _query = '';

  // Création d'une fourniture : ouvre le formulaire complet AddFournitureScreen
  // (nom, catégorie, fournisseur, prix achat/vente, conditionnement, quantité,
  // unité, code-barre, photo galerie) et insère la fourniture créée au devis.
  Future<void> _createFournitureInline() async {
    final created = await Navigator.of(context).push<Fourniture>(
      MaterialPageRoute(builder: (_) => const AddFournitureScreen()),
    );
    if (!mounted) return;
    ref.invalidate(allFournituresProvider);
    if (created != null) Navigator.pop(context, created);
  }

  // Catégorie sélectionnée dans la barre latérale ('' = Tous).
  String _selectedCategory = '';

  @override
  Widget build(BuildContext context) {
    final asyncFournitures = ref.watch(allFournituresProvider);
    final asyncCategories = ref.watch(productCategoriesProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Header + bouton "Nouvelle".
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Catalogue de produits',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  TextButton.icon(
                    onPressed: _createFournitureInline,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Nouvelle'),
                  ),
                ],
              ),
            ),
            // Recherche.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                onChanged: (v) => setState(() => _query = v.toLowerCase()),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search, size: 20),
                  hintText: 'Rechercher…',
                  isDense: true,
                  filled: true,
                  fillColor: const Color(0xFFF1F5F9),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const Divider(height: 1),
            // Corps : barre latérale catégories (gauche) + produits (droite).
            Expanded(
              child: asyncFournitures.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                    child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Erreur : $e',
                      style: const TextStyle(color: Color(0xFFB91C1C))),
                )),
                data: (fournitures) {
                  final categories = asyncCategories.maybeWhen(
                    data: (c) => c,
                    orElse: () => kFournitureCategories,
                  );
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _categorySidebar(categories, fournitures),
                      const VerticalDivider(width: 1),
                      Expanded(
                        child: _productList(scrollCtrl, fournitures),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Barre latérale "CATÉGORIE DE PRODUITS" (style Odoo) ────────────────────
  Widget _categorySidebar(
      List<String> categories, List<Fourniture> fournitures) {
    // Compteur par catégorie pour aider l'utilisateur.
    int countFor(String cat) =>
        fournitures.where((f) => f.category == cat).length;
    final total = fournitures.length;

    Widget tile(String label, String value, int count, {bool header = false}) {
      final selected = _selectedCategory == value;
      return InkWell(
        onTap: () => setState(() => _selectedCategory = value),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          color: selected ? const Color(0xFFEFF4FF) : Colors.transparent,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: header ? 11 : 13,
                    fontWeight: header
                        ? FontWeight.w800
                        : (selected ? FontWeight.w700 : FontWeight.w500),
                    color: header
                        ? const Color(0xFF64748B)
                        : (selected
                            ? const Color(0xFF1D4ED8)
                            : const Color(0xFF0F172A)),
                    letterSpacing: header ? 0.5 : 0,
                  ),
                ),
              ),
              if (!header && count > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF1D4ED8)
                        : const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('$count',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: selected
                              ? Colors.white
                              : const Color(0xFF475569))),
                ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      width: 132,
      child: Container(
        color: const Color(0xFFF8FAFC),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(12, 12, 12, 4),
              child: Text('CATÉGORIE DE PRODUITS',
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.4)),
            ),
            tile('Tous', '', total),
            const Divider(height: 1),
            ...categories.map((c) => tile(c, c, countFor(c))),
          ],
        ),
      ),
    );
  }

  // ── Liste des produits filtrés (recherche + catégorie) ─────────────────────
  Widget _productList(ScrollController scrollCtrl, List<Fourniture> fournitures) {
    final filtered = fournitures.where((f) {
      final matchCat =
          _selectedCategory.isEmpty || f.category == _selectedCategory;
      final matchQuery = _query.isEmpty ||
          f.name.toLowerCase().contains(_query) ||
          f.category.toLowerCase().contains(_query) ||
          (f.fournisseurName ?? '').toLowerCase().contains(_query);
      return matchCat && matchQuery;
    }).toList();

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined,
                  size: 40, color: Color(0xFFCBD5E1)),
              const SizedBox(height: 8),
              Text(
                _selectedCategory.isEmpty
                    ? 'Aucun produit'
                    : 'Aucun produit dans « $_selectedCategory »',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: _createFournitureInline,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Créer un produit'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      controller: scrollCtrl,
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 24),
      itemCount: filtered.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final f = filtered[i];
        return _productCard(f);
      },
    );
  }

  Widget _productCard(Fourniture f) {
    return InkWell(
      onTap: () => Navigator.pop(context, f),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            // Vignette produit (image ou icône).
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: (f.imageUrl != null && f.imageUrl!.isNotEmpty)
                  ? Image.network(f.imageUrl!,
                      width: 44,
                      height: 44,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _productIcon())
                  : _productIcon(),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(f.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13.5)),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text('${f.prixVenteHT.toStringAsFixed(2)} €',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: Color(0xFF15803D))),
                      if ((f.fournisseurName ?? '').isNotEmpty) ...[
                        const Text('  ·  ',
                            style: TextStyle(color: Color(0xFFCBD5E1))),
                        Flexible(
                          child: Text(f.fournisseurName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11, color: Color(0xFF64748B))),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            // Bouton "Ajouter" — comme Odoo.
            TextButton.icon(
              onPressed: () => Navigator.pop(context, f),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF15803D),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                visualDensity: VisualDensity.compact,
              ),
              icon: const Icon(Icons.add_shopping_cart, size: 16),
              label: const Text('Ajouter',
                  style:
                      TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _productIcon() => Container(
        width: 44,
        height: 44,
        color: const Color(0xFFF1F5F9),
        child: const Icon(Icons.inventory_2_outlined,
            size: 20, color: Color(0xFF94A3B8)),
      );
}
