"use client";

import Link from "next/link";
import { Shell } from "../components/Shell";
import { euro, shortDate } from "../lib/pricing";
import { useApi } from "../lib/use-api";

function Section({ title, href, children }) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>{title}</h2>
        {href ? <Link href={href} aria-label={title}>{">"}</Link> : null}
      </div>
      <div className="home-section-card">{children}</div>
    </section>
  );
}

function EmptyToday() {
  return (
    <div className="home-empty">
      <strong>Aucune tache pour aujourd'hui</strong>
      <span>Vous etes a jour !</span>
    </div>
  );
}

export default function HomePage() {
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: tasks } = useApi("/api/tasks", "tasks");

  const activeProjects = projects.filter((project) => project.status !== "Archive");
  const todoTasks = tasks.filter((task) => !task.done);
  const quotesInProgress = quotes.filter((quote) => ["Brouillon", "Pret a envoyer", "Envoye"].includes(quote.status));
  const signedRevenue = quotes.filter((quote) => quote.status === "Signe").reduce((sum, quote) => sum + Number(quote.totalTtc || 0), 0);
  const waitingRevenue = quotes.filter((quote) => quote.status === "Envoye").reduce((sum, quote) => sum + Number(quote.totalTtc || 0), 0);
  const createLabel = activeProjects.length === 0 ? "Creer votre premier chantier" : "Creer votre chantier";

  return (
    <Shell>
      <div className="home-feed">
        <Link className="home-primary-action" href="/chantier/new">
          <span>+</span>
          {createLabel}
        </Link>

        <Section title="A faire maintenant" href="/planning">
          {todoTasks.length === 0 ? (
            <EmptyToday />
          ) : (
            <div className="home-list">
              {todoTasks.slice(0, 3).map((task) => (
                <article className="home-list-item alert" key={task.id}>
                  <span className="home-list-icon">!</span>
                  <div className="home-list-main">
                    <strong>{task.label}</strong>
                    <small>{task.project} - {task.assignedTo} - {shortDate(task.dueDate)}</small>
                  </div>
                  <span className="home-list-meta">A faire</span>
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="Chantiers" href="/chantiers">
          {activeProjects.length === 0 ? (
            <div className="home-empty"><strong>Aucun chantier</strong><span>Commencez par creer votre chantier.</span></div>
          ) : (
            <>
              <div className="home-list">
                {activeProjects.slice(0, 3).map((project) => (
                  <article className="home-list-item" key={project.id}>
                    <span className="home-list-icon">X</span>
                    <div className="home-list-main">
                      <strong>{project.title}</strong>
                      <small>{project.client}</small>
                    </div>
                    <span className="home-list-meta">{project.status}</span>
                  </article>
                ))}
              </div>
              {activeProjects.length > 3 ? <p className="home-more">+ {activeProjects.length - 3} autres</p> : null}
            </>
          )}
        </Section>

        <Section title="Devis en cours" href="/devis">
          {quotesInProgress.length === 0 ? (
            <div className="home-empty"><strong>Aucun devis en cours</strong><span>Les devis apparaitront ici.</span></div>
          ) : (
            <>
              <div className="home-list">
                {quotesInProgress.slice(0, 3).map((quote) => (
                  <article className="home-list-item" key={quote.id}>
                    <span className="home-list-icon">#</span>
                    <div className="home-list-main">
                      <strong>{quote.client}</strong>
                      <small>{quote.quoteNumber} - {quote.project}</small>
                    </div>
                    <span className="home-list-meta">{euro(quote.totalTtc)}</span>
                  </article>
                ))}
              </div>
              {quotesInProgress.length > 3 ? <p className="home-more">+ {quotesInProgress.length - 3} autres</p> : null}
            </>
          )}
        </Section>

        <Section title="Chiffre d'affaires">
          <div className="home-revenue-list">
            <div>
              <span>Facture</span>
              <strong>{euro(signedRevenue)}</strong>
            </div>
            <div>
              <span>En attente de signature</span>
              <strong>{euro(waitingRevenue)}</strong>
            </div>
          </div>
        </Section>
      </div>
    </Shell>
  );
}
