export function readStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("koji-user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readStoredUserId() {
  return readStoredUser()?.id || null;
}

// The session itself now lives in an HttpOnly cookie (see
// lib/session-cookies.js), sent automatically by the browser on every
// same-origin request — no Authorization header needed here. "koji-user" in
// localStorage is display-only profile data (name/email/id/...), never a
// token, so a script running on the page has nothing live to steal from it.

// Access tokens expire after ~1h; ask the server to refresh the session from
// the refresh-token cookie. Returns true if the refresh succeeded.
async function refreshSession() {
  try {
    const response = await fetch("/api/auth/refresh", { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}

function forceRelogin() {
  if (typeof window === "undefined") return;
  const user = readStoredUser();
  window.localStorage.removeItem("koji-user");
  const isParticulier = user?.accountType === "particulier";
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.assign(isParticulier ? "/login" : "/login?type=entreprise");
}

// Supabase surfaces an expired token as a query error (e.g. "JWT expired",
// often via routes that just forward error.message with a 500/400), not
// necessarily as an HTTP 401 — so status alone isn't a reliable signal.
function looksLikeExpiredToken(status, data) {
  if (status === 401) return true;
  const message = String(data?.error || data?.message || "").toLowerCase();
  return message.includes("jwt expired") || message.includes("invalid jwt") || message.includes("pgrst301");
}

// Retries a request once after refreshing the session when the Supabase token
// has expired. This module (apiGet/apiSend) is only used by the company/pro
// side — the particulier and worker portals talk to their own routes with
// plain fetch (see app/client/** and app/worker/page.jsx) — so any logged-in
// session found here is an entreprise one, refreshable via /api/auth/refresh.
export async function fetchWithAuthRetry(makeRequest) {
  let response = await makeRequest();
  if (!response.ok && readStoredUser()?.id) {
    let data = null;
    try { data = await response.clone().json(); } catch { /* non-JSON body */ }
    if (looksLikeExpiredToken(response.status, data)) {
      const refreshed = await refreshSession();
      if (refreshed) {
        response = await makeRequest();
      } else {
        forceRelogin();
      }
    }
  }
  return response;
}

function withUserQuery(path) {
  const userId = readStoredUserId();
  if (!userId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}userId=${encodeURIComponent(userId)}`;
}

function withUserPayload(payload = {}) {
  const userId = readStoredUserId();
  if (!userId || payload.userId) return payload;
  return { ...payload, userId };
}

export async function apiGet(path) {
  const response = await fetchWithAuthRetry(() =>
    fetch(withUserQuery(path), { cache: "no-store" })
  );
  if (!response.ok) throw new Error(`Erreur API ${response.status}`);
  return response.json();
}

export async function apiSend(path, payload, method = "POST") {
  const response = await fetchWithAuthRetry(() =>
    fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withUserPayload(payload))
    })
  );
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `Erreur API ${response.status}`);
    error.upgradeRequired = Boolean(data.upgradeRequired);
    throw error;
  }
  return data;
}
