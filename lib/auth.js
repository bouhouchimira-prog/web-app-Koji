import crypto from "node:crypto";

export const ADMIN_EMAILS = ["bouhouchimira@gmail.com", "ablexpertrenov@gmail.com", "abaqueduc@gmail.com"];

export function isAdminEmail(email = "") {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function makeActivationToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function makeResetToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function activationExpires(hours = 24) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export function resetExpires(hours = 2) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}
