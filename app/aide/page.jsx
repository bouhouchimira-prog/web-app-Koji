"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";

// Page "Aide" (15 oct, maquette fournie par Amira) — contrairement aux
// tableaux de bord precedents (Fournitures, Chantiers, Devis...), il n'y a
// pas de donnees metier existantes a agreger ici : c'est du contenu
// editorial. Choix confirme avec Amira (AskUserQuestion) : un vrai contenu
// reduit plutot que des chiffres gonfles — les compteurs (12 articles,
// 6 themes, 5 questions) correspondent exactement a ce qui est ecrit
// ci-dessous, rien n'est invente. Pas de "videos" (aucune n'existe et je
// ne peux pas en produire) — remplacees par des raccourcis "Prise en main"
// qui pointent vers les vrais ecrans concernes.

const THEMES = [
  { key: "premiers-pas", icon: "🚀", label: "Premiers pas" },
  { key: "devis", icon: "📄", label: "Devis et assistant" },
  { key: "factures", icon: "🧾", label: "Factures" },
  { key: "bibliotheque", icon: "📖", label: "Bibliothèque koji" },
  { key: "abonnement", icon: "⭐", label: "Abonnement koji premium" },
  { key: "compte", icon: "🛡️", label: "Compte et sécurité" }
];

const ARTICLES = [
  { theme: "premiers-pas", title: "Découvrir le menu koji", body: "Principal (Accueil, Chantiers, Devis) regroupe l'essentiel. Koji Premium (Factures, Fournitures, Bibliothèque koji, Comptabilité, Contacts, Calendrier, Archives, Interventions, Avenant...) rassemble les outils avancés, disponibles avec l'abonnement." },
  { theme: "premiers-pas", title: "Créer votre premier chantier", body: "Depuis Chantiers, cliquez sur \"+ Nouveau chantier\" — ou laissez-le se créer automatiquement : chaque devis envoyé puis accepté donne naissance à un chantier suivi." },
  { theme: "devis", title: "Créer un devis avec l'assistant koji", body: "Dans l'éditeur de devis, l'assistant peut remplir les informations du chantier, ajouter des ouvrages de votre bibliothèque et proposer des fournitures automatiquement à partir de votre description des travaux." },
  { theme: "devis", title: "Envoyer un devis pour signature", body: "Le bouton \"Envoyer\" génère un lien Koji Signature sécurisé : votre client reçoit un identifiant et un mot de passe provisoire pour signer en ligne, sans rien installer." },
  { theme: "factures", title: "Transformer un devis en facture", body: "Depuis un devis accepté, le bouton \"Transformer en facture\" crée directement la facture correspondante, prête à être envoyée ou marquée payée." },
  { theme: "factures", title: "Facturer un acompte ou un solde", body: "Lors de la création d'une facture, choisissez un montant fixe, un pourcentage du devis, un acompte, ou le solde restant dû calculé automatiquement." },
  { theme: "bibliotheque", title: "Configurer votre taux horaire", body: "Depuis Profil > Informations de l'entreprise, renseignez votre taux journalier : koji calcule votre taux horaire et l'applique à tous vos ouvrages chiffrés." },
  { theme: "bibliotheque", title: "Que faire si un métier n'a pas d'ouvrage ?", body: "Ses lignes restent \"à chiffrer manuellement\" dans vos devis. Depuis Bibliothèque koji, la carte \"Métiers sans ouvrage\" liste ce qu'il reste à compléter, avec un bouton pour créer directement un ouvrage pour ce métier." },
  { theme: "abonnement", title: "Les outils inclus dans Koji Premium", body: "Factures, Fournitures, Bibliothèque koji, Comptabilité, Contacts, Calendrier, Archives, Interventions et Avenant sont réservés à l'abonnement Koji Premium, au-delà de la période d'essai." },
  { theme: "abonnement", title: "Gérer mon abonnement", body: "Depuis Profil > Abonnement, suivez votre statut, votre période d'essai restante et vos informations de facturation." },
  { theme: "compte", title: "Donner un accès à un client ou un ouvrier", body: "Depuis Clients ou Équipe, le bouton \"Copier le lien de connexion\" génère un identifiant et un mot de passe pour que votre client ou votre ouvrier/sous-traitant accède à son espace koji." },
  { theme: "compte", title: "Mot de passe oublié", body: "Utilisez le lien \"Mot de passe oublié\" sur la page de connexion, ou changez-le directement depuis votre profil une fois connecté." }
];

