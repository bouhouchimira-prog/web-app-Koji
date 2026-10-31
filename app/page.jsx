"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../components/Shell";
import { PublicLanding } from "../components/PublicLanding";
import { apiGet, apiSend, readStoredUser } from "../lib/client-api";
import { euro, shortDate } from "../lib/pricing";
import { useApi } from "../lib/use-api";
import { estNouveau, publication, titreCourt, villeSeule } from "../lib/radar-display";
// Kept: /marketplace and /chiffre-affaires reuse its kd-/home- classes and
// only get them through this import.
import "./dashboard.css";

// Accueil Koji Pro, nouvelle DA (maquette PRO-01, 30 oct). Données réelles
// uniquement : la maquette montre aussi des fourchettes de prix, des jetons
// et un nombre de positions par chantier, que l'API ne fournit pas (les
// fourchettes ont été retirées le 17 oct, les jetons ne sont pas encore en
// place côté serveur).

const URGENT_LABELS = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };

const LEADS_VISIBLES = 6;
const A_TRAITER_VISIBLES = 5;
const RELANCE_DEVIS_JOURS = 7;
const MAX_POSITIONNEMENTS = 5; // même limite que /api/marketplace/offres/[id]/positionner

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function pluriel(n, mot, motPluriel) {
  return `${n} ${n > 1 ? motPluriel || `${mot}s` : mot}`;
}

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function dateDuJour() {
  const texte = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function prenomDe(user) {
  const name = String(user?.name || "").trim();
  if (name) return name.split(/\s+/)[0];
  return user?.email ? user.email.split("@")[0] : "";
}

function timeAgo(value) {
  if (!value) return "";
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(value));
}

