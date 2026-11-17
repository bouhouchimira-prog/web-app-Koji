import 'package:flutter/material.dart';

/// Liste vide (maquette PRO-19) : comment la liste se remplit, une action
/// principale (jaune) et une alternative discrète. Jamais de fausses données.
class ListeVide extends StatelessWidget {
  const ListeVide({super.key, required this.titre, required this.texte, this.action, this.onAction, this.alternative, this.onAlternative});
  final String titre;
  final String texte;
  final String? action;
  final VoidCallback? onAction;
  final String? alternative;
  final VoidCallback? onAlternative;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(18),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFF171B1E), width: 2), left: BorderSide(color: Color(0xFFCFCFC9)), right: BorderSide(color: Color(0xFFCFCFC9)), bottom: BorderSide(color: Color(0xFFCFCFC9))),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(titre, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF171B1E))),
          const SizedBox(height: 6),
          Text(texte, style: const TextStyle(fontSize: 14, height: 1.45, color: Color(0xFF5B5F66))),
          if (action != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFFC400), foregroundColor: const Color(0xFF171B1E), shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(2))), textStyle: const TextStyle(fontWeight: FontWeight.w700)),
                onPressed: onAction,
                child: Text(action!),
              ),
            ),
          ],
          if (alternative != null) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF171B1E), side: const BorderSide(color: Color(0xFF171B1E)), shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(2)))),
                onPressed: onAlternative,
                child: Text(alternative!),
              ),
            ),
          ],
        ]),
      );
}
