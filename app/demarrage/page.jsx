"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import {
  DEMARRAGE_SKIP_KEY,
  METIERS_DEMARRAGE,
  RAYONS_ZONE,
  activiteDe,
  demarrageSteps,
  essentialsDone,
  masquerSiren,
  tauxHoraireDe,
  tauxMinimum
} from "../../lib/demarrage";
import { formaterIban, ibanValide, normaliserIban } from "../../lib/iban";

// Démarrage guidé (maquette PRO-01.1) : six étapes, chacune dit ce qu'elle
// débloque ; l'étape en cours est ouverte, les autres se rouvrent d'un clic.
// Tout s'enregistre ici même. Pas encore construits, donc absents de
// l'écran : l'import de factures qui calcule les taux, la lecture d'une
// photo de l'attestation décennale, les taux proposés par Koji (Koji
// n'invente pas de prix : l'artisan les saisit ou les calcule).

function IconCheck() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}

function IconCalc() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4" />
    </svg>
  );
}

function adresseSiege(business) {
  return [business.addressLine1, [business.postalCode, business.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

async function geocoder(adresse) {
  const reponse = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`);
  const data = await reponse.json();
  const f = data?.features?.[0];
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates;
  return { label: f.properties.label, lat, lon };
}

// Étape 1 : SIREN → fiche de l'annuaire → « C'est bien moi ».
function EtapeEntreprise({ business, enregistrer }) {
  const [siren, setSiren] = useState(business.siren || "");
  const [fiche, setFiche] = useState(null);
  const [etat, setEtat] = useState({ status: "idle", error: "" });

  async function chercher(event) {
    event.preventDefault();
    setEtat({ status: "recherche", error: "" });
    setFiche(null);
    try {
      const data = await apiGet(`/api/entreprise/fiche-siren?siren=${encodeURIComponent(siren.replace(/\s/g, ""))}`);
      setFiche(data.fiche);
      setEtat({ status: "idle", error: "" });
    } catch (error) {
      setEtat({ status: "idle", error: error.message || "Recherche impossible pour le moment." });
    }
  }

  return (
    <div className="ob-body">
      <form className="ob-row" onSubmit={chercher}>
        <label className="ob-f">
          <span>Votre SIREN</span>
          <input value={siren} onChange={(e) => { setSiren(e.target.value); setFiche(null); }} inputMode="numeric" placeholder="9 chiffres" maxLength={11} autoComplete="off" />
        </label>
        <button type="submit" className="btn btn-sec" disabled={etat.status === "recherche" || siren.replace(/\D/g, "").length !== 9}>
          {etat.status === "recherche" ? "Recherche…" : "Rechercher"}
        </button>
      </form>
      {etat.error ? <p className="ob-err" role="alert">{etat.error}</p> : null}
      {fiche ? (
        <>
          <div className="ob-found">
            <span className="lab"><IconCheck />Trouvé dans l'annuaire des entreprises</span>
            <strong>{fiche.raisonSociale}</strong>
            <small>{[fiche.formeJuridique, adresseSiege(fiche)].filter(Boolean).join(" · ")}</small>
          </div>
          <div className="ob-act">
            <button type="button" className="link" onClick={() => setFiche(null)}>Ce n'est pas moi</button>
            <button type="button" className="btn btn-main" onClick={() => enregistrer({ business: fiche })}>C'est bien moi</button>
          </div>
        </>
      ) : (
        <small className="ob-help">
          Pas encore de SIREN (entreprise en création) ? Renseignez votre raison sociale dans <Link href="/profil">Profil</Link>.
        </small>
      )}
    </div>
  );
}

// Étape 2 : métiers (mêmes valeurs que le Radar) et zone autour d'une adresse.
function EtapeMetiers({ user, enregistrer }) {
  const business = user.business || {};
  const [metiers, setMetiers] = useState(Array.isArray(user.professions) ? user.professions : []);
  const [adresse, setAdresse] = useState(business.zoneAddress || adresseSiege(business));
  const [rayon, setRayon] = useState(Number(business.zoneRadiusKm) || 10);
  const [etat, setEtat] = useState({ status: "idle", error: "" });

  function basculer(metier) {
    setMetiers((actuels) => (actuels.includes(metier) ? actuels.filter((m) => m !== metier) : [...actuels, metier]));
  }

  async function continuer() {
    if (!metiers.length) { setEtat({ status: "idle", error: "Choisissez au moins un métier." }); return; }
    if (!adresse.trim()) { setEtat({ status: "idle", error: "Indiquez l'adresse d'où vous partez (le siège, en général)." }); return; }
    setEtat({ status: "envoi", error: "" });
    let lieu = null;
    try { lieu = await geocoder(adresse.trim()); } catch { lieu = null; }
    if (!lieu) { setEtat({ status: "idle", error: "Adresse introuvable : vérifiez la ville et le code postal." }); return; }
    const ok = await enregistrer({
      professions: metiers,
      business: { zoneAddress: lieu.label, zoneLat: lieu.lat, zoneLon: lieu.lon, zoneRadiusKm: rayon }
    });
    if (!ok) setEtat({ status: "idle", error: "" });
  }

  return (
    <div className="ob-body">
      <span className="ob-lab">Vos métiers</span>
      <div className="ob-chips">
        {METIERS_DEMARRAGE.map(({ metier, activite }) => {
          const on = metiers.includes(metier);
          return (
            <button key={metier} type="button" className={`ob-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => basculer(metier)}>
              {on ? null : "+ "}{activite}
            </button>
          );
        })}
      </div>
      <span className="ob-lab">Votre zone</span>
      <div className="ob-chips">
        {RAYONS_ZONE.map((km) => (
          <button key={km} type="button" className={`ob-chip${rayon === km ? " on" : ""}`} aria-pressed={rayon === km} onClick={() => setRayon(km)}>
            {km} km
          </button>
        ))}
      </div>
      <label className="ob-f">
        <span>autour de</span>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="12 rue des Vinaigriers, 75010 Paris" autoComplete="street-address" />
      </label>
      <small className="ob-help">Débloque le Radar des chantiers : vous voyez les chantiers de vos métiers dans cette zone.</small>
      {etat.error ? <p className="ob-err" role="alert">{etat.error}</p> : null}
      <div className="ob-act end">
        <button type="button" className="btn btn-main" onClick={continuer} disabled={etat.status === "envoi"}>
          {etat.status === "envoi" ? "Enregistrement…" : "Continuer"}
        </button>
      </div>
    </div>
  );
}

