function readStoredUserId() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("koji-user");
    if (!raw) return null;
    return JSON.parse(raw)?.id || null;
  } catch {
    return null;
  }
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
  const response = await fetch(withUserQuery(path), { cache: "no-store" });
  if (!response.ok) throw new Error(`Erreur API ${response.status}`);
  return response.json();
}

export async function apiSend(path, payload, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withUserPayload(payload))
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `Erreur API ${response.status}`);
    error.upgradeRequired = Boolean(data.upgradeRequired);
    throw error;
  }
  return data;
}
