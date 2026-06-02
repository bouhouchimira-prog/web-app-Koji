const textFixes = [
  ["ÃƒÂ¯", "Ã¯"],
  ["ÃƒÂ©", "Ã©"],
  ["ÃƒÂ¨", "Ã¨"],
  ["ÃƒÂª", "Ãª"],
  ["ÃƒÂ ", "Ã "],
  ["ÃƒÂ¢", "Ã¢"],
  ["ÃƒÂ´", "Ã´"],
  ["ÃƒÂ§", "Ã§"],
  ["Ãƒâ€”", "Ã—"],
  ["Ã¢â‚¬â€œ", "â€“"],
  ["Ã¢â‚¬â„¢", "â€™"],
  ["Ã¢â‚¬Å“", "â€œ"],
  ["Ã¢â‚¬Â", "â€"],
  ["Ã‚Â²", "Â²"],
  ["Ã‚Â°", "Â°"],
  ["Ã¯", "ï"],
  ["Ã©", "é"],
  ["Ãè", "è"],
  ["Ã¨", "è"],
  ["Ãª", "ê"],
  ["Ã ", "à"],
  ["Ã¢", "â"],
  ["Ã´", "ô"],
  ["Ã§", "ç"],
  ["Ã‰", "É"],
  ["Ã€", "À"],
  ["Ã‡", "Ç"],
  ["Ã—", "×"],
  ["Â²", "²"],
  ["Â°", "°"],
  ["Â ", " "],
  ["â€“", "–"],
  ["â€”", "—"],
  ["â€™", "'"],
  ["â€œ", "\""],
  ["â€", "\""],
  ["â€¦", "..."],
  ["Â", ""]
];

function replaceKnownSequences(value) {
  return textFixes.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

function decodeMojibakeOnce(value) {
  if (!/[ÃÂâ]/.test(value) || typeof TextDecoder === "undefined") return value;
  try {
    const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 255));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded.includes("�") ? value : decoded;
  } catch {
    return value;
  }
}

export function fixText(value) {
  if (typeof value !== "string") return value;
  let text = value;
  for (let index = 0; index < 4; index += 1) {
    const next = replaceKnownSequences(decodeMojibakeOnce(replaceKnownSequences(text)));
    if (next === text) break;
    text = next;
  }
  return text.normalize("NFC");
}

export function fixObjectText(value) {
  if (Array.isArray(value)) return value.map(fixObjectText);
  if (!value || typeof value !== "object") return fixText(value);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, fixObjectText(entry)]));
}
