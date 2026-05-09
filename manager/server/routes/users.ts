import type { Hono } from "hono";
import {
  loadUsers,
  saveUsers,
  authenticate,
  type UserRecord,
} from "../user-registry.js";

export default function userRoutes(app: Hono) {
  app.get("/api/users", async (c) => {
    const users = await loadUsers();
    return c.json(users.map((u) => ({ username: u.username, role: u.role, createdAt: u.createdAt })));
  });

  app.post("/api/users", async (c) => {
    const body = await c.req.json<{ username?: string; password?: string; role?: string }>();
    const username = body.username?.trim();
    const password = body.password;
    const role = body.role === "leader" ? "leader" : "member";
    if (!username || !password) return c.json({ error: "username and password are required" }, 400);

    const users = await loadUsers();
    if (users.some((u) => u.username === username)) return c.json({ error: "user already exists" }, 409);

    const user: UserRecord = { username, password, role, createdAt: Date.now() };
    users.push(user);
    await saveUsers(users);

    console.log(`[user-created] ${username} (${role})`);
    return c.json({ username, role, createdAt: user.createdAt }, 201);
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
    const password = body.password;
    if (!username || !password) return c.json({ error: "username and password are required" }, 400);

    const user = await authenticate(username, password);
    if (!user) return c.json({ error: "invalid credentials" }, 401);
    return c.json({ ok: true, username: user.username, role: user.role });
  });
}
