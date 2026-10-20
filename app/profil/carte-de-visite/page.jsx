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
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: "1px solid #F3F3F8" }}>
      <div style={{ flex: "1 1 auto" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1E2430" }}>{label}</div>
        {hint ? <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{ flex: "0 0 auto", width: 42, height: 24, borderRadius: 12, background: checked ? "#16233F" : "#CBD0DC", position: "relative", border: "none", cursor: "pointer" }}
      >
        <i style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left 0.15s" }} />
      </button>
    </div>
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
      <Shell>
        <section className="panel"><div className="empty-state">{L.common.loading}</div></section>
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
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/profil"
            aria-label="Retour"
            style={{
              width: 44, height: 44, borderRadius: 12, border: "1px solid #EDEFF3", background: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", color: "inherit"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "#9C9FB0", fontWeight: 600 }}>Profil <span style={{ margin: "0 4px" }}>›</span> Carte de visite</div>
            <h1 style={{ margin: "2px 0 0 0", fontSize: 24, fontWeight: 800, color: "#16233F", letterSpacing: "-0.01em" }}>{L.parametres.businessCard}</h1>
            <p style={{ margin: "3px 0 0 0", fontSize: 14, color: "#6B7280" }}>{L.parametres.businessCardSub}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/profil" className="button secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16zM14 6l3 3M12 20h8" /></svg>
              Modifier mon profil
            </Link>
            <button type="button" className="button secondary" onClick={() => openBusinessCard("preview")} disabled={cardLoading} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /></svg>
              Aperçu
            </button>
            <button type="button" className="button blue" onClick={() => openBusinessCard("download")} disabled={cardLoading} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
              {cardLoading ? L.parametres.saving : L.parametres.downloadBusinessCard}
            </button>
          </div>
        </div>

        {cardMessage ? <p className="profile-message">{cardMessage}</p> : null}

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 26 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#16233F" }}>Recto</span>
                <span style={{ fontSize: 12.5, color: "#6B7280" }}>Logo de l'entreprise et QR code du site</span>
              </div>
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
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#16233F" }}>Verso</span>
                <span style={{ fontSize: 12.5, color: "#6B7280" }}>Logo koji — identique pour tous les artisans</span>
              </div>
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

          <div style={{ flex: "1 1 320px", minWidth: 300, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#FFFCF4", border: "1px solid #F1E2B8", borderRadius: 18, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E8E5A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#16233F" }}>Prête pour l'imprimeur</div>
              </div>
              <div style={{ fontSize: 13.5, color: "#6B5A2A", lineHeight: 1.5 }}>Téléchargez le PDF et envoyez-le à votre imprimeur, ou ouvrez-le pour l'imprimer directement.</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="button blue" onClick={() => openBusinessCard("download")} disabled={cardLoading}>{L.parametres.downloadBusinessCard}</button>
                <button type="button" className="button secondary" onClick={() => openBusinessCard("preview")} disabled={cardLoading}>Imprimer</button>
              </div>
            </div>

            <div className="profile-block">
              <h2>Informations affichées</h2>
              <p className="muted" style={{ marginTop: -4, marginBottom: 2 }}>Activez ou masquez ce qui apparaît sur votre carte.{optionsSaving ? " Enregistrement…" : ""}</p>
              <ToggleRow label="Logo de l'entreprise" hint="Celui de votre profil" checked={cardOptions.showLogo} onChange={(v) => toggleOption("showLogo", v)} />
              <ToggleRow label="QR code du site web" hint="Sans site, le lien s'ajoute après l'adresse" checked={cardOptions.showQr} onChange={(v) => toggleOption("showQr", v)} />
              <ToggleRow label="Téléphone" checked={cardOptions.showPhone} onChange={(v) => toggleOption("showPhone", v)} />
              <ToggleRow label="E-mail professionnel" checked={cardOptions.showEmail} onChange={(v) => toggleOption("showEmail", v)} />
              <ToggleRow label="Adresse" checked={cardOptions.showAddress} onChange={(v) => toggleOption("showAddress", v)} />
              <ToggleRow label="Spécialité" hint={specialty ? `« ${specialty} »` : ""} checked={cardOptions.showSpecialty} onChange={(v) => toggleOption("showSpecialty", v)} />
            </div>

            <div className="profile-block">
              <h2>Format d'impression</h2>
              <div style={{ display: "flex", gap: 8, margin: "8px 0 14px" }}>
                <span style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 11, background: "#16233F", color: "#FFFFFF", border: "1px solid #16233F" }}>85 × 55 mm</span>
                <span title="Bientôt disponible" style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 11, background: "#F6F7FB", color: "#B5B9C6", border: "1px solid #E5E5EC", cursor: "not-allowed" }}>90 × 50 mm</span>
                <span title="Bientôt disponible" style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 11, background: "#F6F7FB", color: "#B5B9C6", border: "1px solid #E5E5EC", cursor: "not-allowed" }}>Format US</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F3F8", fontSize: 13.5 }}>
                <span style={{ color: "#6B7280" }}>Format</span>
                <span style={{ fontWeight: 700, color: "#1E2430" }}>85 × 55 mm, taille réelle</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 13.5 }}>
                <span style={{ color: "#6B7280" }}>Fichier</span>
                <span style={{ fontWeight: 700, color: "#1E2430" }}>PDF recto-verso</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
