"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientTopbar, CHARTE_CLIENT } from "../../../../components/ClientTopbar";
import { ClientNotifIcone } from "../../../../components/ClientNotifIcone";
import { actionsNotification, cleFil, estPourClient, quandDetail, titreCourt, CE_QUE_KOJI_ENVOIE, OU_LES_RETROUVER } from "../../../../lib/notifications-client";
import "../../cli03.css";

// Koji Client · détail d'une notification (maquette CLI-04) : le fait en
// Shippori Mincho, l'objet, UN bouton marine vers l'action réelle et, si un
// fil existe avec l'entreprise, « Poser une question à l'entreprise ».

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function NotificationDetail() {
  const { id } = useParams();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | introuvable | erreur | deconnecte
  const [notif, setNotif] = useState(null);
  const [fils, setFils] = useState(new Set());
  const [projets, setProjets] = useState(new Map());

  useEffect(() => {
    if (!compteLocal()?.id) { setEtat("deconnecte"); return; }
    const opt = { credentials: "same-origin" };
    Promise.all([
      fetch("/api/notifications", opt).then((r) => r.json()),
      fetch("/api/client/messages", opt).then((r) => r.json()).catch(() => ({ conversations: [] }))
    ])
      .then(([data, messages]) => {
        const n = (data.notifications || []).find((x) => x.id === decodeURIComponent(String(id)) && estPourClient(x));
        const conversations = messages.conversations || [];
        setFils(new Set(conversations.map((c) => cleFil(c.offerId, c.entrepriseUserId))));
        setProjets(new Map(conversations.map((c) => [c.offerId, c.offre?.titre || ""])));
        if (!n) { setEtat("introuvable"); return; }
        setNotif(n);
        setEtat("pret");
        if (!n.read) {
          fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: n.id, action: "read" }) }).catch(() => {});
        }
      })
      .catch(() => setEtat("erreur"));
  }, [id]);

  if (etat === "deconnecte") {
    return (
      <div className={`${CHARTE_CLIENT} kc sans-barre`}>
        <header className={`${CHARTE_CLIENT} kc-bar`} style={{ display: "flex" }}>
          <div><strong>Notification</strong><small>connexion nécessaire</small></div>
        </header>
        <main className="kc-m">
          <div className="kc-body" style={{ maxWidth: 520 }}>
            <p className="kc-p">Connectez-vous pour lire cette notification.</p>
            <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
          </div>
        </main>
      </div>
    );
  }

  const actions = notif ? actionsNotification(notif, fils) : null;
  const projet = notif?.offerId ? projets.get(notif.offerId) : "";
  const quand = notif ? quandDetail(notif.createdAt) : "";
  const sous = notif ? [notif.entrepriseName, quand].filter(Boolean).join(" · ") : "";

  const detail = etat === "pret" ? (
    <div className="kc3-det">
      <div className="kc3-dh">
        <ClientNotifIcone type={notif.type} grande />
        <h3>{notif.title || "Notification"}</h3>
        {notif.message ? <p className="kc-p">{notif.message}</p> : null}
      </div>
      {projet || notif.taskLabel ? (
        <div className="kc3-row fixe">
          <div>
            <strong>{projet ? "Projet" : "Ouvrage"}</strong>
            <small>{projet || notif.taskLabel}</small>
          </div>
        </div>
      ) : null}
      <Link className="kc-btn" href={actions.principale.lien}>{actions.principale.libelle}</Link>
      {actions.question ? <Link className="kc-sec" href={actions.question.lien}>{actions.question.libelle}</Link> : null}
    </div>
  ) : etat === "introuvable" ? (
    <>
      <p className="kc-p">Cette notification n'existe plus.</p>
      <Link className="kc-sec" href="/client/notifications">Toutes les notifications</Link>
    </>
  ) : etat === "erreur" ? (
    <p className="kc-p">La notification n'a pas pu être chargée.</p>
  ) : (
    <p className="kc-s">Chargement…</p>
  );

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar titre={notif ? titreCourt(notif) : "Notification"} sousTitre={sous} backHref="/client/notifications" />
      <main className="kc-m">
        {/* Ordinateur */}
        <div className="kc-d">
          <div className="kc3-nh">
            <div>
              <Link href="/client/notifications" className="kc-ey">‹ Notifications</Link>
              <h1 className="kc-h">{notif ? titreCourt(notif) : "Notification"}</h1>
            </div>
            {sous ? <span className="kc-ey">{sous}</span> : null}
          </div>
          <div className="kc3-cols large">
            <div className="kc3-pan" style={{ maxWidth: 640 }}>{detail}</div>
            <aside className="kc3-a">
              <h3>Ce que Koji vous envoie</h3>
              <p>{CE_QUE_KOJI_ENVOIE}</p>
              <h3>Où les retrouver</h3>
              <p>{OU_LES_RETROUVER}</p>
            </aside>
          </div>
        </div>

        {/* Téléphone */}
        <div className="kc-t kc-body">{detail}</div>
      </main>
    </div>
  );
}