// Étape 3 : un taux par métier, et celui des autres postes (préparation,
// dépose, évacuation…) qui reste le taux de l'entreprise. Calculateur en
// 4 questions pour qui ne connaît pas son taux.
function EtapePrix({ user, taux, enregistrerPrix }) {
  const business = user.business || {};
  const metiers = (Array.isArray(user.professions) ? user.professions : []).filter((m) => METIERS_DEMARRAGE.find((d) => d.metier === m)?.familles.length);
  const [valeurs, setValeurs] = useState(() => Object.fromEntries(metiers.map((m) => [m, taux[m] ? String(taux[m]) : ""])));
  const [autres, setAutres] = useState(tauxHoraireDe(business) ? String(tauxHoraireDe(business)) : "");
  const [calcul, setCalcul] = useState(null); // { charges, revenu, heuresParSemaine, semaines }
  const [etat, setEtat] = useState({ status: "idle", error: "" });
  const minimum = calcul ? tauxMinimum(calcul) : null;

  function utiliserCalcul() {
    if (!minimum) return;
    setValeurs((v) => Object.fromEntries(Object.entries(v).map(([m, t]) => [m, t || String(minimum)])));
    setAutres((a) => a || String(minimum));
    setCalcul(null);
  }

  async function valider() {
    const taux = Number(String(autres).replace(",", "."));
    if (!(taux > 0)) { setEtat({ status: "idle", error: "Indiquez au moins le taux des autres postes : c'est lui qui chiffre la préparation, la dépose et l'évacuation." }); return; }
    setEtat({ status: "envoi", error: "" });
    const parMetier = Object.fromEntries(Object.entries(valeurs).map(([m, t]) => [m, Number(String(t).replace(",", ".")) || ""]));
    const ok = await enregistrerPrix(parMetier, taux);
    setEtat({ status: "idle", error: ok ? "" : etat.error });
  }

  const ligne = (cle, titre, detail, valeur, changer) => (
    <label key={cle} className="mp-tx">
      <div><strong>{titre}</strong>{detail ? <small>{detail}</small> : null}</div>
      <span className="ob-taux">
        <input value={valeur} onChange={(e) => changer(e.target.value)} inputMode="decimal" placeholder="—" aria-label={`Taux horaire ${titre}`} />
        <small>€/h</small>
      </span>
    </label>
  );

  return (
    <div className="ob-body">
      {metiers.map((m) => ligne(m, activiteDe(m), null, valeurs[m] || "", (v) => setValeurs((x) => ({ ...x, [m]: v }))))}
      {ligne("autres", "Autres postes", "préparation, dépose, évacuation, et tout métier sans taux", autres, setAutres)}

      {calcul ? (
        <div className="ob-calc">
          <strong>Calculer mon taux · 4 questions</strong>
          <div className="ob-calc-g">
            {[
              ["charges", "Charges de l'année", "€", "18 000"],
              ["revenu", "Revenu voulu, avant impôt", "€", "36 000"],
              ["heuresParSemaine", "Heures facturées par semaine", "h", "30"],
              ["semaines", "Semaines travaillées", "", "44"]
            ].map(([cle, label, unite, exemple]) => (
              <label key={cle} className="ob-f">
                <span>{label}</span>
                <span className="ob-taux">
                  <input value={calcul[cle]} onChange={(e) => setCalcul({ ...calcul, [cle]: e.target.value.replace(/\s/g, "").replace(",", ".") })} inputMode="decimal" placeholder={exemple} />
                  {unite ? <small>{unite}</small> : null}
                </span>
              </label>
            ))}
          </div>
          <div className="ob-min">
            <div>
              <small>Votre taux minimum</small>
              <b>{minimum ? `${minimum} € HT/h` : "—"}</b>
              <small>en dessous, vous perdez de l'argent</small>
            </div>
            <button type="button" className="btn btn-sec" disabled={!minimum} onClick={utiliserCalcul}>Utiliser ce calcul</button>
          </div>
        </div>
      ) : null}

      {etat.error ? <p className="ob-err" role="alert">{etat.error}</p> : null}
      <div className="ob-act">
        {calcul ? (
          <button type="button" className="link" onClick={() => setCalcul(null)}>Fermer le calcul</button>
        ) : (
          <button type="button" className="link" onClick={() => setCalcul({ charges: "", revenu: "", heuresParSemaine: "", semaines: "" })}>
            <IconCalc />Je ne connais pas mon taux : le calculer
          </button>
        )}
        <button type="button" className="btn btn-main" onClick={valider} disabled={etat.status === "envoi"}>
          {etat.status === "envoi" ? "Enregistrement…" : "Valider mes prix"}
        </button>
      </div>
    </div>
  );
}

