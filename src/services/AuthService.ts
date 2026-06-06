import { getManagerUrl, managerFetch } from "../api";
import { rsaEncrypt } from "../utils/rsa";

/**
 * Verify a password against the manager without creating a session.
 * Used by the lock screen for re-authentication.
 */
export async function verifyPassword(username: string, password: string): Promise<void> {
  const base = getManagerUrl();
  const keyRes = await fetch(`${base}/api/public-key`);
  if (!keyRes.ok) throw new Error("Failed to fetch public key");
  const { key: pubKey } = await keyRes.json();
  const encrypted = await rsaEncrypt(pubKey, password);

  await managerFetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: encrypted }),
  });
}
