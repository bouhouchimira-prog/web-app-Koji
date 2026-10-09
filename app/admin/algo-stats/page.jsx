"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, readStoredUser } from "../../../lib/client-api";

// Vue admin "algorithme vs IA" (9 oct, demande d'Amira) — pour chaque
// assistant (Radar des Chantiers / koji pro) et chaque etape du parcours,
// quelle part des reponses a ete tranchee par du code deterministe (mot-cle,
// clic exact, code F/T...) plutot que par un appel IA. Donnees alimentees
// par lib/assistant-algo-stats.js, jamais affichee a une entreprise normale
// (verifie cote serveur dans app/api/admin/algo-stats/route.js, ceci n'est
// qu'un confort d'UI, meme principe que app/admin/clients/page.jsx).
const PERIOD_OPTIONS = [
  { days: 7, label: "7 derniers jours" },
  { days: 30, label: "30 derniers jours" },
  { days: 90, label: "90 derniers jours" }
];

function StepRow({ row }) {
  return (
    <div className="algo-stats-row">
      <div className="algo-stats-row-top">
        <strong>{row.label}</strong>
        <span className="algo-stats-row-total">{row.total} réponse{row.total > 1 ? "s" : ""}</span>
      </div>
      <div className="algo-stats-bar">
        <div className="algo-stats-bar-algo" style={{ width: `${row.algorithmePercent}%` }} />
      </div>
      <div className="algo-stats-row-legend">
        <span className="algo-stats-dot algo" />Algorithme {row.algorithmePercent}% ({row.algorithme})
        {row.ia_resserree > 0 ? <><span className="algo-stats-dot ia-resserree" />IA resserrée {Math.round((row.ia_resserree / row.total) * 100)}% ({row.ia_resserree})</> : null}
        <span className="algo-stats-dot ia" />IA {Math.round((row.ia / row.total) * 100)}% ({row.ia})
      </div>
    </div>
  );
}

function AssistantBlock({ title, rows }) {
  return (
    <div className="radar-recap-card" style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>{title}</h2>
      {rows.length === 0 ? <p className="radar-recap-note">Aucune donnée pour cette période.</p> : null}
      {rows.map((row) => <StepRow key={row.step} row={row} />)}
    </div>
  );
}

export default function AdminAlgoStatsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(null);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = readStoredUser();
    if (!user?.isAdmin) {
      router.replace("/");
      return;
    }
    setAllowed(true);
  }, [router]);

  useEffect(() => {
    if (!allowed) return;
    setData(null);
    setError("");
    apiGet(`/api/admin/algo-stats?days=${days}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [allowed, days]);

  if (allowed === null) return null;

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.push("/")}>{"<"}</button>
          <h1>Algorithme vs IA</h1>
          <span />
        </header>
        <p className="radar-recap-note" style={{ margin: "0 0 14px" }}>
          Pour chaque étape des deux assistants, part des réponses tranchées par un algorithme déterministe (mot-clé, clic exact, code F/T...) contre un appel IA.
        </p>

        <div className="radar-mode-tabs" style={{ marginBottom: 14, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              className={`radar-mode-tab ${days === opt.days ? "active" : ""}`}
              style={{ padding: "10px 12px" }}
              onClick={() => setDays(opt.days)}
            >
              <div><strong style={{ fontSize: 13 }}>{opt.label}</strong></div>
            </button>
          ))}
        </div>

        {error ? <div className="tool-empty">{error}</div> : null}
        {!data && !error ? <div className="tool-empty">Chargement…</div> : null}

        {data ? (
          <>
            <p className="radar-recap-note" style={{ marginBottom: 14 }}>{data.totalEntries} événement{data.totalEntries > 1 ? "s" : ""} mesuré{data.totalEntries > 1 ? "s" : ""} sur la période.</p>
            <AssistantBlock title="Radar des Chantiers (particulier)" rows={data.radar} />
            <AssistantBlock title="Koji pro (entreprise)" rows={data.koji} />
          </>
        ) : null}
      </section>
    </Shell>
  );
}