function EtapeDecennale({ business, enregistrer }) {
  const [champs, setChamps] = useState({
    decennaleInsurer: business.decennaleInsurer || "",
    decennalePolicy: business.decennalePolicy || "",
    decennaleUntil: business.decennaleUntil || ""
  });
  const [envoi, setEnvoi] = useState(false);
  async function valider(event) {
    event.preventDefault();
    setEnvoi(true);
    await enregistrer({ business: champs });
    setEnvoi(false);
  }
  return (
    <form className="ob-body" onSubmit={valider}>
      <div className="ob-grid">
        <label className="ob-f"><span>Assureur</span><input value={champs.decennaleInsurer} onChange={(e) => setChamps({ ...champs, decennaleInsurer: e.target.value })} maxLength={80} required /></label>
        <label className="ob-f"><span>N° de contrat</span><input value={champs.decennalePolicy} onChange={(e) => setChamps({ ...champs, decennalePolicy: e.target.value })} maxLength={60} /></label>
        <label className="ob-f"><span>Valable jusqu'au</span><input type="date" value={champs.decennaleUntil} onChange={(e) => setChamps({ ...champs, decennaleUntil: e.target.value })} required /></label>
      </div>
      <small className="ob-help">Ces mentions apparaissent sur vos devis, comme la loi l'exige.</small>
      <div className="ob-act end">
        <button type="submit" className="btn btn-main" disabled={envoi}>{envoi ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}

// Logo réduit à 512 px dans le navigateur avant l'envoi.
function reduireImage(fichier, taille = 512) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Image illisible."));
    lecteur.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Image illisible."));
      image.onload = () => {
        const echelle = Math.min(1, taille / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * echelle));
        canvas.height = Math.max(1, Math.round(image.height * echelle));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = String(lecteur.result || "");
    };
    lecteur.readAsDataURL(fichier);
  });
}

