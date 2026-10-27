"use client";

import { EntrepriseShell } from "../../components/EntrepriseShell";

// Root layout for /app/entreprise/* pages.
// Authentication is verified server-side on each page via resolveEntreprise().
// If not authenticated, redirects to /login happen per-page.
export default function EntrepriseLayout({ children }) {
  return <EntrepriseShell>{children}</EntrepriseShell>;
}
