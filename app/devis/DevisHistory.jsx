"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";

// Liste des devis, maquette PRO-03 (DA Koji Pro, 30 oct). Le choix guidé /
// manuel vit dans les deux boutons d'en-tête, qui renvoient vers
// /devis?new=1&mode=... (voir app/devis/page.jsx).

// Même seuil que « Devis à relancer » sur l'Accueil (app/page.jsx).
const RELANCE_DAYS = 7;

const TABS = [
  { id: "tous", label: "Tous" },
  { id: "brouillon", label: "Brouillons" },
  { id: "envoye", label: "Envoyés" },
  { id: "accepte", label: "Signés" },
  { id: "refuse", label: "Refusés" }
];

function money(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function shortDay(value) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(value));
}

function daysSince(value) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

// Regroupement du quote.status réel (Brouillon / Pret a envoyer / Envoye /
// Signe / Refuse / Annule) pour les onglets.
function bucketOf(status) {
  if (status === "Signe") return "accepte";
  if (status === "Envoye") return "envoye";
  if (status === "Refuse" || status === "Annule") return "refuse";
  return "brouillon";
}

function needsRelance(quote) {
  return quote.status === "Envoye" && Boolean(quote.sentAt) && daysSince(quote.sentAt) >= RELANCE_DAYS;
}

function Status({ quote }) {
  const bucket = bucketOf(quote.status);
  if (bucket === "accepte") {
    return (
      <span className="signed">
        <span className="seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg></span>
        Signé
      </span>
    );
  }
  if (bucket === "refuse") return <span className="tag tag-o dim">Refusé</span>;
  if (bucket === "envoye") {
    return needsRelance(quote) ? <span className="tag tag-o">À relancer</span> : <span className="tag tag-e">Envoyé</span>;
  }
  return <span className="tag tag-o">{quote.status === "Pret a envoyer" ? "Prêt à envoyer" : "Brouillon"}</span>;
}

function lastAction(quote) {
  const bucket = bucketOf(quote.status);
  if (bucket === "accepte") return quote.signedAt ? `Signé le ${shortDay(quote.signedAt)}` : "Signé";
  if (bucket === "envoye") {
    const sent = quote.sentAt ? `Envoyé le ${shortDay(quote.sentAt)}` : "Envoyé";
    return needsRelance(quote) ? `${sent} · sans réponse` : sent;
  }
  const edited = quote.updatedAt || quote.createdAtIso;
  if (!edited) return "";
  const date = new Date(edited);
  if (date.toDateString() === new Date().toDateString()) {
    return `Modifié à ${date.getHours()} h ${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return `Modifié le ${shortDay(edited)}`;
}

function actionLabel(quote) {
  if (bucketOf(quote.status) === "brouillon") return "Reprendre";
  if (needsRelance(quote)) return "Relancer";
  return "Voir";
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

export default function DevisHistory() {
  const { L } = useLocale();
  const router = useRouter();
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const [tab, setTab] = useState("tous");
  const [query, setQuery] = useState("");

  const activeQuotes = useMemo(() => quotes.filter((q) => q.status !== "Archive"), [quotes]);

  const buckets = useMemo(() => {
    const out = { brouillon: [], envoye: [], accepte: [], refuse: [] };
    activeQuotes.forEach((q) => out[bucketOf(q.status)].push(q));
    return out;
  }, [activeQuotes]);

  const relanceCount = useMemo(() => buckets.envoye.filter(needsRelance).length, [buckets]);

  const rows = useMemo(() => {
    const list = tab === "tous" ? activeQuotes : buckets[tab];
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? list.filter((q) => [q.quoteNumber, q.client, q.project].some((v) => String(v || "").toLowerCase().includes(needle)))
      : list;
    return [...matching].sort((a, b) => String(b.createdAtIso || b.createdAt || "").localeCompare(String(a.createdAtIso || a.createdAt || "")));
  }, [activeQuotes, buckets, tab, query]);

  const eyebrow = [
    `${activeQuotes.length} devis`,
    buckets.envoye.length ? `${plural(buckets.envoye.length, "envoyé")} en attente` : null,
    relanceCount ? `${relanceCount} à relancer` : null,
    buckets.brouillon.length ? plural(buckets.brouillon.length, "brouillon") : null
  ].filter(Boolean).join(" · ");

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{eyebrow}</span>
          <h1>Devis</h1>
        </div>
        <div className="acts">
          <Link href="/devis?new=1&mode=manuel" className="btn btn-sec">Devis manuel</Link>
          <Link href="/devis?new=1&mode=ia" className="btn btn-main">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Démarrer un devis guidé
          </Link>
        </div>
      </div>

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Filtrer les devis">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "on" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label} <span>{t.id === "tous" ? activeQuotes.length : buckets[t.id].length}</span>
            </button>
          ))}
        </div>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un client, un chantier, un numéro"
            aria-label="Rechercher un devis"
          />
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="tbl">
          <div className="empty">{query.trim() ? "Aucun devis ne correspond à cette recherche." : L.devis.noQuotes}</div>
        </div>
      ) : (
        <>
        <div className="tbl has-cards">
          <table>
            <thead>
              <tr>
                <th>Numéro · client</th>
                <th>Chantier</th>
                <th className="r">Montant HT</th>
                <th>Statut</th>
                <th>Dernière action</th>
                <th aria-label="Action" />
              </tr>
            </thead>
            <tbody>
              {rows.map((quote) => (
                <tr key={quote.id} onClick={() => router.push(`/devis?id=${quote.id}`)}>
                  <td className="n">
                    {quote.quoteNumber}
                    <div className="sm">{quote.client || "Client"}</div>
                  </td>
                  <td>{quote.project || "—"}</td>
                  <td className="r">{money(quote.totalHt)}</td>
                  <td><Status quote={quote} /></td>
                  <td className="sm2">{lastAction(quote)}</td>
                  <td className="r">
                    <Link href={`/devis?id=${quote.id}`} className="btn btn-sec" onClick={(event) => event.stopPropagation()}>
                      {actionLabel(quote)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mlist">
          {rows.map((quote) => (
            <Link href={`/devis?id=${quote.id}`} className="m-card dvc" key={quote.id}>
              <div className="top2">
                <div>
                  <div className="nm">{quote.project || quote.quoteNumber}</div>
                  <div className="meta">{quote.quoteNumber} · {quote.client || "Client"}</div>
                </div>
                <Status quote={quote} />
              </div>
              <div className="dvc-f">
                <b>{money(quote.totalHt)}</b>
                <span className="meta">{lastAction(quote)}</span>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}

      <p className="foot-note">Un devis envoyé sans réponse passe « À relancer » après {RELANCE_DAYS} jours.</p>
    </Shell>
  );
}