function EtapeLogo({ business, enregistrer }) {
  const [logo, setLogo] = useState(business.logoDataUrl || "");
  const [etat, setEtat] = useState({ status: "idle", error: "" });
  async function choisir(event) {
    const fichier = event.target.files?.[0];
    if (!fichier) return;
    if (!fichier.type.startsWith("image/")) { setEtat({ status: "idle", error: "Choisissez une image (PNG, JPG)." }); return; }
    try {
      setLogo(await reduireImage(fichier));
      setEtat({ status: "idle", error: "" });
    } catch (error) {
      setEtat({ status: "idle", error: error.message });
    }
  }
  async function valider() {
    setEtat({ status: "envoi", error: "" });
    await enregistrer({ business: { logoDataUrl: logo } });
    setEtat({ status: "idle", error: "" });
  }
  return (
    <div className="ob-body">
      <div className="ob-logo">
        <span className="ob-logo-v">{logo ? <img src={logo} alt="Aperçu du logo" /> : "Logo"}</span>
        <label className="btn btn-sec">
          {logo ? "Changer d'image" : "Choisir une image"}
          <input type="file" accept="image/*" onChange={choisir} hidden />
        </label>
      </div>
      {etat.error ? <p className="ob-err" role="alert">{etat.error}</p> : null}
      <div className="ob-act end">
        <button type="button" className="btn btn-main" disabled={!logo || etat.status === "envoi"} onClick={valider}>
          {etat.status === "envoi" ? "Enregistrement…" : "Enregistrer le logo"}
        </button>
      </div>
    </div>
  );
}

