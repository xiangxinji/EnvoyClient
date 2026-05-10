const BASE = "/api";

export interface TeamInfo {
  name: string;
  port: number;
  createdAt: number;
  status: "running" | "stopped";
  stats: {
    totalClients: number;
    onlineClients: number;
    totalTasks: number;
    tasksByStatus: Record<string, number>;
  } | null;
}

export interface DashboardData {
  totalTeams: number;
  totalOnline: number;
  totalTasks: number;
  taskSummary: Record<string, number>;
}

export interface MemberInfo {
  id: string;
  role: "client" | "watcher";
  status: "online" | "offline";
  connectedAt: number;
  lastHeartbeat: number;
  queueLength: number;
  uptime: number;
}

export interface TaskInfo {
  id: string;
  createBy: string;
  subscribe: string[];
  content: string;
  mode: "serial" | "parallel";
  status: "pending" | "running" | "completed" | "failed";
  resources: { type: string; by: string; data: unknown }[];
  createdAt: number;
}

export interface UserInfo {
  username: string;
  role: "leader" | "member";
  createdAt: number;
}

async function rsaEncrypt(publicKeyPem: string, plaintext: string): Promise<string> {
  const binaryDer = pemToArrayBuffer(publicKeyPem);
  const key = await crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN.*?-----/, "").replace(/-----END.*?-----/, "").replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getPublicKey(): Promise<string> {
  const res = await fetch(`${BASE}/public-key`);
  if (!res.ok) throw new Error("Failed to fetch public key");
  const data = await res.json();
  return data.key as string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  getDashboard: () => request<DashboardData>("/dashboard"),
  getTeams: () => request<TeamInfo[]>("/teams"),
  getTeam: (name: string) => request<TeamInfo>(`/teams/${name}`),
  createTeam: (name: string, port?: number) =>
    request<TeamInfo>("/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, port }),
    }),
  deleteTeam: (name: string) =>
    request<{ ok: boolean }>(`/teams/${name}`, { method: "DELETE" }),
  getMembers: (name: string) => request<MemberInfo[]>(`/teams/${name}/members`),
  getTasks: (name: string) => request<TaskInfo[]>(`/teams/${name}/tasks`),
  getUsers: () => request<UserInfo[]>("/users"),
  createUser: async (username: string, password: string, role: "leader" | "member") => {
    const pubKey = await getPublicKey();
    const encrypted = await rsaEncrypt(pubKey, password);
    return request<UserInfo>("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: encrypted, role }),
    });
  },
  deleteUser: (username: string) =>
    request<{ ok: boolean }>(`/users/${username}`, { method: "DELETE" }),
  auth: async (username: string, password: string) => {
    const pubKey = await getPublicKey();
    const encrypted = await rsaEncrypt(pubKey, password);
    return request<{ ok: boolean; username: string; role: "leader" | "member" }>("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: encrypted }),
    });
  },
  adminAuth: async (username: string, password: string) => {
    const pubKey = await getPublicKey();
    const encrypted = await rsaEncrypt(pubKey, password);
    return request<{ ok: boolean; token: string }>("/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: encrypted }),
    });
  },
  adminLogout: () =>
    request<{ ok: boolean }>("/admin/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}` },
    }),
  getAdminProfile: () =>
    request<{ username: string }>("/admin/profile", {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}` },
    }),
  updateAdmin: async (username: string, password: string) => {
    const pubKey = await getPublicKey();
    const encrypted = await rsaEncrypt(pubKey, password);
    return request<{ ok: boolean }>("/admin/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
      },
      body: JSON.stringify({ username, password: encrypted }),
    });
  },
};
