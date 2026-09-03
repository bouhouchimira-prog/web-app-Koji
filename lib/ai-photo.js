// Shared helper for routes that send a stored base64 data-URL photo to the
// Anthropic API as an image content block (app/api/estimer-devis/route.js,
// app/api/radar-assistant/route.js).
export function parsePhoto(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}
