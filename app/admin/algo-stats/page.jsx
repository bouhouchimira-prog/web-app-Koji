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
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
      <div className="kv">
        <span>{row.label}</span>
        <b>{row.total} réponse{row.total > 1 ? "s" : ""}</b>
      </div>
      <div className="bar"><i style={{ width: `${row.algorithmePercent}%` }} /></div>
      <p className="sm2" style={{ margin: "6px 0 0" }}>
        Algorithme {row.algorithmePercent} % ({row.algorithme})
        {row.ia_resserree > 0 ? ` · IA resserrée ${Math.round((row.ia_resserree / row.total) * 100)} % (${row.ia_resserree})` : ""}
        {` · IA ${Math.round((row.ia / row.total) * 100)} % (${row.ia})`}
      </p>
    </div>
  );
}

function AssistantBlock({ title, rows }) {
  return (
    <section className="card">
      <div className="card-h"><h2>{title}</h2></div>
      {rows.length === 0 ? <p className="muted">Aucune donnée pour cette période.</p> : null}
      {rows.map((row) => <StepRow key={row.step} row={row} />)}
    </section>
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
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.push("/")}>← Accueil</button>
          <span className="eyebrow">Administration</span>
          <h1>Algorithme vs IA</h1>
          <span className="muted">Pour chaque étape des deux assistants, part des réponses tranchées par un algorithme déterministe (mot-clé, clic exact, code F/T...) contre un appel IA.</span>
        </div>
      </div>

      <div className="kp-seg" role="group" aria-label="Période" style={{ marginBottom: 16 }}>
        {PERIOD_OPTIONS.map((opt) => (
          <button type="button" key={opt.days} className={days === opt.days ? "on" : ""} aria-pressed={days === opt.days} onClick={() => setDays(opt.days)}>
            {opt.label}
          </button>
        ))}
      </div>

      {error ? <p className="notice notice-err" role="alert">{error}</p> : null}
      {!data && !error ? <p className="empty">Chargement…</p> : null}

      {data ? (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>{data.totalEntries} événement{data.totalEntries > 1 ? "s" : ""} mesuré{data.totalEntries > 1 ? "s" : ""} sur la période.</p>
          <div className="pf-g2">
            <AssistantBlock title="Radar des Chantiers (particulier)" rows={data.radar} />
            <AssistantBlock title="Koji pro (entreprise)" rows={data.koji} />
          </div>
        </>
      ) : null}
    </Shell>
  );
}
