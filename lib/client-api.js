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

// Supabase access token stored at login — authenticates shared-table routes
// under the same RLS rules as the koji-main Flutter app.
function authHeaders() {
  const token = readStoredUser()?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Access tokens expire after ~1h; exchange the refresh token for a new session
// and update the stored user. Returns the refreshed user or null.
async function refreshSession() {
  const user = readStoredUser();
  if (!user?.refreshToken) return null;
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: user.refreshToken })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const updated = {
      ...user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || user.refreshToken
    };
    window.localStorage.setItem("koji-user", JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

function forceRelogin() {
  if (typeof window === "undefined") return;
  const user = readStoredUser();
  window.localStorage.removeItem("koji-user");
  const type = user?.accountType === "particulier" ? "particulier" : "entreprise";
  window.location.assign(`/login?type=${type}`);
}

// Retries a request once after refreshing the session when the Supabase token
// has expired. Only kicks in for sessions that actually carry a token, so the
// worker/client portals (separate auth) are unaffected.
async function fetchWithAuthRetry(makeRequest) {
  let response = await makeRequest();
  if (response.status === 401 && readStoredUser()?.accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await makeRequest();
    } else {
      forceRelogin();
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
    fetch(withUserQuery(path), { cache: "no-store", headers: authHeaders() })
  );
  if (!response.ok) throw new Error(`Erreur API ${response.status}`);
  return response.json();
}

export async function apiSend(path, payload, method = "POST") {
  const response = await fetchWithAuthRetry(() =>
    fetch(path, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
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
