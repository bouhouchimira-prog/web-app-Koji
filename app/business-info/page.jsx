"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

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

export default function BusinessInfoPage() {
  const { L } = useLocale();
  const router = useRouter();
  const [business, setBusiness] = useState({
    raisonSociale: "",
    formeJuridique: "",
    siret: "",
    emailPro: "",
    phone: "",
    address: "",
    tva: "",
    website: ""
  });

  function setField(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const data = await apiSend("/api/auth/profile", { userId: readUserId(), business }, "PATCH");
    window.localStorage.setItem("koji-user", JSON.stringify(data.user));
    router.push("/profession-selection");
  }

  const fields = [
    ["raisonSociale", L.setup.legalName],
    ["formeJuridique", L.setup.legalForm],
    ["siret", L.setup.siret],
    ["emailPro", L.setup.emailPro],
    ["phone", L.setup.phone],
    ["address", L.setup.address],
    ["tva", L.setup.tva],
    ["website", L.setup.website],
  ];

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">{L.setup.setupEyebrow}</p>
          <h1>{L.setup.businessTitle}</h1>
          <p className="muted">{L.setup.businessDesc}</p>
        </div>
      </header>
      <form className="panel" onSubmit={submit}>
        <div className="form-grid">
          {fields.map(([field, label]) => (
            <label className="field" key={field}>{label}<input value={business[field]} onChange={(event) => setField(field, event.target.value)} /></label>
          ))}
        </div>
        <button className="button blue" style={{ marginTop: 16 }}>{L.common.save}</button>
      </form>
    </Shell>
  );
}
