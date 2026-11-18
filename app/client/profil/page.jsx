"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClientTopbar, CHARTE_CLIENT } from "../../../components/ClientTopbar";
import { ClientDonnees, ClientSuppression } from "../../../components/ClientDonnees";
import { ligneCoordonnees, ligneLogement, nomAffiche } from "../../../lib/profil-client";
import { CE_QUE_KOJI_ENVOIE, OU_LES_RETROUVER } from "../../../lib/notifications-client";
import "../cli03.css";

// Koji Client · Profil (maquette CLI-03). Ordinateur : la liste à gauche,
// la rubrique choisie à droite. Téléphone : la liste, puis chaque rubrique
// en plein écran (/client/profil?rubrique=…). Données : /api/client/profile
// (session du particulier). « Mon logement » enregistre l'adresse et
// l'ancienneté déclarée (plus de 2 ans : TVA réduite).

function compteLocal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

const RUBRIQUES = ["coordonnees", "logement", "langue", "notifications", "donnees", "motdepasse"];
const TITRES = { coordonnees: "Coordonnées", logement: "Mon logement", langue: "Langue", notifications: "Notifications", donnees: "Mes données", motdepasse: "Mot de passe", suppression: "Supprimer mon compte" };

async function enregistrer(corps) {
  const r = await fetch("/api/client/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(corps) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Impossible d'enregistrer.");
  return data.user;
}

function useEnvoi(onUser) {
  const [etat, setEtat] = useState({ envoi: false, ok: false, erreur: "" });
  async function lancer(corps) {
    setEtat({ envoi: true, ok: false, erreur: "" });
    try {
      const user = await enregistrer(corps);
      onUser(user);
      setEtat({ envoi: false, ok: true, erreur: "" });
      return true;
    } catch (e) {
      setEtat({ envoi: false, ok: false, erreur: e.message });
      return false;
    }
  }
  return [etat, lancer];
}

function Retour({ etat }) {
  if (etat.erreur) return <p className="kc3-err" role="alert">{etat.erreur}</p>;
  if (etat.ok) return <p className="kc3-ok" role="status">Enregistré.</p>;
  return null;
}

function Coordonnees({ user, onUser }) {
  const [p, setP] = useState({ firstName: user.personal?.firstName || "", lastName: user.personal?.lastName || "", phone: user.personal?.phone || "" });
  const [etat, lancer] = useEnvoi(onUser);
  const champ = (cle) => (e) => setP((x) => ({ ...x, [cle]: e.target.value }));
  return (
    <form className="kc3-list" onSubmit={(e) => { e.preventDefault(); lancer({ personal: p }); }}>
      <div className="kc3-duo">
        <div className="kc-fld"><label htmlFor="kc3-prenom">Prénom</label><input id="kc3-prenom" value={p.firstName} onChange={champ("firstName")} autoComplete="given-name" maxLength={200} /></div>
        <div className="kc-fld"><label htmlFor="kc3-nom">Nom</label><input id="kc3-nom" value={p.lastName} onChange={champ("lastName")} autoComplete="family-name" maxLength={200} /></div>
      </div>
      <div className="kc-fld"><label htmlFor="kc3-tel">Téléphone</label><input id="kc3-tel" type="tel" value={p.phone} onChange={champ("phone")} autoComplete="tel" maxLength={40} /></div>
      <div className="kc-fld"><label htmlFor="kc3-mail">E-mail</label><input id="kc3-mail" value={user.email || ""} readOnly /></div>
      <p className="kc-s">Pour changer d'adresse e-mail, écrivez à contact@getkoji.io.</p>
      <Retour etat={etat} />
      <button type="submit" className="kc-btn sm" disabled={etat.envoi}>{etat.envoi ? "Enregistrement…" : "Enregistrer"}</button>
      <p className="kc-n" style={{ marginTop: 2 }}>Votre téléphone n'est transmis qu'à l'entreprise avec laquelle un rendez-vous est confirmé.</p>
    </form>
  );
}

