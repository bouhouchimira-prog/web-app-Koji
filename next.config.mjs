import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// script-src/style-src need 'unsafe-inline': Next.js App Router streams RSC
// payloads through an inline <script> on every page, and React's style={{}}
// prop sets the DOM style attribute directly — both are inline by nature.
// Locking those down further would need a nonce pipeline (its own project);
// what's here still blocks loading any *external* script/resource/frame,
// restricts network requests to this origin + Supabase, and forbids framing.
// The Radar map (components/RadarMap.jsx) reads its tiles, fonts and icons
// from OpenFreeMap (OpenStreetMap data, free, no key) — fetched, so only
// connect-src needs it; its worker is served from /carte on this origin.
const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const mapTilesOrigin = "https://tiles.openfreemap.org";
// Address autocomplete (profile work zone, guided start) calls the free
// national address API (BAN) from the browser.
const addressApiOrigin = "https://api-adresse.data.gouv.fr";
// Turbopack's dev server (HMR, React error-overlay stack reconstruction) uses
// eval() and breaks under this CSP without it. Production never needs or gets
// 'unsafe-eval' — React itself never calls eval() outside development.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Photos de chantier : liens signés Supabase Storage (PRO-02.2).
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""} ${mapTilesOrigin} ${addressApiOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
];

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["nodemailer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
