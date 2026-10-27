import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';

class ChantierBudgetScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  const ChantierBudgetScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierBudgetScreen> createState() => _ChantierBudgetScreenState();
}

class _ChantierBudgetScreenState extends ConsumerState<ChantierBudgetScreen> {
  static const _kDark = Color(0xFF0F172A);

  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final chantierId = widget.data['id'] as String?;
    if (chantierId == null) {
      return const Scaffold(body: Center(child: Text('Erreur: ID manquant')));
    }

    final budgetAsync = ref.watch(chantierBudgetProvider(chantierId));
    final budgetLinesAsync = ref.watch(chantierBudgetLinesProvider(chantierId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: _kDark))
                  : budgetAsync.when(
                      loading: () => const Center(
                          child: CircularProgressIndicator(color: _kDark)),
                      error: (e, _) => Center(child: Text('Erreur: $e')),
                      data: (budget) {
                        return budgetLinesAsync.when(
                          loading: () => const Center(
                              child: CircularProgressIndicator(color: _kDark)),
                          error: (e, _) => Center(child: Text('Erreur: $e')),
                          data: (lines) {
                            // Compute totals from lines
                            double mainOeuvreReal = 0;
                            double fournitureReal = 0;
                            double diversReal = 0;

                            for (final line in lines) {
                              final cat = line['category'] as String?;
                              final amt = num.tryParse(line['amount']?.toString() ?? '0')?.toDouble() ?? 0;
                              if (cat == 'main_oeuvre') mainOeuvreReal += amt;
                              if (cat == 'fourniture') fournitureReal += amt;
                              if (cat == 'divers') diversReal += amt;
                            }

                            final mainOeuvreEst = num.tryParse(budget?['main_oeuvre_estimated']?.toString() ?? '0')?.toDouble() ?? 0;
                            final fournitureEst = num.tryParse(budget?['fourniture_estimated']?.toString() ?? '0')?.toDouble() ?? 0;
                            final diversEst = num.tryParse(budget?['divers_estimated']?.toString() ?? '0')?.toDouble() ?? 0;

                            return SingleChildScrollView(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 20, vertical: 24),
                              child: _buildBudgetCard(
                                chantierId: chantierId,
                                mainOeuvreReal: mainOeuvreReal,
                                mainOeuvreEst: mainOeuvreEst,
                                fournitureReal: fournitureReal,
                                fournitureEst: fournitureEst,
                                diversReal: diversReal,
                                diversEst: diversEst,
                              ),
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

  Widget _buildAppBar(BuildContext context) {
    final chantierId = widget.data['id'] as String?;
    return Container(
      color: const Color(0xFFF5F0EB),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: const Icon(Icons.chevron_left_rounded,
                color: _kDark, size: 30),
          ),
          const Text(
            'Budget',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
          GestureDetector(
            onTap: () {
              if (chantierId != null) {
                context.push('/chantier/budget/history', extra: widget.data);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Row(
                children: [
                  Icon(Icons.history, size: 16, color: _kDark),
                  SizedBox(width: 4),
                  Text(
                    'Historique',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _kDark,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBudgetCard({
    required String chantierId,
    required double mainOeuvreReal,
    required double mainOeuvreEst,
    required double fournitureReal,
    required double fournitureEst,
    required double diversReal,
    required double diversEst,
  }) {
    final grandTotalReal = mainOeuvreReal + fournitureReal + diversReal;
    final grandTotalEst = mainOeuvreEst + fournitureEst + diversEst;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Budget',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: _kDark,
                      ),
                    ),
                    Icon(Icons.touch_app_outlined,
                        size: 18, color: Color(0xFF94A3B8)),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Touchez une catégorie pour voir le détail ou modifier',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 24),
                _buildBudgetRow(
                  chantierId: chantierId,
                  label: "Main d'œuvre",
                  dbCategory: "main_oeuvre",
                  real: mainOeuvreReal,
                  estimated: mainOeuvreEst,
                  onAdd: _showAddMainOeuvreDialog,
                ),
                const SizedBox(height: 24),
                _buildBudgetRow(
                  chantierId: chantierId,
                  label: 'Fourniture',
                  dbCategory: "fourniture",
                  real: fournitureReal,
                  estimated: fournitureEst,
                  onAdd: _showAddFournitureDialog,
                ),
                const SizedBox(height: 24),
                _buildBudgetRow(
                  chantierId: chantierId,
                  label: 'Divers',
                  dbCategory: "divers",
                  real: diversReal,
                  estimated: diversEst,
                  onAdd: _showAddDiversDialog,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: _kDark,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'TOTAL',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${_fmt(grandTotalReal)} €',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'Estimé: ${_fmt(grandTotalEst)} €',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBudgetRow({
    required String chantierId,
    required String label,
    required String dbCategory,
    required double real,
    required double estimated,
    required VoidCallback onAdd,
  }) {
    final bool overBudget = real > estimated;
    final double progress =
        estimated > 0 ? (real / estimated).clamp(0.0, 1.0) : 0.0;
    final Color barColor = overBudget ? const Color(0xFFEF4444) : _kDark;

    final String realStr = _fmt(real);
    final String estStr = _fmt(estimated);

    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () {
              context.push('/chantier/budget/detail', extra: {
                'chantierId': chantierId,
                'category': dbCategory,
                'label': label,
              });
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text(
                          label,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: _kDark,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          '$realStr / $estStr €',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: overBudget ? const Color(0xFFEF4444) : _kDark,
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => _editEstimatedBudget(chantierId, dbCategory, label, estimated),
                          child: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation<Color>(barColor),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: onAdd,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: _kDark,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.add,
                    color: Theme.of(context).colorScheme.surface, size: 18),
                const SizedBox(width: 4),
                Text(
                  'Ajouter',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.surface,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _editEstimatedBudget(String chantierId, String category, String label, double currentEst) {
    final estCtrl = TextEditingController(text: currentEst.toStringAsFixed(0));

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Modifier le budget estimé\n$label',
          style: const TextStyle(fontWeight: FontWeight.bold, color: _kDark, fontSize: 16),
        ),
        content: TextField(
          controller: estCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Budget Estimé (€)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              final newEst = double.tryParse(estCtrl.text) ?? 0;
              Navigator.pop(ctx);
              setState(() => _isLoading = true);

              try {
                await ref.read(chantierRepositoryProvider).updateEstimated(
                      chantierId: chantierId,
                      category: category,
                      estimated: newEst,
                    );
                
                ref.invalidate(chantierBudgetProvider(chantierId));
                ref.invalidate(chantierBudgetHistoryProvider(chantierId));
              } catch (e) {
                debugPrint('Error updating estimated budget: $e');
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Erreur: $e')),
                  );
                }
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _kDark,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Enregistrer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddMainOeuvreDialog() {
    final descCtrl = TextEditingController();
    final hoursCtrl = TextEditingController();
    final rateCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          "Ajouter Main d'œuvre",
          style: TextStyle(fontWeight: FontWeight.bold, color: _kDark),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (ex: Pose carrelage)',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: hoursCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Heures'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: rateCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Taux horaire (€)'),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              final desc = descCtrl.text.trim();
              final hours = double.tryParse(hoursCtrl.text) ?? 0;
              final rate = double.tryParse(rateCtrl.text) ?? 0;
              final total = hours * rate;
              final chantierId = widget.data['id'] as String?;

              if (chantierId == null || total <= 0) {
                Navigator.pop(ctx);
                return;
              }

              Navigator.pop(ctx);
              setState(() => _isLoading = true);

              try {
                await ref.read(chantierRepositoryProvider).addBudgetLine(
                      chantierId: chantierId,
                      category: 'main_oeuvre',
                      label: desc.isEmpty ? "Main d'œuvre" : desc,
                      amount: total,
                      quantity: hours,
                      unitPrice: rate,
                    );

                ref.invalidate(chantierBudgetProvider(chantierId));
                ref.invalidate(chantierBudgetLinesProvider(chantierId));
                ref.invalidate(chantierBudgetHistoryProvider(chantierId));

                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                        '${desc.isEmpty ? "Main d'œuvre" : desc} ajoutée (+${total.toStringAsFixed(2)} €)'),
                    backgroundColor: const Color(0xFF22C55E),
                  ),
                );
              } catch (e) {
                debugPrint("Error adding main d'œuvre: $e");
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text("Erreur lors de l'ajout"),
                    backgroundColor: Color(0xFFEF4444),
                  ),
                );
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _kDark,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Ajouter', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddFournitureDialog() {
    final nameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');
    final priceCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Ajouter Fourniture',
          style: TextStyle(fontWeight: FontWeight.bold, color: _kDark),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Nom de la fourniture',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: qtyCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Quantité',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: priceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Prix unitaire (€)',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              final qty = double.tryParse(qtyCtrl.text) ?? 1;
              final price = double.tryParse(priceCtrl.text) ?? 0;
              final total = qty * price;
              final chantierId = widget.data['id'] as String?;

              if (chantierId != null && name.isNotEmpty && price > 0) {
                Navigator.pop(ctx);
                setState(() => _isLoading = true);

                try {
                  await ref.read(chantierRepositoryProvider).addBudgetLine(
                        chantierId: chantierId,
                        category: 'fourniture',
                        label: name,
                        amount: total,
                        quantity: qty,
                        unitPrice: price,
                      );

                  ref.invalidate(chantierBudgetProvider(chantierId));
                  ref.invalidate(chantierBudgetLinesProvider(chantierId));
                  ref.invalidate(chantierBudgetHistoryProvider(chantierId));

                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$name ajouté (+${total.toStringAsFixed(2)} €)'),
                        backgroundColor: const Color(0xFF22C55E),
                      ),
                    );
                  }
                } catch (e) {
                  debugPrint('Error adding fourniture: $e');
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Erreur lors de l\'ajout'),
                        backgroundColor: Color(0xFFEF4444),
                      ),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isLoading = false);
                }
              } else {
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _kDark,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Ajouter', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddDiversDialog() {
    final descCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    File? pickedFile;
    String? pickedFileName;
    String? attachmentType; // 'photo' | 'document'

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Ajouter Divers',
            style: TextStyle(fontWeight: FontWeight.bold, color: _kDark),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Description (ex: Frais de transport)',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Montant (€)'),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _attachmentButton(
                      icon: Icons.image_outlined,
                      label: 'Photo',
                      onTap: () async {
                        final picker = ImagePicker();
                        final x = await picker.pickImage(
                            source: ImageSource.gallery, imageQuality: 80);
                        if (x != null) {
                          setLocal(() {
                            pickedFile = File(x.path);
                            pickedFileName = x.name;
                            attachmentType = 'photo';
                          });
                        }
                      },
                    ),
                    _attachmentButton(
                      icon: Icons.photo_camera_outlined,
                      label: 'Caméra',
                      onTap: () async {
                        final picker = ImagePicker();
                        final x = await picker.pickImage(
                            source: ImageSource.camera, imageQuality: 80);
                        if (x != null) {
                          setLocal(() {
                            pickedFile = File(x.path);
                            pickedFileName = x.name;
                            attachmentType = 'photo';
                          });
                        }
                      },
                    ),
                    _attachmentButton(
                      icon: Icons.attach_file_outlined,
                      label: 'Document',
                      onTap: () async {
                        final result = await FilePicker.platform.pickFiles(
                          type: FileType.any,
                          withData: false,
                        );
                        final path = result?.files.single.path;
                        if (path != null) {
                          setLocal(() {
                            pickedFile = File(path);
                            pickedFileName = result!.files.single.name;
                            attachmentType = 'document';
                          });
                        }
                      },
                    ),
                  ],
                ),
                if (pickedFileName != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          attachmentType == 'photo'
                              ? Icons.image
                              : Icons.insert_drive_file,
                          size: 18,
                          color: _kDark,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            pickedFileName!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: _kDark),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => setLocal(() {
                            pickedFile = null;
                            pickedFileName = null;
                            attachmentType = null;
                          }),
                          child: const Icon(Icons.close,
                              size: 16, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final desc = descCtrl.text.trim();
                final amount = double.tryParse(amountCtrl.text.replaceAll(',', '.')) ?? 0;
                final chantierId = widget.data['id'] as String?;

                if (chantierId == null || desc.isEmpty || amount <= 0) {
                  Navigator.pop(ctx);
                  return;
                }

                Navigator.pop(ctx);
                setState(() => _isLoading = true);

                try {
                  String? attachmentUrl;
                  if (pickedFile != null && pickedFileName != null) {
                    attachmentUrl = await ref.read(chantierRepositoryProvider).uploadAttachment(
                          chantierId: chantierId,
                          file: pickedFile!,
                          filename: pickedFileName!,
                        );
                  }

                  await ref.read(chantierRepositoryProvider).addBudgetLine(
                        chantierId: chantierId,
                        category: 'divers',
                        label: desc,
                        amount: amount,
                        attachmentUrl: attachmentUrl,
                        attachmentType: attachmentType,
                      );

                  ref.invalidate(chantierBudgetProvider(chantierId));
                  ref.invalidate(chantierBudgetLinesProvider(chantierId));
                  ref.invalidate(chantierBudgetHistoryProvider(chantierId));

                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('$desc ajouté (+${amount.toStringAsFixed(2)} €)'),
                      backgroundColor: const Color(0xFF22C55E),
                    ),
                  );
                } catch (e) {
                  debugPrint('Error adding divers: $e');
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Erreur: $e'),
                      backgroundColor: const Color(0xFFEF4444),
                    ),
                  );
                } finally {
                  if (mounted) setState(() => _isLoading = false);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _kDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: const Text('Ajouter', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _attachmentButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: _kDark, size: 24),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: _kDark,
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(double v) {
    return v.toStringAsFixed(0).replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+$)'),
          (m) => '${m[1]} ',
        );
  }
}
