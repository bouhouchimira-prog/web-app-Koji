// Centralizes the HttpOnly cookie names/options for all three session types
// (company/pro, particulier portal, worker). Session tokens used to live in
// localStorage under "koji-user" / "koji-worker-session", readable by any
// script running on the page — a single XSS bug anywhere in the app would
// have handed over a live, working session. Cookies here are httpOnly, so
// client-side JS can no longer read or exfiltrate them; the browser attaches
// them automatically on same-origin requests.
const isProd = process.env.NODE_ENV === "production";

const base = { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" };
const ONE_HOUR = 60 * 60;
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const FIFTEEN_MINUTES = 15 * 60;

export const COOKIES = {
  // Supabase access token — short-lived, refreshed via /api/auth/refresh.
  access: { name: "koji_session", options: { ...base, maxAge: ONE_HOUR } },
  // Supabase refresh token — scoped to /api/auth so it's never sent to
  // ordinary data routes, only to the refresh/logout endpoints that need it.
  refresh: { name: "koji_refresh", options: { ...base, path: "/api/auth", maxAge: THIRTY_DAYS } },
  // particulier client-portal session (lib/portal-session.js).
  portal: { name: "koji_portal_session", options: { ...base, maxAge: THIRTY_DAYS } },
  // worker portal session (lib/worker-session.js).
  worker: { name: "koji_worker_session", options: { ...base, maxAge: THIRTY_DAYS } },
};

// Fenetre d'inactivite (6 oct, demande d'Amira) — separee des durees de vie
// ci-dessus (qu'on ne touche pas, pour ne pas casser le "rester connecte"
// voulu par ailleurs). Prolongee par proxy.js a chaque requete tant
// qu'il y a de l'activite ; si elle expire (15 min sans requete), le
// middleware efface TOUTES les vraies sessions ci-dessus.
export const LAST_ACTIVE_COOKIE = { name: "koji_last_active", options: { ...base, maxAge: FIFTEEN_MINUTES } };

export function setSessionCookie(response, key, value) {
  const { name, options } = COOKIES[key];
  response.cookies.set(name, value, options);
  response.cookies.set(LAST_ACTIVE_COOKIE.name, "1", LAST_ACTIVE_COOKIE.options);
}

export function clearSessionCookie(response, key) {
  const { name, options } = COOKIES[key];
  response.cookies.set(name, "", { ...options, maxAge: 0 });
}

export function readSessionCookie(request, key) {
  return request.cookies?.get(COOKIES[key].name)?.value || "";
}
