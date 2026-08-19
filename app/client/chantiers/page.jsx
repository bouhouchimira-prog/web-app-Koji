"use client";

import { useEffect, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { useLocale } from "../../../lib/i18n";
import { ChantierCard } from "../page";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function ClientChantiersPage() {
  const { L } = useLocale();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.email) { setLoading(false); return; }
    fetch("/api/client/quotes")
      .then((r) => r.json())
      .then((data) => setQuotes(data.quotes || []))
      .finally(() => setLoading(false));
  }, []);

  const signedQuotes = quotes.filter((q) => q.status === "Signe" || q.signatureStatus === "Signe");

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="ct-welcome">
        <strong>{L.clientSpace.myProjects}</strong>
      </div>

      <section className="ct-section">
        {loading ? <div className="client-empty">{L.clientSpace.loading}</div> : null}
        {!loading && signedQuotes.length === 0 ? <div className="client-empty">{L.clientSpace.noQuotes}</div> : null}
        {signedQuotes.map((quote) => (
          <ChantierCard
            key={quote.id}
            quote={quote}
            signedLabel={L.clientSpace.signedLabel}
            inProgressLabel={L.clientSpace.taskStepInProgress}
            waitingLabel={L.clientSpace.waiting}
          />
        ))}
      </section>
    </main>
  );
}
