let _managerUrl = "http://localhost:8080";
let _clientToken = "";
let _credentials: { username: string; encryptedPassword: string } | null = null;
let _reloginPromise: Promise<string | null> | null = null;

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

export function setCredentials(username: string, encryptedPassword: string) {
  _credentials = { username, encryptedPassword };
}

export function clearCredentials() {
  _credentials = null;
  _clientToken = "";
}

export function apiUrl(path: string): string {
  return `${_managerUrl}${path}`;
}

async function tryRelogin(): Promise<string | null> {
  if (!_credentials || !_managerUrl) return null;
  try {
    const res = await fetch(`${_managerUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: _credentials.username,
        password: _credentials.encryptedPassword,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
      _clientToken = data.token;
      return data.token;
    }
    return null;
  } catch (e) {
    console.warn("[tryRelogin] failed:", e);
    return null;
  }
}

export async function managerFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(_clientToken ? { "X-Envoy-Token": _clientToken } : {}),
    },
  });

  if (res.status === 401) {
    if (!_reloginPromise) {
      _reloginPromise = tryRelogin();
    }
    const newToken = await _reloginPromise;
    _reloginPromise = null;

    if (newToken) {
      // FormData/Blob bodies cannot be re-sent after the first fetch consumes them
      if (init?.body && typeof init.body !== "string") {
        _credentials = null;
        _clientToken = "";
        window.location.hash = "#/";
        throw new Error("Session expired during upload");
      }
      const retryRes = await fetch(apiUrl(path), {
        ...init,
        headers: {
          ...(init?.headers || {}),
          "X-Envoy-Token": newToken,
        },
      });
      if (retryRes.ok) return retryRes;
    }

    _credentials = null;
    _clientToken = "";
    window.location.hash = "#/";
    throw new Error("Session expired");
  }

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
