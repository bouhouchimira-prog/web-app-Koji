# KOJI — Interface Koji & Marketplace

**Rédigé par :** Amira
**Date :** 3 septembre 2026
**Objet :** Récapitulatif pour la réunion de demain — pivot de la page de connexion, nouvelle interface Koji (particulier / Radar des Chantiers), Marketplace côté Koji Pro (entreprise), et les deux premières briques IA.

**Important :** rien de ce qui suit n'a encore été poussé sur GitHub ni déployé. Tout est en local, testé au fur et à mesure, prêt à être relu avant mise en ligne.

---

## 1. Résumé du repositionnement

La page de connexion publique a été restructurée : **Koji** (profil particulier, porte d'entrée vers Radar des Chantiers) est maintenant l'interface mise en avant en premier, avec un slogan et une animation. **Koji Pro** (profil entreprise) est toujours disponible, mais réduit à une petite carte repliable en bas de la même page plutôt que d'être à égalité visuelle.

Les accès directs client (suivi de chantier signé) et ouvrier (pointage) restent entièrement fonctionnels — rien n'a été supprimé côté fonctionnalités — mais ils ne sont plus mis en avant sur cette page d'accueil : un particulier qui a déjà un chantier suivi avec une entreprise et un particulier qui vient chercher une entreprise via Radar des Chantiers utilisent désormais le **même compte Koji**.

---

## 2. Côté Koji (particulier) — Radar des Chantiers

### Ce qui existe aujourd'hui

- **Accueil simplifié** : un seul bouton "Publier une offre" + la liste "Mes offres", sans les anciens indicateurs de devis/chantiers qui n'avaient plus leur place ici.
- **Assistant de publication en 6 étapes**, conforme au cahier des charges (§3.1 — une information par écran) : Photos, Description + métier, Adresse (avec autocomplétion réelle via la Base Adresse Nationale), Budget, Fournitures, Validation.
- **Publication gratuite et illimitée**, sans quota ni palier payant (décision de Bilal du 2 septembre, déjà appliquée).
- **Fiche détail de chaque offre**, avec la liste des entreprises qui ont pris contact et l'historique de la discussion avec chacune.

### Fichiers principaux

- `app/client/page.jsx` — accueil
- `app/client/radar/page.jsx` — liste "Mes offres"
- `app/client/radar/new/page.jsx` — assistant de publication
- `app/client/radar/[id]/page.jsx` — fiche détail + conversations
- `app/api/chantier-offres/route.js` — création/liste des offres
- `components/ClientTopbar.jsx` — menu simplifié (Accueil, Mes offres, Profil, Paramètres, Déconnexion)

---

## 3. Côté Koji Pro (entreprise) — Marketplace

Les entreprises voient les chantiers publiés par les particuliers via l'outil **Marketplace**, accessible depuis leur espace habituel.

- **`/marketplace`** : liste des chantiers disponibles (métier, adresse, budget si le particulier a choisi de le rendre visible, date de publication).
- **`/marketplace/[id]`** : fiche détail d'un chantier — photos, description complète, adresse, et surtout la possibilité de **contacter le client pour avoir plus de détails** : bouton d'appel direct, e-mail (révélé au clic), et discussion interne Koji.

### Fichiers principaux

- `app/marketplace/page.jsx` — liste des chantiers
- `app/marketplace/[id]/page.jsx` — fiche détail + contact + discussion
- `app/api/marketplace/offres/route.js` — liste (côté entreprise)
- `app/api/marketplace/offres/[id]/route.js` — détail (côté entreprise)

---

## 4. Discussion interne Koji — en cours de réglage

La messagerie entre une entreprise et un particulier fonctionne dans les deux sens (l'entreprise peut écrire, le particulier reçoit une **notification** et peut répondre depuis sa fiche d'offre). La notification reçue par le particulier indique déjà le nom de l'entreprise, son adresse, son site web si renseigné, et donne accès à sa carte de visite Koji si l'entreprise a un compte payant.

**Ce qui est encore en réglage, à évoquer en réunion :**

- La prise de rendez-vous (RDV) n'est pas encore structurée dans la discussion — pour l'instant c'est un simple échange de messages, sans proposition/confirmation de créneau.
- Le cahier des charges (§5.4) prévoit que l'adresse exacte et les coordonnées du particulier ne soient partagées qu'après un RDV confirmé. Pour l'instant, en bêta interne, elles sont visibles dès l'ouverture de la fiche par l'entreprise — un écart volontaire et temporaire, à resserrer avant d'ouvrir à de vraies entreprises externes (V2).

### Fichiers principaux

- `app/api/marketplace/offres/[id]/messages/route.js` — messagerie (entreprise et particulier)
- `app/api/marketplace/offres/[id]/entreprise-card/route.js` — carte de visite consultable par le particulier

---

## 5. Devis pré-rempli par IA (côté entreprise)

Sur la fiche d'un chantier, l'entreprise peut cliquer sur **"Générer un devis avec l'IA"**. Le système envoie à Claude la photo du chantier, sa description, et un extrait pertinent de notre bibliothèque de prix interne (métier concerné), puis crée directement un vrai devis (statut "Brouillon") dans l'éditeur existant — l'entreprise n'a plus qu'à l'ajuster et l'envoyer.

Extrait du schéma de réponse imposé à l'IA :

```
{
  "lots": [
    {
      "nom": "string",
      "postes": [
        { "designation": "string", "quantite": number, "prix_unitaire": number, "prix_total": number }
      ]
    }
  ],
  "prix_total_estime": number
}
```

### Fichiers principaux

- `app/api/estimer-devis/route.js` — génération et création du devis
- `lib/ouvrages.js` — bibliothèque de prix (extraite pour être partagée entre les deux briques IA)
- `lib/quote-mapping.js` — lien entre un devis généré par IA et l'offre d'origine

---

## 6. Nouveau : assistant IA côté particulier

À l'étape "Photos" de la publication d'une offre, un bouton **"Discuter avec l'assistant IA"** ouvre un vrai mini-chat. L'assistant pose une question à la fois (type de travaux, surface/unité, fournitures, budget), puis propose un résumé modifiable : description, métier, et une **fourchette de budget indicative** clairement marquée "estimation IA, non engageante" — jamais un chiffre ferme. Le particulier peut tout corriger avant de valider, et ça pré-remplit les étapes suivantes du formulaire (toujours modifiables ensuite).

*Point à signaler en réunion : le cahier des charges (§6) prévoyait volontairement de ne pas montrer d'estimation chiffrée au particulier en V1, faute de données réelles pour la calibrer. C'est un écart assumé, décidé pour pouvoir tester la mécanique dès maintenant.*

### Fichiers principaux

- `app/api/radar-assistant/route.js` — le chat
- `components/RadarAiAssistant.jsx` — l'interface de discussion

---

## 7. Claude Console — configuration

Un compte a été créé sur `platform.claude.com` (workspace "Koji"), avec une clé API générée et déjà branchée en local pour tester les deux fonctionnalités IA ci-dessus.

**Point bloquant à régler avant de pouvoir tester en conditions réelles : il faut ajouter des crédits sur ce compte** — il est actuellement à 0,00 $, donc les deux boutons IA (devis entreprise et assistant particulier) renvoient une erreur "crédits épuisés" tant que ce n'est pas fait.

---

## 8. Ce qui reste ouvert pour la V1 complète

- **Positionnement des entreprises** (bouton "Se positionner", plafond de chantiers simultanés par entreprise) — pas encore construit ; les deux briques IA ci-dessus ont été branchées directement sur la fiche chantier en attendant.
- **Zones de travail par entreprise** (matching géographique automatique) — pas encore construit ; toutes les entreprises voient tous les chantiers pour l'instant.
- **Prise de RDV structurée** dans la discussion interne.
- **Partage des coordonnées uniquement après RDV confirmé** (actuellement immédiat, en bêta interne).
- **Paiement échelonné** via un prestataire type Stripe Connect (acompte / avancement / solde).

---

*Note sur les captures d'écran : je n'ai pas pu intégrer directement les copies d'écran échangées pendant nos échanges dans ce document — je n'ai pas accès aux fichiers images correspondants sur le disque, seulement à ce qui a été collé dans la conversation. Si tu veux des captures dans le document final, le plus simple est de les enregistrer toi-même (ou de me les repartager en tant que fichiers) et je les intègre.*
