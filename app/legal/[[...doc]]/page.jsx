"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "../../home-pro.css";
import "../legal.css";
import { useLocale } from "../../../lib/i18n";
import { ChoixCookies } from "../../../components/BandeauCookies";
import { DOCUMENTS } from "../documents";

// Pages légales (maquette PRO-20) : sommaire à gauche, une page par
// document, date de mise à jour en tête. Les textes déjà rédigés sont
// repris tels quels ; un bloc gris attend chaque texte manquant, à rédiger
// et valider par l'avocat (aucune clause rédigée par Koji).
// Sections de L.legal.sections : 0 mentions, 1 CGU, 2 confidentialité,
// 3 CGV abonnement, 4 cookies.

export default function LegalPage() {
  const { L } = useLocale();
  const params = useParams();
  const slug = Array.isArray(params?.doc) ? params.doc[0] : "";
  const doc = DOCUMENTS.find((d) => d.slug === slug) || DOCUMENTS[0];
  const sections = (L.legal?.sections || []);
  // Téléphone : le document ouvert reste visible dans le sommaire.
  useEffect(() => { document.querySelector(".lg-nav a.on")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [slug]);
  return (
    <div className="pro public-pro wide lg">
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>← Retour</button>
          <span className="eyebrow">Informations légales</span>
        </div>
      </div>
      <div className="lg-g">
        <nav className="lg-nav" aria-label="Documents légaux">
          {DOCUMENTS.map((d) => <Link key={d.slug} href={`/legal/${d.slug}`} className={d.slug === doc.slug ? "on" : ""} aria-current={d.slug === doc.slug ? "page" : undefined}>{d.titre}</Link>)}
        </nav>
        <article className="lg-doc">
          <span className="eyebrow">Mise à jour : à dater à la publication</span>
          <h1>{doc.titre}</h1>
          {doc.sections.map((i) => sections[i] ? (
            <section key={i} className="lg-s">
              <h2>{sections[i].title}</h2>
              {sections[i].paragraphs.map((p, k) => <p key={k}>{p}</p>)}
            </section>
          ) : null)}
          {doc.attendus.map(([titre, texte]) => (
            <section key={titre} className="lg-s">
              <h2>{titre}</h2>
              <p className="lg-gris">{texte}</p>
            </section>
          ))}
          {doc.choix ? <section className="lg-s"><h2>Vos choix</h2><ChoixCookies /></section> : null}
          <p className="lg-note">Gabarit Koji : la mise en page et les rubriques sont prêtes ; chaque texte est à faire valider par l'avocat avant publication.</p>
        </article>
      </div>
    </div>
  );
}
