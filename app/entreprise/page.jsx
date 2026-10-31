"use client";

import Link from "next/link";

export default function EntreprisePage() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f8f7f6" }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 32px",
        backgroundColor: "white",
        borderBottom: "1px solid #e5e4e2"
      }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>KOJI Pro</div>
        <nav style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 14 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer" }}>Découvrir</button>
          <button style={{ background: "none", border: "none", cursor: "pointer" }}>Fonctionnalités</button>
          <button style={{ background: "none", border: "none", cursor: "pointer" }}>Tarifs</button>
        </nav>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/login?type=entreprise" style={{ color: "#1a1a1a", textDecoration: "none" }}>Se connecter</Link>
          <Link href="/login?type=entreprise" style={{ backgroundColor: "#D9A93E", color: "white", padding: "10px 20px", borderRadius: 4, textDecoration: "none" }}>Créer mon compte</Link>
        </div>
      </header>

      <section style={{ padding: "80px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, marginBottom: 24 }}>
          Décrivez le chantier.<br />
          <em style={{ fontStyle: "italic" }}>Koji le chiffre.</em>
        </h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div style={{ backgroundColor: "white", borderRadius: 8, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 4 }}>Devis 2026-041</h3>
              <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Salle de bain, Paris 10e</p>
            </div>
            <p style={{ fontSize: 13, marginBottom: 16 }}>Salle de bain de 5,8 m², douche à l'italienne à la place de la baignoire.</p>
            <button style={{ width: "100%", padding: "12px", backgroundColor: "#1a1a1a", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>Continuer</button>
          </div>

          <div>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>
              La page d'accueil publique s'adresse aux artisans et entreprises. Elle montre le produit lui-même, répond aux objections d'un artisan.
            </p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32 }}>
              <li style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13 }}>✓ Accès aux chantiers publiés</li>
              <li style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13 }}>✓ Création de devis en quelques minutes</li>
              <li style={{ display: "flex", gap: 10, fontSize: 13 }}>✓ Signature électronique</li>
            </ul>
            <Link href="/login?type=entreprise" style={{ backgroundColor: "#D9A93E", color: "white", padding: "14px 28px", borderRadius: 4, textDecoration: "none", fontWeight: 600 }}>Créer mon compte</Link>
          </div>
        </div>
      </section>

      <footer style={{ padding: "40px 32px", backgroundColor: "white", borderTop: "1px solid #e5e4e2", textAlign: "center", marginTop: 80 }}>
        <p style={{ fontSize: 12, color: "#999" }}>© {new Date().getFullYear()} Koji</p>
      </footer>
    </main>
  );
}
