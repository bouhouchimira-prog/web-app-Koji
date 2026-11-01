"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { DEMARRAGE_SKIP_KEY, demarrageSteps, essentialsDone } from "../../lib/demarrage";

export default function DemarragePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [decennale, setDecennale] = useState({ decennaleInsurer: "", decennalePolicy: "", decennaleUntil: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then(({ user: fetched }) => {
        setUser(fetched);
        const business = fetched?.business || {};
        setDecennale({
          decennaleInsurer: business.decennaleInsurer || "",
          decennalePolicy: business.decennalePolicy || "",
          decennaleUntil: business.decennaleUntil || ""
        });
      })
      .catch((err) => setError(err.message || "Chargement impossible."));
  }, []);

  async function saveDecennale(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { user: updated } = await apiSend("/api/auth/profile", { business: decennale }, "PATCH");
      window.localStorage.setItem("koji-user", JSON.stringify(updated));
      setUser(updated);
    } catch (err) {
      setError(err.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    try {
      window.localStorage.setItem(DEMARRAGE_SKIP_KEY, new Date().toISOString());
    } catch {}
    router.push("/");
  }

  const steps = user ? demarrageSteps(user) : [];
  const doneCount = steps.filter((step) => step.done).length;
  const ready = steps.length > 0 && essentialsDone(steps);

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Démarrage guidé · {user ? `${doneCount} étape${doneCount > 1 ? "s" : ""} sur 6` : "…"}</span>
          <h1>{ready ? "Prêt à envoyer votre premier devis" : "Prêt à envoyer votre premier devis en 10 minutes"}</h1>
          <span className="muted">Les trois premières étapes suffisent pour chiffrer et envoyer. Les autres peuvent attendre.</span>
        </div>
        <div className="acts">
          {ready ? <Link href="/devis?new=1&mode=ia" className="btn btn-main">Démarrer un devis guidé</Link> : null}
        </div>
      </div>

      {error ? <p className="notice" role="alert">{error}</p> : null}
      {!user && !error ? <p className="empty">Chargement…</p> : null}

      {user ? (
        <ol className="dg">
          {steps.map((step, index) => (
            <li key={step.id} className={`dg-step${step.done ? " done" : ""}`}>
              <span className="dg-n" aria-hidden="true">
                {step.done ? <svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" /></svg> : index + 1}
              </span>
              <div className="dg-b">
                <strong>{step.title}{index < 3 ? <span className="tag tag-e">essentiel</span> : null}</strong>
                <small>{step.detail}</small>
                <small className="dg-u">Débloque : {step.unlocks}</small>
                {step.inline && !step.done ? (
                  <form className="dg-form" onSubmit={saveDecennale}>
                    <input value={decennale.decennaleInsurer} onChange={(event) => setDecennale({ ...decennale, decennaleInsurer: event.target.value })} placeholder="Assureur" aria-label="Assureur" maxLength={80} required />
                    <input value={decennale.decennalePolicy} onChange={(event) => setDecennale({ ...decennale, decennalePolicy: event.target.value })} placeholder="N° de contrat" aria-label="Numéro de contrat" maxLength={60} />
                    <input type="date" value={decennale.decennaleUntil} onChange={(event) => setDecennale({ ...decennale, decennaleUntil: event.target.value })} aria-label="Valable jusqu'au" required />
                    <button type="submit" className="btn btn-sec" disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
                  </form>
                ) : null}
              </div>
              <div className="dg-a">
                {step.done ? <span className="tag tag-o">fait</span> : step.href ? <Link href={step.href} className="btn btn-sec">Faire</Link> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="dg-foot">
        <button type="button" className="link" onClick={skip}>Passer pour l'instant</button>
        <span className="muted">Vous retrouverez ce démarrage dans Profil.</span>
      </div>
    </Shell>
  );
}
