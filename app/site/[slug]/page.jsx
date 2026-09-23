"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PublicCompanySite() {
  const { slug } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/site/${slug}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Page introuvable.");
        if (alive) setSite(payload.site);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return <main className="koji-site koji-site-loading" />;
  }

  if (error || !site) {
    return (
      <main className="koji-site koji-site-notfound">
        <img src="/koji-logo-blue.svg" alt="Koji" className="koji-site-notfound-logo" />
        <h1>Page introuvable</h1>
        <p>{error || "Ce site n'existe pas ou n'est plus publié."}</p>
      </main>
    );
  }

  return (
    <main className="koji-site">
      {!site.published ? (
        <div className="koji-site-draft-banner">
          Aperçu — ce site n'est pas encore publié, seule vous pouvez le voir.
        </div>
      ) : null}
      <section className="koji-site-hero">
        {site.logoDataUrl ? <img src={site.logoDataUrl} alt={site.name} className="koji-site-logo" /> : null}
        <h1>{site.name}</h1>
        {site.tagline ? <p className="koji-site-tagline">{site.tagline}</p> : null}
      </section>

      {site.description ? (
        <section className="koji-site-section">
          <h2>À propos</h2>
          <p className="koji-site-description">{site.description}</p>
        </section>
      ) : null}

      {site.photos.length ? (
        <section className="koji-site-section">
          <h2>Réalisations</h2>
          <div className="koji-site-gallery">
            {site.photos.map((photo, index) => (
              <img key={index} src={photo} alt={`${site.name} — photo ${index + 1}`} loading="lazy" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="koji-site-section koji-site-contact">
        <h2>Contact</h2>
        <div className="koji-site-contact-grid">
          {site.phone ? <a href={`tel:${site.phone}`}>{site.phone}</a> : null}
          {site.email ? <a href={`mailto:${site.email}`}>{site.email}</a> : null}
          {site.address ? <span>{site.address}</span> : null}
        </div>
      </section>

      <footer className="koji-site-footer">
        <span>Site créé avec Koji</span>
      </footer>
    </main>
  );
}
