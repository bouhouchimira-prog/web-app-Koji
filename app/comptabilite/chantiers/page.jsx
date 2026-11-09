"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Shell } from "../../../components/Shell";
import { useApi } from "../../../lib/use-api";
import { euro } from "../../../lib/pricing";
import { fixText } from "../../../lib/text";
// Même devis de référence que la marge moyenne de l'accueil (PRO-01.2).
import { devisDuChantier as quoteFor } from "../../../lib/chiffres-du-mois";

const WATCH_RATIO = 0.8;

function isSigned(quote) {
  return quote.status === "Signe" || quote.signatureStatus === "Signe";
}

// PRO-09.1 : même calcul que l'onglet « Coût » de la fiche chantier
// (devis HT − dépenses saisies sur le chantier), pour que les deux écrans
// affichent toujours les mêmes chiffres.
function costRow(project, quotes, expenses) {
  const quote = quoteFor(project.id, quotes);
  const devisHt = Number(quote?.totalHt || 0);
  const spent = expenses.filter((expense) => expense.projectId === project.id).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const margin = devisHt - spent;
  const ratio = devisHt > 0 ? spent / devisHt : 0;
  let level = "ok";
  let phrase = `${Math.round(ratio * 100)} % du devis dépensé.`;
  if (devisHt <= 0) {
    level = "none";
    phrase = "Aucun devis rattaché : pas de marge calculée.";
  } else if (margin < 0) {
    level = "over";
    phrase = `Dépenses au-dessus du devis de ${euro(-margin)}.`;
  } else if (ratio >= WATCH_RATIO) {
    level = "watch";
    phrase = `${Math.round(ratio * 100)} % du devis déjà dépensé.`;
  }
  return { project, quote, devisHt, spent, margin, ratio, level, phrase, signed: Boolean(quote && isSigned(quote)) };
}

const LEVEL_TAG = {
  over: { label: "Dépassement", className: "tag tag-b" },
  watch: { label: "À regarder", className: "tag tag-e" },
  ok: { label: "Dans le devis", className: "tag tag-o" },
  none: { label: "Sans devis", className: "tag tag-o dim" }
};

const LEVEL_ORDER = { over: 0, watch: 1, ok: 2, none: 3 };

export default function CoutDesChantiersPage() {
  const { data: projects, loading: loadingProjects } = useApi("/api/projects", "projects");
  const { data: quotes, loading: loadingQuotes } = useApi("/api/quotes", "quotes");
  const { data: expenses, loading: loadingExpenses } = useApi("/api/expenses", "expenses");
  const loading = loadingProjects || loadingQuotes || loadingExpenses;

  const rows = useMemo(() => projects
    .filter((project) => !project.archivedAt)
    .map((project) => costRow(project, quotes, expenses))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.spent - a.spent), [projects, quotes, expenses]);

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    devis: acc.devis + row.devisHt,
    spent: acc.spent + row.spent,
    watch: acc.watch + (row.level === "over" || row.level === "watch" ? 1 : 0)
  }), { devis: 0, spent: 0, watch: 0 }), [rows]);

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <Link href="/comptabilite" className="link">← Comptabilité</Link>
          <span className="eyebrow">Dépenses</span>
          <h1>Coût des chantiers</h1>
        </div>
      </div>

      <div className="kpis">
        <div><div className="l">Chantiers</div><div className="v">{rows.length}</div><div className="s">hors archivés</div></div>
        <div><div className="l">Devis HT</div><div className="v">{euro(totals.devis)}</div><div className="s">signé, sinon le plus récent</div></div>
        <div><div className="l">Dépensé</div><div className="v">{euro(totals.spent)}</div><div className="s">dépenses saisies</div></div>
        <div><div className="l">À regarder</div><div className="v">{totals.watch}</div><div className="s">dès {Math.round(WATCH_RATIO * 100)} % du devis</div></div>
      </div>

      <p className="muted cc-note">Dépensé = dépenses saisies sur chaque chantier. Les heures de l'équipe ne sont pas encore comptées : la marge affichée est provisoire.</p>

      {loading ? <p className="empty">Chargement…</p> : rows.length === 0 ? (
        <p className="empty">Aucun chantier pour le moment. Un chantier se crée quand un devis est signé.</p>
      ) : (
        <div className="cc-grid">
          {rows.map((row) => {
            const tag = LEVEL_TAG[row.level];
            return (
              <section className="card cc-card" key={row.project.id}>
                <div className="card-h">
                  <h2>{fixText(row.project.title)}</h2>
                  <span className={tag.className}>{tag.label}</span>
                </div>
                <p className="muted">{[fixText(row.project.client), row.quote ? `devis ${row.quote.quoteNumber}${row.signed ? " signé" : " non signé"}` : ""].filter(Boolean).join(" · ")}</p>
                <div className="kv"><span>Devis HT</span><b>{row.devisHt > 0 ? euro(row.devisHt) : "—"}</b></div>
                <div className="kv"><span>Dépensé</span><b>{euro(row.spent)}</b></div>
                <div className="kv"><span>Marge provisoire</span><b>{row.devisHt > 0 ? euro(row.margin) : "—"}</b></div>
                {row.devisHt > 0 ? (
                  <div className="cc-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(row.ratio * 100))}%` }} /></div>
                ) : null}
                <p className="cc-phrase">{row.phrase}</p>
                <div><Link className="btn btn-sec" href={`/chantiers?project=${row.project.id}`}>Voir le coût du chantier</Link></div>
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
