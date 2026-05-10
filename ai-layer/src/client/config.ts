import type { AIConfigPublic, ProviderType } from "../shared/types";

export async function getAIConfig(
  baseUrl: string,
  options?: { token?: string },
): Promise<AIConfigPublic> {
  const headers: Record<string, string> = {};
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}/api/ai/config`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to get AI config: ${response.status}`);
  }
  return response.json();
}

export async function updateAIConfig(
  baseUrl: string,
  config: Partial<AIConfigPublic & { apiKey?: string }>,
  options?: { token?: string },
): Promise<AIConfigPublic> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}/api/ai/config`, {
    method: "PUT",
    headers,
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Failed to update AI config: ${response.status}`);
  }
  return response.json();
}

export async function getModels(
  baseUrl: string,
  provider?: ProviderType,
  options?: { token?: string },
): Promise<string[] | { id: string; label: string; models: string[] }[]> {
  const headers: Record<string, string> = {};
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const url = provider
    ? `${baseUrl}/api/ai/models?provider=${provider}`
    : `${baseUrl}/api/ai/models`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to get models: ${response.status}`);
  }
  return response.json();
}

export async function checkAIHealth(
  baseUrl: string,
): Promise<{ configured: boolean; provider: string; model: string }> {
  const response = await fetch(`${baseUrl}/api/ai/health`);
  if (!response.ok) {
    throw new Error(`AI health check failed: ${response.status}`);
  }
  return response.json();
}
