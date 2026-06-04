import { safeInvoke, isTauri } from "../utils/platform";
import { managerFetch, getClientToken } from "../api";

interface GlossaryEntry {
  term: string;
  definition: string;
}

function toSystemMarkdown(entries: GlossaryEntry[]): string {
  let md = "---\nname: 系统词汇表\ndescription: 团队统一术语定义（全局+团队级合并）\n---\n";
  for (const e of entries) {
    md += `\n## ${e.term}\n${e.definition}\n`;
  }
  return md;
}

const PERSONAL_MD = "---\nname: 个人词汇表\ndescription: 个人自定义术语定义\n---\n";

export async function syncGlossary(teamName: string, username: string): Promise<void> {
  if (!isTauri) return;

  try {
    const token = getClientToken();
    const res = await managerFetch(`/api/glossary?team=${encodeURIComponent(teamName)}`, {
      headers: { ...(token ? { "X-Envoy-Token": token } : {}) },
    });
    if (!res.ok) return;

    const entries = (await res.json()) as GlossaryEntry[];
    const systemMd = toSystemMarkdown(entries);
    const systemPath = `~/brains/${username}/glossary/system.md`;

    await safeInvoke("file_write", { path: systemPath, content: systemMd, workingDir: null });

    // Ensure personal glossary exists (never overwrite)
    const personalPath = `~/brains/${username}/glossary/personal.md`;
    const readResult = await safeInvoke("file_read", { path: personalPath, workingDir: null });
    if (!readResult) {
      await safeInvoke("file_write", { path: personalPath, content: PERSONAL_MD, workingDir: null });
    }
  } catch {
    // Silent: glossary sync must not block connection flow
  }
}
