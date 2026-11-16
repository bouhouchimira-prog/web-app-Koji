"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { Liste, Nouvelle, Suivi } from "../RapideVues";
import "../rapide.css";
import "../../../equipe/equipe.css";

// Intervention rapide (maquette PRO-17.1) : /interventions/rapide (liste et
// prix), /interventions/rapide/nouvelle, /interventions/rapide/{id} (suivi).
export default function InterventionRapidePage() {
  const params = useParams();
  const vue = Array.isArray(params?.id) ? params.id[0] : "";
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { setErreur(""); setMessage(""); }, [vue]);
  return (
    <Shell variant="pro">
      <div className="ir">
        {erreur ? <p className="err" role="alert">{erreur} <button type="button" className="link" onClick={() => setErreur("")}>Fermer</button></p> : null}
        {message ? <p className="eq-ok-msg" role="status">{message}</p> : null}
        {!vue ? <Liste setErreur={setErreur} /> : vue === "nouvelle" ? <Nouvelle setErreur={setErreur} /> : <Suivi id={vue} setErreur={setErreur} setMessage={setMessage} />}
      </div>
    </Shell>
  );
}
