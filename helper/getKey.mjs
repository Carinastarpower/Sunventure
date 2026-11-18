import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let cached = null;
let refreshPromise = null;

function redact(value) {
  return String(value ?? "")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted key]");
}

function keyError(message, fix) {
  const error = new Error(redact(message));
  error.fix = redact(fix);
  return error;
}

async function readConfig() {
  const values = { url: process.env.KEYGEN_URL, token: process.env.KEYGEN_TOKEN };
  if (values.url && values.token) return values;

  let envText;
  try {
    envText = await fs.readFile(path.join(projectRoot, ".env"), "utf8");
  } catch {
    throw keyError("MindDo key settings are missing.", "Add KEYGEN_URL and KEYGEN_TOKEN to the server environment.");
  }
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !values[match[1].toLowerCase().replace("keygen_", "")]) {
      const name = match[1].toLowerCase().replace("keygen_", "");
      if (name === "url" || name === "token") values[name] = match[2].trim();
    }
  }
  if (!values.url || !values.token || values.url === "paste-here" || values.token === "paste-here") {
    throw keyError("MindDo key settings are not ready.", "Put the real KEYGEN_URL and KEYGEN_TOKEN in .env or the server environment.");
  }
  return values;
}

async function requestKey() {
  const { url, token } = await readConfig();
  let response;
  try {
    response = await fetch(`${url.replace(/\/+$/, "")}/api/lookup-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    throw keyError("MindDo could not be reached.", "Check KEYGEN_URL and the server's network connection.");
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    // The status below still gives the user a useful fix.
  }
  if (!response.ok) {
    throw keyError(body?.error?.message || body?.message || `MindDo returned HTTP ${response.status}.`, "Check KEYGEN_URL and KEYGEN_TOKEN, then try again.");
  }
  if (typeof body.apiKey !== "string" || !body.apiKey || typeof body.expiresAt !== "string") {
    throw keyError("MindDo returned an incomplete key response.", "Ask MindDo for a response containing apiKey and expiresAt.");
  }
  const expiresAtMs = Date.parse(body.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw keyError("MindDo returned an expired key.", "Check the MindDo key service and try again.");
  }
  cached = { apiKey: body.apiKey, expiresAtMs };
  return cached.apiKey;
}

export async function getKey({ forceRefresh = false } = {}) {
  if (!forceRefresh && cached && cached.expiresAtMs > Date.now() + 5000) return cached.apiKey;
  if (!refreshPromise) {
    refreshPromise = requestKey().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function invalidateKey(apiKey) {
  if (cached?.apiKey === apiKey) cached = null;
}

export function isInvalidOpenAIKeyError(error) {
  return error?.status === 401 || error?.status === 403 || /invalid api key|incorrect api key|authentication failed|unauthorized/i.test(error?.message || "");
}

export function toSafeError(error, fallbackMessage, fallbackFix) {
  return {
    message: redact(error?.message || fallbackMessage),
    fix: redact(error?.fix || fallbackFix),
  };
}
