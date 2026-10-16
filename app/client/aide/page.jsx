"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { apiSend } from "../../../lib/client-api";

// Aide cote particulier (16 oct, maquette Artifact) — meme principe que la
// page Aide entreprise (app/aide/page.jsx, confirme avec Amira via
// AskUserQuestion) : du vrai contenu reduit plutot que des chiffres gonfles,
// les compteurs correspondent exactement a ce qui est ecrit ci-dessous.
// Pas de notation/avis artisan (aucun systeme de notation n'existe dans
// l'app, contrairement a ce que montrait la maquette) ni de 2FA — on
// n'affiche que des fonctionnalites reellement disponibles.

const THEMES = [
  { key: "premiers-pas", icon: "🚀", label: "Premiers pas" },
  { key: "publier", icon: "📣", label: "Publier un chantier" },
  { key: "messages", icon: "💬", label: "Échanger avec un artisan" },
  { key: "chantiers", icon: "🏗️", label: "Mes chantiers et devis" },
  { key: "compte", icon: "🛡️", label: "Mon compte" }
];

const ARTICLES = [
  { theme: "premiers-pas", title: "Découvrir l'espace particulier", body: "Accueil regroupe l'essentiel : vos demandes en cours et vos chantiers signés. Le menu donne accès à Mes demandes, Devis reçus, Mes chantiers et Messages." },
  { theme: "publier", title: "Publier un chantier gratuitement", body: "Depuis \"+ Publier un chantier\", décrivez votre projet à l'assistant koji (avec des photos si besoin) : il prépare une fourchette de prix indicative et publie votre demande aux entreprises de votre secteur. C'est gratuit et illimité." },
  { theme: "publier", title: "Comment une entreprise me contacte", body: "Dès qu'une entreprise s'intéresse à votre demande, elle vous écrit dans Messages. Vous retrouvez aussi la demande elle-même depuis Mes demandes, avec son statut." },
  { theme: "messages", title: "Répondre à une entreprise", body: "Chaque conversation est rattachée à une demande précise. Vous pouvez échanger librement, accepter ou refuser un rendez-vous proposé par l'entreprise, et choisir de débloquer vos photos du chantier pour elle." },
  { theme: "messages", title: "Mes échanges restent sur koji", body: "Tant qu'aucun rendez-vous n'est confirmé, vos coordonnées complètes ne sont pas partagées — la discussion se fait depuis Koji." },
  { theme: "chantiers", title: "Suivre un chantier signé", body: "Une fois un devis signé avec une entreprise, le chantier apparaît dans Mes chantiers avec son avancement, les prochaines étapes et les documents liés." },
  { theme: "chantiers", title: "Télécharger un devis signé", body: "Depuis Devis reçus, chaque devis signé peut être téléchargé en PDF à tout moment." },
  { theme: "compte", title: "Modifier mes informations", body: "Depuis Profil, mettez à jour vos coordonnées et votre mot de passe (l'ancien mot de passe vous sera redemandé)." },
  { theme: "compte", title: "Exporter ou supprimer mes données", body: "Depuis Paramètres, vous pouvez exporter une copie de vos données ou demander la suppression de votre compte à tout moment." }
];

const FAQ = [
  { q: "Publier un chantier coûte-t-il quelque chose ?", a: "Non, publier un chantier via Radar des Chantiers est entièrement gratuit et sans limite, quel que soit le nombre de demandes." },
  { q: "Comment savoir si une entreprise s'intéresse à ma demande ?", a: "Vous recevez une notification et un message dans Messages dès qu'une entreprise vous contacte au sujet de votre demande." },
  { q: "Mon numéro de téléphone est-il visible par tout le monde ?", a: "Non. Il n'est communiqué qu'à l'entreprise que vous retenez, jamais affiché publiquement." },
  { q: "Où retrouver mes devis déjà signés ?", a: "Dans Devis reçus : chaque devis signé peut y être téléchargé en PDF à tout moment." },
  { q: "Comment supprimer mon compte ?", a: "Depuis Paramètres > Supprimer mon compte, envoyez votre demande : elle est traitée par notre équipe." }
];

export default function ClientAidePage() {
  const [activeTheme, setActiveTheme] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");

  const visibleArticles = activeTheme ? ARTICLES.filter((a) => a.theme === activeTheme) : ARTICLES;

  async function submitReport(event) {
    event.preventDefault();
    if (!reportMessage.trim()) return;
    setReportSending(true);
    setReportError("");
    try {
      // Reutilise le signalement technique existant (lib/mailer.js,
      // sendTechnicalReportEmail) avec un prefixe distinct pour que
      // l'equipe distingue un probleme avec un artisan d'un bug technique.
      await apiSend("/api/support/report", {
        message: `[Signalement artisan] ${reportMessage.trim()}`,
        accountType: "particulier",
        page: "/client/aide"
      });
      setReportSent(true);
      setReportMessage("");
      window.setTimeout(() => { setReportOpen(false); setReportSent(false); }, 1800);
    } catch (error) {
      setReportError(error.message || "Impossible d'envoyer le signalement.");
    } finally {
      setReportSending(false);
    }
  }

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Aide</span></h1>
            <p>Guides, questions fréquentes et support pour vos travaux.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <a href="mailto:contact@kojibuild.com" className="button blue">Contacter le support</a>
          </div>
        </header>

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
              <strong>BESOIN D'AIDE POUR CHOISIR ?</strong>
              <p>L'assistant koji vous aide à préciser votre projet et vos critères.</p>
              <Link href="/client/radar/new" className="button white">Discuter avec l'assistant</Link>
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Contacter le support</strong>
              <p className="tool-muted" style={{ margin: "0 0 10px" }}>Réponse sous 24 à 48h par email.</p>
              <a href="mailto:contact@kojibuild.com" className="button secondary profile-link-button">Écrire au support</a>
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Un problème avec un artisan ?</strong>
              <p className="tool-muted" style={{ margin: "0 0 10px" }}>Signalez un retard, un désaccord sur un devis ou un comportement inapproprié.</p>
              <button type="button" className="button secondary profile-link-button" onClick={() => { setReportOpen(true); setReportSent(false); setReportError(""); }}>
                Faire un signalement
              </button>
            </div>
          </div>
        </div>
      </section>

      {reportOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setReportOpen(false)}>
          <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Signaler un problème avec un artisan</h2>
            <form onSubmit={submitReport} className="settings-report-form">
              <textarea
                rows={4}
                className="profile-textarea"
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
                placeholder="Décrivez la situation (quelle entreprise, quel chantier, ce qui s'est passé)…"
                autoFocus
              />
              {reportError ? <p className="profile-message error">{reportError}</p> : null}
              {reportSent ? <p className="profile-message">Signalement envoyé, notre équipe revient vers vous.</p> : null}
              <div>
                <button type="button" onClick={() => setReportOpen(false)}>Annuler</button>
                <button type="submit" disabled={reportSending || !reportMessage.trim()}>Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
