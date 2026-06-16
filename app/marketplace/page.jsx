"use client";

import { Shell } from "../../components/Shell";
import { useApi } from "../../lib/use-api";
import { apiSend } from "../../lib/client-api";
import { useState } from "react";

function money(v) {
  return Number(v || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(v) {
  if (!v) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(v));
}

export default function MarketplacePage() {
  const { data: projects, setData: setProjects } = useApi("/api/marketplace", "projects", []);
  const [sending, setSending] = useState({});
  const [messages, setMessages] = useState({});
  const [feedback, setFeedback] = useState({});

  async function handleInterest(project) {
    if (project.isOwn) return;
    setSending((s) => ({ ...s, [project.id]: true }));
    try {
      await apiSend("/api/marketplace", { action: "interest", projectId: project.id, message: messages[project.id] || "" });
      setProjects((current) => current.map((p) => p.id === project.id ? { ...p, alreadyInterested: true, interestCount: p.interestCount + 1 } : p));
      setFeedback((f) => ({ ...f, [project.id]: "Votre intérêt a été transmis au propriétaire du chantier." }));
    } catch (err) {
      setFeedback((f) => ({ ...f, [project.id]: err.message || "Erreur lors de l'envoi." }));
    } finally {
      setSending((s) => ({ ...s, [project.id]: false }));
    }
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">MARKETPLACE</p>
          <h1>Chantiers disponibles</h1>
          <p className="page-subtitle">Découvrez les chantiers publiés par d'autres utilisateurs Koji et manifestez votre intérêt.</p>
        </div>
      </header>

      <section className="marketplace-grid">
        {!projects.length ? (
          <div className="empty-state">
            <p>Aucun chantier publié pour le moment.</p>
            <small>Les chantiers publiés par les autres utilisateurs Koji apparaîtront ici.</small>
          </div>
        ) : projects.map((project) => (
          <article className="marketplace-card" key={project.id}>
            <div className="marketplace-card-header">
              <div>
                <h2>{project.title}</h2>
                {project.address && <p className="marketplace-address">{project.address}</p>}
              </div>
              <span className="marketplace-type-badge">{project.type || "Travaux"}</span>
            </div>

            {project.description && <p className="marketplace-description">{project.description}</p>}

            <div className="marketplace-meta">
              {project.budgetHt > 0 && <span>Budget HT : <strong>{money(project.budgetHt)}</strong></span>}
              {project.startDate && <span>Début : <strong>{formatDate(project.startDate)}</strong></span>}
              {project.rooms?.length > 0 && <span>Pièces : <strong>{project.rooms.join(", ")}</strong></span>}
              <span>{project.interestCount} intérêt{project.interestCount !== 1 ? "s" : ""}</span>
            </div>

            {!project.isOwn && (
              <div className="marketplace-interest-block">
                {project.alreadyInterested ? (
                  <p className="marketplace-already">Intérêt transmis — le propriétaire vous contactera.</p>
                ) : (
                  <>
                    <textarea
                      className="marketplace-message"
                      placeholder="Message optionnel : présentez-vous, votre expérience..."
                      value={messages[project.id] || ""}
                      onChange={(e) => setMessages((m) => ({ ...m, [project.id]: e.target.value }))}
                      rows={2}
                    />
                    <button
                      type="button"
                      className="button blue"
                      onClick={() => handleInterest(project)}
                      disabled={sending[project.id]}
                    >
                      {sending[project.id] ? "Envoi..." : "Je suis intéressé"}
                    </button>
                  </>
                )}
                {feedback[project.id] && <p className="marketplace-feedback">{feedback[project.id]}</p>}
              </div>
            )}

            {project.isOwn && (
              <div className="marketplace-own-badge">Votre chantier — publié le {formatDate(project.publishedAt)}</div>
            )}

            <small className="marketplace-date">Publié le {formatDate(project.publishedAt)}</small>
          </article>
        ))}
      </section>
    </Shell>
  );
}
