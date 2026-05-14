import type { Hono } from "hono";
import { randomBytes } from "node:crypto";
import {
  loadUsers,
  saveUsers,
  authenticate,
  hashPassword,
  type UserRecord,
} from "../user-registry.js";
import { getPublicKey, decryptWithPrivateKey } from "../crypto.js";

const clientSessions = new Map<string, { userId: string; role: string; createdAt: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000;

export function validateClientToken(token: string): boolean {
  const session = clientSessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    clientSessions.delete(token);
    return false;
  }
  return true;
}

export default function userRoutes(app: Hono) {
  app.get("/api/public-key", (c) => {
    return c.json({ key: getPublicKey() });
  });

  app.get("/api/users", async (c) => {
    const users = await loadUsers();
    return c.json(users.map((u) => ({ username: u.username, role: u.role, responsibilities: u.responsibilities ?? "", createdAt: u.createdAt })));
  });

  app.post("/api/users", async (c) => {
    const body = await c.req.json<{ username?: string; password?: string; role?: string; responsibilities?: string }>();
    const username = body.username?.trim();
    const encryptedPassword = body.password;
    const role = body.role === "leader" ? "leader" : "member";
    const responsibilities = body.responsibilities?.trim() ?? "";
    if (!username || !encryptedPassword) return c.json({ error: "username and password are required" }, 400);

    const password = decryptWithPrivateKey(encryptedPassword);

    const users = await loadUsers();
    if (users.some((u) => u.username === username)) return c.json({ error: "user already exists" }, 409);

    const hashed = await hashPassword(password);
    const user: UserRecord = { username, password: hashed, role, responsibilities, createdAt: Date.now() };
    users.push(user);
    await saveUsers(users);

    console.log(`[user-created] ${username} (${role})`);
    return c.json({ username, role, responsibilities, createdAt: user.createdAt }, 201);
  });

  app.delete("/api/users/:username", async (c) => {
    const username = c.req.param("username");
    let users = await loadUsers();
    const before = users.length;
    users = users.filter((u) => u.username !== username);
    if (users.length === before) return c.json({ error: "user not found" }, 404);
    await saveUsers(users);
    console.log(`[user-deleted] ${username}`);
    return c.json({ ok: true });
  });

  app.post("/api/auth", async (c) => {
    const body = await c.req.json<{ username?: string; password?: string }>();
    const username = body.username?.trim();
    const encryptedPassword = body.password;
    if (!username || !encryptedPassword) return c.json({ error: "username and password are required" }, 400);

    const password = decryptWithPrivateKey(encryptedPassword);

    const user = await authenticate(username, password);
    if (!user) return c.json({ error: "invalid credentials" }, 401);

    const token = randomBytes(32).toString("hex");
    clientSessions.set(token, { userId: user.username, role: user.role, createdAt: Date.now() });

    return c.json({ ok: true, username: user.username, role: user.role, token });
  });
}
