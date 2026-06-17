"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";

function CheckIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: "koji-spin 0.9s linear infinite", transformOrigin: "center" }} />
    </svg>
  );
}

function ActivateInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien d'activation invalide ou manquant.");
      return;
    }
    fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Activation impossible.");
        setStatus("ok");
        setMessage(payload.message || "Votre compte est maintenant actif.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error.message || "Une erreur est survenue lors de l'activation.");
      });
  }, [token]);

  const iconBg = status === "ok" ? "#f0fdf4" : status === "error" ? "#fef2f2" : "#eff6ff";

  return (
    <main className="auth-screen-v2">
      <AuthBrandPanel />
      <section className="auth-panel-v2">
        <div className="auth-card">
          <div className="auth-confirm-card">

            <div className="auth-confirm-icon" style={{ background: iconBg }}>
              {status === "loading" && <SpinnerIcon />}
              {status === "ok" && <CheckIcon />}
              {status === "error" && <ErrorIcon />}
            </div>

            <h2 className="auth-confirm-card-title" style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "#0a1538",
              margin: 0
            }}>
              {status === "loading" && "Activation en cours…"}
              {status === "ok" && "Compte activé !"}
              {status === "error" && "Activation échouée"}
            </h2>

            <p className="auth-confirm-sub">
              {status === "loading" && "Veuillez patienter quelques instants."}
              {status === "ok" && message}
              {status === "error" && message}
            </p>

            {status === "ok" && (
              <Link href="/login?type=entreprise" className="auth-btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
                Se connecter
              </Link>
            )}

            {status === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <Link href="/signup" className="auth-btn-primary" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>
                  Créer un nouveau compte
                </Link>
                <Link href="/login" style={{ textAlign: "center", fontSize: "0.85rem", color: "#64748b", textDecoration: "none" }}>
                  Retour à la connexion
                </Link>
              </div>
            )}

          </div>
        </div>
      </section>
    </main>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateInner />
    </Suspense>
  );
}
