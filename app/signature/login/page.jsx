"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../../lib/i18n";

function SignatureLoginScreen() {
  const { L } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState(params.get("identifier") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signatureToken = params.get("signatureToken") || "";

  useEffect(() => {
    if (signatureToken && !params.get("identifier")) {
      setIdentifier("");
    }
  }, [signatureToken]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError(L.signaturePub.errRequired);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signature-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password: password.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || L.signaturePub.errWrong);
        return;
      }
      router.push(`/signature/${data.signatureToken}`);
    } catch {
      setError(L.signaturePub.errGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="signature-public">
      <section className="signature-card" style={{ maxWidth: 420 }}>
        <div className="signature-brand">
          <img src="/koji-logo.svg" alt="Koji" style={{ width: 48, height: 48 }} />
          <div>
            <strong>Kôji</strong>
            <span>{L.signaturePub.clientSig}</span>
          </div>
        </div>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0a1538", margin: "20px 0 6px" }}>
          {L.signaturePub.loginTitle}
        </h1>
        <p style={{ color: "#737b88", fontSize: "0.9rem", marginBottom: 24 }}>
          {L.signaturePub.loginDesc}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label className="field">
            {L.signaturePub.identifier}
            <input
              type="text"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
              placeholder="Koji-XXXXXX"
              autoComplete="username"
              autoFocus={!identifier}
            />
          </label>

          <label className="field">
            {L.signaturePub.password}
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Koji-XXXX-XXXX"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <p style={{ color: "#ef3f4a", background: "#fff0f0", border: "1px solid #ffd6d6", borderRadius: 8, padding: "10px 14px", fontSize: "0.88rem", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="button blue"
            disabled={loading || !identifier.trim() || !password.trim()}
            style={{ marginTop: 4 }}
          >
            {loading ? L.signaturePub.verifying : L.signaturePub.accessQuote}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: "0.82rem", color: "#9aa5b4", textAlign: "center" }}>
          {L.signaturePub.receivedHint}
        </p>
      </section>
    </main>
  );
}

export default function SignatureLoginPage() {
  return (
    <Suspense fallback={null}>
      <SignatureLoginScreen />
    </Suspense>
  );
}
