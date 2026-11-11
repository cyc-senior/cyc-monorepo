import { AuthTokens } from "@/types/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

let inMemoryToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return inMemoryToken;
}

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

/**
 * Attempts to obtain a new access token using the HTTP-only refresh cookie.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Empty body if backend reads cookie, or passes empty JSON
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (!res.ok) {
        setAccessToken(null);
        return null;
      }

      const data: AuthTokens = await res.json();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Standard fetch wrapper for CYC Backend.
 * Automatically attaches Authorization header and includes credentials for cross-subdomain cookies.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { skipAuth = false, headers, ...rest } = options;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const requestHeaders = new Headers(headers);

  if (!skipAuth && inMemoryToken) {
    requestHeaders.set("Authorization", `Bearer ${inMemoryToken}`);
  }

  // Ensure credentials (cookies) are passed
  const fetchOptions: RequestInit = {
    ...rest,
    headers: requestHeaders,
    credentials: "include",
  };

  let response = await fetch(url, fetchOptions);

  // If unauthorized and we haven't skipped auth, attempt one token refresh
  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, { ...fetchOptions, headers: requestHeaders });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message ||
        `Request to ${endpoint} failed with status ${response.status}`
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

