"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../lib/client-api";
import "./recherche-menu.css";

// Recherche simple du menu (maquettes PRO-18 et 18.1) : résultats immédiats
// groupés ; Entrée ouvre le premier ; dernière ligne « Demander à Koji »
// (Tab) qui passe la question à l'assistant.
const GROUPES = [
  ["chantiers", "Chantiers"], ["contacts", "Contacts"], ["devis", "Devis"], ["factures", "Factures"],
  ["equipe", "Équipe"], ["fournitures", "Fournitures"], ["fournisseurs", "Fournisseurs"], ["tools", "Pages"]
];

export function RechercheMenu({ onAsk }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [r, setR] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setR(null); return undefined; }
    const id = setTimeout(() => apiGet(`/api/search?q=${encodeURIComponent(t)}`).then(setR).catch(() => setR(null)), 180);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const fermer = (e) => { if (!boite.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);
  const groupes = r ? GROUPES.map(([k, l]) => [l, (r[k] || []).slice(0, 4)]).filter(([, items]) => items.length) : [];
  const premier = groupes[0]?.[1][0];
  const aller = (href) => { setOuvert(false); setQ(""); router.push(href); };
  const demander = () => { const t = q.trim(); if (!t) return; setOuvert(false); setQ(""); onAsk?.(t); };
  return (
    <div className="rm" ref={boite}>
      <label className="rm-f">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5" /></svg>
        <input
          type="search"
          placeholder="Rechercher"
          aria-label="Rechercher un chantier, un client, un devis, une facture"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOuvert(true); }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOuvert(false); e.currentTarget.blur(); }
            if (e.key === "Enter" && premier) { e.preventDefault(); aller(premier.href); }
            if (e.key === "Tab" && q.trim().length >= 2) { e.preventDefault(); demander(); }
          }}
        />
      </label>
      {ouvert && q.trim().length >= 2 ? (
        <div className="rm-d" role="listbox">
          {r && !groupes.length ? <p className="rm-v">Aucun résultat.</p> : null}
          {groupes.map(([l, items]) => (
            <div key={l} className="rm-g">
              <span className="rm-l">{l}</span>
              {items.map((x) => (
                <button key={`${l}${x.id || x.href}${x.title}`} type="button" className="rm-i" role="option" aria-selected={x === premier} onClick={() => aller(x.href)}>
                  <b>{x.title}</b>{x.sub ? <small>{x.sub}</small> : null}
                </button>
              ))}
            </div>
          ))}
          <button type="button" className="rm-i rm-k" onClick={demander}>
            <span className="rm-s"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg></span>
            <b>Demander à Koji : « {q.trim()} »</b><kbd>Tab</kbd>
          </button>
        </div>
      ) : null}
    </div>
  );
}
