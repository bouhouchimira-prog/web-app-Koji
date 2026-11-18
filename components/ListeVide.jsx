"use client";

import Link from "next/link";

// Liste vide (maquette PRO-19) : comment la liste se remplit, une action
// principale (jaune) et une alternative discrète. Jamais de fausses données.
const Bouton = ({ a, cls }) => (a.href ? <Link href={a.href} className={cls}>{a.label}</Link> : <button type="button" className={cls} onClick={a.onClick}>{a.label}</button>);

export function ListeVide({ titre, texte, action, alternative }) {
  return (
    <div className="lv" role="status">
      <h2>{titre}</h2>
      <p>{texte}</p>
      {action || alternative ? (
        <div className="lv-a">
          {action ? <Bouton a={action} cls="btn btn-main" /> : null}
          {alternative ? <Bouton a={alternative} cls="btn btn-sec" /> : null}
        </div>
      ) : null}
    </div>
  );
}
