"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";

// Ecran de choix avant la creation d'un devis (17 oct, demande d'Amira) —
// jusque-la "+ Nouveau devis" ouvrait directement l'editeur en mode
// Manuel (la bascule Manuel/Avec l'IA vivait a l'interieur, voir
// DevisEditor.jsx). Choisir le mode AVANT d'entrer dans l'editeur evite de
// devoir redemarrer une conversation deja commencee si on hesite.
function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function DevisModeChoice() {
  const router = useRouter();

  return (
    <Shell>
      <header className="page-header" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="avenant-back-btn" aria-label="Retour" onClick={() => router.push("/devis")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div>
          <h1>Devis</h1>
          <p className="tool-muted" style={{ margin: "2px 0 0" }}>Tous vos devis, du brouillon à la signature.</p>
        </div>
      </header>

      <div className="devis-mode-choice-grid">
        <Link href="/devis?new=1&mode=ia" className="devis-mode-choice-card devis-mode-choice-ia">
          <span className="devis-mode-choice-icon"><SparkleIcon /></span>
          <div className="devis-mode-choice-body">
            <div className="devis-mode-choice-title-row">
              <strong>Devis avec l'IA</strong>
              <span className="status-pill devis-mode-choice-badge">RECOMMANDÉ</span>
            </div>
            <p>Décrivez le chantier, l'assistant prépare le devis à partir de la bibliothèque koji.</p>
          </div>
          <span className="button white devis-mode-choice-cta">Démarrer <ArrowIcon /></span>
        </Link>

        <Link href="/devis?new=1&mode=manuel" className="devis-mode-choice-card devis-mode-choice-manuel">
          <span className="devis-mode-choice-icon"><PencilIcon /></span>
          <div className="devis-mode-choice-body">
            <strong>Devis manuel</strong>
            <p>Construisez-le ligne par ligne avec vos lots, la bibliothèque et vos fournitures.</p>
          </div>
          <span className="button secondary devis-mode-choice-cta">Créer <ArrowIcon /></span>
        </Link>
      </div>
    </Shell>
  );
}
