"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";

function ActivateInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Activation en cours...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token manquant.");
      return;
    }
    fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Activation impossible");
        setStatus("ok");
        setMessage(payload.message || "Compte active.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error.message);
      });
  }, [token]);

  return (
    <main className="auth-screen">
      <AuthBrandPanel />
      <section className="auth-panel">
        <div className="panel" style={{ boxShadow: "none" }}>
          <h2>{status === "ok" ? "Compte active" : status === "error" ? "Activation echouee" : "Veuillez patienter"}</h2>
          <p className="muted">{message}</p>
          <div style={{ marginTop: 18 }}>
            <Link className="button blue" href="/login?type=entreprise">Aller a la connexion</Link>
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
