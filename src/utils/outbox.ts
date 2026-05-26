import { isTauri, safeInvoke } from "./platform";

interface OutboxEntry {
  teamName: string;
  taskId: string;
  from: string;
  success: boolean;
  data?: unknown;
  error?: string;
  trace?: unknown[];
}

function outboxPath(teamName: string, taskId: string): string {
  return `~/outbox/${teamName}/${taskId}.json`;
}

function outboxDir(teamName: string): string {
  return `~/outbox/${teamName}`;
}

export async function writeOutbox(teamName: string, taskId: string, result: Omit<OutboxEntry, "teamName" | "taskId">): Promise<void> {
  if (!isTauri) return;
  const entry: OutboxEntry = { teamName, taskId, ...result };
  await safeInvoke("file_write", {
    path: outboxPath(teamName, taskId),
    content: JSON.stringify(entry),
  });
}

export async function deleteOutbox(teamName: string, taskId: string): Promise<void> {
  if (!isTauri) return;
  await safeInvoke("file_delete", { path: outboxPath(teamName, taskId) });
}

export async function scanOutbox(teamName: string): Promise<OutboxEntry[]> {
  if (!isTauri) return [];
  const result = await safeInvoke<{ files: string[] }>("list_dir", { path: outboxDir(teamName) });
  if (!result?.files?.length) return [];

  const entries: OutboxEntry[] = [];
  for (const file of result.files) {
    if (!file.endsWith(".json")) continue;
    const readResult = await safeInvoke<{ content: string }>("file_read", {
      path: `${outboxDir(teamName)}/${file}`,
    });
    if (readResult?.content) {
      try {
        entries.push(JSON.parse(readResult.content) as OutboxEntry);
      } catch {
        // corrupted file, skip
      }
    }
  }
  return entries;
}

export async function submitWithRetry(
  submitFn: () => Promise<void>,
  maxRetries = 3,
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await submitFn();
      return true;
    } catch (e) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error("[outbox] submit failed after retries:", e);
      }
    }
  }
  return false;
}
