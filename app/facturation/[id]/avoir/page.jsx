"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function AvoirPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;
  const [reason, setReason] = useState("defaut_qualite");
  const [amount, setAmount] = useState("0");
  const [description, setDescription] = useState("");

  const reasons = [
    { value: "defaut_qualite", label: "Défaut de qualité" },
    { value: "travaux_non_realises", label: "Travaux non réalisés" },
    { value: "retard", label: "Retard injustifié" },
    { value: "erreur_facturation", label: "Erreur de facturation" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Facturation</span>
          <h1>Facture d'avoir</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Créer un avoir</h2>
        </div>

        <div className="fgrid">
          <label>
            <span>Motif</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Montant de l'avoir (€)</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="10"
            />
          </label>

          <label className="full">
            <span>Description détaillée</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez les raisons de cet avoir..."
            />
          </label>
        </div>

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button type="button" className="btn btn-main">📋 Générer l'avoir</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Avoirs existants</h2>
        </div>
        <p className="empty">Aucun avoir enregistré pour cette facture.</p>
      </div>
    </Shell>
  );
}
