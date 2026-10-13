const ADMIN_EMAILS = ["bouhouchimira@gmail.com", "ablexpertrenov@gmail.com"];

export function isAdminEmail(email = "") {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function nowIso() {
  return new Date().toISOString();
}
