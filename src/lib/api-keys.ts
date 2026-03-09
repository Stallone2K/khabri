import crypto from "crypto";

const KEY_PREFIX = "khabri_";

/**
 * Generate a new API key.
 * Returns { rawKey, hashedKey, prefix }.
 * The rawKey is shown to the user ONCE and never stored.
 */
export function generateApiKey(): {
  rawKey: string;
  hashedKey: string;
  prefix: string;
} {
  const randomPart = crypto.randomBytes(16).toString("hex"); // 32 hex chars
  const rawKey = `${KEY_PREFIX}${randomPart}`;
  const hashedKey = hashApiKey(rawKey);
  const prefix = rawKey.substring(0, KEY_PREFIX.length + 8); // "khabri_a1b2c3d4"
  return { rawKey, hashedKey, prefix };
}

/**
 * Hash a raw API key using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Valid scopes for API keys.
 */
export const VALID_SCOPES = [
  "trends",
  "signals",
  "anomalies",
  "narratives",
  "geo",
  "analytics",
  "webhooks",
] as const;

export type ApiScope = (typeof VALID_SCOPES)[number];

/**
 * Validate that all provided scopes are valid.
 */
export function validateScopes(scopes: string[]): scopes is ApiScope[] {
  return scopes.every((s) =>
    (VALID_SCOPES as readonly string[]).includes(s),
  );
}
