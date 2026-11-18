"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "../lib/client-api";

// Une réponse de Koji à une question (maquettes PRO-18 à 18.2) : constat,
// points, chiffres calculés par Koji, sources cliquables, actions à valider
// (rien ne part sans l'utilisateur), suggestions de suite.
function Action({ a, onFait }) {
  const router = useRouter();
  const [texte, setTexte] = useState(a.texte || "");
  const [edition, setEdition] = useState(false);
  const [etat, setEtat] = useState("");
  if (a.type === "ouvrir") {
    return (
      <div className="kr-a">
        <div><b>{a.label}</b>{a.detail ? <small>{a.detail}</small> : null}</div>
        <button type="button" className="kr-b" onClick={() => router.push(a.href)}>Ouvrir</button>
      </div>
    );
  }
  async function envoyer() {
    setEtat("envoi");
    try { await apiSend(`/api/quotes/${encodeURIComponent(a.quoteId)}/messages`, { texte }); setEtat("ok"); onFait?.(); } catch (e) { setEtat(e.message || "Envoi impossible."); }
  }
  return (
    <div className="kr-a kr-m">
      <div><b>{a.label}</b><small>{a.detail || "par message Koji, à relire"}</small></div>
      {edition ? <textarea value={texte} onChange={(e) => setTexte(e.target.value)} aria-label="Message au client" /> : <p className="kr-t">{texte}</p>}
      {etat === "ok" ? <small className="kr-ok">Envoyé.</small> : (
        <div className="kr-ab">
          <button type="button" className="kr-l" onClick={() => setEdition(!edition)}>{edition ? "Terminer" : "Modifier"}</button>
          <button type="button" className="kr-b" disabled={etat === "envoi" || !texte.trim()} onClick={envoyer}>{etat === "envoi" ? "Envoi…" : "Envoyer"}</button>
        </div>
      )}
      {etat && etat !== "ok" && etat !== "envoi" ? <small className="kr-err">{etat}</small> : null}
    </div>
  );
}

export function KojiReponse({ r, onAsk, dernier = false }) {
  const router = useRouter();
  if (!r) return null;
  return (
    <div className="kr">
      <span className="kr-mention">{r.mention || "Réponse de Koji, assistant IA · vérifiez avant de décider"}</span>
      <p className="kr-c">{r.constat}</p>
      {r.chiffres?.length ? <div className="kr-ch">{r.chiffres.map((c) => <div key={c.label}><span>{c.label}</span><b>{c.valeur}</b></div>)}</div> : null}
      {r.points?.length ? <ul className="kr-p">{r.points.map((p) => <li key={p.titre}><b>{p.titre}</b>{p.detail ? <small>{p.detail}</small> : null}</li>)}</ul> : null}
      {r.sources?.length ? <div className="kr-s"><span>Sources</span>{r.sources.map((s) => <button key={s.href} type="button" onClick={() => router.push(s.href)}>{s.label}</button>)}</div> : null}
      {r.actions?.length ? <div className="kr-as">{r.actions.map((a, i) => <Action key={`${a.label}${i}`} a={a} />)}</div> : null}
      {dernier && r.suggestions?.length ? <div className="kr-sg">{r.suggestions.map((s) => <button key={s} type="button" onClick={() => onAsk?.(s)}>{s}</button>)}</div> : null}
    </div>
  );
}