function EtapeIban({ business, enregistrer }) {
  const [iban, setIban] = useState(business.iban ? formaterIban(business.iban) : "");
  const [bic, setBic] = useState(business.bic || "");
  const [etat, setEtat] = useState({ status: "idle", error: "" });
  async function valider(event) {
    event.preventDefault();
    if (!ibanValide(iban)) { setEtat({ status: "idle", error: "Cet IBAN n'est pas valide : vérifiez les chiffres (la clé ne correspond pas)." }); return; }
    setEtat({ status: "envoi", error: "" });
    await enregistrer({ business: { iban: formaterIban(normaliserIban(iban)), bic: bic.trim().toUpperCase() } });
    setEtat({ status: "idle", error: "" });
  }
  return (
    <form className="ob-body" onSubmit={valider}>
      <div className="ob-grid">
        <label className="ob-f full"><span>IBAN</span><input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" autoComplete="off" required /></label>
        <label className="ob-f"><span>BIC · facultatif</span><input value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BNPAFRPP" maxLength={11} autoComplete="off" /></label>
      </div>
      <small className="ob-help">Imprimé sur vos factures pour le règlement par virement.</small>
      {etat.error ? <p className="ob-err" role="alert">{etat.error}</p> : null}
      <div className="ob-act end">
        <button type="submit" className="btn btn-main" disabled={etat.status === "envoi"}>{etat.status === "envoi" ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}

export default function DemarragePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [taux, setTaux] = useState({});
  const [ouverte, setOuverte] = useState(undefined); // undefined = l'étape en cours
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then(({ user: fetched }) => setUser(fetched))
      .catch((err) => setError(err.message || "Chargement impossible."));
    apiGet("/api/entreprise/taux").then((data) => setTaux(data?.taux || {})).catch(() => {});
  }, []);

  useEffect(() => {
    if (!info) return undefined;
    const t = setTimeout(() => setInfo(""), 3000);
    return () => clearTimeout(t);
  }, [info]);

  const steps = useMemo(() => (user ? demarrageSteps(user, { taux }) : []), [user, taux]);
  const doneCount = steps.filter((step) => step.done).length;
  const ready = steps.length > 0 && essentialsDone(steps);
  const enCours = steps.find((step) => !step.done)?.id || null;
  const idOuverte = ouverte === undefined ? enCours : ouverte;

  function suivante(apres, etapes) {
    const i = etapes.findIndex((s) => s.id === apres);
    return etapes.slice(i + 1).find((s) => !s.done)?.id || etapes.find((s) => !s.done)?.id || null;
  }

  async function enregistrer(id, body) {
    setError("");
    try {
      const { user: updated } = await apiSend("/api/auth/profile", body, "PATCH");
      try { window.localStorage.setItem("koji-user", JSON.stringify(updated)); } catch {}
      setUser(updated);
      setOuverte(suivante(id, demarrageSteps(updated, { taux })));
      setInfo("Enregistré");
      return true;
    } catch (err) {
      setError(err.message || "Enregistrement impossible.");
      return false;
    }
  }

  async function enregistrerPrix(parMetier, autres) {
    setError("");
    try {
      const data = await apiSend("/api/entreprise/taux", { taux: parMetier }, "PUT");
      setTaux(data?.taux || {});
      const heures = Number(user?.business?.hoursPerDay) || 7;
      return await enregistrer("prix", { business: { dailyRate: Math.round(autres * heures * 100) / 100, hoursPerDay: heures } });
    } catch (err) {
      setError(err.message || "Enregistrement impossible.");
      return false;
    }
  }

  function skip() {
    try { window.localStorage.setItem(DEMARRAGE_SKIP_KEY, new Date().toISOString()); } catch {}
    router.push("/");
  }

  function corps(step) {
    const business = user.business || {};
    switch (step.id) {
      case "entreprise": return <EtapeEntreprise business={business} enregistrer={(b) => enregistrer("entreprise", b)} />;
      case "metiers": return <EtapeMetiers user={user} enregistrer={(b) => enregistrer("metiers", b)} />;
      case "prix": return <EtapePrix user={user} taux={taux} enregistrerPrix={enregistrerPrix} />;
      case "decennale": return <EtapeDecennale business={business} enregistrer={(b) => enregistrer("decennale", b)} />;
      case "logo": return <EtapeLogo business={business} enregistrer={(b) => enregistrer("logo", b)} />;
      case "iban": return <EtapeIban business={business} enregistrer={(b) => enregistrer("iban", b)} />;
      default: return null;
    }
  }

  return (
    <Shell variant="pro">
      <div className="ob">
        <div className="ob-h">
          <span className="eyebrow">Bienvenue sur Koji · 10 minutes</span>
          <h1>Prêt à envoyer votre premier devis</h1>
          <div className="ob-p">
            <div className="pf-bar"><i style={{ width: `${Math.round((doneCount / 6) * 100)}%` }} /></div>
            <span>{user ? `${doneCount} étape${doneCount > 1 ? "s" : ""} sur 6` : "…"}</span>
            {ready ? <Link href="/devis?new=1&mode=ia" className="btn btn-main ob-go">Démarrer un devis guidé</Link> : null}
          </div>
        </div>

        {error ? <p className="ob-err" role="alert">{error}</p> : null}
        {!user && !error ? <p className="empty">Chargement…</p> : null}

        {user ? (
          <div className="ob-l">
            {steps.map((step, index) => {
              const ouvert = idOuverte === step.id;
              const etat = ouvert ? "cur" : step.done ? "ok" : "todo";
              return (
                <div key={step.id} className={`ob-st ${etat}${step.done ? " fait" : ""}`}>
                  <span className="ob-n" aria-hidden="true">{step.done && !ouvert ? <IconCheck /> : index + 1}</span>
                  <div className="ob-t">
                    <button type="button" className="ob-tog" aria-expanded={ouvert} onClick={() => setOuverte(ouvert ? null : step.id)}>
                      <span className="h"><strong>{step.title}</strong><em>{step.unlocks}</em></span>
                      <small>{step.done && step.resume ? step.resume : step.detail}</small>
                    </button>
                    {ouvert ? corps(step) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <button type="button" className="link ob-skip" onClick={skip}>
          Passer et explorer Koji · vous pourrez finir plus tard depuis Profil et compte
        </button>
        {info ? <div className="kp-toast" role="status">{info}</div> : null}
      </div>
    </Shell>
  );
}
