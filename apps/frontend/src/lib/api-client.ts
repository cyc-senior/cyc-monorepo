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

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export interface CacheOptions {
  cacheMinutes?: number;
  forceRefresh?: boolean;
}

/**
 * Wraps a fetch function with an in-memory TTL cache (in minutes) and in-flight deduplication.
 *
 * @param fetchFn - Base fetch function (e.g. `apiFetch`)
 * @returns A wrapped fetcher accepting a `cacheMinutes` parameter or option
 *
 * @example
 * ```ts
 * const fetchCached = wrapFetchWithCache(apiFetch);
 * // Cache for 5 minutes
 * const user = await fetchCached<User>('/users/me', {}, 5);
 * // Or via options
 * const user = await fetchCached<User>('/users/me', { cacheMinutes: 5 });
 * ```
 */
export function wrapFetchWithCache<
  F extends (endpoint: string, options?: any) => Promise<any>
>(fetchFn: F) {
  return async function cachedFetch<T = any>(
    endpoint: string,
    options?: Parameters<F>[1] & CacheOptions,
    cacheMinutesParam?: number
  ): Promise<T> {
    const cacheMinutes =
      cacheMinutesParam !== undefined
        ? cacheMinutesParam
        : (options as CacheOptions)?.cacheMinutes ?? 0;

    const forceRefresh = (options as CacheOptions)?.forceRefresh ?? false;

    // If no cache duration requested or force refresh is set, bypass cache
    if (cacheMinutes <= 0 || forceRefresh) {
      return fetchFn(endpoint, options);
    }

    const method = options?.method?.toUpperCase() || "GET";
    const cacheKey = `${method}:${endpoint}:${options?.body ? String(options.body) : ""}`;

    // 1. Check if valid unexpired cache exists
    const cached = memoryCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    // 2. In-flight request deduplication (prevent duplicate network requests fired simultaneously)
    const existingInFlight = inFlightRequests.get(cacheKey);
    if (existingInFlight) {
      return existingInFlight as Promise<T>;
    }

    // 3. Perform network call and cache the result
    const fetchPromise = (async () => {
      try {
        const data = await fetchFn(endpoint, options);
        memoryCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + cacheMinutes * 60 * 1000,
        });
        return data;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  };
}

/**
 * Pre-wrapped `apiFetch` with in-memory TTL caching.
 */
export const apiFetchWithCache = wrapFetchWithCache(apiFetch);

/**
 * Clears cached entries. If `endpointPrefix` is provided, clears entries matching that endpoint.
 */
export function clearApiCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(endpointPrefix)) {
      memoryCache.delete(key);
    }
  }
}


