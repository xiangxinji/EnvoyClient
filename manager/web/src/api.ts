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
  createUser: (username: string, password: string, role: "leader" | "member") =>
    request<UserInfo>("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    }),
  deleteUser: (username: string) =>
    request<{ ok: boolean }>(`/users/${username}`, { method: "DELETE" }),
  auth: (username: string, password: string) =>
    request<{ ok: boolean; username: string; role: "leader" | "member" }>("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
};
