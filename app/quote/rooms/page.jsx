"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { getDraft, rooms, saveDraft } from "../../../lib/quote-state";
import { useLocale } from "../../../lib/i18n";

export default function QuoteRoomsPage() {
  const { L } = useLocale();
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
          <p className="eyebrow">{L.setup.roomsEyebrow}</p>
          <h1>{L.setup.roomsTitle}</h1>
          <p className="muted">{L.setup.roomsDesc}</p>
        </div>
      </header>

      <section className="panel">
        <div className="form-grid">
          <label className="field full">{L.setup.addCustomRoom}<input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder={L.setup.customRoomPh} /></label>
        </div>
        <button className="button secondary" style={{ marginTop: 12 }} onClick={addCustom}>{L.setup.addRoomBtn}</button>
      </section>

      <section className="grid cols-3" style={{ marginTop: 22 }}>
        {[...rooms.map((room) => room.label), ...selected.filter((room) => !rooms.some((item) => item.label === room))].map((room) => (
          <button className="panel" key={room} onClick={() => toggle(room)} style={{ borderColor: selected.includes(room) ? "var(--blue)" : "var(--line)", textAlign: "left" }}>
            <strong>{selected.includes(room) ? "✓ " : ""}{room}</strong>
          </button>
        ))}
      </section>

      <button className="button blue" style={{ marginTop: 22 }} disabled={!selected.length} onClick={next}>{L.setup.continueDevis}</button>
    </Shell>
  );
}
