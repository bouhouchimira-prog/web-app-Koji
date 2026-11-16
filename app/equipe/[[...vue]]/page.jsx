"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet } from "../../../lib/client-api";
import { Ajouter, Aujourdhui, EnTete, Fiche, Heures } from "../EquipeVues";
import "../equipe.css";

// Équipe (maquettes PRO-16 à 16.3) : /equipe (aujourd'hui), /equipe/heures,
// /equipe/nouveau (ajouter un compagnon), /equipe/{id} (fiche).
export default function EquipePage() {
  const params = useParams();
  const vue = Array.isArray(params?.vue) ? params.vue[0] : "";
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [semaine, setSemaine] = useState("");
  const charger = () => apiGet("/api/equipe").then(setD).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);
  useEffect(() => { setErreur(""); setMessage(""); }, [vue]);

  const fiche = vue && !["heures", "nouveau"].includes(vue);
  const bandeaux = (
    <>
      {erreur ? <p className="err" role="alert">{erreur} <button type="button" className="link" onClick={() => setErreur("")}>Fermer</button></p> : null}
      {message ? <p className="eq-ok-msg" role="status">{message}</p> : null}
    </>
  );
  return (
    <Shell variant="pro">
      <div className="eq">
        {fiche ? (
          <>
            <Link className="link" href="/equipe" style={{ alignSelf: "flex-start" }}>‹ Équipe</Link>
            {bandeaux}
            <Fiche id={vue} setErreur={setErreur} setMessage={setMessage} />
          </>
        ) : vue === "heures" ? (
          <>
            {bandeaux}
            <Heures semaine={semaine} setSemaine={setSemaine} setErreur={setErreur} setMessage={setMessage} onChange={charger} aValider={d?.kpis?.aValider} />
          </>
        ) : (
          <>
            <EnTete
              eyebrow={d ? `${d.equipe.length} compagnon${d.equipe.length > 1 ? "s" : ""}` : "Équipe"}
              titre="Équipe"
              onglet="aujourdhui"
              aValider={d?.kpis?.aValider && d?.equipe?.length > 0}
              actions={<Link className="btn btn-sec" href="/equipe/nouveau">Ajouter un compagnon</Link>}
            />
            {bandeaux}
            {d ? <Aujourdhui d={d} recharger={charger} setErreur={setErreur} /> : erreur ? null : <p className="muted">Chargement…</p>}
            {vue === "nouveau" && d ? <Ajouter roles={d.roles} setErreur={setErreur} onFait={charger} /> : null}
          </>
        )}
      </div>
    </Shell>
  );
}
