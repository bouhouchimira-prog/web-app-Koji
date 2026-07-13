"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { useLocale } from "../../lib/i18n";

export default function WelcomePage() {
  const { L } = useLocale();
  const [selected, setSelected] = useState("entreprise");

  return (
    <main className="auth-screen welcome-screen">
      <AuthBrandPanel welcome />

      <section className="auth-panel welcome-panel">
        <div className="grid">
          <button
            className={`panel auth-choice-card ${selected === "entreprise" ? "is-selected" : ""}`}
            onClick={() => setSelected("entreprise")}
            style={{ textAlign: "left" }}
          >
            <h2>{L.auth.profileCompany}</h2>
            <p className="muted">{L.auth.companyDesc}</p>
          </button>
          <button
            className={`panel auth-choice-card ${selected === "particulier" ? "is-selected" : ""}`}
            onClick={() => setSelected("particulier")}
            style={{ textAlign: "left" }}
          >
            <h2>{L.auth.profilePersonal}</h2>
            <p className="muted">{L.auth.personalDesc}</p>
          </button>
        </div>
        <div className="actions welcome-actions" style={{ marginTop: 22 }}>
          <Link className="button blue" href={`/login?type=${selected}`}>{L.auth.loginBtn}</Link>
          <Link className="button secondary" href={`/signup?type=${selected}`}>{L.auth.createAccount}</Link>
        </div>
      </section>
    </main>
  );
}
