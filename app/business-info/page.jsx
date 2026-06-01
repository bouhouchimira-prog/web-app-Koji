"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";

export default function BusinessInfoPage() {
  const router = useRouter();
  const [business, setBusiness] = useState({
    raisonSociale: "",
    formeJuridique: "",
    siret: "",
    emailPro: "",
    phone: "",
    address: "",
    tva: ""
  });

  function setField(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }));
  }

  function readUserId() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("koji-user");
      if (!raw) return null;
      return JSON.parse(raw).id || null;
    } catch {
      return null;
    }
  }

  async function submit(event) {
    event.preventDefault();
    const data = await apiSend("/api/auth/profile", { userId: readUserId(), business }, "PATCH");
    window.localStorage.setItem("koji-user", JSON.stringify(data.user));
    router.push("/profession-selection");
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">PARAMÉTRAGE</p>
          <h1>Informations entreprise</h1>
          <p className="muted">Ces informations alimenteront les devis et documents.</p>
        </div>
      </header>
      <form className="panel" onSubmit={submit}>
        <div className="form-grid">
          {[
            ["raisonSociale", "Raison sociale"],
            ["formeJuridique", "Forme juridique"],
            ["siret", "SIRET"],
            ["emailPro", "E-mail pro"],
            ["phone", "Téléphone"],
            ["address", "Adresse"],
            ["tva", "TVA"]
          ].map(([field, label]) => (
            <label className="field" key={field}>{label}<input value={business[field]} onChange={(event) => setField(field, event.target.value)} /></label>
          ))}
        </div>
        <button className="button blue" style={{ marginTop: 16 }}>Enregistrer</button>
      </form>
    </Shell>
  );
}
