"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { saveChantierDraft } from "../../../lib/chantier-draft";

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
            <h1>Creer un nouveau chantier</h1>
          </div>
          <span />
        </header>

        <section className="wizard-form-card">
          <div className="wizard-form-grid">
            <label className="wizard-field full">Reference du chantier<input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Loft Durand - Cuisine ..." /></label>
            <label className="wizard-field full">Numero / Rue<input value={form.street} onChange={(event) => setField("street", event.target.value)} placeholder="Rajouter votre texte..." /></label>
            <label className="wizard-field">Code postale<input value={form.postalCode} onChange={(event) => setField("postalCode", event.target.value)} placeholder="Rajouter votre texte..." /></label>
            <label className="wizard-field">Ville<input value={form.city} onChange={(event) => setField("city", event.target.value)} placeholder="Rajouter votre texte..." /></label>
            <label className="wizard-field">Client<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder="Nom client" /></label>
            <label className="wizard-field">Adresse e-mail du client<input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@exemple.com" /></label>
            <label className="wizard-field full">Type du bien<select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
              <option>Maison</option>
              <option>Appartement</option>
              <option>Local</option>
              <option>Autre</option>
            </select></label>
          </div>
          <button className="wizard-primary" onClick={next} disabled={!form.title.trim()}>Suivant <span>{">"}</span></button>
        </section>
      </div>
    </Shell>
  );
}
