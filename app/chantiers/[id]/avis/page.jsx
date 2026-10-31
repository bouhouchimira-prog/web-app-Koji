"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function AvisPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [review, setReview] = useState({
    rating: 0,
    comment: "",
    wouldRecommend: false
  });
  const [reviews, setReviews] = useState([
    { id: 1, clientName: "Dupont", rating: 5, comment: "Excellent travail, très professionnel", date: "2026-10-20" },
    { id: 2, clientName: "Martin", rating: 4, comment: "Bon résultat, quelques petits détails", date: "2026-10-15" }
  ]);

  const handleSubmit = () => {
    if (review.rating > 0 && review.comment.trim()) {
      setReviews([{ id: reviews.length + 1, clientName: "Client", rating: review.rating, comment: review.comment, date: new Date().toISOString().split("T")[0] }, ...reviews]);
      setReview({ rating: 0, comment: "", wouldRecommend: false });
    }
  };

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Fiche chantier</span>
          <h1>Avis et réalisation</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="kpis" style={{ marginBottom: 24 }}>
        <div>
          <div className="l">Note moyenne</div>
          <div className="v">4.5/5</div>
          <div className="s">sur {reviews.length} avis</div>
        </div>
        <div>
          <div className="l">Taux de recommandation</div>
          <div className="v">100%</div>
          <div className="s">{reviews.length} clients recommandent</div>
        </div>
        <div>
          <div className="l">Score de satisfaction</div>
          <div className="v">92%</div>
          <div className="s">Basé sur les retours clients</div>
        </div>
        <div>
          <div className="l">Délai de réalisation</div>
          <div className="v">15 j</div>
          <div className="s">Conforme aux estimations</div>
        </div>
      </div>

      {/* New Review */}
      <div className="card">
        <div className="card-h">
          <h2>Laisser un avis sur ce chantier</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Note</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReview({ ...review, rating: star })}
                  style={{
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    background: review.rating >= star ? "#FFC400" : "#FFFFFF",
                    cursor: "pointer"
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label>
            <span style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Votre avis</span>
            <textarea
              rows={4}
              value={review.comment}
              onChange={(e) => setReview({ ...review, comment: e.target.value })}
              placeholder="Partagez votre expérience avec ce chantier..."
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid var(--line)",
                borderRadius: 4,
                fontFamily: "inherit",
                fontSize: 14,
                resize: "vertical"
              }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={review.wouldRecommend}
              onChange={(e) => setReview({ ...review, wouldRecommend: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span>Je recommande ce chantier/cette entreprise</span>
          </label>
        </div>

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button type="button" className="btn btn-main" onClick={handleSubmit}>Publier l'avis</button>
        </div>
      </div>

      {/* Reviews List */}
      <div className="card">
        <div className="card-h">
          <h2>Avis reçus</h2>
        </div>

        {reviews.length > 0 ? (
          <div className="mlist">
            {reviews.map((r) => (
              <div key={r.id} className="m-card">
                <div className="top2">
                  <strong>{r.clientName}</strong>
                  <small style={{ color: "var(--grey)" }}>{r.date}</small>
                </div>
                <div style={{ marginBottom: 8, fontSize: 12 }}>
                  {Array(r.rating).fill("★").join("")}
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--grey)" }}>{r.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Aucun avis pour le moment.</p>
        )}
      </div>
    </Shell>
  );
}