const FAQ = [
  { q: "Comment créer mon premier devis avec l'assistant ?", a: "Ouvrez Devis > \"+ Nouveau devis\", renseignez le client et l'objet des travaux, puis laissez l'assistant koji vous proposer des ouvrages et fournitures à partir de votre description. Vous pouvez ensuite ajuster chaque ligne avant d'envoyer." },
  { q: "Comment modifier mon taux horaire ?", a: "Depuis Profil > Informations de l'entreprise, modifiez votre taux journalier : votre taux horaire se recalcule automatiquement et s'applique à tous les nouveaux ouvrages chiffrés." },
  { q: "Que faire si un métier n'a pas d'ouvrage ?", a: "Depuis Bibliothèque koji, la carte \"Métiers sans ouvrage\" liste les métiers à compléter avec un bouton \"Compléter\". Tant qu'aucun ouvrage n'existe, les lignes de ce métier restent \"à chiffrer manuellement\" dans vos devis." },
  { q: "Comment envoyer un devis pour signature ?", a: "Depuis l'éditeur de devis, cliquez sur \"Envoyer\" : un lien Koji Signature est généré et envoyé à votre client avec un identifiant et un mot de passe provisoire pour signer en ligne." },
  { q: "Comment exporter ma comptabilité ?", a: "Depuis Comptabilité, choisissez le mois voulu puis cliquez sur \"Exporter pour l'expert-comptable\" : un fichier CSV avec toutes les écritures du mois se télécharge." }
];

const QUICKSTART = [
  { title: "Créer son premier devis", href: "/devis?new=1" },
  { title: "Transformer un devis en facture", href: "/facturation" },
  { title: "Configurer son profil et son taux horaire", href: "/profil" }
];

export default function AidePage() {
  const [activeTheme, setActiveTheme] = useState("");

  const visibleArticles = activeTheme ? ARTICLES.filter((a) => a.theme === activeTheme) : ARTICLES;

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Aide</span></h1>
            <p>Guides et support pour tirer le meilleur de koji.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <a href="mailto:contact@kojibuild.com" className="button blue">Contacter le support</a>
          </div>
        </header>

        <div className="fournitures-kpi-row">
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📚</span>
              <span className="title-chip">Articles</span>
            </div>
            <strong>{ARTICLES.length}</strong>
            <small>guides pas à pas</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">🗂️</span>
              <span className="title-chip">Thèmes</span>
            </div>
            <strong>{THEMES.length}</strong>
            <small>à parcourir</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">⏱</span>
              <span className="title-chip">Réponse support</span>
            </div>
            <strong>24-48h</strong>
            <small>par email</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">✅</span>
              <span className="title-chip">Statut de koji</span>
            </div>
            <strong>Opérationnel</strong>
            <small>aucun incident</small>
          </div>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Parcourir par thème</strong>
            </div>
            <div className="library-family-grid">
              <button
                type="button"
                className="library-family-card"
                onClick={() => setActiveTheme("")}
                style={activeTheme === "" ? { borderColor: "var(--navy)" } : undefined}
              >
                <div className="library-family-card-head">
                  <span className="library-family-icon">📋</span>
                  <strong>{ARTICLES.length}</strong>
                </div>
                <strong className="library-family-name">Tous les articles</strong>
                <small className="library-family-metier">&nbsp;</small>
              </button>
              {THEMES.map((theme) => {
                const count = ARTICLES.filter((a) => a.theme === theme.key).length;
                return (
                  <button
                    type="button"
                    key={theme.key}
                    className="library-family-card"
                    onClick={() => setActiveTheme(theme.key)}
                    style={activeTheme === theme.key ? { borderColor: "var(--navy)" } : undefined}
                  >
                    <div className="library-family-card-head">
                      <span className="library-family-icon">{theme.icon}</span>
                      <strong>{count}</strong>
                    </div>
                    <strong className="library-family-name">{theme.label}</strong>
                    <small className="library-family-metier">{count} article{count > 1 ? "s" : ""}</small>
                  </button>
                );
              })}
            </div>

            <div className="aide-article-list">
              {visibleArticles.map((article) => (
                <details className="static-faq-item" key={article.title}>
                  <summary>{article.title}</summary>
                  <p>{article.body}</p>
                </details>
              ))}
            </div>

            <div className="fournitures-main-card-head" style={{ marginTop: 24 }}>
              <strong className="title-chip">Questions fréquentes</strong>
            </div>
            {FAQ.map((item) => (
              <details className="static-faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>

          <div>
            <div className="aide-support-card">
              <strong>BESOIN D'UN COUP DE MAIN ?</strong>
              <p>Écrivez-nous, nous répondons sous 24 à 48h.</p>
              <a href="mailto:contact@kojibuild.com" className="button white">Écrire au support</a>
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Prise en main</strong>
              {QUICKSTART.map((item) => (
                <a className="aide-quickstart-row" href={item.href} key={item.href}>
                  <span className="aide-quickstart-icon">▶</span>
                  <strong>{item.title}</strong>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
