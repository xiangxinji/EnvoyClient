import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface UserRecord {
  username: string;
  password: string;
  role: "leader" | "member";
  createdAt: number;
}

const USERS_PATH = join(homedir(), ".envoy", "users.json");

export async function loadUsers(): Promise<UserRecord[]> {
  try {
    const raw = await readFile(USERS_PATH, "utf-8");
    return JSON.parse(raw) as UserRecord[];
  } catch {
    return [];
  }
}

export async function saveUsers(users: UserRecord[]): Promise<void> {
  const dir = join(homedir(), ".envoy");
  await mkdir(dir, { recursive: true });
  await writeFile(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}

export async function authenticate(username: string, password: string): Promise<UserRecord | null> {
  const users = await loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user || user.password !== password) return null;
  return user;
}
