export async function apiGet(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Erreur API ${response.status}`);
  return response.json();
}

export async function apiSend(path, payload, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Erreur API ${response.status}`);
  return data;
}
