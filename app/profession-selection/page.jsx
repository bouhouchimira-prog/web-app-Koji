"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";

const professions = ["Électricien", "Plombier", "Carreleur", "Menuisier", "Peintre", "Tout corps d'état"];

export default function ProfessionSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(["Peintre"]);

  function toggle(value) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
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

  async function submit() {
    const data = await apiSend("/api/auth/profile", { userId: readUserId(), professions: selected }, "PATCH");
    window.localStorage.setItem("koji-user", JSON.stringify(data.user));
    router.push("/");
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">PROFIL MÉTIER</p>
          <h1>Vos professions</h1>
          <p className="muted">Ce choix permet d’adapter les ouvrages proposés dans le devis.</p>
        </div>
      </header>
      <section className="grid cols-3">
        {professions.map((profession) => (
          <button className="panel" key={profession} onClick={() => toggle(profession)} style={{ borderColor: selected.includes(profession) ? "var(--blue)" : "var(--line)", textAlign: "left" }}>
            <h2>{selected.includes(profession) ? "✓ " : ""}{profession}</h2>
          </button>
        ))}
      </section>
      <button className="button blue" disabled={!selected.length} onClick={submit} style={{ marginTop: 22 }}>Enregistrer le profil</button>
    </Shell>
  );
}
