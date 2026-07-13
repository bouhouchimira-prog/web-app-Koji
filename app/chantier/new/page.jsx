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
    <Shell>
      <div className="koji-wizard">
        <header className="wizard-top">
          <button type="button" className="wizard-back" onClick={goBack}>{"<"}</button>
          <div>
            <h1>{L.setup.newTitle}</h1>
          </div>
          <span />
        </header>

        <section className="wizard-form-card">
          <div className="wizard-form-grid">
            <label className="wizard-field full">{L.setup.refLabel}<input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Loft Durand - Cuisine ..." /></label>
            <label className="wizard-field full">{L.setup.street}<input value={form.street} onChange={(event) => setField("street", event.target.value)} /></label>
            <label className="wizard-field">{L.setup.postalCode}<input value={form.postalCode} onChange={(event) => setField("postalCode", event.target.value)} /></label>
            <label className="wizard-field">{L.setup.city}<input value={form.city} onChange={(event) => setField("city", event.target.value)} /></label>
            <label className="wizard-field">{L.setup.client}<input value={form.client} onChange={(event) => setField("client", event.target.value)} /></label>
            <label className="wizard-field">{L.setup.clientEmail}<input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@exemple.com" /></label>
            <label className="wizard-field full">{L.setup.propertyType}<select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
              <option>Maison</option>
              <option>Appartement</option>
              <option>Local</option>
              <option>Autre</option>
            </select></label>
          </div>
          <button className="wizard-primary" onClick={next} disabled={!form.title.trim()}>{L.setup.nextBtn} <span>{">"}</span></button>
        </section>
      </div>
    </Shell>
  );
}
