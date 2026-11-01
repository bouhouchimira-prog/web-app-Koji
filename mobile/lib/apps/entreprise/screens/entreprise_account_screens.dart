import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';

// === PROFIL ===

class EntrepriseProfilScreen extends ConsumerStatefulWidget {
  const EntrepriseProfilScreen({super.key});

  @override
  ConsumerState<EntrepriseProfilScreen> createState() =>
      _EntrepriseProfilScreenState();
}

class _EntrepriseProfilScreenState
    extends ConsumerState<EntrepriseProfilScreen> {
  final _raisonSocialeController = TextEditingController();
  final _siretController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  bool _saving = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _raisonSocialeController.text = 'SARL Mon Entreprise';
    _siretController.text = '12345678901234';
    _phoneController.text = '+33 1 23 45 67 89';
    _addressController.text = '123 Rue de la Paix, 75001 Paris';
  }

  @override
  void dispose() {
    _raisonSocialeController.dispose();
    _siretController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _saveProfil() async {
    setState(() {
      _saving = true;
      _error = null;
      _success = null;
    });

    try {
      await Future.delayed(const Duration(seconds: 1));
      setState(() => _success = 'Profil sauvegardé');
    } catch (err) {
      setState(() => _error = 'Erreur lors de la sauvegarde');
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return KojiPage(
      title: 'Profil entreprise',
      appBarOnPhone: true,
      main: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F5F2),
                  border: Border.all(color: const Color(0xFFD9D9D4)),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(
                    color: Colors.red,
                    fontSize: 13,
                  ),
                ),
              ),
            if (_success != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F5F2),
                  border: Border.all(color: const Color(0xFFD9D9D4)),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Text(
                  _success!,
                  style: const TextStyle(
                    color: Colors.green,
                    fontSize: 13,
                  ),
                ),
              ),
            _buildField('Raison sociale', _raisonSocialeController),
            const SizedBox(height: 16),
            _buildField('SIRET', _siretController),
            const SizedBox(height: 16),
            _buildField('Téléphone', _phoneController),
            const SizedBox(height: 16),
            _buildField('Adresse', _addressController, maxLines: 2),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: KojiButton(
                label: 'Enregistrer',
                onPressed: _saving ? null : _saveProfil,
                loading: _saving,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildField(
    String label,
    TextEditingController controller, {
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          decoration: InputDecoration(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(2),
              borderSide: const BorderSide(color: Color(0xFFD9D9D4)),
            ),
            filled: true,
            fillColor: const Color(0xFFFFFFFF),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 14),
        ),
      ],
    );
  }
}

// === PARAMÈTRES ===

class EntrepriseParametresScreen extends ConsumerWidget {
  const EntrepriseParametresScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Paramètres',
      appBarOnPhone: true,
      main: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Theme section
            Text(
              'Thème',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F2),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              child: Column(
                children: [
                  _ParameterRow('Clair', true),
                  _ParameterRow('Sombre', false),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Notifications section
            Text(
              'Notifications',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F2),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              child: Column(
                children: [
                  _CheckboxRow('Nouveaux devis', true),
                  _CheckboxRow('Nouveaux messages', true),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Account section
            Text(
              'Compte',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F2),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              child: Column(
                children: [
                  _AccountRow('Abonnement', 'Koji Pro - Annuel'),
                  _AccountRow('Déconnexion', null),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ParameterRow extends StatelessWidget {
  final String label;
  final bool selected;

  const _ParameterRow(this.label, this.selected);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: const Color(0xFFD9D9D4),
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 14),
          ),
          if (selected)
            const Icon(
              Icons.check,
              color: Color(0xFF171B1E),
              size: 20,
            ),
        ],
      ),
    );
  }
}

class _CheckboxRow extends StatelessWidget {
  final String label;
  final bool checked;

  const _CheckboxRow(this.label, this.checked);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: const Color(0xFFD9D9D4),
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 14),
          ),
          Checkbox(
            value: checked,
            onChanged: (_) {},
          ),
        ],
      ),
    );
  }
}

class _AccountRow extends StatelessWidget {
  final String label;
  final String? value;

  const _AccountRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: const Color(0xFFD9D9D4),
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (value != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    value!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right,
            size: 20,
            color: Color(0xFF171B1E),
          ),
        ],
      ),
    );
  }
}
