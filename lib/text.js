const textFixes = [
  ["Ò¯", "�"],
  ["Ò©", "�"],
  ["Ò¨", "�"],
  ["Òª", "�"],
  ["Ò ", "�"],
  ["Ò¢", "�"],
  ["Ò´", "�"],
  ["Ò§", "�"],
  ["Ò�", "�"],
  ["ââ‚¬â€œ", "â€“"],
  ["ââ‚¬â„¢", "â€™"],
  ["����", "�S"],
  ["���", "⬝"],
  ["�²", "²"],
  ["��", "�"],
  ["ï", "ï"],
  ["é", "é"],
  ["��", "�"],
  ["è", "è"],
  ["ê", "ê"],
  ["à", "à"],
  ["â", "â"],
  ["ô", "ô"],
  ["ç", "ç"],
  ["�0", "�"],
  ["ì", "�"],
  ["�!", "�"],
  ["�", "�"],
  ["²", "�"],
  ["°", "°"],
  ["� ", " "],
  ["â€“", "–"],
  ["â€”", "—"],
  ["â€™", "'"],
  ["â€œ", "\""],
  ["â€", "\""],
  ["â€¦", "..."],
  ["�", ""]
];

function replaceKnownSequences(value) {
  return textFixes.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

function decodeMojibakeOnce(value) {
  if (!/[���]/.test(value) || typeof TextDecoder === "undefined") return value;
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
