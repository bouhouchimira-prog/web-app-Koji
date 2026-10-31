"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

const professions = ["Électricien", "Plombier", "Carreleur", "Menuisier", "Peintre", "Tout corps d'état"];

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

export default function ProfessionSelectionPage() {
  const { L } = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState(["Peintre"]);

  function toggle(value) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit() {
    const data = await apiSend("/api/auth/profile", { userId: readUserId(), professions: selected }, "PATCH");
    window.localStorage.setItem("koji-user", JSON.stringify(data.user));
    router.push("/");
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{L.setup.professionEyebrow}</span>
          <h1>{L.setup.professionTitle}</h1>
          <span className="muted">{L.setup.professionDesc}</span>
        </div>
      </div>
      <div className="pf-chips" role="group" aria-label={L.setup.professionTitle}>
        {professions.map((profession) => (
          <button
            type="button"
            key={profession}
            className={`pf-chip${selected.includes(profession) ? " on" : ""}`}
            aria-pressed={selected.includes(profession)}
            onClick={() => toggle(profession)}
          >
            {selected.includes(profession) ? "✓ " : ""}{profession}
          </button>
        ))}
      </div>
      <div className="ed-act" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-main" disabled={!selected.length} onClick={submit}>{L.setup.saveProfile}</button>
      </div>
    </Shell>
  );
}
