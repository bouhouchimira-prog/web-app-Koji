// Structured logger for Koji (web). Emits JSON in production (for Vercel
// log drains / Sentry) and pretty lines in development. Never logs secrets:
// callers must redact tokens, passwords and API keys before passing values.
const isProd = process.env.NODE_ENV === "production";

function redact(value) {
  if (typeof value !== "string") return value;
  // Redact obvious secrets (tokens, keys, passwords).
  if (/^(sk_|pk_|rk_|eyJ|ghp_|gho_|xoxb-)/.test(value)) return "[REDACTED]";
  if (value.length > 64 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return "[REDACTED]";
  return value;
}

function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return redact(obj);
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (lower.includes("password") || lower.includes("token") || lower.includes("secret") || lower.includes("apikey") || lower.includes("api_key")) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return obj;
}

function emit(level, message, meta) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: sanitize(meta) } : {})
  };
  const line = isProd ? JSON.stringify(payload) : `[${level.toUpperCase()}] ${message}${meta ? " " + JSON.stringify(sanitize(meta)) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg, meta) => emit("debug", msg, meta),
  info: (msg, meta) => emit("info", msg, meta),
  warn: (msg, meta) => emit("warn", msg, meta),
  error: (msg, meta) => emit("error", msg, meta),
};

// Express/Next-style request logger. Call at the start of a route handler:
//   const log = requestLogger(request, "POST /api/foo");
//   ... on success: log.done({ userId });
//   ... on error: log.fail(err);
export function requestLogger(request, route) {
  const start = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);
  return {
    requestId,
    done: (meta = {}) => logger.info(`${route} OK`, { requestId, durationMs: Date.now() - start, ...meta }),
    fail: (err, meta = {}) => logger.error(`${route} FAIL`, { requestId, durationMs: Date.now() - start, error: String(err?.message || err), ...meta })
  };
}
