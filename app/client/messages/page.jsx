"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClientTopbar, CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { cleFil, heureBulle, heureFil } from "../../../lib/notifications-client";
import "../cli03.css";

// Koji Client · Messages (maquette CLI-03). Un fil par entreprise et par
// demande : liste à gauche et fil à droite sur ordinateur, fil plein écran
// sur téléphone (/client/messages?fil=offre:entreprise). Les fils viennent
// de /api/client/messages (session du particulier), l'envoi de
// /api/marketplace/offres/[id]/messages, comme sur la fiche du projet :
// message, réponse à un rendez-vous proposé, rendez-vous proposé par le
// client, photos débloquées pour une entreprise.
//
// Traduction : côté Pro, les messages de l'artisan sont traduits en français
// avant l'envoi et seul le texte français est enregistré ; aucun message ne
// porte donc de traduction ni d'original à montrer ici (pas de « traduit
// du … · voir l'original »).

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

const Envoyer = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>;

const nomDe = (c) => c?.entrepriseSnapshot?.raisonSociale || "Entreprise";
const dernier = (c) => c?.messages?.[c.messages.length - 1] || null;

function useOrdinateur() {
  const [ordinateur, setOrdinateur] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)");
    const maj = () => setOrdinateur(m.matches);
    maj();
    m.addEventListener("change", maj);
    return () => m.removeEventListener("change", maj);
  }, []);
  return ordinateur;
}

function Bulle({ m, reponduA, onRdv, envoi }) {
  const sortant = m.senderType === "particulier";
  const proposition = m.kind === "rdv_proposal" && !sortant;
  return (
    <div className={`kc3-bub ${sortant ? "out" : "in"}${proposition ? " rdv" : ""}`}>
      {m.message}
      {proposition && !reponduA.has(m.id) ? (
        <span className="kc3-bact">
          <button type="button" className="kc-btn sm" onClick={() => onRdv(m.id, "accepted")} disabled={envoi}>Accepter</button>
          <button type="button" className="kc-sec" onClick={() => onRdv(m.id, "declined")} disabled={envoi}>Refuser</button>
        </span>
      ) : null}
      <small>{heureBulle(m.createdAt)}</small>
    </div>
  );
}

