"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClientTopbar, CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { ClientNotifIcone } from "../../../components/ClientNotifIcone";
import { estPourClient, heureNotification, parJour, CE_QUE_KOJI_ENVOIE, OU_LES_RETROUVER } from "../../../lib/notifications-client";
import "../cli03.css";

// Koji Client · Notifications (maquette CLI-04). Liste par jour ; non lue =
// titre gras et point marine ; l'action attend dans le détail
// (/client/notifications/[id]), jamais dans la liste. /api/notifications
// lit la session (cookie du particulier), jamais un identifiant envoyé par
// le navigateur.

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function ClientNotificationsPage() {
  const [etat, setEtat] = useState("chargement"); // chargement | pret | erreur | deconnecte
  const [notifications, setNotifications] = useState([]);

  const charger = useCallback(() => {
    if (!compteLocal()?.id) { setEtat("deconnecte"); return; }
    setEtat("chargement");
    fetch("/api/notifications", { credentials: "same-origin" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lecture impossible.");
        setNotifications((data.notifications || []).filter(estPourClient));
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function toutLire() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "read-all" }) }).catch(() => {});
  }

  if (etat === "deconnecte") {
    return (
      <div className={`${CHARTE_CLIENT} kc sans-barre`}>
        <header className={`${CHARTE_CLIENT} kc-bar`} style={{ display: "flex" }}>
          <div><strong>Notifications</strong><small>connexion nécessaire</small></div>
        </header>
        <main className="kc-m">
          <div className="kc-body" style={{ maxWidth: 520 }}>
            <p className="kc-p">Connectez-vous pour retrouver vos notifications.</p>
            <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
          </div>
        </main>
      </div>
    );
  }

  const nonLues = notifications.filter((n) => !n.read).length;
  const groupes = parJour(notifications);
  const lignes = groupes.map((g) => (
    <div key={g.jour} role="group" aria-label={g.jour}>
      <div className="kc3-day">{g.jour}</div>
      {g.notifications.map((n) => (
        <Link key={n.id} href={`/client/notifications/${encodeURIComponent(n.id)}`} className={`kc3-nr${n.read ? "" : " un"}`}>
          <ClientNotifIcone type={n.type} />
          <div><b>{n.title || "Notification"}</b><small>{n.message || ""}</small></div>
          <div className="kc3-rt"><span>{heureNotification(n.createdAt)}</span>{n.read ? null : <i aria-label="non lue" />}</div>
        </Link>
      ))}
    </div>
  ));
  const corps = etat === "erreur" ? (
    <div className="kc-err"><span>Vos notifications n'ont pas pu être chargées.</span><button type="button" className="kc-sec" onClick={charger}>Réessayer</button></div>
  ) : etat === "chargement" ? (
    <p className="kc-vide">Chargement…</p>
  ) : notifications.length === 0 ? (
    <p className="kc-vide">Aucune notification pour l'instant.</p>
  ) : lignes;

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar />
      <main className="kc-m">
        {/* Ordinateur */}
        <div className="kc-d">
          <div className="kc3-nh">
            <div>
              <span className="kc-ey">{etat === "pret" ? (nonLues ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Tout est lu") : " "}</span>
              <h1 className="kc-h">Notifications</h1>
            </div>
            {nonLues ? <button type="button" className="kc3-lien" onClick={toutLire}>Tout marquer comme lu</button> : null}
          </div>
          <div className="kc3-cols large">
            <div>{corps}</div>
            <aside className="kc3-a">
              <h3>Ce que Koji vous envoie</h3>
              <p>{CE_QUE_KOJI_ENVOIE}</p>
              <h3>Où les retrouver</h3>
              <p>{OU_LES_RETROUVER}</p>
            </aside>
          </div>
        </div>

        {/* Téléphone */}
        <div className="kc-t kc-body">
          <div className="kc3-mh2">
            <h3 className="kc-ph">Notifications</h3>
            {nonLues ? <button type="button" className="kc3-lien" onClick={toutLire} style={{ fontSize: 13 }}>Tout marquer lu</button> : null}
          </div>
          {etat === "erreur" ? (
            <>
              <p className="kc-s">Vos notifications n'ont pas pu être chargées.</p>
              <button type="button" className="kc-sec" onClick={charger}>Réessayer</button>
            </>
          ) : etat === "chargement" ? (
            <p className="kc-s">Chargement…</p>
          ) : notifications.length === 0 ? (
            <p className="kc-s">Aucune notification pour l'instant.</p>
          ) : <div>{lignes}</div>}
        </div>
      </main>
    </div>
  );
}
