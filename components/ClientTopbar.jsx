"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import KojiWordmark from "./KojiWordmark";
import { DM_Sans, Shippori } from "../app/fonts";
import "../app/client/client.css";

// Cadre de Koji Client (maquette CLI-01 et suivantes). Ordinateur : bandeau
// marine avec « Mes projets », « Messages », « Paiements », la cloche et le
// compte. Téléphone : bandeau marine (« Bonjour … », ou retour + titre) et
// barre du bas (Projets, Messages, +, Paiements, Profil).
//
// « Paiements » arrive avec CLI-02 : tant que la page n'existe pas, l'entrée
// reste masquée plutôt que de mener nulle part.
export const PAIEMENTS_PRET = true;

// Classes de portée de l'univers Client : variables et polices de la charte.
export const CHARTE_CLIENT = `lc ${DM_Sans.variable} ${Shippori.variable}`;

const NOTIFS_CLIENT = new Set(["company.reply", "task.started", "task.pending_validation", "radar.message", "radar.positionnement"]);

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

const prenomDe = (compte) => String(compte?.personal?.firstName || compte?.name || "").trim();

const TRACES = {
  projets: "M4 20h16M6 20V9l6-4 6 4v11",
  messages: "M4 5h16v11H9l-5 4z",
  plus: "M12 5v14M5 12h14",
  paiements: "M4 7h16v12H4zM4 11h16",
  profil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  cloche: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  chevron: "M6 9l6 6 6-6"
};
const Trace = ({ nom }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TRACES[nom]} /></svg>;

export function ClientTopbar({ backHref = "/client", showBack = false, titre = "", sousTitre = "", bonjour = "", sansBarre = false }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [nonLus, setNonLus] = useState(0);
  const [messages, setMessages] = useState(0);
  const [prenom, setPrenom] = useState("");
  const [menu, setMenu] = useState(false);
  const zoneCompte = useRef(null);

  useEffect(() => { setMenu(false); }, [pathname]);

  useEffect(() => {
    const compte = compteLocal();
    setPrenom(prenomDe(compte));
    if (!compte?.id) return;
    fetch(`/api/notifications?userId=${encodeURIComponent(compte.id)}`)
      .then((r) => r.json())
      .then((data) => {
        const liste = (data.notifications || []).filter((n) => !n.read && !n.archived);
        setNonLus(liste.filter((n) => NOTIFS_CLIENT.has(n.type)).length);
        setMessages(liste.filter((n) => n.type === "radar.message").length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const fermer = (e) => { if (!zoneCompte.current?.contains(e.target)) setMenu(false); };
    const echap = (e) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", fermer); document.removeEventListener("keydown", echap); };
  }, [menu]);

  function deconnexion() {
    window.localStorage.removeItem("koji-user");
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login?type=particulier");
  }

  const surMessages = pathname.startsWith("/client/messages");
  const surPaiements = pathname.startsWith("/client/paiements");
  const surProfil = ["/client/profil", "/client/parametres", "/client/aide"].some((p) => pathname.startsWith(p));
  const surProjets = !surMessages && !surPaiements && !surProfil && !pathname.startsWith("/client/notifications");
  const nom = bonjour || prenom;
  const compteur = (n) => (n > 0 ? <i>{n > 9 ? "9+" : n}</i> : null);

  return (
    <>
      <header className={`${CHARTE_CLIENT} kc-top`}>
        <Link href="/client" className="kc-w" aria-label="Koji, mes projets"><KojiWordmark height={13} /></Link>
        <nav aria-label="Espace client">
          <Link href="/client" className={surProjets ? "on" : ""}>Mes projets</Link>
          <Link href="/client/messages" className={surMessages ? "on" : ""}>Messages{compteur(messages)}</Link>
          {PAIEMENTS_PRET ? <Link href="/client/paiements" className={surPaiements ? "on" : ""}>Paiements</Link> : null}
        </nav>
        <Link href="/client/notifications" className="kc-bell" aria-label={nonLus ? `Notifications, ${nonLus} non lues` : "Notifications"}>
          <Trace nom="cloche" />{compteur(nonLus)}
        </Link>
        <div className="kc-cpt" ref={zoneCompte}>
          <button type="button" className="kc-u" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            {nom || "Mon compte"}<Trace nom="chevron" />
          </button>
          {menu ? (
            <div className="kc-menu" role="menu">
              <Link href="/client/profil" role="menuitem">Profil</Link>
              <Link href="/client/parametres" role="menuitem">Paramètres</Link>
              <Link href="/client/aide" role="menuitem">Aide</Link>
              <button type="button" role="menuitem" onClick={deconnexion}>Se déconnecter</button>
            </div>
          ) : null}
        </div>
      </header>

      {titre ? (
        <header className={`${CHARTE_CLIENT} kc-bar`}>
          <Link href={backHref} className="kc-b" aria-label="Retour">‹</Link>
          <div><strong>{titre}</strong>{sousTitre ? <small>{sousTitre}</small> : null}</div>
        </header>
      ) : (
        <header className={`${CHARTE_CLIENT} kc-ptop`}>
          {showBack ? <Link href={backHref} className="kc-pbell" aria-label="Retour" style={{ fontSize: 24, lineHeight: 1 }}>‹</Link> : null}
          <Link href="/client" className="kc-w" aria-label="Koji, mes projets"><KojiWordmark height={13} /></Link>
          <small>{nom ? `Bonjour ${nom}` : "Bonjour"}</small>
          <Link href="/client/notifications" className="kc-pbell" aria-label={nonLus ? `Notifications, ${nonLus} non lues` : "Notifications"}>
            <Trace nom="cloche" />{compteur(nonLus)}
          </Link>
        </header>
      )}

      {sansBarre ? null : (
        <nav className={`${CHARTE_CLIENT} kc-nav`} aria-label="Navigation" style={{ "--kc-cases": PAIEMENTS_PRET ? 5 : 4 }}>
          <Link href="/client" className={surProjets ? "on" : ""}><Trace nom="projets" /><span>Projets</span></Link>
          <Link href="/client/messages" className={surMessages ? "on" : ""}><Trace nom="messages" /><span>Messages</span>{compteur(messages)}</Link>
          <Link href="/client/radar/new" className="plus" aria-label="Nouveau projet"><Trace nom="plus" /><span /></Link>
          {PAIEMENTS_PRET ? <Link href="/client/paiements" className={surPaiements ? "on" : ""}><Trace nom="paiements" /><span>Paiements</span></Link> : null}
          <Link href="/client/profil" className={surProfil ? "on" : ""}><Trace nom="profil" /><span>Profil</span></Link>
        </nav>
      )}
    </>
  );
}
