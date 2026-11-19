"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClientTopbar, CHARTE_CLIENT } from "../../components/ClientTopbar";
import UrgenceEntree from "../../components/UrgenceEntree";

// Koji Client · « Mes projets » (maquette CLI-01). Une seule liste : les
// chantiers, les demandes publiées avec leurs propositions, les brouillons.
// Remplace l'ancien accueil (« Un autre projet de travaux ? ») et les listes
// séparées « Mes chantiers », « Mes demandes », « Devis reçus ».
//
// Les libellés viennent de /api/client/projets : le site et l'app affichent
// les mêmes. Aucun prix calculé par Koji (décision du 10 novembre) : la
// maquette écrit « prix recommandé » sous une demande, on n'affiche que le
// nombre de propositions.

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

// Lien interne (navigation du site) ou externe (page de signature).
function Lien({ href, className, children }) {
  return /^https?:/.test(href) ? <a href={href} className={className}>{children}</a> : <Link href={href} className={className}>{children}</Link>;
}

export default function MesProjets() {
  const [etat, setEtat] = useState("chargement"); // chargement | pret | deconnecte | erreur
  const [vue, setVue] = useState({ bonjour: "", projets: [], attendus: [] });

  const charger = useCallback(() => {
    if (!compteLocal()?.id) { setEtat("deconnecte"); return; }
    setEtat("chargement");
    fetch("/api/client/projets", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) { setEtat("deconnecte"); return; }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Lecture impossible.");
        setVue({ bonjour: data.bonjour || "", projets: data.projets || [], attendus: data.attendus || [] });
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  if (etat === "deconnecte") {
    return (
      <div className={`${CHARTE_CLIENT} kc sans-barre`}>
        <header className={`${CHARTE_CLIENT} kc-bar`} style={{ display: "flex" }}>
          <div><strong>Votre espace Koji</strong><small>connexion nécessaire</small></div>
        </header>
        <main className="kc-m">
          <div className="kc-body" style={{ maxWidth: 520 }}>
            <p className="kc-p">Connectez-vous pour retrouver vos projets, vos propositions et vos messages.</p>
            <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
          </div>
        </main>
      </div>
    );
  }

  const { projets, attendus } = vue;
  const nombre = projets.length;
  const compte = nombre === 0 ? "Aucun projet" : `${nombre} projet${nombre > 1 ? "s" : ""}`;

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar bonjour={vue.bonjour} />
      <main className="kc-m">
        {/* Ordinateur */}
        <div className="kc-d">
          <div className="kc-hd">
            <div>
              <span className="kc-ey">{etat === "pret" ? compte : " "}</span>
              <h1 className="kc-h">Mes projets</h1>
            </div>
            <Link className="kc-btn sm" href="/client/radar/new">Décrire un nouveau projet</Link>
          </div>

          {etat === "erreur" ? (
            <div className="kc-err"><span>Vos projets n'ont pas pu être chargés.</span><button type="button" className="kc-sec" onClick={charger}>Réessayer</button></div>
          ) : etat === "chargement" ? (
            <p className="kc-vide">Chargement de vos projets…</p>
          ) : nombre === 0 ? (
            <p className="kc-vide">Vous n'avez pas encore de projet. Décrivez vos travaux avec l'assistant Koji : il pose les bonnes questions et prépare votre demande pour les entreprises.</p>
          ) : (
            <div className="kc-pj">
              {projets.map((p) => (
                <div key={p.cle} className={`kc-pc${p.principale ? " on" : ""}${p.attenue ? " dim" : ""}`}>
                  <div><b>{p.titre}</b><small>{p.detail}</small></div>
                  <Lien href={p.lien} className={p.principale ? "kc-btn sm" : "kc-sec"}>{p.action}</Lien>
                </div>
              ))}
            </div>
          )}

          {/* Urgences (maquette PRO-17, Koji Client › Urgence) */}
          <UrgenceEntree style={{ marginTop: 10 }} />

          <aside className="kc-a">
            <h3>Ce qui vous attend</h3>
            {etat === "pret" && attendus.length ? attendus.map((ligne) => <p key={ligne}>{ligne}</p>) : <p>{etat === "pret" ? "Rien à faire pour l'instant." : " "}</p>}
            <h3>Un lien reçu ?</h3>
            <p>Les liens par SMS ou e-mail ouvrent directement le devis ou le message.</p>
          </aside>
        </div>

        {/* Téléphone */}
        <div className="kc-t kc-body">
          <h3 className="kc-ph">Vos projets</h3>
          {etat === "erreur" ? (
            <>
              <p className="kc-s">Vos projets n'ont pas pu être chargés.</p>
              <button type="button" className="kc-sec" onClick={charger}>Réessayer</button>
            </>
          ) : etat === "chargement" ? (
            <p className="kc-s">Chargement de vos projets…</p>
          ) : nombre === 0 ? (
            <p className="kc-s">Vous n'avez pas encore de projet.</p>
          ) : projets.map((p) => (
            <Lien key={p.cle} href={p.lien} className={`kc-ppj${p.attenue ? " dim" : ""}`}>
              <div><b>{p.titre}</b><small>{p.detail}</small></div>
              {p.etiquette ? <span className={`kc-st${p.etiquettePleine ? "" : " o"}`}>{p.etiquette}</span> : null}
            </Lien>
          ))}
          <Link className="kc-btn" href="/client/radar/new" style={{ marginTop: 8 }}>Nouveau projet</Link>
          <UrgenceEntree />
          <div className="kc-info">Décrivez vos travaux avec l'assistant Koji : il pose les bonnes questions et prépare votre demande pour les entreprises.</div>
          {etat === "pret" && attendus.length ? (
            <div className="kc-a" style={{ marginTop: 6 }}>
              <h3>Ce qui vous attend</h3>
              {attendus.map((ligne) => <p key={ligne}>{ligne}</p>)}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
