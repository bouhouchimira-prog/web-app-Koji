"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend, fetchWithAuthRetry } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";

function readLocalUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("koji-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function withProtocol(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const DEFAULT_CARD_OPTIONS = { showLogo: true, showQr: true, showPhone: true, showEmail: true, showAddress: true, showSpecialty: true };

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <button type="button" className={checked ? "kj-tg on" : "kj-tg"} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>{label}{hint ? <small>{hint}</small> : null}</span>
      <i><b /></i>
    </button>
  );
}

function CircleIconRow({ icon, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#16233F", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#16233F" }}>{value}</span>
    </div>
  );
}

export default function CarteVisitePage() {
  const { L } = useLocale();
  const [business, setBusiness] = useState(null);
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [qrPreview, setQrPreview] = useState("");
  const [cardOptions, setCardOptions] = useState(DEFAULT_CARD_OPTIONS);
  const [optionsSaving, setOptionsSaving] = useState(false);

  useEffect(() => {
    const localUser = readLocalUser();
    const query = localUser?.id ? `/api/auth/profile?userId=${localUser.id}` : "/api/auth/profile";
    apiGet(query)
      .then((payload) => {
        const fetchedUser = payload.user || localUser || {};
        setBusiness(fetchedUser.business || {});
        setProfessions(Array.isArray(fetchedUser.professions) ? fetchedUser.professions : []);
        setCardOptions({ ...DEFAULT_CARD_OPTIONS, ...(fetchedUser.business?.cardOptions || {}) });
      })
      .catch(() => {
        setBusiness({});
        setProfessions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const website = business?.website || "";
  const customQr = business?.qrCodeDataUrl || "";

  useEffect(() => {
    if (customQr) { setQrPreview(customQr); return; }
    if (!website) { setQrPreview(""); return; }
    let alive = true;
    QRCode.toDataURL(withProtocol(website), { margin: 0, color: { dark: "#0d1b33", light: "#ffffff" } })
      .then((dataUrl) => { if (alive) setQrPreview(dataUrl); })
      .catch(() => { if (alive) setQrPreview(""); });
    return () => { alive = false; };
  }, [website, customQr]);

  const address = useMemo(() => {
    if (!business) return "";
    return [business.addressLine1, [business.postalCode, business.city].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(", ");
  }, [business]);

  const specialty = professions.filter(Boolean).join(" · ");

  async function toggleOption(key, value) {
    const next = { ...cardOptions, [key]: value };
    setCardOptions(next);
    setOptionsSaving(true);
    try {
      await apiSend("/api/auth/profile", { business: { cardOptions: next } }, "PATCH");
    } catch {
      setCardOptions(cardOptions);
    } finally {
      setOptionsSaving(false);
    }
  }

  async function openBusinessCard(mode) {
    setCardLoading(true);
    setCardMessage("");
    try {
      const path = mode === "preview" ? "/api/business-card?preview=1" : "/api/business-card";
      const response = await fetchWithAuthRetry(() => fetch(path, { cache: "no-store" }));
      if (response.status === 402) {
        setCardMessage(L.parametres.businessCardUpsell);
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la génération.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        window.open(url, "_blank");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "Carte_visite.pdf";
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      setCardMessage(error.message || "Erreur lors de la génération.");
    } finally {
      setCardLoading(false);
    }
  }

  if (loading || !business) {
    return (
      <Shell variant="pro">
        <section className="card"><p className="empty">{L.common.loading}</p></section>
      </Shell>
    );
  }

  const cardW = 320;
  const cardH = Math.round(cardW * (55 / 85));
  const showLogo = cardOptions.showLogo && Boolean(business.logoDataUrl);
  const showQr = cardOptions.showQr && Boolean(qrPreview);
  const showPhone = cardOptions.showPhone && Boolean(business.phone);
  const showEmail = cardOptions.showEmail && Boolean(business.emailPro);
  const showAddress = cardOptions.showAddress && Boolean(address);
  const showSpecialty = cardOptions.showSpecialty && Boolean(specialty);

  const iconStroke = { fill: "none", stroke: "#E6B94F", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">KojiPage · carte de visite</span>
          <h1>{L.parametres.businessCard}</h1>
          <span className="muted">{L.parametres.businessCardSub}</span>
        </div>
        <div className="hact">
          <Link href="/profil" className="btn btn-sec">Modifier mon profil</Link>
          <button type="button" className="btn btn-sec" onClick={() => openBusinessCard("preview")} disabled={cardLoading}>Aperçu</button>
          <button type="button" className="btn btn-main" onClick={() => openBusinessCard("download")} disabled={cardLoading}>
            {cardLoading ? L.parametres.saving : L.parametres.downloadBusinessCard}
          </button>
        </div>
      </div>

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="KojiPage">
          <a role="tab" aria-selected="false" href="/profil/site-web">Profil</a>
          <a className="on" role="tab" aria-selected="true" href="/profil/carte-de-visite">Carte de visite</a>
        </div>
      </div>

      {cardMessage ? <p className="notice notice-err" role="alert">{cardMessage}</p> : null}

      <div className="kj-grid">
        <div className="kj-col">
          <section className="card">
            <div className="card-h"><h2>Informations affichées</h2><span className="sm2">{optionsSaving ? "Enregistrement…" : "Activez ou masquez ce qui apparaît sur la carte"}</span></div>
            <ToggleRow label="Logo de l'entreprise" hint="Celui de votre profil" checked={cardOptions.showLogo} onChange={(v) => toggleOption("showLogo", v)} />
            <ToggleRow label="QR code du site web" hint="Sans site, le lien s'ajoute après l'adresse" checked={cardOptions.showQr} onChange={(v) => toggleOption("showQr", v)} />
            <ToggleRow label="Téléphone" checked={cardOptions.showPhone} onChange={(v) => toggleOption("showPhone", v)} />
            <ToggleRow label="E-mail professionnel" checked={cardOptions.showEmail} onChange={(v) => toggleOption("showEmail", v)} />
            <ToggleRow label="Adresse" checked={cardOptions.showAddress} onChange={(v) => toggleOption("showAddress", v)} />
            <ToggleRow label="Spécialité" hint={specialty ? `« ${specialty} »` : ""} checked={cardOptions.showSpecialty} onChange={(v) => toggleOption("showSpecialty", v)} />
          </section>

          <section className="card">
            <div className="card-h"><h2>Format d'impression</h2></div>
            <div className="kv"><span>Format</span><b>85 × 55 mm, taille réelle</b></div>
            <div className="kv"><span>Fichier</span><b>PDF recto-verso</b></div>
            <div className="kv"><span>Autres formats</span><b className="muted">Bientôt disponibles</b></div>
            <div className="ed-act" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-sec" onClick={() => openBusinessCard("preview")} disabled={cardLoading}>Imprimer</button>
              <button type="button" className="btn btn-main" onClick={() => openBusinessCard("download")} disabled={cardLoading}>{L.parametres.downloadBusinessCard}</button>
            </div>
          </section>
        </div>

        <aside className="kj-prev">
          <div className="kj-ph-h"><span className="lab">Aperçu · 85 × 55 mm</span></div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#5B5F66", marginBottom: 8 }}>Recto</div>
              <div style={{
                position: "relative", width: cardW, height: cardH, borderRadius: 14, background: "#FBF9F5",
                overflow: "hidden", boxShadow: "0 18px 40px rgba(11,21,48,.18)"
              }}>
                <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 4, background: "linear-gradient(90deg,#E6B94F,#CB9A2E)" }} />
                <div style={{ position: "absolute", left: 18, top: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  {showLogo ? (
                    <img src={business.logoDataUrl} alt="Logo" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px dashed #CFC7B6", background: "#F3EFE6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#9A9382" }}>LOGO</div>
                  )}
                </div>
                <span style={{ position: "absolute", right: 14, top: 16, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8F6A12", padding: "4px 9px", borderRadius: 10, background: "#F6ECD3" }}>Artisan</span>
                <div style={{ position: "absolute", left: 18, top: 60 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16233F", lineHeight: 1 }}>{business.raisonSociale || "Votre entreprise"}</div>
                  {showSpecialty ? (
                    <>
                      <div style={{ marginTop: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8F6A12" }}>{specialty}</div>
                      <div style={{ marginTop: 6, width: 22, height: 2, borderRadius: 2, background: "linear-gradient(90deg,#E6B94F,#CB9A2E)" }} />
                    </>
                  ) : null}
                </div>
                <div style={{ position: "absolute", left: 18, bottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  {showPhone ? <CircleIconRow value={business.phone} icon={<svg width="10" height="10" viewBox="0 0 24 24" {...iconStroke}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>} /> : null}
                  {showEmail ? <CircleIconRow value={business.emailPro} icon={<svg width="10" height="10" viewBox="0 0 24 24" {...iconStroke}><path d="M3 6h18v12H3zM3 7l9 7 9-7" /></svg>} /> : null}
                  {showAddress ? <CircleIconRow value={address} icon={<svg width="10" height="10" viewBox="0 0 24 24" {...iconStroke}><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5" /></svg>} /> : null}
                  {!showQr && website ? <span style={{ fontSize: 10, color: "#6B7280" }}>{website}</span> : null}
                </div>
                {showQr ? (
                  <div style={{ position: "absolute", right: 14, bottom: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ padding: 4, borderRadius: 8, background: "#FFFFFF", border: "1px solid #E6E1D6" }}>
                      <img src={qrPreview} alt="QR code" width={40} height={40} />
                    </div>
                    <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8F6A12" }}>Mon site web</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#5B5F66", marginBottom: 8 }}>Verso</div>
              <div style={{
                position: "relative", width: cardW, height: cardH, borderRadius: 14, overflow: "hidden",
                background: "radial-gradient(120% 90% at 50% 0%,#1D2F57 0%,#0B1530 62%)", boxShadow: "0 18px 40px rgba(11,21,48,.3)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6
              }}>
                <img src="/koji-logo.svg" alt="koji" style={{ width: 34, height: 34, filter: "brightness(0) saturate(100%) invert(85%) sepia(28%) saturate(600%) hue-rotate(2deg)" }} />
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.4em", color: "#FFFFFF", paddingLeft: "0.4em" }}>KOJI</div>
                <div style={{ fontSize: 9, color: "#C9CEDB" }}>Devis, chantiers et factures.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
