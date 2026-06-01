"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";

const professionsList = ["Electricien", "Plombier", "Carreleur", "Menuisier", "Peintre", "Tout corps d'etat"];

const initialBusiness = {
  raisonSociale: "",
  formeJuridique: "",
  siret: "",
  siren: "",
  emailPro: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  tva: "",
  dailyRate: 0,
  hoursPerDay: 7,
  logoDataUrl: ""
};

function readLocalUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("koji-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function icon(name) {
  switch (name) {
    case "building":
      return "M3 20h18M5 20V6h6v14M11 20V3h8v17M14 7h2M14 11h2M14 15h2M7 10h2M7 14h2";
    case "gavel":
      return "M3 21h8M6 18l7-7M10 7l4 4M8 9l4 4M14 3l7 7";
    case "id":
      return "M4 20V7l2-3h12l2 3v13zM8 11h8M8 15h5M8 7h3";
    case "mail":
      return "M4 6h16v12H4zM4 8l8 6 8-6";
    case "phone":
      return "M6 3l4 2-1 3 2 2 2 2 3-1 2 4-3 2c-6 0-12-6-12-12z";
    case "pin":
      return "M12 21c4-5 6-8 6-11a6 6 0 10-12 0c0 3 2 6 6 11zM12 11a2 2 0 100-4 2 2 0 000 4z";
    case "tag":
      return "M20 12l-8 8-8-8V4h8zM9 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z";
    case "money":
      return "M3 8h18M3 16h18M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z";
    case "clock":
      return "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2";
    case "camera":
      return "M4 8h4l2-2h4l2 2h4v10H4zM12 16a3 3 0 100-6 3 3 0 000 6z";
    default:
      return "";
  }
}

function Field({ label, iconName, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      <div className="profile-input">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon(iconName)} /></svg>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} />
      </div>
    </label>
  );
}

export default function ParametresPage() {
  const fileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(initialBusiness);
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const localUser = readLocalUser();
    const query = localUser?.id ? `/api/auth/profile?userId=${localUser.id}` : "/api/auth/profile";
    apiGet(query)
      .then((payload) => {
        const fetchedUser = payload.user || localUser || { accountType: "entreprise" };
        setUser(fetchedUser);
        setBusiness({ ...initialBusiness, ...(fetchedUser.business || {}) });
        setProfessions(Array.isArray(fetchedUser.professions) ? fetchedUser.professions : []);
      })
      .catch(() => {
        const fallback = localUser || { accountType: "entreprise" };
        setUser(fallback);
        setBusiness(initialBusiness);
        setProfessions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function setField(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }));
  }

  function toggleProfession(value) {
    setProfessions((current) => (
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    ));
  }

  function onLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("logoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  const hourlyCost = useMemo(() => {
    const rate = Number(business.dailyRate || 0);
    const hours = Number(business.hoursPerDay || 0);
    if (!hours) return 0;
    return rate / hours;
  }, [business.dailyRate, business.hoursPerDay]);

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const localUser = readLocalUser();
      const payload = {
        userId: user?.id || localUser?.id,
        name: user?.name || localUser?.name || "Utilisateur Koji",
        email: user?.email || localUser?.email || "",
        accountType: user?.accountType || localUser?.accountType || "entreprise",
        business: {
          ...business,
          dailyRate: Number(business.dailyRate || 0),
          hoursPerDay: Number(business.hoursPerDay || 0)
        },
        professions
      };
      const response = await apiSend("/api/auth/profile", payload, "PATCH");
      setUser(response.user);
      window.localStorage.setItem("koji-user", JSON.stringify(response.user));
      setMessage("Informations enregistrees.");
    } catch (error) {
      setMessage(error.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  const accountLabel = user?.accountType === "particulier" ? "Profil Particulier" : "Profil Entreprise";
  const logoSrc = business.logoDataUrl || "/koji-logo.svg";

  if (loading) {
    return (
      <Shell>
        <section className="panel"><div className="empty-state">Chargement du profil...</div></section>
      </Shell>
    );
  }

  return (
    <Shell>
      <form className="profile-layout" onSubmit={onSave}>
        <header className="profile-header">
          <h1>{accountLabel}</h1>
        </header>

        <section className="profile-logo">
          <div className="logo-ring">
            <img src={logoSrc} alt="Logo entreprise" />
            <button type="button" className="logo-upload" onClick={() => fileRef.current?.click()} aria-label="Changer le logo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon("camera")} /></svg>
            </button>
          </div>
          <p>Changer le logo</p>
          <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} style={{ display: "none" }} />
        </section>

        <section className="profile-block">
          <h2>Informations Entreprise</h2>
          <div className="profile-grid">
            <Field label="Raison sociale" iconName="building" value={business.raisonSociale} onChange={(event) => setField("raisonSociale", event.target.value)} placeholder="Nom entreprise" />
            <Field label="Forme juridique" iconName="gavel" value={business.formeJuridique} onChange={(event) => setField("formeJuridique", event.target.value)} placeholder="SARL, SAS..." />
            <Field label="SIRET (14 chiffres)" iconName="id" value={business.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="12345678901234" />
            <Field label="RCS / SIREN (9 chiffres)" iconName="id" value={business.siren} onChange={(event) => setField("siren", event.target.value)} placeholder="123456789" />
            <Field label="Email professionnel" iconName="mail" type="email" value={business.emailPro} onChange={(event) => setField("emailPro", event.target.value)} placeholder="pro@entreprise.fr" />
            <Field label="Telephone" iconName="phone" value={business.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="+33..." />
            <Field label="Adresse" iconName="pin" value={business.addressLine1} onChange={(event) => setField("addressLine1", event.target.value)} placeholder="Numero et rue" />
            <Field label="Ville / code postal" iconName="pin" value={business.addressLine2} onChange={(event) => setField("addressLine2", event.target.value)} placeholder="75000 Paris" />
            <Field label="Numero TVA" iconName="tag" value={business.tva} onChange={(event) => setField("tva", event.target.value)} placeholder="FR..." />
          </div>
        </section>

        <section className="profile-block">
          <h2>Tarification</h2>
          <div className="profile-grid cols-2">
            <Field label="Tarif journalier (EUR HT / jour)" iconName="money" type="number" value={String(business.dailyRate ?? 0)} onChange={(event) => setField("dailyRate", event.target.value)} />
            <Field label="Heures par jour" iconName="clock" type="number" value={String(business.hoursPerDay ?? 7)} onChange={(event) => setField("hoursPerDay", event.target.value)} />
          </div>
          <div className="hourly-box">
            <span>Cout horaire</span>
            <strong>{hourlyCost.toFixed(2)} EUR / h</strong>
          </div>
        </section>

        <section className="profile-block">
          <h2>Metiers</h2>
          <p className="muted">Selectionnez un ou plusieurs metiers.</p>
          <div className="metiers-list">
            {professionsList.map((item) => (
              <button
                type="button"
                key={item}
                className={`metier-chip ${professions.includes(item) ? "active" : ""}`}
                onClick={() => toggleProfession(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {message ? <p className="profile-message">{message}</p> : null}

        <footer className="profile-actions">
          <button className="button blue" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
        </footer>
      </form>
    </Shell>
  );
}
