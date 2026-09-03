# KOJI — Réponse à la proposition de restructuration

**Destinataires :** toi (auteur de la note "Restructuration Koji") et Bilal
**Répond à :** "Restructuration Koji" (maquette et remarques suite à la prise en main de l'application)
**Rédigé par :** Amira
**Date :** 26 août 2026

Merci beaucoup pour ces points, franchement bien vus pour quelqu'un qui découvre l'appli avec un regard neuf. Je réponds un par un ci-dessous.

---

## 1. Guide de l'application (onboarding)

Je suis d'accord sur le principe. Pour l'instant j'attendais juste d'avoir fini les grosses tâches avant de m'y mettre sérieusement — l'idée est de voir avec l'IA pour faire une belle animation et l'intégrer proprement à la plateforme. Le code existe déjà, mais je l'ai seulement testé sur une autre plateforme pour l'instant, pas encore branché sur Koji.

## 2. Le Filtre de Confiance (SIRET, KBIS, assurance dès l'inscription)

Sur le principe je suis d'accord sur le fond, mais pas sur le timing. Imposer tout de suite l'import du KBIS et de l'assurance RC Pro/Décennale risque de compliquer l'inscription — j'ai déjà travaillé avec de petites entreprises du BTP, et beaucoup ont du mal à réunir ou à envoyer ces documents ; il leur faut souvent quelqu'un pour les assister.

Ceci dit, dès qu'on commence à vraiment vendre le produit, cette obligation devra être mise en place. Ce n'est pas un refus, juste une question de moment.

## 3. Le Ciblage du Profil

- **Spécialité** : déjà fait.
- **Zone géographique** : on la rajoutera dès que la marketplace sera en place (pour faire remonter les chantiers les plus proches).
- **Grille tarifaire** : j'ai besoin que tu précises ce que tu entends par là. Aujourd'hui on a un prix forfaitaire par jour et par heure — c'est ce que tu avais en tête, ou tu penses à autre chose (une grille par type de prestation, par exemple) ?

## 4. Le Mode "Vitrine" (attente de validation)

Je valide le principe de "en attente de validation" avec accès en mode lecture seule pendant ce temps. Le point qui me fait hésiter, c'est l'import des documents dès le départ — même remarque qu'au point 2 : certaines entreprises ne peuvent tout simplement pas les fournir tout de suite.

## 5. Radar à chantiers / Marketplace

Je ne peux pas encore te répondre sur ce point précis — c'était prévu qu'on la mette en place après le lancement. J'ai plusieurs questions à poser à Bilal avant de commencer à la construire, donc on en reparle dès qu'on a fait le point avec lui.

## 6. "On ne sait pas à quoi sert vraiment Koji" — clarification

Tu as raison de pointer ça, donc je clarifie où on en est aujourd'hui et où on va.

Au départ, l'idée de Koji c'était juste de faciliter la création de devis. Aujourd'hui on est allés bien au-delà : Koji est devenu un produit qui permet de faire toutes les tâches administratives d'une entreprise — plus précisément une entreprise du BTP :

- **Devis** : la base du produit — création avec les ouvrages ajoutés manuellement ou via la bibliothèque d'ouvrages, et les fournitures directement depuis l'appli.
- **Signature électronique** : le client signe le devis en ligne, sans aller-retour papier.
- **RDV et urgences** : gestion des rendez-vous, et remontée des urgences chantier (fuite, dégât, problème sur les travaux) sous forme d'alertes.
- **Équipe** : planning des ouvriers et heures de travail, avec un historique de travail exportable qui facilite la comptabilité derrière.
- **Dépenses** : suivi des dépenses par chantier.
- **Factures** : création des factures, avec l'historique de ce qui est payé ou en attente.
- **Rentabilité réelle** : Koji calcule les gains et les dépenses de chaque chantier en **net réel**, pas en estimation — avec une traçabilité sur tout et partout.
- **Espace client** : chaque client final suit l'avancement de son chantier, ouvrage par ouvrage, et accède à ses documents sans repasser par l'artisan.
- **Espace ouvrier** : chaque ouvrier a son propre accès, avec uniquement ses tâches (sur tous ses chantiers) et son pointage.
- **Échange** : un fil de messages/alertes centralisé entre l'entreprise, le client et les ouvriers, rattaché à l'ouvrage précis concerné.

Tout ça, c'est côté profil entreprise.

Sur l'accueil actuel, l'idée d'aller vers des fonctions bien identifiées est déjà en cours de mise en place : les cartes ont été réorganisées pour remonter en premier ce qui rapporte de l'argent ou qui demande une action — chiffre d'affaires (facturé, en attente de signature, dépenses, net gagné), puis "à faire maintenant", puis les devis en cours, les chantiers actifs et les interventions. Les alertes urgentes remontées par les clients ou les ouvriers apparaissent aussi en priorité.

Ce qui manque encore pour que ce soit lisible d'un coup d'œil comme "trois fonctions", c'est justement la marketplace (point 5 ci-dessus) — sans elle, Koji tourne aujourd'hui sur deux grands blocs (gérer ses devis/chantiers, et être payé), pas trois. Une fois la marketplace posée, les **Pôles** proposés au point 7 ci-dessous (Opportunités, Terrain, Trésorerie, Ressources) seront exactement la réponse concrète à ce point : ils sont les fonctions dont tu parles, rendues visibles dans le menu. Les deux remarques (point 2 et point 7 de ta note) se rejoignent en fait sur la même solution.

## 7. Menu réorganisé par "Pôles"

J'aime bien l'idée. Si Bilal valide, on la met en place — juste besoin de revoir l'ordre des pôles avant. On en discute ensemble pour arrêter l'ordre définitif.

## 8. Création du devis — dashboard unique plutôt qu'étapes

Voici le lien Figma que je te laisse consulter : [KOJI UI/UX — Figma](https://www.figma.com/design/EmaQp2MtkL0KSqgRicEOvP/KOJI-UI-UX?node-id=0-4&t=mVAcP9hNvx9RClnE-1)

Tu y retrouveras les étapes que tu proposes (client → chantier → lignes de prix → conditions → validation) — on les avait déjà construites au tout début. Mais avec Bilal, on en a eu marre de travailler avec cette méthode, surtout sur les documents type administration (haha), et on s'est rendu compte qu'un seul dashboard qui contient tout facilite vraiment les choses.

La raison principale : un devis n'est presque jamais validé à sa première version. Il faut souvent revenir en arrière ou avancer sur une seule modification précise, et remonter les "étapes" à chaque fois devient vite fatiguant. D'où le choix actuel d'un formulaire unique plutôt qu'un assistant pas-à-pas.

## 9. Gamification

Comme l'a dit Bilal, ce sera pour plus tard. Pas la priorité tant que l'organisation de l'appli n'est pas réglée.

---

Merci encore pour le travail sur la maquette, ça aide beaucoup à visualiser. On se cale avec Bilal pour trancher l'ordre des pôles et les questions marketplace, et j'avance sur le guide d'onboarding de mon côté.
