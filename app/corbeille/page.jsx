"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { contactDisplayName } from "../../lib/contacts";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

// Page "Corbeille" (15 oct) — jusqu'ici un simple "bientot disponible"
// (12 oct). Construite comme une vue d'ensemble de tout ce qui est
// archive dans l'app : contacts et avenants (geres directement ici, ils
// n'ont pas d'autre ecran dedie) ; chantiers et devis archives restent
// geres depuis /archives (deja complet : voir/restaurer/supprimer), un
// simple compteur + lien ici pour eviter de dupliquer cet ecran.

export default function CorbeillePage() {
  const { data: allContacts, setData: setAllContacts } = useApi("/api/contacts?includeArchived=1", "contacts");
  const { data: allAvenants, setData: setAllAvenants } = useApi("/api/avenants", "avenants");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const [tab, setTab] = useState("contacts");

  const archivedContacts = useMemo(() => allContacts.filter((c) => c.archived), [allContacts]);
  const archivedAvenants = useMemo(() => allAvenants.filter((a) => a.status === "Archive"), [allAvenants]);
  const archivedProjectsCount = useMemo(() => projects.filter((p) => p.status === "Archive").length, [projects]);
  const archivedQuotesCount = useMemo(() => quotes.filter((q) => q.status === "Archive").length, [quotes]);

  async function restoreContact(contact) {
    const { contact: restored } = await apiSend("/api/contacts", { id: contact.id, action: "restore" }, "PATCH");
    setAllContacts(allContacts.map((item) => (item.id === restored.id ? restored : item)));
  }

  async function deleteContact(contact) {
    if (!window.confirm(`Supprimer définitivement ${contactDisplayName(contact)} ?`)) return;
    try {
      const { contact: deleted } = await apiSend("/api/contacts", { id: contact.id, action: "delete" }, "PATCH");
      if (deleted?.deleted) setAllContacts(allContacts.filter((item) => item.id !== contact.id));
    } catch (error) {
      window.alert(error.message || "Suppression impossible.");
    }
  }

  async function restoreAvenant(avenant) {
    const { avenant: restored } = await apiSend("/api/avenants", { id: avenant.id, action: "restore" }, "PATCH");
    setAllAvenants(allAvenants.map((item) => (item.id === restored.id ? restored : item)));
  }

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Corbeille</span></h1>
            <p>Tout ce qui a été archivé dans koji, au même endroit.</p>
          </div>
        </header>

        <div className="fournitures-kpi-row">
          <button type="button" className={`fournitures-kpi-card clickable ${tab === "contacts" ? "kpi-active" : ""}`} onClick={() => setTab("contacts")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">👤</span>
              <span className="title-chip">Contacts</span>
            </div>
            <strong>{archivedContacts.length}</strong>
            <small>archivés</small>
          </button>
          <button type="button" className={`fournitures-kpi-card clickable ${tab === "avenants" ? "kpi-active" : ""}`} onClick={() => setTab("avenants")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">📝</span>
              <span className="title-chip">Avenants</span>
            </div>
            <strong>{archivedAvenants.length}</strong>
            <small>archivés</small>
          </button>
          <a href="/archives" className="fournitures-kpi-card clickable">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">🏗️</span>
              <span className="title-chip">Chantiers</span>
            </div>
            <strong>{archivedProjectsCount}</strong>
            <small>voir dans Archives</small>
          </a>
          <a href="/archives" className="fournitures-kpi-card clickable">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">📄</span>
              <span className="title-chip">Devis</span>
            </div>
            <strong>{archivedQuotesCount}</strong>
            <small>voir dans Archives</small>
          </a>
        </div>

        <div className="fournitures-main-card">
          <div className="fournitures-main-card-head">
            <strong className="title-chip">{tab === "contacts" ? "Contacts archivés" : "Avenants archivés"}</strong>
            <div className="fournitures-filter-tabs">
              <button type="button" className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>Contacts</button>
              <button type="button" className={tab === "avenants" ? "active" : ""} onClick={() => setTab("avenants")}>Avenants</button>
            </div>
          </div>

          {tab === "contacts" ? (
            archivedContacts.length === 0 ? (
              <div className="tool-empty">
                <strong>Aucun contact archivé</strong>
                <span>Les contacts que vous archivez depuis la page Contacts apparaîtront ici.</span>
              </div>
            ) : (
              <div className="archive-list">
                {archivedContacts.map((contact) => (
                  <article className="archive-row" key={contact.id}>
                    <span className="archive-icon">{contactDisplayName(contact).slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{contactDisplayName(contact)}</strong>
                      <small>{[contact.phone, contact.email].filter(Boolean).join(" · ") || "—"}</small>
                      <small className="archive-row-dates">Archivé le {contact.archivedAt ? shortDate(contact.archivedAt) : "—"}</small>
                    </div>
                    <div className="archive-row-actions">
                      <button type="button" onClick={() => restoreContact(contact)}>Restaurer</button>
                      <button type="button" className="danger" onClick={() => deleteContact(contact)}>Supprimer</button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            archivedAvenants.length === 0 ? (
              <div className="tool-empty">
                <strong>Aucun avenant archivé</strong>
                <span>Les avenants que vous archivez depuis un devis apparaîtront ici.</span>
              </div>
            ) : (
              <div className="archive-list">
                {archivedAvenants.map((avenant) => (
                  <article className="archive-row" key={avenant.id}>
                    <span className="archive-icon">AV</span>
                    <div>
                      <strong>{avenant.numero} · {avenant.quoteNumber}</strong>
                      <small>{avenant.client || "Client"} — {euro(avenant.totalTtcDelta)}</small>
                      <small className="archive-row-dates">{avenant.motif || "Sans motif"}</small>
                    </div>
                    <div className="archive-row-actions">
                      <a className="mini-button" href={`/avenant?id=${avenant.id}`}>Voir</a>
                      <button type="button" onClick={() => restoreAvenant(avenant)}>Restaurer</button>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </div>
      </section>
    </Shell>
  );
}
