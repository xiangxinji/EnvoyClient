import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface TeamRecord {
  name: string;
  port: number;
  createdAt: number;
}

const REGISTRY_PATH = join(homedir(), ".envoy", "teams.json");

export async function ensureRegistryDir(): Promise<void> {
  const dir = join(homedir(), ".envoy");
  await mkdir(dir, { recursive: true });
}

export async function loadRegistry(): Promise<TeamRecord[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, "utf-8");
    return JSON.parse(raw) as TeamRecord[];
  } catch {
    return [];
  }
}

export async function saveRegistry(records: TeamRecord[]): Promise<void> {
  await ensureRegistryDir();
  await writeFile(REGISTRY_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export function allocatePort(records: TeamRecord[], start = 3001): number {
  const usedPorts = new Set(records.map((r) => r.port));
  let port = start;
  while (usedPorts.has(port)) port++;
  return port;
}
