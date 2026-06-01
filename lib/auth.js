import crypto from "node:crypto";

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
