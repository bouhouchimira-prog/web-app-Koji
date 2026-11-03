export function required(value, fieldName = "Ce champ") {
  if (value === undefined || value === null) return `${fieldName} est requis.`;
  if (typeof value === "string" && value.trim() === "") return `${fieldName} est requis.`;
  if (Array.isArray(value) && value.length === 0) return `${fieldName} est requis.`;
  return null;
}

export function maxLength(value, max, fieldName = "Ce champ") {
  if (typeof value !== "string") return null;
  if (value.length > max) return `${fieldName} ne doit pas dépasser ${max} caractères.`;
  return null;
}

export function isEmail(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) return "Adresse email invalide.";
  return null;
}

export function validateFields(body, rules) {
  for (const [field, validators] of Object.entries(rules)) {
    const value = body[field];
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
  }
  return null;
}
