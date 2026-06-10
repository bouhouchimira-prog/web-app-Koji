"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { euro, shortDate } from "../../lib/pricing";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("koji-user") || "null");
  } catch {
    return null;
  }
}

export default function ClientHomePage() {
  const [user, setUser] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (!stored?.email) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ email: stored.email, userId: stored.id || "" });
    fetch(`/api/client/quotes?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => setQuotes(data.quotes || []))
      .finally(() => setLoading(false));
  }, []);

  const signedQuotes = useMemo(() => quotes.filter((quote) => quote.status === "Signe"), [quotes]);
  const activeTasks = useMemo(() => quotes.flatMap((quote) => quote.tasks || []).filter((task) => task.status !== "Terminee"), [quotes]);

  if (!user?.email) {
    return (
      <main className="client-space">
        <section className="client-auth-card">
          <div className="koji-mark small">KJ</div>
          <h1>Espace particulier</h1>
          <p>Connectez-vous avec l'adresse e-mail utilisee pour recevoir votre devis.</p>
          <Link className="primary-button" href="/login?type=particulier">Connexion client</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="client-space">
      <header className="client-topbar">
        <div>
          <p className="eyebrow">Koji</p>
          <h1>Espace particulier</h1>
          <p>{user.name || user.email}</p>
        </div>
        <Link className="ghost-button" href="/client/profil"><span className="client-mini-icon" aria-hidden="true">P</span> Profil</Link>
      </header>

      <section className="client-grid">
        <article className="client-card metric-card">
          <span className="client-mini-icon" aria-hidden="true">D</span>
          <span>Devis recus</span>
          <strong>{quotes.length}</strong>
        </article>
        <article className="client-card metric-card">
          <span className="client-mini-icon" aria-hidden="true">S</span>
          <span>Devis signes</span>
          <strong>{signedQuotes.length}</strong>
        </article>
        <article className="client-card metric-card">
          <span className="client-mini-icon" aria-hidden="true">T</span>
          <span>Taches chantier</span>
          <strong>{activeTasks.length}</strong>
        </article>
      </section>

      <section className="client-card">
        <div className="client-section-title">
          <h2>Mes devis</h2>
          <span>{loading ? "Chargement..." : `${quotes.length} document(s)`}</span>
        </div>
        <div className="client-list">
          {quotes.length === 0 ? (
            <div className="client-empty">Aucun devis lie a cette adresse e-mail.</div>
          ) : quotes.map((quote) => (
            <article className="client-row" key={quote.id}>
              <div>
                <strong>{quote.reference}</strong>
                <span>{quote.project?.name || quote.projectName || "Chantier"} · {shortDate(quote.createdAt)}</span>
              </div>
              <div className="client-row-actions">
                <span className="client-amount">{euro(quote.totalTtc || quote.total || 0)}</span>
                <Link className="ghost-button compact" href={`/client/devis/${quote.id}`}>Voir</Link>
                {quote.signatureUrl ? <a className="primary-button compact" href={quote.signatureUrl}>Signer</a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="client-card">
        <div className="client-section-title">
          <h2>Suivi chantier</h2>
          <span>{activeTasks.length} tache(s)</span>
        </div>
        <div className="client-list">
          {activeTasks.length === 0 ? (
            <div className="client-empty">Aucune tache en cours.</div>
          ) : activeTasks.map((task) => (
            <article className="client-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <span>Date : {task.dueDate ? shortDate(task.dueDate) : "Date a definir"}</span>
              </div>
              <span className="status-pill">{task.status || "A faire"}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="client-card muted-card">
        <span className="client-mini-icon" aria-hidden="true">A</span>
        <div>
          <h2>Documents et chantier</h2>
          <p>Les devis signes, factures et documents ajoutes resteront lies a votre chantier.</p>
        </div>
      </section>
    </main>
  );
}
