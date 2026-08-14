const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, HeadingLevel, BorderStyle, AlignmentType, ExternalHyperlink
} = require("docx");

const NAVY = "06132D";
const GREEN = "1F5B3F";
const SOFT = "F4F6FA";
const AMBER_BG = "FFF8EC";
const AMBER_BORDER = "F1D7B9";
const LINE = "DFE6F0";
const TEXT = "1A1F29";
const MUTED = "5B6472";

function cellBorder() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return { top: b, bottom: b, left: b, right: b };
}

function tableCell(text, { header = false, width, bold = false } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: header ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    borders: cellBorder(),
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({
        text,
        bold: header || bold,
        color: header ? "FFFFFF" : TEXT,
        size: header ? 18 : 19
      })]
    })]
  });
}

function refTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell("Réf.", { header: true, width: 8 }),
          tableCell("Ce qui reste à faire", { header: true, width: 62 }),
          tableCell("Qui agit", { header: true, width: 30 })
        ]
      }),
      ...rows.map(([ref, desc, who]) => new TableRow({
        children: [tableCell(ref, { width: 8, bold: true }), tableCell(desc, { width: 62 }), tableCell(who, { width: 30 })]
      }))
    ]
  });
}

function sectionHeading(text, color) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: color },
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 24 })]
  });
}

function subHeading(text) {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    children: [new TextRun({ text, bold: true, size: 21, color: TEXT })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text, size: 20, color: TEXT, italics: opts.italics, bold: opts.bold })]
  });
}

function decisionBox(children) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: AMBER_BG },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: AMBER_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: AMBER_BORDER },
          left: { style: BorderStyle.SINGLE, size: 6, color: AMBER_BORDER },
          right: { style: BorderStyle.SINGLE, size: 6, color: AMBER_BORDER }
        },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children
      })]
    })]
  });
}

function checkboxLine(text, note) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "☐  ", size: 20 }),
      new TextRun({ text, size: 20, color: TEXT }),
      ...(note ? [new TextRun({ text: `  ${note}`, size: 18, italics: true, color: MUTED })] : [])
    ]
  });
}

function questionLabel(text) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, bold: true, size: 20, color: TEXT })] });
}

function recommendation(text) {
  return new Paragraph({ spacing: { before: 100, after: 0 }, children: [new TextRun({ text: `Recommandation développement : ${text}`, italics: true, size: 19, color: MUTED })] });
}