function Messages() {
  const params = useSearchParams();
  const fil = params.get("fil") || "";
  const ordinateur = useOrdinateur();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | erreur | deconnecte
  const [conversations, setConversations] = useState([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [rdvOuvert, setRdvOuvert] = useState(false);
  const [rdvDate, setRdvDate] = useState("");
  const chatOrdi = useRef(null);

  const charger = useCallback(() => {
    if (!compteLocal()?.id) { setEtat("deconnecte"); return; }
    setEtat("chargement");
    fetch("/api/client/messages", { credentials: "same-origin" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lecture impossible.");
        setConversations(data.conversations || []);
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const cle = (c) => cleFil(c.offerId, c.entrepriseUserId);
  const choisie = conversations.find((c) => cle(c) === fil) || null;
  // Ordinateur : sans fil choisi, le plus récent s'ouvre à droite.
  const active = choisie || (ordinateur ? conversations[0] || null : null);
  const cleActive = active ? cle(active) : "";

  useEffect(() => { setErreur(""); setRdvOuvert(false); setTexte(""); }, [cleActive]);

  // Fil ouvert : ses notifications « message » passent en lues.
  useEffect(() => {
    if (!active?.unread) return;
    fetch("/api/notifications", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        const aLire = (data.notifications || []).filter((n) => n.type === "radar.message" && !n.read && n.offerId === active.offerId && n.entrepriseUserId === active.entrepriseUserId);
        return Promise.all(aLire.map((n) => fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, action: "read" }) })));
      })
      .then(() => setConversations((prev) => prev.map((c) => (cle(c) === cleActive ? { ...c, unread: false } : c))))
      .catch(() => {});
  }, [cleActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dernier message visible.
  useEffect(() => {
    if (!active) return;
    if (ordinateur && chatOrdi.current) chatOrdi.current.scrollTop = chatOrdi.current.scrollHeight;
    if (!ordinateur) window.scrollTo(0, document.documentElement.scrollHeight);
  }, [cleActive, active?.messages?.length, ordinateur]); // eslint-disable-line react-hooks/exhaustive-deps

  const reponduA = useMemo(() => new Set((active?.messages || []).map((m) => m.respondsToId).filter(Boolean)), [active]);
  const photosDemandees = Boolean(active?.aDesPhotos) && (active?.messages || []).some((m) => m.kind === "photo_request") && !(active?.messages || []).some((m) => m.kind === "photo_grant");

  async function poster(corps) {
    if (!active) return false;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch(`/api/marketplace/offres/${encodeURIComponent(active.offerId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ entrepriseUserId: active.entrepriseUserId, ...corps })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Le message n'est pas parti.");
      setConversations((prev) => prev.map((c) => (cle(c) === cleActive ? { ...c, messages: [...c.messages, data.message] } : c)));
      return true;
    } catch (e) {
      setErreur(e.message || "Le message n'est pas parti.");
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function envoyer(event) {
    event.preventDefault();
    if (!texte.trim()) return;
    if (await poster({ message: texte.trim() })) setTexte("");
  }
  const repondreRdv = (respondsToId, rdvStatus) => poster({ kind: "rdv_response", respondsToId, rdvStatus });
  async function proposerRdv(event) {
    event.preventDefault();
    if (!rdvDate) return;
    if (await poster({ kind: "rdv_proposal", rdvDate: new Date(rdvDate).toISOString() })) { setRdvOuvert(false); setRdvDate(""); }
  }

  if (etat === "deconnecte") {
    return (
      <div className={`${CHARTE_CLIENT} kc sans-barre`}>
        <header className={`${CHARTE_CLIENT} kc-bar`} style={{ display: "flex" }}>
          <div><strong>Messages</strong><small>connexion nécessaire</small></div>
        </header>
        <main className="kc-m">
          <div className="kc-body" style={{ maxWidth: 520 }}>
            <p className="kc-p">Connectez-vous pour retrouver vos échanges avec les entreprises.</p>
            <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
          </div>
        </main>
      </div>
    );
  }

  const liste = conversations.map((c) => {
    const m = dernier(c);
    const apercu = m ? `${m.senderType === "particulier" ? "Vous : " : ""}${String(m.message || "").replace(/\s+/g, " ")}` : "";
    return (
      <Link key={cle(c)} href={`/client/messages?fil=${encodeURIComponent(cle(c))}`} scroll={false} className={`kc3-mt${cle(c) === cleActive ? " on" : ""}`} aria-current={cle(c) === cleActive ? "true" : undefined}>
        <b>{nomDe(c)}</b>
        <small>{apercu || c.offre?.titre || ""}</small>
        <em>{m ? heureFil(m.createdAt) : ""}</em>
        {c.unread ? <i aria-label="non lu" /> : null}
      </Link>
    );
  });

  const outils = active ? (
    <>
      {rdvOuvert ? (
        <form className="kc3-rdvf" onSubmit={proposerRdv}>
          <input type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} required aria-label="Date et heure du rendez-vous" />
          <button type="submit" className="kc-sec" disabled={envoi || !rdvDate}>Proposer</button>
          <button type="button" className="kc3-lien" onClick={() => setRdvOuvert(false)}>Annuler</button>
        </form>
      ) : (
        <div className="kc3-outils">
          <button type="button" className="kc3-lien" onClick={() => setRdvOuvert(true)}>Proposer un rendez-vous</button>
          {photosDemandees ? <button type="button" className="kc3-lien" onClick={() => poster({ kind: "photo_grant" })} disabled={envoi}>Débloquer mes photos pour {nomDe(active)}</button> : null}
        </div>
      )}
      {erreur ? <p className="kc3-err" role="alert">{erreur}</p> : null}
    </>
  ) : null;

  const saisie = (tel) => (
    <form className={`kc3-in${tel ? " tel" : ""}`} onSubmit={envoyer}>
      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={tel ? "Écrire un message…" : "Écrire à l'entreprise…"} aria-label="Votre message" maxLength={3000} />
      <button type="submit" disabled={envoi || !texte.trim()} aria-label="Envoyer"><Envoyer /></button>
    </form>
  );

  const fils = (active?.messages || []).map((m) => <Bulle key={m.id} m={m} reponduA={reponduA} onRdv={repondreRdv} envoi={envoi} />);
  const vide = "Aucun message pour l'instant. Les entreprises qui répondent à vos demandes vous écrivent ici.";

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar
        titre={!ordinateur && choisie ? nomDe(choisie) : ""}
        sousTitre={!ordinateur && choisie ? choisie.offre?.titre || "" : ""}
        backHref="/client/messages"
      />
      <main className="kc-m">
        {/* Ordinateur */}
        <div className="kc-d">
          <h1 className="kc-h">Messages</h1>
          {etat === "erreur" ? (
            <div className="kc-err"><span>Vos messages n'ont pas pu être chargés.</span><button type="button" className="kc-sec" onClick={charger}>Réessayer</button></div>
          ) : etat === "chargement" ? (
            <p className="kc-vide">Chargement de vos messages…</p>
          ) : conversations.length === 0 ? (
            <p className="kc-vide">{vide}</p>
          ) : (
            <div className="kc3-msg">
              <nav className="kc3-ml" aria-label="Conversations">{liste}</nav>
              {active ? (
                <section className="kc3-mc" aria-label={`Conversation avec ${nomDe(active)}`}>
                  <div className="kc3-mh"><b>{nomDe(active)}</b><small>{active.offre?.titre || ""}</small></div>
                  <div className="kc3-chat" ref={chatOrdi}>{fils}</div>
                  {saisie(false)}
                  {outils}
                  <p className="kc3-n">Vos messages sont traduits pour les compagnons qui le souhaitent ; en cas de doute, le texte original fait foi.</p>
                </section>
              ) : null}
            </div>
          )}
        </div>

        {/* Téléphone */}
        {choisie ? (
          <div className="kc-t kc-body">
            <div className="kc3-chat tel">{fils}</div>
            {outils}
            {saisie(true)}
          </div>
        ) : (
          <div className="kc-t kc-body">
            <h3 className="kc-ph">Messages</h3>
            {etat === "erreur" ? (
              <>
                <p className="kc-s">Vos messages n'ont pas pu être chargés.</p>
                <button type="button" className="kc-sec" onClick={charger}>Réessayer</button>
              </>
            ) : etat === "chargement" ? (
              <p className="kc-s">Chargement de vos messages…</p>
            ) : conversations.length === 0 ? (
              <p className="kc-s">{vide}</p>
            ) : fil ? (
              <>
                <p className="kc-s">Cette conversation n'existe plus.</p>
                <div className="kc3-tlist">{liste}</div>
              </>
            ) : (
              <div className="kc3-tlist">{liste}</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ClientMessagesPage() {
  return <Suspense fallback={null}><Messages /></Suspense>;
}