function Logement({ user, onUser }) {
  const [p, setP] = useState({ address: user.personal?.address || "", postalCode: user.personal?.postalCode || "", city: user.personal?.city || "" });
  const [age, setAge] = useState(user.logement?.plusDeDeuxAns ?? null);
  const [etat, lancer] = useEnvoi(onUser);
  const champ = (cle) => (e) => setP((x) => ({ ...x, [cle]: e.target.value }));
  const choix = [[true, "Oui"], [false, "Non, il est neuf"], [null, "Je ne sais pas"]];
  return (
    <form className="kc3-list" onSubmit={(e) => { e.preventDefault(); lancer({ personal: p, logement: { plusDeDeuxAns: age } }); }}>
      <div className="kc-fld"><label htmlFor="kc3-adr">Adresse</label><input id="kc3-adr" value={p.address} onChange={champ("address")} autoComplete="street-address" maxLength={200} /></div>
      <div className="kc3-duo cp">
        <div className="kc-fld"><label htmlFor="kc3-cp">Code postal</label><input id="kc3-cp" value={p.postalCode} onChange={champ("postalCode")} autoComplete="postal-code" inputMode="numeric" maxLength={10} /></div>
        <div className="kc-fld"><label htmlFor="kc3-ville">Ville</label><input id="kc3-ville" value={p.city} onChange={champ("city")} autoComplete="address-level2" maxLength={200} /></div>
      </div>
      <div className="kc-fld">
        <label id="kc3-age">Le logement a-t-il plus de 2 ans ?</label>
        <div className="kc3-choix" role="radiogroup" aria-labelledby="kc3-age">
          {choix.map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={age === v} className={age === v ? "on" : ""} onClick={() => setAge(v)}>{l}</button>)}
        </div>
      </div>
      <div className="kc-info">Dans un logement achevé depuis plus de 2 ans, la plupart des travaux de rénovation sont à 10 % de TVA au lieu de 20 %. L'entreprise confirme le taux sur son devis.</div>
      <Retour etat={etat} />
      <button type="submit" className="kc-btn sm" disabled={etat.envoi}>{etat.envoi ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}

function MotDePasse({ onUser }) {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [etat, lancer] = useEnvoi(onUser);
  async function valider(e) {
    e.preventDefault();
    if (await lancer({ password: nouveau.trim(), currentPassword: actuel.trim() || undefined })) { setActuel(""); setNouveau(""); }
  }
  return (
    <form className="kc3-list" onSubmit={valider}>
      <p className="kc-s">Le mot de passe est facultatif : vous pouvez aussi retrouver votre projet avec un code reçu par e-mail.</p>
      <div className="kc-fld"><label htmlFor="kc3-mdp1">Mot de passe actuel</label><input id="kc3-mdp1" type="password" value={actuel} onChange={(e) => setActuel(e.target.value)} autoComplete="current-password" /></div>
      <p className="kc-s">Laissez vide si vous n'en avez jamais choisi.</p>
      <div className="kc-fld"><label htmlFor="kc3-mdp2">Nouveau mot de passe</label><input id="kc3-mdp2" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" minLength={8} /></div>
      <p className="kc-s">8 caractères au moins.</p>
      <Retour etat={etat} />
      <button type="submit" className="kc-btn sm" disabled={etat.envoi || nouveau.trim().length < 8}>{etat.envoi ? "Enregistrement…" : "Changer le mot de passe"}</button>
    </form>
  );
}

function Langue() {
  return (
    <div className="kc3-list">
      <div className="kc3-row fixe"><div><strong>Français</strong><small>Koji Client est en français</small></div></div>
      <p className="kc-p">Les compagnons qui écrivent dans une autre langue peuvent faire traduire leurs messages en français avant de vous les envoyer. En cas de doute, le texte original fait foi : demandez-le à l'entreprise.</p>
    </div>
  );
}

function Notifications() {
  return (
    <div className="kc3-list">
      <p className="kc-p">{CE_QUE_KOJI_ENVOIE}</p>
      <p className="kc-p">{OU_LES_RETROUVER}</p>
      <Link className="kc-sec" href="/client/notifications">Voir mes notifications</Link>
    </div>
  );
}

function Profil() {
  const params = useSearchParams();
  const demandee = params.get("rubrique") || "";
  const [etat, setEtat] = useState("chargement"); // chargement | pret | erreur | deconnecte
  const [user, setUser] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const charger = useCallback(() => {
    const local = compteLocal();
    if (!local?.id) { setEtat("deconnecte"); return; }
    fetch("/api/client/profile", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) { setEtat("deconnecte"); return; }
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.user) throw new Error(data.error || "Lecture impossible.");
        setUser(data.user);
        setEtat("pret");
      })
      .catch(() => setEtat("erreur"));
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setSuppression(demandee === "suppression"); }, [demandee]);

  // Profil enregistré : la copie locale (nom affiché dans le bandeau) suit.
  function majUser(nouveau) {
    if (!nouveau) return;
    setUser(nouveau);
    try {
      const local = compteLocal() || {};
      localStorage.setItem("koji-user", JSON.stringify({ ...local, name: nouveau.name, personal: nouveau.personal }));
    } catch { /* stockage indisponible */ }
  }

  if (etat === "deconnecte") {
    return (
      <div className={`${CHARTE_CLIENT} kc sans-barre`}>
        <header className={`${CHARTE_CLIENT} kc-bar`} style={{ display: "flex" }}>
          <div><strong>Profil</strong><small>connexion nécessaire</small></div>
        </header>
        <main className="kc-m">
          <div className="kc-body" style={{ maxWidth: 520 }}>
            <p className="kc-p">Connectez-vous pour retrouver votre profil.</p>
            <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
          </div>
        </main>
      </div>
    );
  }

  const rubrique = demandee === "suppression" ? "donnees" : RUBRIQUES.includes(demandee) ? demandee : "";
  const active = rubrique || "coordonnees"; // ordinateur : Coordonnées par défaut
  const nom = user ? nomAffiche(user) : "";
  const lignes = user ? [
    ["coordonnees", "Coordonnées", ligneCoordonnees(user)],
    ["logement", "Mon logement", ligneLogement(user)],
    ["langue", "Langue", "français"],
    ["notifications", "Notifications", "dans Koji · pas encore par e-mail"],
    ["donnees", "Mes données", "télécharger, supprimer mon compte"],
    ["motdepasse", "Mot de passe", "facultatif · connexion par code possible"]
  ] : [];

  const contenu = (cle, tel) => {
    if (!user) return null;
    if (cle === "coordonnees") return <Coordonnees user={user} onUser={majUser} />;
    if (cle === "logement") return <Logement user={user} onUser={majUser} />;
    if (cle === "langue") return <Langue />;
    if (cle === "notifications") return <Notifications />;
    if (cle === "motdepasse") return <MotDePasse onUser={majUser} />;
    if (cle === "donnees") {
      return suppression
        ? <ClientSuppression onGarder={() => (tel ? window.history.back() : setSuppression(false))} />
        : tel ? <ClientDonnees lienSupprimer="/client/profil?rubrique=suppression" /> : <ClientDonnees onSupprimer={() => setSuppression(true)} />;
    }
    return null;
  };

  const liste = (tel) => (
    <div className="kc3-list">
      {lignes.map(([cle, titre, detail]) => (
        <Link key={cle} href={`/client/profil?rubrique=${cle}`} scroll={false} className={`kc3-row${!tel && cle === active ? " on" : ""}`} aria-current={!tel && cle === active ? "true" : undefined}>
          <div><strong>{titre}</strong><small>{detail}</small></div><span aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );

  const titreTel = demandee === "suppression" ? TITRES.suppression : rubrique ? TITRES[rubrique] : "Profil";
  const titrePanneau = active === "donnees" && suppression ? TITRES.suppression : TITRES[active];

  return (
    <div className={`${CHARTE_CLIENT} kc`}>
      <ClientTopbar titre={titreTel} sousTitre={nom} backHref={demandee === "suppression" ? "/client/profil?rubrique=donnees" : rubrique ? "/client/profil" : "/client"} />
      <main className="kc-m">
        {/* Ordinateur */}
        <div className="kc-d">
          <h1 className="kc-h">Profil</h1>
          {etat === "erreur" ? (
            <div className="kc-err"><span>Votre profil n'a pas pu être chargé.</span><button type="button" className="kc-sec" onClick={charger}>Réessayer</button></div>
          ) : etat === "chargement" ? (
            <p className="kc-vide">Chargement de votre profil…</p>
          ) : (
            <div className="kc3-cols">
              {liste(false)}
              <section className="kc3-pan" aria-label={titrePanneau}>
                <h3>{titrePanneau}</h3>
                {contenu(active, false)}
              </section>
            </div>
          )}
        </div>

        {/* Téléphone */}
        <div className="kc-t kc-body">
          {etat === "erreur" ? (
            <>
              <p className="kc-s">Votre profil n'a pas pu être chargé.</p>
              <button type="button" className="kc-sec" onClick={charger}>Réessayer</button>
            </>
          ) : etat === "chargement" ? (
            <p className="kc-s">Chargement de votre profil…</p>
          ) : rubrique ? contenu(rubrique, true) : (
            <>
              {liste(true)}
              <p className="kc-s" style={{ marginTop: 6 }}><Link className="kc3-lien" href="/client/parametres">Paramètres</Link> · <Link className="kc3-lien" href="/client/aide">Aide</Link></p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ClientProfilePage() {
  return <Suspense fallback={null}><Profil /></Suspense>;
}