const doc = new Document({
  sections: [{
    properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
    children: [
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "KOJI — Points à valider par la direction (Président / DG)", bold: true, size: 30, color: NAVY })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({
          text: "ABL Expert Renov, SAS — préparé par le développement (Amira) le 11 août 2026, mis à jour le 14 août 2026, en complément du document « Réponses aux informations requises v0.2 »",
          size: 19, color: MUTED, italics: true
        })]
      }),

      decisionBox([
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Objet.", bold: true, size: 20 })] }),
        body("Suite au questionnaire juridique du 6 août 2026, aux réponses techniques déjà préparées, et aux corrections de sécurité menées les 12 et 14 août, il reste des points qui nécessitent une validation rapide de la direction avant transmission finale au juriste — des choix commerciaux (tarifs, offre de lancement) et des décisions liées aux corrections de sécurité récentes, présentés avec une recommandation du développement à valider ou ajuster.", { after: 0 })
      ]),

      sectionHeading("1. Points nécessitant une décision de la direction", NAVY),
      refTable([
        ["B3", "Fixer le délai de récupération des données après résiliation d'un compte. Proposition développement : 30 jours (cohérent avec la durée déjà utilisée pour l'accès aux liens de signature dans le code).", "Direction à valider"],
        ["B7", "Choisir le nom de domaine pour les adresses de contact et désigner qui relève chacune des 4 adresses (contact, support, protection des données, signalement). Proposition d'Amira : nom de domaine ____________________ (à compléter avant envoi) — à valider par la direction.", "Direction"],
        ["B8", "Compléter le reste de la matrice de conservation. Durées légales déjà connues : pièces comptables 10 ans (art. L.123-22 code de commerce), prescription commerciale 5 ans (art. L.110-4). Restent à fixer : compte inactif, données client final après achèvement du chantier, tickets de support. Proposition développement : compte inactif 3 ans, données client final 5 ans après le chantier, tickets support 3 ans — à valider avec le juriste.", "Direction + juriste"],
        ["C1", "Lancer la déclaration d'activité \"édition de logiciel\" auprès du courtier MIC pour la RC Pro.", "Direction"],
        ["C3", "Lancer le dépôt de marque KOJI à l'INPI (recherche d'antériorité classes 9 et 42 au minimum).", "Direction"],
        ["C4", "Clarifier le statut de Firas Mzoughi (salarié ou prestataire ponctuel) et déterminer avec le juriste si un contrat de cession de droits est nécessaire au regard de sa contribution.", "Direction + juriste"]
      ]),

      sectionHeading("2. Proposition tarifaire à valider", GREEN),
      subHeading("A. Formules actuelles (déjà en ligne dans l'application)"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [tableCell("Formule", { header: true, width: 22 }), tableCell("Prix mensuel", { header: true, width: 18 }), tableCell("Fonctionnalités clés", { header: true, width: 60 })] }),
          new TableRow({ children: [tableCell("Koji GO", { width: 22, bold: true }), tableCell("19,99 €/mois", { width: 18 }), tableCell("4 devis, versions illimitées par devis, génération PDF & Word, signature électronique, espace client particulier", { width: 60 })] }),
          new TableRow({ children: [tableCell("Koji Premium (« populaire »)", { width: 22, bold: true }), tableCell("49,99 €/mois", { width: 18 }), tableCell("Devis illimités, versions illimitées, accès Marketplace, bibliothèque d'ouvrages avancée, gestion d'équipe, notifications SMS", { width: 60 })] }),
          new TableRow({ children: [tableCell("Koji Business", { width: 22, bold: true }), tableCell("99,99 €/mois", { width: 18 }), tableCell("Accès illimité à tous les outils, devis et chantiers illimités, multi-utilisateurs, support prioritaire, intégration comptable, rapports personnalisés", { width: 60 })] })
        ]
      }),
      new Paragraph({ text: "", spacing: { after: 160 } }),
      decisionBox([
        questionLabel("À valider — HT ou TTC ?"),
        checkboxLine("HT", "(recommandé — clientèle professionnelle, artisans du BTP récupérant la TVA, pratique standard en SaaS B2B français)"),
        checkboxLine("TTC")
      ]),
      new Paragraph({ text: "", spacing: { after: 160 } }),

      subHeading("B. Forfait annuel"),
      body("Décision retenue : pas de forfait annuel au lancement. L'application reste en facturation mensuelle uniquement dans un premier temps ; un forfait annuel (avec remise, par exemple deux mois offerts) pourra être introduit ultérieurement si la demande le justifie. Aucun développement n'est nécessaire dans l'immédiat sur ce point."),

      subHeading("C. Offre de lancement"),
      body("Structure déjà actée : remise sur la première période de facturation uniquement, souscription manuelle, aucun prélèvement automatique sans validation expresse du client (cf. B4). Il reste à choisir le pourcentage et la fenêtre de validité — remplacée par une durée limitée dans le temps plutôt qu'un compteur de clients."),
      new Paragraph({ text: "", spacing: { after: 100 } }),
      decisionBox([
        questionLabel("À valider — Pourcentage de la remise de lancement"),
        checkboxLine("-30 %"), checkboxLine("-50 %", "(option initialement envisagée)"), checkboxLine("-70 %"), checkboxLine("Autre : ______%"),
        new Paragraph({ text: "", spacing: { after: 100 } }),
        questionLabel("À valider — Durée de l'offre de lancement"),
        checkboxLine("1 mois après la mise en ligne"), checkboxLine("3 mois après la mise en ligne"), checkboxLine("Jusqu'à une date fixe : ______________"),
        recommendation("-50 % pendant les 3 premiers mois suivant le lancement — assez incitatif pour créer un signal d'urgence, sans devenir un engagement de trop longue durée à honorer.")
      ]),

      sectionHeading("3. Nouveaux points remontés lors des corrections de sécurité (12–14 août 2026)", NAVY),
      body("Un audit de sécurité mené ces derniers jours a permis de corriger plusieurs failles actives (accès aux données d'une entreprise depuis une autre, base de données lisible sans connexion, mots de passe en clair, absence de session vérifiable). Le détail technique est dans le document de suivi séparé ; trois décisions issues de ce travail restent à valider par la direction.", { after: 240 }),

      subHeading("D1 — Purge de l'historique Git"),
      body("Constat : le fichier contenant une copie de la base de développement, avec plusieurs mots de passe réels en clair (dont celui du compte administrateur), a été retiré du suivi Git le 12 août et n'est plus versionné depuis. Il reste néanmoins visible dans les anciens commits (historique antérieur au 12 août 2026), consultable par toute personne ayant accès au dépôt."),
      decisionBox([
        questionLabel("À valider — Faut-il réécrire l'historique Git pour purger ces anciens commits ?"),
        checkboxLine("Oui, à programmer dès que possible"),
        checkboxLine("Non — dépôt privé, accès limité à l'équipe, risque résiduel jugé acceptable"),
        checkboxLine("À réévaluer si le dépôt devient public ou change d'hébergement"),
        recommendation("oui — même dans un dépôt privé, toute personne ayant eu accès au dépôt (actuellement ou par le passé) a pu voir ces mots de passe réels. Cette opération réécrit l'historique et invalide les clones existants : à programmer à un moment où l'équipe peut re-cloner le dépôt sans perturber un travail en cours.")
      ]),
      new Paragraph({ text: "", spacing: { after: 160 } }),

      subHeading("D2 — Évaluation d'une notification RGPD (violation de données)"),
      body("Constat : jusqu'au 12 août 2026, la table de données de l'application était lisible par quiconque disposait de la clé publique du site (elle-même visible par tout visiteur, puisqu'elle est envoyée au navigateur), sans authentification — exposant les comptes utilisateurs et leurs mots de passe en clair, ainsi que d'autres données personnelles (ouvriers, clients). Corrigé côté code depuis le 12 août ; la fermeture complète côté base de données nécessite une commande SQL encore à exécuter par la direction (point technique séparé, non bloquant pour cette question)."),
      decisionBox([
        questionLabel("À valider — Cette exposition constitue-t-elle une « violation de données à caractère personnel » au sens de l'article 4.12 du RGPD, nécessitant une notification à la CNIL sous 72h (art. 33) et/ou une information des personnes concernées (art. 34) ?"),
        checkboxLine("Oui — à qualifier et notifier avec le juriste"),
        checkboxLine("Non — risque jugé faible pour les droits et libertés des personnes (à documenter et justifier)"),
        checkboxLine("Analyse à mener avec le juriste avant de trancher"),
        recommendation("cette question a une portée juridique et un délai légal court (72h à compter de la connaissance de la violation) — elle ne peut pas être tranchée par le développement seul et devrait être analysée en priorité avec le juriste, indépendamment des autres points de ce document.")
      ]),
      new Paragraph({ text: "", spacing: { after: 160 } }),

      subHeading("D3 — Réinitialisation des mots de passe existants"),
      body("Constat : les mots de passe qui ont été exposés en clair jusqu'au 12 août restent valables tels quels pour les comptes qui n'en ont pas changé depuis."),
      decisionBox([
        questionLabel("À valider — Faut-il forcer une réinitialisation des mots de passe pour les comptes concernés (comptes professionnels, ouvriers, clients particuliers), par mesure de précaution ?"),
        checkboxLine("Oui, à programmer"),
        checkboxLine("Non"),
        recommendation("oui par précaution, en priorité pour les 3 comptes administrateurs de l'application.")
      ]),

      new Paragraph({
        spacing: { before: 400 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
        children: [new TextRun({
          text: "KOJI / ABL Expert Renov — Points à valider par la direction — document interne, non contractuel — 11 août 2026, mis à jour le 14 août 2026.",
          size: 16, color: MUTED
        })]
      })
    ]
  }]
});

const outPath = path.join(__dirname, "..", "KOJI-points-a-valider-manager.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("OK:", outPath);
});
