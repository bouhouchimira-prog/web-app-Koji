"use client";

import { useLocale } from "../../lib/i18n";

export default function AidePage() {
  const { L } = useLocale();

  return (
    <main className="static-page">
      <header className="static-page-header">
        <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
        <h1>{L.settings.help}</h1>
        <span />
      </header>

      <section className="static-page-card">
        <h2>{L.aide.faqTitle}</h2>
        {L.aide.faqItems.map((item, index) => (
          <details key={index} className="static-faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <section className="static-page-card">
        <h2>{L.aide.contactTitle}</h2>
        <p>{L.aide.contactBody}</p>
        <a className="button secondary" href="mailto:contact@koji.app">contact@koji.app</a>
      </section>
    </main>
  );
}
