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
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{L.setup.setupEyebrow}</span>
          <h1>{L.setup.businessTitle}</h1>
          <span className="muted">{L.setup.businessDesc}</span>
        </div>
      </div>
      <form className="card" onSubmit={submit}>
        <div className="fgrid">
          {fields.map(([field, label]) => (
            <label key={field}>
              {label}
              <input value={business[field]} onChange={(event) => setField(field, event.target.value)} />
            </label>
          ))}
        </div>
        <div className="ed-act" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-main">{L.common.save}</button>
        </div>
      </form>
    </Shell>
  );
}
