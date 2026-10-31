"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../../lib/i18n";
import "../../home-pro.css";

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
    <div className="pro" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      backgroundColor: "var(--bg)"
    }}>
      <section className="card" style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <img src="/koji-logo-blue.svg" alt="Koji" style={{ width: 40, height: 40 }} />
          <div>
            <strong style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Koji</strong>
            <span style={{ fontSize: 12, color: "var(--grey)" }}>{L.signaturePub.clientSig}</span>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
          {L.signaturePub.loginTitle}
        </h1>
        <p style={{ color: "var(--grey)", fontSize: 14, marginBottom: 28, margin: 0 }}>
          {L.signaturePub.loginDesc}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.signaturePub.identifier}</label>
            <input
              type="text"
              style={{
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 2,
                fontSize: 14,
                fontFamily: "inherit",
                backgroundColor: "var(--card)",
                color: "var(--ink)"
              }}
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
              placeholder="Koji-XXXXXX"
              autoComplete="username"
              autoFocus={!identifier}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.signaturePub.password}</label>
            <input
              style={{
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 2,
                fontSize: 14,
                fontFamily: "inherit",
                backgroundColor: "var(--card)",
                color: "var(--ink)"
              }}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Koji-XXXX-XXXX"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p style={{ color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "10px 12px", borderRadius: 2, fontSize: 13, margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-main"
            disabled={loading || !identifier.trim() || !password.trim()}
            style={{ marginTop: 8 }}
          >
            {loading ? L.signaturePub.verifying : L.signaturePub.accessQuote}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 12, color: "var(--grey)", textAlign: "center", margin: 0 }}>
          {L.signaturePub.receivedHint}
        </p>
      </section>
    </div>
  );
}

export default function SignatureLoginPage() {
  return (
    <Suspense fallback={null}>
      <SignatureLoginScreen />
    </Suspense>
  );
}
