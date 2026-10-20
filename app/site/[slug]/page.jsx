"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

// Toutes les tailles de cette page (texte, cartes, boutons) sont celles de
// la maquette artifact "ProfilSiteApercu" multipliees par 0.65 (-35%,
// demande explicite d'Amira le 21 oct — le gabarit 1440px de la maquette
// restait identique, seules les proportions etaient jugees trop grandes a
// l'echelle reelle d'un navigateur). Le gouttiere laterale de page (64px) et
// le conteneur max-width:1440 restent inchanges, ce sont des reperes de mise
// en page, pas du texte/des cartes.
const FONT_INTER = "'Inter',system-ui,sans-serif";
const FONT_SERIF = "'Playfair Display',Georgia,serif";
const GOLD = "#E6B94F";
const GOLD_DARK = "#CB9A2E";
const NAVY = "#0B1530";
const WRAP = { maxWidth: 1440, margin: "0 auto", padding: "0 64px", boxSizing: "border-box" };

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KJ";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Kicker({ children }) {
  if (!children) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_INTER }}>
      <span style={{ width: 27, height: 2, background: GOLD }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD }}>{children}</span>
    </div>
  );
}

function GoldButton({ href, onClick, children, type }) {
  const style = {
    height: 47, padding: "0 26px", borderRadius: 23, display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 12.5, fontWeight: 700, background: `linear-gradient(180deg,${GOLD},${GOLD_DARK})`, color: NAVY, border: "none",
    boxShadow: "0 8px 18px rgba(203,154,46,.30)", fontFamily: FONT_INTER, textDecoration: "none", cursor: "pointer"
  };
  if (type === "submit") return <button type="submit" style={{ ...style, width: "100%", height: 44, borderRadius: 22 }}>{children}</button>;
  return <a href={href} onClick={onClick} style={style}>{children}</a>;
}

function OutlineButton({ href, children }) {
  return (
    <a href={href} style={{
      height: 47, padding: "0 26px", borderRadius: 23, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 12.5, fontWeight: 700, background: "rgba(255,255,255,.06)", color: "#FFFFFF", border: "1.5px solid rgba(255,255,255,.4)",
      fontFamily: FONT_INTER, textDecoration: "none"
    }}>{children}</a>
  );
}

function ContactIconRow({ icon, label, value, href }) {
  if (!value) return null;
  const Tag = href ? "a" : "div";
  return (
    <Tag href={href} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
      <span style={{ width: 35, height: 35, borderRadius: 10, background: "rgba(143,106,18,.12)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8575" }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, marginTop: 2 }}>{value}</div>
      </div>
    </Tag>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6657", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const fieldStyle = {
  width: "100%", boxSizing: "border-box", height: 39, borderRadius: 10, background: "#FFFFFF", border: "1px solid #E2DACA",
  padding: "0 14px", fontSize: 11, color: "#1E2430", fontFamily: FONT_INTER
};

function realisationCover(photos) {
  const shown = photos.slice(0, 4);
  const style = { position: "relative", width: "100%", height: 163, overflow: "hidden" };
  if (shown.length <= 1) {
    return <div style={style}><img src={shown[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, height: 163 }}>
      {shown.map((photo, index) => (
        <img key={index} src={photo} alt="" style={{ width: "100%", height: shown.length <= 2 ? 163 : 80, objectFit: "cover" }} />
      ))}
    </div>
  );
}

const EMPTY_FORM = { name: "", phone: "", email: "", city: "", prestation: "", message: "" };

