"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function AssistantPage() {
  const router = useRouter();
  const [step, setStep] = useState("welcome");
  const [form, setForm] = useState({
    specialty: "Carrelage",
    experience: "5-10",
    coverage: ["Paris", "Île-de-France"],
    services: ["Pose", "Fournitures"]
  });

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Créer ma KojiPage avec l'assistant</h1>
      </div>

      {step === "welcome" && (
        <div className="card">
          <div className="card-h"><h2>Bienvenue!</h2></div>
          <p style={{ marginBottom: 16, color: "var(--grey)" }}>
            L'assistant vous aidera à créer votre page publique en quelques minutes.
          </p>
          <button className="btn btn-main" onClick={() => setStep("form")}>Commencer</button>
        </div>
      )}

      {step === "form" && (
        <div className="card">
          <div className="card-h"><h2>Vos informations</h2></div>
          <div className="fgrid">
            <label>
              <span>Spécialité</span>
              <select value={form.specialty} onChange={(e) => setForm({...form, specialty: e.target.value})}>
                <option>Carrelage</option>
                <option>Électricité</option>
                <option>Plomberie</option>
              </select>
            </label>

            <label>
              <span>Expérience</span>
              <select value={form.experience} onChange={(e) => setForm({...form, experience: e.target.value})}>
                <option>0-5 ans</option>
                <option>5-10 ans</option>
                <option>10+ ans</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Zones d'intervention</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Paris", "Île-de-France", "Hauts-de-Seine"].map((zone) => (
                <button key={zone} className={`btn btn-sm ${form.coverage.includes(zone) ? "btn-main" : "btn-sec"}`} style={{ fontSize: 12 }}>
                  {zone}
                </button>
              ))}
            </div>
          </div>

          <div className="ed-act" style={{ marginTop: 24 }}>
            <button className="btn btn-sec" onClick={() => setStep("welcome")}>Retour</button>
            <button className="btn btn-main" onClick={() => setStep("finish")}>Suivant</button>
          </div>
        </div>
      )}

      {step === "finish" && (
        <div className="card">
          <div className="card-h"><h2>Bravo!</h2></div>
          <p style={{ marginBottom: 16, color: "var(--grey)" }}>Votre KojiPage a été créée avec succès.</p>
          <div style={{ padding: "16px", background: "#F5F5F2", borderRadius: 4, marginBottom: 16 }}>
            <p style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600 }}>URL: koji.fr/artisans/jean-dupont</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--grey)" }}>Commencez à recevoir des demandes!</p>
          </div>
          <button className="btn btn-main" onClick={() => router.back()}>Terminer</button>
        </div>
      )}
    </Shell>
  );
}
