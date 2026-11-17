"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { useApi } from "../../../lib/use-api";
import { actionsDe, LIBELLES } from "../../../lib/notifications-pro";
import { IconeNotif } from "../notif-ui";
import "../notifications.css";

// Détail d'une notification (maquette PRO-23) : le fait, l'objet lié et au
// plus une action principale (jaune) ; les autres en boutons secondaires.
// Accès client envoyé : identifiants, renvoi par e-mail ou WhatsApp.
const quand = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso)) : "");
const CHAMPS = { quoteNumber: "Devis", portalIdentifier: "Identifiant client", password: "Mot de passe", loginUrl: "Lien de connexion", email: "E-mail", phone: "Téléphone", amount: "Montant", montant: "Montant" };

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: notifications, setData, loading } = useApi("/api/notifications", "notifications");
  const n = (notifications || []).find((x) => x.id === params.id);
  const [etat, setEtat] = useState("");
  const [tel, setTel] = useState("");

  useEffect(() => {
    if (n && !n.read) apiSend("/api/notifications", { id: n.id, action: "read" }, "PATCH").then(({ notification }) => setData((prev) => prev.map((x) => (x.id === notification.id ? { ...x, read: true } : x)))).catch(() => {});
  }, [n?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!n) return <Shell variant="pro"><div className="nt">{loading ? <p className="muted">Chargement…</p> : <><p className="muted">Notification introuvable.</p><Link className="link" href="/notifications">Notifications</Link></>}</div></Shell>;

  const { principale, secondaires } = actionsDe(n);
  const meta = n.meta || {};
  const champs = Object.entries(CHAMPS).filter(([k]) => meta[k]).map(([k, l]) => [l, String(meta[k])]);
  const acces = n.type === "client.access.sent";

  async function renvoyer() {
    setEtat("envoi");
    try { await apiSend("/api/notifications", { id: n.id, action: "resend-email" }, "PATCH"); setEtat("ok"); } catch (e) { setEtat(e.message || "Envoi impossible."); }
  }
  function whatsapp() {
    const phone = (meta.phone || tel || "").replace(/\D/g, "");
    if (!phone) return;
    const texte = ["Bonjour, votre espace Koji est prêt.", meta.quoteNumber ? `Devis : ${meta.quoteNumber}` : "", meta.portalIdentifier ? `Identifiant : ${meta.portalIdentifier}` : "", meta.password ? `Mot de passe : ${meta.password}` : "", meta.loginUrl ? `Connexion : ${meta.loginUrl}` : ""].filter(Boolean).join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texte)}`, "_blank");
  }
  async function archiver() {
    await apiSend("/api/notifications", { id: n.id, action: n.archived ? "unarchive" : "archive" }, "PATCH");
    router.push("/notifications");
  }

  return (
    <Shell variant="pro">
      <div className="nt">
        <Link className="link" href="/notifications" style={{ alignSelf: "flex-start" }}>‹ Notifications</Link>
        <div className="card nt-d">
          <div className="nt-dh"><IconeNotif categorie={n.categorie} /><span className="eyebrow">{LIBELLES[n.categorie] || "Info"} · {quand(n.createdAt)}</span></div>
          <h1>{n.title || "Notification"}</h1>
          {n.message ? String(n.message).split("\n").map((l, i) => <p key={i} className="nt-p">{l}</p>) : null}
          {champs.length ? (
            <div className="nt-obj">
              {champs.map(([l, v]) => <div key={l} className="nt-kv"><small>{l}</small><b>{v}</b></div>)}
            </div>
          ) : null}
          <div className="nt-act">
            {principale ? <Link className="btn btn-main" href={principale.href}>{principale.label}</Link> : null}
            {secondaires.map((a) => <Link key={a.href} className="btn btn-sec" href={a.href}>{a.label}</Link>)}
            {acces && meta.email ? <button type="button" className="btn btn-sec" disabled={etat === "envoi"} onClick={renvoyer}>{etat === "ok" ? "E-mail renvoyé" : "Renvoyer par e-mail"}</button> : null}
            {acces ? <button type="button" className="btn btn-sec" disabled={!(meta.phone || tel)} onClick={whatsapp}>Envoyer par WhatsApp</button> : null}
          </div>
          {acces && !meta.phone ? <input className="nt-tel" type="tel" placeholder="Téléphone du client pour WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} /> : null}
          {etat && !["ok", "envoi"].includes(etat) ? <p className="err">{etat}</p> : null}
          <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={archiver}>{n.archived ? "Désarchiver" : "Archiver"}</button>
        </div>
      </div>
    </Shell>
  );
}
