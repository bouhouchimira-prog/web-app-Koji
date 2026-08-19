"use client";

import { useLocale } from "../../lib/i18n";

export default function LegalPage() {
  const { L } = useLocale();

  return (
    <main className="static-page">
      <header className="static-page-header">
        <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
        <h1>{L.settings.legal}</h1>
        <span />
      </header>

      <div className="static-draft-banner">{L.legal.draftBanner}</div>

      {L.legal.sections.map((section, index) => (
        <section key={index} className="static-page-card">
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph, pIndex) => (
            <p key={pIndex}>{paragraph}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
