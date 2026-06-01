"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { getDraft, rooms, saveDraft } from "../../../lib/quote-state";

export default function QuoteRoomsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(() => getDraft().rooms || []);
  const [custom, setCustom] = useState("");

  function toggle(room) {
    setSelected((current) => current.includes(room) ? current.filter((item) => item !== room) : [...current, room]);
  }

  function addCustom() {
    const value = custom.trim();
    if (!value) return;
    setSelected((current) => current.includes(value) ? current : [...current, value]);
    setCustom("");
  }

  function next() {
    saveDraft({ ...getDraft(), rooms: selected });
    router.push("/devis");
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">ASSISTANT DEVIS</p>
          <h1>Choisir les pièces</h1>
          <p className="muted">Sélectionnez les zones du chantier. Elles seront reprises dans le devis.</p>
        </div>
      </header>

      <section className="panel">
        <div className="form-grid">
          <label className="field full">Ajouter une pièce personnalisée<input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Buanderie, garage..." /></label>
        </div>
        <button className="button secondary" style={{ marginTop: 12 }} onClick={addCustom}>Ajouter la pièce</button>
      </section>

      <section className="grid cols-3" style={{ marginTop: 22 }}>
        {[...rooms.map((room) => room.label), ...selected.filter((room) => !rooms.some((item) => item.label === room))].map((room) => (
          <button className="panel" key={room} onClick={() => toggle(room)} style={{ borderColor: selected.includes(room) ? "var(--blue)" : "var(--line)", textAlign: "left" }}>
            <strong>{selected.includes(room) ? "✓ " : ""}{room}</strong>
          </button>
        ))}
      </section>

      <button className="button blue" style={{ marginTop: 22 }} disabled={!selected.length} onClick={next}>Continuer vers le devis</button>
    </Shell>
  );
}
