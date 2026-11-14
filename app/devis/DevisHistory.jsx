"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RelanceDevis } from "../../components/RelanceDevis";
import { Shell } from "../../components/Shell";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import { apiSend } from "../../lib/client-api";
import { ONGLETS_DEVIS, RELANCE_JOURS, VALIDITE_JOURS, actionDevis, compterDevis, derniereAction, ongletDevis, resumeDevis, statutDevis } from "../../lib/devis-liste";

// Liste des devis, maquette PRO-03 : onglets, statut, dernière action et
// action de la ligne (Reprendre, Relancer, Voir, Dupliquer) ; règles dans
// lib/devis-liste.js, partagées avec l'app Koji Pro.

// Champs repris quand on duplique un devis expiré ou refusé.
const CHAMPS_DUPLIQUES = ["client", "clientReference", "clientEmail", "clientPhone", "clientType", "clientFirstName", "clientLastName", "clientCompanyName", "project", "projectId", "projectReference", "contactId", "chantierAddress", "chantierAddressDetails", "workDescription", "expectedDuration", "company", "rooms", "items", "notes", "surcharges", "situationFactors", "vatRate", "totalHt", "totalTtc"];

function money(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function Status({ statut }) {
  if (statut.ton === "sceau") {
    return (
      <span className="signed">
        <span className="seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg></span>
        Signé
      </span>
    );
  }
  const classe = statut.ton === "graphite" ? "tag tag-e" : statut.ton === "gris" ? "tag tag-o dim" : "tag tag-o";
  return <span className={classe}>{statut.label}</span>;
}

export default function DevisHistory() {
  const { L } = useLocale();
  const router = useRouter();
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: projects } = useApi("/api/projects", "projects");
  const [tab, setTab] = useState("tous");
  const [query, setQuery] = useState("");
  const [relance, setRelance] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const activeQuotes = useMemo(() => quotes.filter((q) => q.status !== "Archive"), [quotes]);
  const comptes = useMemo(() => compterDevis(activeQuotes, today), [activeQuotes, today]);
  const enCours = useMemo(() => new Set(projects.filter((p) => p.status === "En cours").map((p) => p.id)), [projects]);

  const rows = useMemo(() => {
    const list = tab === "tous" ? activeQuotes : activeQuotes.filter((q) => ongletDevis(q, today) === tab);
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? list.filter((q) => [q.quoteNumber, q.client, q.project].some((v) => String(v || "").toLowerCase().includes(needle)))
      : list;
    return [...matching].sort((a, b) => String(b.createdAtIso || b.createdAt || "").localeCompare(String(a.createdAtIso || a.createdAt || "")));
  }, [activeQuotes, tab, query, today]);

  async function dupliquer(quote) {
    setEnvoi(true);
    try {
      const copie = Object.fromEntries(CHAMPS_DUPLIQUES.filter((k) => quote[k] !== undefined).map((k) => [k, quote[k]]));
      const { quote: nouveau } = await apiSend("/api/quotes", { ...copie, status: "Brouillon", quoteDate: today });
      router.push(`/devis?id=${nouveau.id}`);
    } catch (error) {
      setMessage(error.message || "Le devis n'a pas pu être dupliqué.");
      setEnvoi(false);
    }
  }

  function agir(quote, event) {
    event.stopPropagation();
    const action = actionDevis(quote, today);
    if (action.id === "relancer") setRelance({ quote });
    else if (action.id === "dupliquer") dupliquer(quote);
    else router.push(`/devis?id=${quote.id}`);
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{resumeDevis(comptes)}</span>
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

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Filtrer les devis">
          {ONGLETS_DEVIS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label} <span>{comptes[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client, un chantier, un numéro" aria-label="Rechercher un devis" />
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
                    <td><Status statut={statutDevis(quote, today)} /></td>
                    <td className="sm2">{derniereAction(quote, today, { chantierEnCours: enCours.has(quote.projectId) })}</td>
                    <td className="r">
                      <button type="button" className="btn btn-sec" disabled={envoi} onClick={(event) => agir(quote, event)}>{actionDevis(quote, today).label}</button>
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
                  <Status statut={statutDevis(quote, today)} />
                </div>
                <div className="dvc-f">
                  <b>{money(quote.totalHt)}</b>
                  <span className="meta">{derniereAction(quote, today, { chantierEnCours: enCours.has(quote.projectId) })}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="foot-note">Un devis envoyé sans réponse passe « À relancer » après {RELANCE_JOURS} jours. Validité par défaut {VALIDITE_JOURS} jours ; à l'échéance le devis passe « Expiré » et peut être dupliqué.</p>

      {relance ? (
        <RelanceDevis
          quote={relance.quote}
          onClose={() => setRelance(null)}
          onDone={(quote, texte) => {
            setQuotes((liste) => liste.map((q) => (q.id === quote.id ? quote : q)));
            setMessage(texte);
            setRelance(null);
          }}
        />
      ) : null}
    </Shell>
  );
}
