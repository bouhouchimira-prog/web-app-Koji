/// Une ligne modifiable du devis (éditeur de l'app, devis guidé PRO-03.1).
class DevisLine {
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
  // Variante (maquette PRO-03.1) : chiffrée comme une ligne normale, montrée
  // au client, mais jamais dans le total du lot ni du devis.
  bool get isVariante => lineType == 'variante';
  bool get isBillable => lineType == 'normal' || lineType == 'variante';

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
  // Ce qui compte dans les totaux : rien pour une variante.
  double get totalCompte => isVariante ? 0.0 : totalLigne;

  DevisLine({
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