export default function PublicCompanySite() {
  const { slug } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formStatus, setFormStatus] = useState("idle");
  const [formError, setFormError] = useState("");

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

  const realisations = useMemo(() => (site?.realisations || []).filter((item) => item.photos?.length), [site]);
  const hasCompanyInfo = Boolean(site?.zoneIntervention || site?.horaires || site?.specialties?.length || site?.companyDescription);
  const hasContactCard = Boolean(site?.contactName || site?.contactPhotoDataUrl || site?.contactMessage);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLead(event) {
    event.preventDefault();
    setFormError("");
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      setFormError("Indiquez votre nom et un moyen de vous recontacter (téléphone ou e-mail).");
      return;
    }
    setFormStatus("sending");
    try {
      const response = await fetch(`/api/site/${slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Erreur lors de l'envoi.");
      setFormStatus("sent");
    } catch (err) {
      setFormStatus("idle");
      setFormError(err.message || "Erreur lors de l'envoi.");
    }
  }

  if (loading) {
    return <main style={{ minHeight: "100dvh", background: "#000B28" }} />;
  }

  if (error || !site) {
    return (
      <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: 24, background: "#000B28", color: "#FFFFFF", fontFamily: FONT_INTER }}>
        <img src="/koji-logo.svg" alt="Koji" style={{ width: 40, opacity: 0.85 }} />
        <h1 style={{ margin: 0 }}>Page introuvable</h1>
        <p style={{ margin: 0, color: "#B9C4E2" }}>{error || "Ce site n'existe pas ou n'est plus publié."}</p>
      </main>
    );
  }

  const specialties = site.specialties?.length ? site.specialties : (site.professions || []);
  const kickerLine = [specialties.join(" · "), site.zoneIntervention].filter(Boolean).join(" · ");
  const navSub = specialties.slice(0, 2).join(" · ") || "";
  const logoBox = (size, radius, fontSize) => site.logoDataUrl ? (
    <img src={site.logoDataUrl} alt={site.name} style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", background: "#FFFFFF", boxShadow: `0 0 0 2px ${GOLD}` }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: radius, background: "#FFFFFF", boxShadow: `0 0 0 2px ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 800, color: "#16233F", fontFamily: FONT_INTER, flex: "0 0 auto" }}>
      {initials(site.name)}
    </div>
  );

  return (
    <main style={{ position: "relative", boxSizing: "border-box", background: "linear-gradient(180deg,#000B28 0%,#000820 100%)", color: "#FFFFFF", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", overflowX: "hidden" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap" />

      {!site.published ? (
        <div style={{ background: GOLD_DARK, color: NAVY, textAlign: "center", fontWeight: 700, fontSize: 11, padding: "6px 16px" }}>
          Aperçu — ce site n'est pas encore publié, seule vous pouvez le voir.
        </div>
      ) : null}

      {/* Nav */}
      <div style={{ background: "#00081F", borderBottom: "1px solid rgba(255,255,255,.13)" }}>
        <div style={{ ...WRAP, display: "flex", alignItems: "center", justifyContent: "space-between", height: 68, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logoBox(42, 12, 14)}
            <div style={{ fontFamily: FONT_INTER, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{site.name || "Entreprise"}</div>
              {navSub ? <div style={{ fontSize: 10, color: "#B9C4E2", marginTop: 1 }}>{navSub}</div> : null}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 25, flexWrap: "wrap" }}>
            <a href="#presentation" style={{ fontSize: 11, fontWeight: 600, color: "#E8EDFA", fontFamily: FONT_INTER, textDecoration: "none" }}>Présentation</a>
            {realisations.length ? <a href="#realisations" style={{ fontSize: 11, fontWeight: 600, color: "#E8EDFA", fontFamily: FONT_INTER, textDecoration: "none" }}>Réalisations</a> : null}
            {hasCompanyInfo ? <a href="#entreprise" style={{ fontSize: 11, fontWeight: 600, color: "#E8EDFA", fontFamily: FONT_INTER, textDecoration: "none" }}>L'entreprise</a> : null}
            <a href="#contact" style={{ fontSize: 11, fontWeight: 600, color: "#E8EDFA", fontFamily: FONT_INTER, textDecoration: "none" }}>Contact</a>
            <a href="#contact" style={{ height: 38, padding: "0 20px", borderRadius: 20, background: `linear-gradient(180deg,${GOLD},${GOLD_DARK})`, color: NAVY, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", boxShadow: "0 7px 17px rgba(203,154,46,.35)", fontFamily: FONT_INTER, textDecoration: "none" }}>Obtenir un devis</a>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ ...WRAP, padding: "55px 64px 0", display: "flex", gap: 39, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }} id="presentation">
        <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 572 }}>
          <Kicker>{kickerLine}</Kicker>
          <h1 style={{ fontFamily: FONT_SERIF, margin: "14px 0 0 0", fontSize: "clamp(21px,2.8vw,40px)", lineHeight: 1.1, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
            {site.title || site.name || "Devis et travaux soignés."}
          </h1>
          {site.tagline ? (
            <div style={{ fontFamily: FONT_SERIF, marginTop: 12, fontSize: "clamp(13px,1.6vw,22px)", fontStyle: "italic", fontWeight: 600, color: GOLD }}>{site.tagline}</div>
          ) : null}
          {site.presentationText ? (
            <p style={{ fontFamily: FONT_INTER, margin: "17px 0 0 0", fontSize: 12.5, lineHeight: 1.7, color: "#B9C4E2", maxWidth: 514, whiteSpace: "pre-wrap" }}>{site.presentationText}</p>
          ) : null}
        </div>

        {hasContactCard ? (
          <div style={{ marginTop: 4 }}>
            <div style={{ width: 312, maxWidth: "100%", borderRadius: 20, background: "#F7F3EA", border: "1px solid rgba(11,21,48,.08)", padding: 20, display: "flex", gap: 17, alignItems: "flex-start", boxShadow: "0 16px 40px rgba(4,10,30,.35)" }}>
              {site.contactPhotoDataUrl ? (
                <img src={site.contactPhotoDataUrl} alt={site.contactName} style={{ flex: "0 0 81px", width: 81, height: 100, borderRadius: 17, objectFit: "cover", boxShadow: `0 0 0 2px ${GOLD}` }} />
              ) : (
                <div style={{ flex: "0 0 81px", width: 81, height: 100, borderRadius: 17, background: "linear-gradient(160deg,#C9D3EE,#8FA2D3)", boxShadow: `0 0 0 2px ${GOLD}` }} />
              )}
              <div style={{ fontFamily: FONT_INTER }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8F6A12", lineHeight: 1.5 }}>Votre contact chantier</div>
                {site.contactName ? <div style={{ fontFamily: FONT_SERIF, fontSize: 18, fontWeight: 700, color: NAVY, margin: "4px 0 6px" }}>{site.contactName}</div> : null}
                {site.contactMessage ? <div style={{ fontSize: 10, lineHeight: 1.55, color: "#4B5263" }}>{site.contactMessage}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ ...WRAP, display: "flex", gap: 13, marginTop: 36, flexWrap: "wrap" }}>
        {site.phone ? <GoldButton href={`tel:${site.phone}`}>Appeler</GoldButton> : null}
        <GoldButton href="#contact">{site.ctaPrimary}</GoldButton>
        {realisations.length ? <OutlineButton href="#realisations">{site.ctaSecondary}</OutlineButton> : null}
      </div>

      <div style={{ height: 58 }} />

      {/* Réalisations */}
      {realisations.length ? (
        <div style={{ borderTop: "1px solid rgba(255,255,255,.13)" }} id="realisations">
          <div style={{ ...WRAP, padding: "58px 64px 0" }}>
            <Kicker>Réalisations</Kicker>
            <h2 style={{ fontFamily: FONT_SERIF, margin: "14px 0 0 0", fontSize: "clamp(18px,2.3vw,33px)", fontWeight: 700, color: "#FFFFFF" }}>Nos chantiers, en images.</h2>
            <p style={{ fontFamily: FONT_INTER, margin: "10px 0 0 0", fontSize: 12.5, lineHeight: 1.6, color: "#B9C4E2", maxWidth: 494 }}>
              Un aperçu de projets menés à bien : chaque réalisation reflète notre exigence et notre savoir-faire.
            </p>
            <div style={{ display: "flex", gap: 17, marginTop: 31, flexWrap: "wrap" }}>
              {realisations.map((item, index) => (
                <div key={index} style={{ flex: "1 1 220px", minWidth: 220, borderRadius: 18, background: "#08173C", border: "1px solid rgba(255,255,255,.13)", overflow: "hidden", boxShadow: "0 12px 29px rgba(4,10,30,.28)" }}>
                  {realisationCover(item.photos)}
                  <div style={{ padding: "16px 18px 18px", fontFamily: FONT_INTER }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{item.name || "Chantier"}</div>
                    <div style={{ fontSize: 9, color: "#B9C4E2", marginTop: 3 }}>{item.photos.length} photo{item.photos.length > 1 ? "s" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 58 }} />
          </div>
        </div>
      ) : null}

      {/* L'entreprise */}
      {hasCompanyInfo ? (
        <div style={{ borderTop: "1px solid rgba(255,255,255,.13)" }} id="entreprise">
          <div style={{ ...WRAP, padding: "58px 64px 0", display: "flex", gap: 52, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <Kicker>L'entreprise</Kicker>
              <h2 style={{ fontFamily: FONT_SERIF, margin: "14px 0 0 0", fontSize: "clamp(18px,2.3vw,33px)", lineHeight: 1.14, fontWeight: 700, color: "#FFFFFF" }}>
                Une entreprise à votre écoute.
              </h2>
              {site.companyDescription ? (
                <p style={{ fontFamily: FONT_INTER, margin: "17px 0 0 0", fontSize: 12.5, lineHeight: 1.75, color: "#B9C4E2", maxWidth: 416, whiteSpace: "pre-wrap" }}>{site.companyDescription}</p>
              ) : null}
            </div>
            <div style={{ flex: "0 0 364px", minWidth: 240, borderRadius: 20, background: "#F7F3EA", border: "1px solid rgba(11,21,48,.08)", overflow: "hidden", fontFamily: FONT_INTER }}>
              {site.zoneIntervention ? (
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #E6DECB" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8F6A12" }}>Zone d'intervention</div>
                  <div style={{ fontSize: 12, color: NAVY, marginTop: 5, lineHeight: 1.5 }}>{site.zoneIntervention}</div>
                </div>
              ) : null}
              {site.horaires ? (
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #E6DECB" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8F6A12" }}>Horaires</div>
                  <div style={{ fontSize: 12, color: NAVY, marginTop: 5, lineHeight: 1.5 }}>{site.horaires}</div>
                </div>
              ) : null}
              {specialties.length ? (
                <div style={{ padding: "14px 20px" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8F6A12" }}>Spécialités</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                    {specialties.map((item) => (
                      <span key={item} style={{ fontSize: 10, fontWeight: 600, padding: "6px 12px", borderRadius: 13, background: "#EDE6D6", border: "1px solid #DDD3BD", color: NAVY }}>{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ height: 58, flexBasis: "100%" }} />
          </div>
        </div>
      ) : null}

      {/* Contact / devis */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.13)" }} id="contact">
        <div style={{ ...WRAP, padding: "58px 64px 65px", display: "flex", gap: 46, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 416px", minWidth: 240 }}>
            <Kicker>Demande de devis</Kicker>
            <h2 style={{ fontFamily: FONT_SERIF, margin: "14px 0 0 0", fontSize: "clamp(18px,2.3vw,33px)", fontWeight: 700, color: "#FFFFFF" }}>Décrivez-nous votre projet.</h2>
            <p style={{ fontFamily: FONT_INTER, margin: "12px 0 0 0", fontSize: 12.5, lineHeight: 1.65, color: "#B9C4E2" }}>
              Complétez le formulaire ou appelez-nous directement. Nous revenons vers vous rapidement.
            </p>
            <div style={{ marginTop: 25, borderRadius: 18, background: "#F7F3EA", border: "1px solid rgba(11,21,48,.08)", padding: 21, display: "flex", flexDirection: "column", gap: 17 }}>
              <ContactIconRow
                label="Téléphone" value={site.phone} href={site.phone ? `tel:${site.phone}` : undefined}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>}
              />
              <ContactIconRow
                label="E-mail" value={site.email} href={site.email ? `mailto:${site.email}` : undefined}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18v12H3zM3 7l9 7 9-7" /></svg>}
              />
              <ContactIconRow
                label="Zone" value={site.zoneAffichee || site.address}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5" /></svg>}
              />
            </div>
          </div>

          {site.showContactForm ? (
          <div style={{ flex: "1 1 0", minWidth: 240, borderRadius: 21, background: "#F7F3EA", border: "1px solid rgba(11,21,48,.08)", padding: 25, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 16px 40px rgba(4,10,30,.35)", fontFamily: FONT_INTER }}>
            {formStatus === "sent" ? (
              <div style={{ textAlign: "center", padding: "13px 7px", color: NAVY }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT_SERIF, marginBottom: 5 }}>Merci !</div>
                <p style={{ margin: 0, fontSize: 11, color: "#4B5263" }}>Votre demande a bien été envoyée. {site.name || "L'entreprise"} vous recontactera rapidement.</p>
              </div>
            ) : (
              <form onSubmit={submitLead} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {formError ? <p style={{ margin: 0, color: "#B91C1C", fontSize: 9 }}>{formError}</p> : null}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <FormField label="Nom"><input style={fieldStyle} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Votre nom" /></FormField>
                  <FormField label="Téléphone"><input style={fieldStyle} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="06 12 34 56 78" /></FormField>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <FormField label="E-mail"><input type="email" style={fieldStyle} value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="vous@email.fr" /></FormField>
                  <FormField label="Ville du chantier"><input style={fieldStyle} value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Paris, Vincennes…" /></FormField>
                </div>
                {specialties.length ? (
                  <FormField label="Type de prestation">
                    <select style={{ ...fieldStyle, fontWeight: 600 }} value={form.prestation} onChange={(e) => setField("prestation", e.target.value)}>
                      <option value="">Choisir une prestation</option>
                      {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </FormField>
                ) : null}
                <FormField label="Description du projet">
                  <textarea style={{ ...fieldStyle, height: 85, padding: "12px 14px", resize: "vertical" }} value={form.message} onChange={(e) => setField("message", e.target.value)} placeholder="Décrivez brièvement votre projet, la surface ou le type de travaux…" />
                </FormField>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 10, color: "#4B5263" }}>
                  <span style={{ width: 17, height: 17, borderRadius: 5, border: "1.5px solid #BDB4A0", background: "#FFFFFF", flex: "0 0 auto" }} />
                  J'accepte d'être recontacté(e) par {site.name || "l'entreprise"} au sujet de ma demande.
                </div>
                <GoldButton type="submit">{formStatus === "sending" ? "Envoi…" : "Envoyer ma demande de devis"}</GoldButton>
              </form>
            )}
          </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "#00081F", borderTop: "1px solid rgba(255,255,255,.13)" }}>
        <div style={{ ...WRAP, padding: "49px 64px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 39, flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 273px", fontFamily: FONT_INTER }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {logoBox(42, 12, 14)}
                <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{site.name}</div>
              </div>
              {site.tagline ? <p style={{ fontSize: 11, lineHeight: 1.7, color: "#B9C4E2", margin: "16px 0 0 0" }}>{site.tagline}</p> : null}
            </div>

            {(site.phone || site.email || site.address) ? (
              <div style={{ fontFamily: FONT_INTER }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#E8EDFA", marginBottom: 14 }}>Contact</div>
                {site.phone ? <div style={{ fontSize: 11, color: "#B9C4E2", marginBottom: 9, lineHeight: 1.5 }}><b style={{ color: "#fff" }}>Téléphone :</b> {site.phone}</div> : null}
                {site.email ? <div style={{ fontSize: 11, color: "#B9C4E2", marginBottom: 9, lineHeight: 1.5 }}><b style={{ color: "#fff" }}>E-mail :</b> {site.email}</div> : null}
                {site.address ? <div style={{ fontSize: 11, color: "#B9C4E2", marginBottom: 9, lineHeight: 1.5 }}><b style={{ color: "#fff" }}>Adresse :</b> {site.address}</div> : null}
              </div>
            ) : null}

            {(site.zoneAffichee || site.horaires) ? (
              <div style={{ fontFamily: FONT_INTER }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#E8EDFA", marginBottom: 14 }}>Informations</div>
                {site.zoneAffichee ? <div style={{ fontSize: 11, color: "#B9C4E2", marginBottom: 9, lineHeight: 1.5 }}>Zone : {site.zoneAffichee}</div> : null}
                {site.horaires ? <div style={{ fontSize: 11, color: "#B9C4E2", marginBottom: 9, lineHeight: 1.5 }}>Horaires : {site.horaires}</div> : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 39, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,.13)", fontFamily: FONT_INTER, fontSize: 10, color: "#8E9CC6", flexWrap: "wrap" }}>
            <span>© {new Date().getFullYear()} {site.name}. Tous droits réservés.</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#B9C4E2" }}>Site créé avec <b style={{ color: "#FFFFFF" }}>koji</b></span>
          </div>
        </div>
      </div>
    </main>
  );
}
