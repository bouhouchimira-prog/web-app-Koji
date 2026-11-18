"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientTopbar, CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { ClientDonnees, ClientSuppression } from "../../../components/ClientDonnees";
import { OU_LES_RETROUVER } from "../../../lib/notifications-client";
import "../cli03.css";

// Koji Client · Paramètres (maquette CLI-06) : notifications, langue, mes
// données (télécharger, supprimer mon compte), pages légales. La maquette
// prévoit quatre familles de notifications et « par e-mail aussi » : Koji
// n'envoie aujourd'hui au particulier ni e-mail ni notification sur le
// téléphone, les interrupteurs ne régleraient rien ; ils ne sont pas
// affichés. Sur ordinateur, les mêmes réglages sont aussi dans Profil.

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function Parametres() {
  const router = useRouter();
  const params = useSearchParams();
  const suppression = params.get("rubrique") === "suppression";
  const [nom, setNom] = useState("");
  const [connecte, setConnecte] = useState(true);

  useEffect(() => {
    const c = compteLocal();
    if (!c?.id) { setConnecte(false); return; }
    setNom([c.personal?.firstName, c.personal?.lastName].filter(Boolean).join(" ") || c.name || "");
  }, []);

  function deconnexion() {
    try { window.localStorage.removeItem("koji-user"); } catch { /* stockage indisponible */ }
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login?type=particulier");
  }

  if (!connecte) {
    return (
      <div className={`${CHARTE_CLIENT} kc sans-barre`}>
        <header className={`${CHARTE_CLIENT} kc-bar`} style={{ display: "flex" }}>
          <div><strong>Paramètres</strong><small>connexion nécessaire</small></div>
        </header>
        <main className="kc-m">
          <div className="kc-body" style={{ maxWidth: 520 }}>
            <p className="kc-p">Connectez-vous pour régler votre compte.</p>
            <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
          </div>
        </main>
      </div>
    );
  }

  const contenu = suppression ? (
    <ClientSuppression onGarder={() => router.push("/client/parametres")} />
  ) : (
    <>
      <p className="kc3-sec">Notifications</p>
      <div className="kc3-row fixe"><div><strong>Dans Koji</strong><small>{OU_LES_RETROUVER}</small></div></div>
      <p className="kc3-sec">Langue</p>
      <div className="kc3-row fixe"><div><strong>Français</strong><small>les messages des compagnons vous arrivent en français</small></div></div>
      <p className="kc3-sec">Mes données</p>
      <ClientDonnees lienSupprimer="/client/parametres?rubrique=suppression" />
      <p className="kc-s" style={{ marginTop: 6 }}>
        <Link className="kc3-lien" href="/legal/conditions-particuliers">Conditions particuliers</Link>, <Link className="kc3-lien" href="/legal/confidentialite">confidentialité</Link> et <Link className="kc3-lien" href="/legal/cookies">cookies</Link> : pages légales.
      </p>
      <p className="kc-s"><button type="button" className="kc3-lien" onClick={deconnexion}>Se déconnecter</button></p>
    </>
  );

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar titre={suppression ? "Supprimer mon compte" : "Paramètres"} sousTitre={nom} backHref={suppression ? "/client/parametres" : "/client/profil"} />
      <main className="kc-m">
        <div className="kc-d">
          <h1 className="kc-h">{suppression ? "Supprimer mon compte" : "Paramètres"}</h1>
          <div className="kc3-cols large">
            <div className="kc3-list" style={{ maxWidth: 640 }}>{contenu}</div>
            <aside className="kc3-a">
              <h3>Sur ordinateur</h3>
              <p>Vos coordonnées, votre logement et vos données se règlent aussi depuis <Link className="kc3-lien" href="/client/profil">Profil</Link>.</p>
              <h3>Une question ?</h3>
              <p><Link className="kc3-lien" href="/client/aide">Aide</Link> · contact@getkoji.io</p>
            </aside>
          </div>
        </div>
        <div className="kc-t kc-body">{contenu}</div>
      </main>
    </div>
  );
}

export default function ClientParametresPage() {
  return <Suspense fallback={null}><Parametres /></Suspense>;
}
