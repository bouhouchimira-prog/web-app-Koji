import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart'
    show ProKojiWebException;

/// Message d'erreur montré à l'artisan (retours du build 64) : jamais un
/// texte technique (« PostgrestException… Could not find the function… »).
///
/// Passent tels quels les messages écrits pour lui : une chaîne lancée par
/// l'app (« Session expirée. Reconnecte-toi. ») ou la réponse de l'API du
/// site. Tout le reste (erreur de la base, du réseau, d'une bibliothèque)
/// devient [defaut].
const erreurParDefaut =
    "Ça n'a pas marché. Vérifiez la connexion et réessayez.";

String messageErreur(Object? erreur, {String defaut = erreurParDefaut}) {
  final texte = switch (erreur) {
    final String s => s,
    final KojiWebApiException e => e.message,
    final ProKojiWebException e => e.message,
    _ => '',
  }
      .trim();
  return texte.isEmpty || estTechnique(texte) ? defaut : texte;
}

final _technique = RegExp(
  r'Exception|Error\b|PGRST|\bpublic\.|schema cache|\bnull\b|https?://|'
  r'SocketException|TimeoutException|HandshakeException|XMLHttpRequest|'
  r'[{}<>]|\bat line\b|#\d+\s',
);

/// Vrai pour un texte qui n'a pas été écrit pour l'utilisateur.
bool estTechnique(String texte) => _technique.hasMatch(texte);
