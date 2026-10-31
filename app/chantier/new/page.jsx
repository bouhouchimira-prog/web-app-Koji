"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { saveChantierDraft } from "../../../lib/chantier-draft";
import { useLocale } from "../../../lib/i18n";

const initialForm = {
  title: "",
  street: "",
  postalCode: "",
  city: "",
  client: "",
  clientEmail: "",
  propertyType: "Maison"
};

export default function ChantierNewPage() {
  const { L } = useLocale();
  const router = useRouter();
  const [form, setForm] = useState(initialForm);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function next() {
    saveChantierDraft(form);
    router.push("/devis");
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={goBack}>← Retour</button>
          <span className="eyebrow">Nouveau chantier</span>
          <h1>{L.setup.newTitle}</h1>
        </div>
      </div>

      <section className="card">
        <div className="fgrid">
          <label className="full">
            {L.setup.refLabel}
            <input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Loft Durand - Cuisine ..." />
          </label>
          <label className="full">
            {L.setup.street}
            <input value={form.street} onChange={(event) => setField("street", event.target.value)} />
          </label>
          <label>
            {L.setup.postalCode}
            <input value={form.postalCode} onChange={(event) => setField("postalCode", event.target.value)} />
          </label>
          <label>
            {L.setup.city}
            <input value={form.city} onChange={(event) => setField("city", event.target.value)} />
          </label>
          <label>
            {L.setup.client}
            <input value={form.client} onChange={(event) => setField("client", event.target.value)} />
          </label>
          <label>
            {L.setup.clientEmail}
            <input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@exemple.com" />
          </label>
          <label className="full">
            {L.setup.propertyType}
            <select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
              <option>Maison</option>
              <option>Appartement</option>
              <option>Local</option>
              <option>Autre</option>
            </select>
          </label>
        </div>
        <div className="ed-act" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-main" onClick={next} disabled={!form.title.trim()}>{L.setup.nextBtn}</button>
        </div>
      </section>
    </Shell>
  );
}
