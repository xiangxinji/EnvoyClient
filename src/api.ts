let _managerUrl = "http://localhost:8080";
let _clientToken = "";

export function setManagerUrl(url: string) {
  _managerUrl = url;
}

export function getManagerUrl(): string {
  return _managerUrl;
}

export function setClientToken(token: string) {
  _clientToken = token;
}

export function getClientToken(): string {
  return _clientToken;
}

export function apiUrl(path: string): string {
  return `${_managerUrl}${path}`;
}

export async function managerFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(_clientToken ? { "X-Envoy-Token": _clientToken } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res;
}

export async function managerPost(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return managerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export async function managerDelete(path: string, headers?: Record<string, string>): Promise<Response> {
  return managerFetch(path, { method: "DELETE", headers });
}

export async function managerUpload(path: string, formData: FormData, headers?: Record<string, string>): Promise<Response> {
  return managerFetch(path, {
    method: "POST",
    headers,
    body: formData,
  });
}
