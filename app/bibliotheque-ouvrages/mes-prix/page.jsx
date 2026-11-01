"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";

// PRO-08.2 : seul endroit où se règlent les prix de vente. Taux de
// main-d'œuvre (le même pour tous les métiers : le calcul des devis ne gère
// pas encore un taux par métier), TVA par défaut, et majorations proposées
// sur chaque nouveau devis (modifiables ensuite dans le devis).

const MODES = [
  { id: "excluded", label: "Non comptée" },
  { id: "internal", label: "Incluse, cachée au client" },
  { id: "client", label: "Visible par le client" }
];

const STARTING_SURCHARGES = [
  { id: "sc-coord", label: "Coordination de chantier", percent: 10, mode: "excluded", calculationBase: "total_lots" },
  { id: "sc-alea", label: "Provision aléas de chantier", percent: 5, mode: "excluded", calculationBase: "total_lots" },
  { id: "sc-assur", label: "Assurance décennale", percent: 8, mode: "excluded", calculationBase: "chiffrage_cumule" }
];

function rateText(value) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",")} € / h`;
}

export default function MesPrixPage() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then(({ user }) => {
        const business = user?.business || {};
        setForm({
          dailyRate: String(business.dailyRate ?? ""),
          hoursPerDay: String(business.hoursPerDay ?? 7),
          defaultVatRate: String(business.defaultVatRate ?? 20),
          surcharges: Array.isArray(business.defaultSurcharges) ? business.defaultSurcharges : STARTING_SURCHARGES,
          custom: Array.isArray(business.defaultSurcharges)
        });
      })
      .catch((error) => setMessage(error.message || "Chargement impossible."));
  }, []);

  function setSurcharge(id, field, value) {
    setForm((current) => ({ ...current, surcharges: current.surcharges.map((item) => (item.id === id ? { ...item, [field]: value } : item)) }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const surcharges = form.surcharges
        .filter((item) => String(item.label || "").trim())
        .map((item) => ({ id: item.id, label: String(item.label).trim().slice(0, 80), percent: Math.max(0, Number(item.percent) || 0), mode: item.mode, calculationBase: item.calculationBase === "chiffrage_cumule" ? "chiffrage_cumule" : "total_lots" }));
      const response = await apiSend("/api/auth/profile", {
        business: {
          dailyRate: Math.max(0, Number(form.dailyRate) || 0),
          hoursPerDay: Math.max(1, Number(form.hoursPerDay) || 7),
          defaultVatRate: Math.max(0, Number(form.defaultVatRate) || 0),
          defaultSurcharges: surcharges
        }
      }, "PATCH");
      window.localStorage.setItem("koji-user", JSON.stringify(response.user));
      setForm((current) => ({ ...current, surcharges, custom: true }));
      setMessage("Prix enregistrés. Ils s'appliquent aux prochains devis.");
    } catch (error) {
      setMessage(error.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const hourly = form && Number(form.dailyRate) > 0 ? Number(form.dailyRate) / Math.max(1, Number(form.hoursPerDay) || 7) : 0;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <Link href="/bibliotheque-ouvrages" className="link">← Bibliothèque</Link>
          <span className="eyebrow">Le seul endroit où se règlent vos prix de vente</span>
          <h1>Mes prix</h1>
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      {!form ? <p className="empty">Chargement…</p> : (
        <form className="mp" onSubmit={save}>
          <section className="card">
            <div className="card-h"><h2>Main-d'œuvre</h2><span className="sm2">temps de la bibliothèque × taux = main-d'œuvre de chaque ligne</span></div>
            <div className="fgrid pf-3">
              <label>Prix de la journée (€ HT)
                <input type="number" min="0" step="any" value={form.dailyRate} onChange={(event) => setForm({ ...form, dailyRate: event.target.value })} placeholder="Ex : 400" />
              </label>
              <label>Heures travaillées par jour
                <input type="number" min="1" step="any" value={form.hoursPerDay} onChange={(event) => setForm({ ...form, hoursPerDay: event.target.value })} />
              </label>
              <label>Taux horaire
                <input type="text" value={rateText(hourly)} disabled />
                <small className="muted">{hourly > 0 ? "appliqué à tous vos métiers" : "à régler : sans taux, la main-d'œuvre des devis vaut 0"}</small>
              </label>
            </div>
            <p className="muted">Un taux différent par métier n'est pas encore pris en compte par le calcul des devis. Une ligne de devis garde son propre taux si vous le changez dans le devis.</p>
          </section>

          <section className="card">
            <div className="card-h"><h2>TVA par défaut</h2></div>
            <div className="fgrid pf-3">
              <label>Taux appliqué aux nouveaux devis (%)
                <input type="number" min="0" step="any" value={form.defaultVatRate} onChange={(event) => setForm({ ...form, defaultVatRate: event.target.value })} />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Majorations proposées</h2>
              <span className="sm2">{form.custom ? "vos réglages" : "réglages Koji par défaut"} · modifiables dans chaque devis</span>
            </div>
            {form.surcharges.length === 0 ? <p className="empty">Aucune majoration : les nouveaux devis partiront sans.</p> : null}
            {form.surcharges.map((item) => (
              <div className="mp-row" key={item.id}>
                <input value={item.label} onChange={(event) => setSurcharge(item.id, "label", event.target.value)} aria-label="Libellé de la majoration" maxLength={80} />
                <label className="mp-pct"><input type="number" min="0" step="any" value={item.percent} onChange={(event) => setSurcharge(item.id, "percent", event.target.value)} aria-label="Pourcentage" />%</label>
                <select value={item.calculationBase === "chiffrage_cumule" ? "chiffrage_cumule" : "total_lots"} onChange={(event) => setSurcharge(item.id, "calculationBase", event.target.value)} aria-label="Base de calcul">
                  <option value="total_lots">sur les lots</option>
                  <option value="chiffrage_cumule">sur le cumul</option>
                </select>
                <select value={item.mode} onChange={(event) => setSurcharge(item.id, "mode", event.target.value)} aria-label="Affichage">
                  {MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                </select>
                <button type="button" className="dx" aria-label={`Retirer ${item.label}`} onClick={() => setForm({ ...form, surcharges: form.surcharges.filter((row) => row.id !== item.id) })}>×</button>
              </div>
            ))}
            <div>
              <button type="button" className="link" onClick={() => setForm({ ...form, surcharges: [...form.surcharges, { id: `sc-${Date.now()}`, label: "", percent: 0, mode: "excluded", calculationBase: "total_lots" }] })}>+ Ajouter une majoration</button>
            </div>
          </section>

          <div className="mp-act">
            <button type="submit" className="btn btn-main" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer mes prix"}</button>
          </div>
        </form>
      )}
    </Shell>
  );
}
