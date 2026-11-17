"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";
import { grouper, heureListe } from "../../lib/notifications-pro";
import { IconeNotif } from "./notif-ui";
import "./notifications.css";

// Centre de notifications (maquette PRO-23) : un fait, une action. Onglets
// Toutes, Non lues, Archivées (en dernier) ; groupes par jour ; non lue =
// titre gras + point graphite ; archivage automatique à 30 jours.
export default function NotificationsPage() {
  const { data: notifications, setData, loading } = useApi("/api/notifications", "notifications");
  const [onglet, setOnglet] = useState("toutes");
  const liste = notifications || [];
  const actives = liste.filter((n) => !n.archived);
  const nonLues = actives.filter((n) => !n.read);
  const visibles = onglet === "archivees" ? liste.filter((n) => n.archived) : onglet === "nonlues" ? nonLues : actives;
  const groupes = useMemo(() => grouper(visibles), [visibles]);

  async function toutLu() {
    await apiSend("/api/notifications", { action: "read-all" }, "PATCH");
    setData((prev) => (prev || []).map((n) => ({ ...n, read: true })));
  }

  return (
    <Shell variant="pro">
      <div className="nt">
        <div className="head">
          <div className="stack"><span className="eyebrow">{nonLues.length ? `${nonLues.length} non lue${nonLues.length > 1 ? "s" : ""}` : "tout est lu"}</span><h1>Notifications</h1></div>
          <div className="hact">{nonLues.length ? <button type="button" className="btn btn-sec" onClick={toutLu}>Tout marquer comme lu</button> : null}</div>
        </div>
        <div className="tbar">
          <nav className="wtabs" aria-label="Notifications">
            {[["toutes", "Toutes", actives.length], ["nonlues", "Non lues", nonLues.length], ["archivees", "Archivées", null]].map(([id, l, n]) => (
              <button key={id} type="button" className={onglet === id ? "on" : ""} onClick={() => setOnglet(id)}>{l}{n ? <span>{n}</span> : null}</button>
            ))}
          </nav>
        </div>
        <div className="nt-g">
          <div className="card nt-l">
            {loading && !liste.length ? <p className="muted">Chargement…</p> : !groupes.length ? (
              <p className="muted">{onglet === "archivees" ? "Aucune notification archivée." : onglet === "nonlues" ? "Tout est lu." : "Aucune notification pour l'instant. Ce qui se passe sans vous (devis signé, paiement reçu, nouveau chantier dans votre zone…) arrive ici."}</p>
            ) : groupes.map((g) => (
              <section key={g.titre}>
                <h2 className="nt-gt">{g.titre}</h2>
                {g.items.map((n) => (
                  <Link key={n.id} href={`/notifications/${n.id}`} className={`nt-r ${n.read ? "" : "nl"}`}>
                    <IconeNotif categorie={n.categorie} />
                    <div><b>{n.title || "Notification"}</b>{n.message ? <small>{String(n.message).split("\n")[0]}</small> : null}</div>
                    <time>{heureListe(n.createdAt)}</time>
                    {n.read ? null : <i className="nt-pt" aria-label="non lue" />}
                  </Link>
                ))}
              </section>
            ))}
          </div>
          <aside className="nt-side">
            <div className="card">
              <div className="card-h"><h2>Réglages</h2></div>
              <div className="nt-kv"><b>Téléphone et e-mail</b><small>devis, paiements, Radar, messages, rendez-vous</small></div>
              <div className="nt-kv"><b>Heures silencieuses</b><small>20 h – 8 h et le dimanche : les e-mails partent le lendemain matin</small></div>
              <Link className="link" href="/parametres?section=notifications">Choix détaillés dans Paramètres › Notifications</Link>
            </div>
            <div className="card">
              <div className="card-h"><h2>Ce qui arrive ici</h2></div>
              <ul className="nt-ul">
                <li>Un fait, une action : chaque notification dit ce qui s'est passé et ce que vous pouvez faire.</li>
                <li>Lue quand vous l'ouvrez, ou « Tout marquer comme lu ».</li>
                <li>Archivée après 30 jours ; les documents, eux, restent dans leur outil.</li>
                <li>Koji peut résumer la journée : <Link className="link" href="/?koji=1&q=Qu%27est-ce%20qui%20m%27attend%20aujourd%27hui%20%3F">« Qu'est-ce qui m'attend ? »</Link></li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