function extractTime(isoStr) {
  const m = String(isoStr || "").match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

// Où en est un positionnement, d'après la conversation du chantier
// (GET /api/marketplace/offres/[id]/messages).
function suiviDepuisMessages(messages) {
  const fil = Array.isArray(messages) ? messages : [];
  const dernier = fil[fil.length - 1];
  const propositions = fil.filter((m) => m.kind === "rdv_proposal" && m.rdvDate);
  const proposition = propositions[propositions.length - 1];
  const reponse = proposition ? fil.find((m) => m.kind === "rdv_response" && m.respondsToId === proposition.id) : null;
  const visite = proposition
    ? { date: proposition.rdvDate, statut: reponse?.rdvStatus === "accepted" ? "confirmee" : reponse?.rdvStatus === "declined" ? "refusee" : "proposee" }
    : null;
  const clientARepondu = Boolean(dernier && dernier.senderType === "particulier" && (dernier.kind || "text") === "text");
  return { clientARepondu, visite };
}

function dateVisite(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function libelleSuivi(suivi) {
  if (suivi?.clientARepondu) return "Le client vous a répondu";
  if (suivi?.visite?.statut === "confirmee") return `Visite confirmée, ${dateVisite(suivi.visite.date)}`;
  if (suivi?.visite?.statut === "proposee") return `Visite proposée, ${dateVisite(suivi.visite.date)}`;
  if (suivi?.visite?.statut === "refusee") return "Visite refusée, proposez une autre date";
  return "En attente du client";
}

function DashboardHome() {
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: tasks } = useApi("/api/tasks", "tasks");
  const { data: calendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: urgentAlerts } = useApi("/api/urgent-alerts", "alerts");
  const { data: offres, loading: offresLoading } = useApi("/api/marketplace/offres", "offres");

  const [prenom, setPrenom] = useState("");
  const [profileComplete, setProfileComplete] = useState(true);
  const [positions, setPositions] = useState({}); // { [offreId]: { positionnee, envoi, erreur } }
  const [suivis, setSuivis] = useState({}); // { [offreId]: { clientARepondu, visite } }
  const [info, setInfo] = useState("");
  const [radarFiltre, setRadarFiltre] = useState("tous");
  const [radarTri, setRadarTri] = useState("recent");
  const [leadOuvert, setLeadOuvert] = useState(undefined); // undefined = le premier
  const [toutAfficher, setToutAfficher] = useState(false);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) return;
    setPrenom(prenomDe(user));
    setProfileComplete(Boolean(user.profileComplete && user.businessInfoComplete));
  }, []);

  // Statut « déjà positionné » de chaque chantier (pas de route qui liste
  // tous les positionnements d'une entreprise).
  const idsOffres = offres.map((o) => o.id).join(",");
  useEffect(() => {
    if (!idsOffres) return undefined;
    let annule = false;
    idsOffres.split(",").forEach(async (id) => {
      try {
        const data = await apiGet(`/api/marketplace/offres/${id}/positionner`);
        const positionnee = Boolean(data?.positionnee || data?.positionnement?.status === "Active");
        if (!annule && positionnee) setPositions((prev) => ({ ...prev, [id]: { positionnee: true } }));
      } catch { /* une offre illisible ne bloque pas les autres */ }
    });
    return () => { annule = true; };
  }, [idsOffres]);

  const estPrise = (offre) => Boolean(positions[offre.id]?.positionnee);
  const prises = offres.filter(estPrise);
  const disponibles = offres.filter((o) => !estPrise(o));
  const nouveaux = disponibles.filter((o) => estNouveau(o.createdAt));
  const limiteAtteinte = prises.length >= MAX_POSITIONNEMENTS;

  const idsPrises = prises.map((o) => o.id).join(",");
  useEffect(() => {
    if (!idsPrises) return undefined;
    let annule = false;
    idsPrises.split(",").forEach(async (id) => {
      try {
        const data = await apiGet(`/api/marketplace/offres/${id}/messages`);
        if (!annule) setSuivis((prev) => ({ ...prev, [id]: suiviDepuisMessages(data?.messages) }));
      } catch { /* suivi indisponible : la ligne garde « En attente du client » */ }
    });
    return () => { annule = true; };
  }, [idsPrises]);

  useEffect(() => {
    if (!info) return undefined;
    const timer = setTimeout(() => setInfo(""), 3500);
    return () => clearTimeout(timer);
  }, [info]);

  async function positionner(offreId) {
    setPositions((prev) => ({ ...prev, [offreId]: { envoi: true } }));
    try {
      await apiSend(`/api/marketplace/offres/${offreId}/positionner`, {});
      setPositions((prev) => ({ ...prev, [offreId]: { positionnee: true } }));
      setInfo("Positionnement envoyé au client");
    } catch (error) {
      setPositions((prev) => ({ ...prev, [offreId]: { erreur: error.message || "Le positionnement n'a pas pu être envoyé." } }));
    }
  }

  const today = aujourdhui();
  const aSigner = quotes.filter((q) => q.status === "Envoye");
  const brouillons = quotes
    .filter((q) => String(q.status || "").startsWith("Brouillon"))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const dernierBrouillon = brouillons[0];
  const chantiersActifs = projects.filter((p) => !p.archivedAt && !["Termine", "Archive"].includes(p.status));
  const aPlanifier = chantiersActifs.filter((p) => p.status === "A planifier").length;

  const eyebrow = [
    dateDuJour(),
    aSigner.length ? `${pluriel(aSigner.length, "devis", "devis")} à signer` : null,
    brouillons.length ? pluriel(brouillons.length, "brouillon") : null
  ].filter(Boolean).join(" · ");

  let radarListe = radarFiltre === "nouveaux" ? nouveaux : radarFiltre === "prises" ? prises : offres;
  radarListe = [...radarListe].sort((a, b) => {
    const ordre = String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    return radarTri === "ancien" ? -ordre : ordre;
  });
  const radarVisibles = radarListe.slice(0, LEADS_VISIBLES);
  const idOuvert = leadOuvert === undefined ? radarVisibles[0]?.id : leadOuvert;

  const aTraiter = useMemo(() => {
    const items = [];
    for (const alert of urgentAlerts) {
      const qui = alert.source === "client" ? "Client" : "Ouvrier";
      items.push({
        id: `alert-${alert.id}`,
        rang: 0,
        titre: `${URGENT_LABELS[alert.type] || "Alerte"}, ${alert.projectTitle || "chantier"}`,
        meta: [`${qui} ${alert.senderName || ""}`.trim(), timeAgo(alert.createdAt)].filter(Boolean).join(" · "),
        tag: "Bloquant",
        ton: "b",
        href: alert.projectId ? `/chantiers?project=${alert.projectId}` : "/chantiers",
        tri: alert.createdAt
      });
    }
    for (const offre of offres) {
      if (!positions[offre.id]?.positionnee || !suivis[offre.id]?.clientARepondu) continue;
      items.push({
        id: `reponse-${offre.id}`,
        rang: 1,
        titre: `Réponse client, ${titreCourt(offre.description)}`,
        meta: [offre.metier, villeSeule(offre.address)].filter(Boolean).join(" · "),
        tag: "À répondre",
        ton: "e",
        href: `/marketplace/${offre.id}`,
        tri: offre.createdAt
      });
    }
    for (const event of calendarEvents) {
      const jour = String(event.startAt || "").slice(0, 10);
      if (jour !== today || event.status === "Termine") continue;
      const heure = event.allDay ? null : extractTime(event.startAt);
      items.push({
        id: `rdv-${event.id}`,
        rang: 1,
        titre: event.title || "Rendez-vous",
        meta: [heure ? `Aujourd'hui, ${heure}` : "Aujourd'hui", event.clientName || event.projectTitle].filter(Boolean).join(" · "),
        tag: "Aujourd'hui",
        ton: "e",
        href: "/planning",
        tri: event.startAt
      });
    }
    for (const task of tasks) {
      const jour = String(task.dueDate || task.startDate || "").slice(0, 10);
      if (task.done || !jour || jour > today) continue;
      const enRetard = jour < today;
      items.push({
        id: `task-${task.id}`,
        rang: 1,
        titre: task.label || "Tâche",
        meta: [enRetard ? `Prévue le ${shortDate(jour)}` : "Aujourd'hui", task.project].filter(Boolean).join(" · "),
        tag: enRetard ? "En retard" : "Aujourd'hui",
        ton: "e",
        href: task.projectId ? `/chantiers?project=${task.projectId}` : "/planning",
        tri: jour
      });
    }
    for (const invoice of invoices) {
      const echeance = String(invoice.dueDate || "").slice(0, 10);
      if (!["Emise", "Partielle"].includes(invoice.status) || !echeance || echeance >= today) continue;
      items.push({
        id: `facture-${invoice.id}`,
        rang: 2,
        titre: `${invoice.invoiceNumber ? `Facture ${invoice.invoiceNumber}` : "Facture"}, ${invoice.client || invoice.projectTitle || "client"}`,
        meta: `${euro(invoice.amountTtc)} en attente de règlement · échue le ${shortDate(echeance)}`,
        tag: "À relancer",
        ton: "o",
        href: "/facturation",
        tri: echeance
      });
    }
    const limiteRelance = Date.now() - RELANCE_DEVIS_JOURS * 86400000;
    for (const quote of quotes) {
      if (quote.status !== "Envoye") continue;
      const envoi = new Date(quote.sentAt || quote.updatedAt || quote.createdAtIso || quote.createdAt || 0);
      if (!Number.isFinite(envoi.getTime()) || envoi.getTime() > limiteRelance) continue;
      items.push({
        id: `devis-${quote.id}`,
        rang: 2,
        titre: `Relance devis ${quote.quoteNumber || ""}`.trim(),
        meta: `${quote.client || "Client"} · envoyé, sans réponse`,
        tag: "À relancer",
        ton: "o",
        href: `/devis?id=${quote.id}`,
        tri: envoi.toISOString()
      });
    }
    if (!profileComplete) {
      items.push({
        id: "profil",
        rang: 3,
        titre: "Profil entreprise incomplet",
        meta: "Un profil complet rassure les clients du Radar",
        tag: "À compléter",
        ton: "o",
        href: "/profil",
        tri: ""
      });
    }
    return items.sort((a, b) => a.rang - b.rang || String(a.tri || "").localeCompare(String(b.tri || "")));
  }, [urgentAlerts, offres, positions, suivis, calendarEvents, tasks, invoices, quotes, profileComplete, today]);

  const aTraiterVisibles = toutAfficher ? aTraiter : aTraiter.slice(0, A_TRAITER_VISIBLES);

  return (
    <Shell variant="pro">
        <header className="kp-head">
          <span className="kp-eyebrow">{eyebrow}</span>
          <h1>{prenom ? `Bonjour, ${prenom}.` : "Bonjour."}</h1>
        </header>

        <section className="kp-hero" aria-label="Devis guidé">
          <div>
            <div className="kp-hero-k">Devis guidé</div>
            <h2>Décris le chantier. Koji le chiffre.</h2>
            <p>
              Questions oubliées posées, validation ligne par ligne.
              {dernierBrouillon ? (
                <>
                  {" "}
                  <Link href={`/devis?id=${dernierBrouillon.id}`} className="kp-inline-link">
                    Brouillon {dernierBrouillon.quoteNumber || ""} à reprendre
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <Link href="/devis-ia/new" className="kp-btn kp-btn-main">
            <IconPlus /> Démarrer un devis guidé
          </Link>
        </section>

        <section className="kp-kpis" aria-label="Indicateurs">
          <Link href="/devis" className="kp-kpi">
            <div className="l">À signer</div>
            <div className="v">{aSigner.length}</div>
            <div className="s">devis envoyés, en attente</div>
          </Link>
          <Link href="/chantiers" className="kp-kpi">
            <div className="l">Chantiers en cours</div>
            <div className="v">{chantiersActifs.length}</div>
            <div className="s">{aPlanifier ? `${aPlanifier} à planifier` : "en cours ou en attente"}</div>
          </Link>
          <Link href="/marketplace" className="kp-kpi">
            <div className="l">Dans votre zone</div>
            <div className="v">{disponibles.length}</div>
            <div className="s">
              {nouveaux.length ? `${pluriel(nouveaux.length, "nouveau", "nouveaux")} sur le Radar` : "chantiers prêts à être pris"}
            </div>
          </Link>
        </section>

        <div className="kp-grid">
          <section className="kp-card" aria-label="Radar des chantiers">
            <div className="kp-card-h">
              <h2>Radar des chantiers</h2>
              <Link href="/marketplace" className="kp-link">Plein écran</Link>
            </div>

            <div className="kp-rbar">
              <div className="kp-seg" role="group" aria-label="Filtrer le Radar">
                {[
                  ["tous", "Tous", offres.length],
                  ["nouveaux", "Nouveaux", nouveaux.length],
                  ["prises", "Positions prises", prises.length]
                ].map(([cle, libelle, nombre]) => (
                  <button
                    key={cle}
                    type="button"
                    className={radarFiltre === cle ? "on" : ""}
                    aria-pressed={radarFiltre === cle}
                    onClick={() => { setRadarFiltre(cle); setLeadOuvert(undefined); }}
                  >
                    {libelle}<b>{nombre}</b>
                  </button>
                ))}
              </div>
              <label className="kp-sort">
                Trier
                <select value={radarTri} onChange={(e) => { setRadarTri(e.target.value); setLeadOuvert(undefined); }}>
                  <option value="recent">Plus récents</option>
                  <option value="ancien">Plus anciens</option>
                </select>
              </label>
            </div>

            {offresLoading ? (
              <div className="kp-empty">Chargement…</div>
            ) : offres.length === 0 ? (
              <div className="kp-empty">
                <strong>Aucun chantier dans votre zone pour le moment</strong>
                Les chantiers publiés dans votre métier et votre zone apparaîtront ici.
              </div>
            ) : radarVisibles.length === 0 ? (
              <div className="kp-empty">Aucun chantier dans ce filtre.</div>
            ) : (
              <div className="kp-leads">
                {radarVisibles.map((offre, index) => {
                  const prise = estPrise(offre);
                  const ouvert = idOuvert === offre.id;
                  const etat = positions[offre.id];
                  return (
                    <div key={offre.id} className={`kp-lead${ouvert ? " open" : ""}`}>
                      <button
                        type="button"
                        className="kp-lead-row"
                        aria-expanded={ouvert}
                        onClick={() => setLeadOuvert(ouvert ? null : offre.id)}
                      >
                        <span className={`kp-n${prise ? " done" : ""}`}>{index + 1}</span>
                        <span className="kp-lead-main">
                          <span className="kp-lead-t">{titreCourt(offre.description)}</span>
                          <span className="kp-lead-meta">
                            {[villeSeule(offre.address), publication(offre.createdAt)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="kp-lead-r">
                          <span className="kp-pr">{offre.metier || "Chantier"}</span>
                          <span className="kp-sub">
                            {prise ? <><IconCheck /> Position prise</> : estNouveau(offre.createdAt) ? "Nouveau" : pluriel(offre.photosCount || 0, "photo")}
                          </span>
                        </span>
                      </button>
                      {ouvert ? (
                        <div className="kp-lead-det">
                          <div className="kp-ld-line">
                            <span>Métier <b>{offre.metier || "Non précisé"}</b></span>
                            {offre.delaiEstimeJours ? <span>Délai estimé <b>{pluriel(offre.delaiEstimeJours, "jour")}</b></span> : null}
                            <span>Photos <b>{offre.photosCount || 0}</b></span>
                            {prise ? <span>Suivi <b>{libelleSuivi(suivis[offre.id])}</b></span> : null}
                          </div>
                          <div className="kp-lead-act">
                            {prise ? (
                              <span className="kp-tag-val"><IconCheck /> Position prise</span>
                            ) : (
                              <button
                                type="button"
                                className="kp-btn kp-btn-main"
                                disabled={Boolean(etat?.envoi) || limiteAtteinte}
                                onClick={() => positionner(offre.id)}
                              >
                                <IconTarget /> {etat?.envoi ? "Envoi…" : "Me positionner"}
                              </button>
                            )}
                            <Link href={`/marketplace/${offre.id}`} className="kp-link">Voir le chantier</Link>
                          </div>
                          {!prise && limiteAtteinte ? (
                            <p className="kp-lead-note">
                              Vous avez {MAX_POSITIONNEMENTS} positions ouvertes, le maximum. Retirez-vous d'un chantier pour vous positionner ici.
                            </p>
                          ) : null}
                          {etat?.erreur ? <p className="kp-lead-err" role="alert">{etat.erreur}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="kp-card" aria-label="À traiter">
            <div className="kp-card-h">
              <h2>À traiter{aTraiter.length ? <span className="kp-cnt">{aTraiter.length}</span> : null}</h2>
              {aTraiter.length > A_TRAITER_VISIBLES ? (
                <button type="button" className="kp-link" onClick={() => setToutAfficher((v) => !v)}>
                  {toutAfficher ? "Réduire" : "Tout voir"}
                </button>
              ) : null}
            </div>
            {aTraiter.length === 0 ? (
              <div className="kp-empty">
                <strong>Rien à traiter</strong>
                Tout est à jour pour aujourd'hui.
              </div>
            ) : (
              <div className="kp-rows">
                {aTraiterVisibles.map((item) => (
                  <Link key={item.id} href={item.href} className="kp-row">
                    <span className="t">
                      <strong>{item.titre}</strong>
                      {item.meta ? <small>{item.meta}</small> : null}
                    </span>
                    <span className={`kp-tag ${item.ton}`}>{item.tag}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

            {info ? <div className="kp-toast" role="status">{info}</div> : null}
    </Shell>
  );
}

// "/" sert deux publics (23 septembre) : la page publique de presentation
// (visiteur non connecte, voir components/PublicLanding.jsx) et le tableau
// de bord entreprise (DashboardHome ci-dessus) — decide une seule fois via
// le meme cache localStorage "koji-user" que Shell.jsx utilise deja pour sa
// propre verification de session, pour ne jamais monter le tableau de bord
// (et ses appels API authentifies) tant que la decision n'est pas prise.
export default function RootPage() {
  const [status, setStatus] = useState("checking"); // checking | guest | member

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("koji-user");
      const parsed = raw ? JSON.parse(raw) : null;
      setStatus(parsed?.id ? "member" : "guest");
    } catch {
      setStatus("guest");
    }
  }, []);

  if (status === "checking") return null;
  if (status === "guest") return <PublicLanding />;
  return <DashboardHome />;
}
