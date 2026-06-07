import { getManagerUrl, managerFetch } from "../api";
import { rsaEncrypt } from "../utils/rsa";

/**
 * Encrypt a plaintext password using the manager's RSA public key.
 * If the password already starts with "ENC:", returns it as-is (stored credential).
 */
export async function encryptPassword(base: string, password: string): Promise<string> {
  if (password.startsWith("ENC:")) return password.slice(4);
  const keyRes = await fetch(`${base}/api/public-key`);
  if (!keyRes.ok) throw new Error("Failed to fetch public key");
  const { key: pubKey } = await keyRes.json();
  return rsaEncrypt(pubKey, password);
}

/**
 * Login to the manager and return auth data (role, token).
 */
export async function login(base: string, username: string, password: string): Promise<{ role: string; token: string }> {
  const encrypted = await encryptPassword(base, password);
  const res = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: encrypted }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error || "Login failed");
  }
  return res.json() as Promise<{ role: string; token: string }>;
}

/**
 * Verify a password against the manager without creating a session.
 * Used by the lock screen for re-authentication.
 */
export async function verifyPassword(username: string, password: string): Promise<void> {
  const base = getManagerUrl();
  const encrypted = await encryptPassword(base, password);
  await managerFetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: encrypted }),
  });
}
