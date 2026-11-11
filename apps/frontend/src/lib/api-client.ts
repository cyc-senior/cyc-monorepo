import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { AuthTokens } from "@/types/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

let inMemoryToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Cross-tab coordination channel for synchronized token refreshes.
 */
const authChannel: BroadcastChannel | null =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("cyc_auth_channel")
    : null;

if (authChannel) {
  authChannel.onmessage = (event: MessageEvent) => {
    if (event.data?.type === "TOKEN_REFRESHED" && event.data.token) {
      inMemoryToken = event.data.token;
    }
  };
}

/**
 * Retrieves the current in-memory access token.
 */
export function getAccessToken(): string | null {
  return inMemoryToken;
}

/**
 * Updates the in-memory access token.
 */
export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

/**
 * Extended Axios request configuration supporting CYC options.
 */
export interface CustomRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  cacheMinutes?: number;
  forceRefresh?: boolean;
  body?: unknown; // Fetch-compatible alias for data
  _retry?: boolean;
}

/**
 * Base Axios instance for CYC API.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Attempts to obtain a new access token using the HTTP-only refresh cookie.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      // Use raw axios to prevent interceptor loops
      const response = await axios.post<AuthTokens>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const token = response.data.accessToken;
      setAccessToken(token);
      authChannel?.postMessage({ type: "TOKEN_REFRESHED", token });
      return token;
    } catch (err: unknown) {
      // Only wipe session if the server explicitly reports unauthenticated (401/403)
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 401 || err.response?.status === 403)
      ) {
        setAccessToken(null);
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Request Interceptor: attach Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig & { skipAuth?: boolean }) => {
    if (!config.skipAuth && inMemoryToken) {
      config.headers.set("Authorization", `Bearer ${inMemoryToken}`);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: handle 401 transparent token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean; skipAuth?: boolean })
      | undefined;

    if (
      originalRequest &&
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuth
    ) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

// ==========================================
// Caching & Parameter Handling Layer
// ==========================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Generates a deterministic, sorted cache key.
 * Parameter order is normalized (`?page=1&limit=10` === `?limit=10&page=1`),
 * while different parameters produce distinct keys (`page=1` !== `page=2`).
 */
function buildCacheKey(
  endpoint: string,
  config?: CustomRequestConfig
): string {
  const method = (config?.method || "GET").toUpperCase();
  const [path, queryString] = endpoint.split("?");
  const searchParams = new URLSearchParams(queryString || "");

  if (config?.params) {
    if (config.params instanceof URLSearchParams) {
      config.params.forEach((val, key) => searchParams.set(key, val));
    } else {
      Object.entries(config.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.set(key, String(val));
        }
      });
    }
  }

  // Sort query parameters alphabetically for consistent keys
  searchParams.sort();
  const sortedQuery = searchParams.toString();
  const normalizedUrl = sortedQuery ? `${path}?${sortedQuery}` : path;

  let serializedBody = "";
  const payload = config?.data ?? config?.body;
  if (payload) {
    serializedBody =
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload);
  }

  return `${method}:${normalizedUrl}:${serializedBody}`;
}

/**
 * Wraps an API request with an in-memory TTL cache (in minutes) and in-flight deduplication.
 *
 * @param requestFn - Function returning a Promise (e.g. `apiFetch`)
 * @returns A cached request function accepting `cacheMinutes`
 *
 * @example
 * ```ts
 * const fetchCached = wrapFetchWithCache(apiFetch);
 * const user = await fetchCached<User>('/users/me', {}, 5);
 * const projects = await fetchCached('/projects', { params: { page: 1, limit: 10 } }, 10);
 * ```
 */
export function wrapFetchWithCache<
  F extends (endpoint: string, config?: CustomRequestConfig) => Promise<unknown>
>(requestFn: F) {
  return async function cachedRequest<T = unknown>(
    endpoint: string,
    config?: Parameters<F>[1] & { cacheMinutes?: number; forceRefresh?: boolean },
    cacheMinutesParam?: number
  ): Promise<T> {
    const cacheMinutes =
      cacheMinutesParam !== undefined
        ? cacheMinutesParam
        : config?.cacheMinutes ?? 0;

    const forceRefresh = config?.forceRefresh ?? false;

    // Bypass cache if no duration or forceRefresh requested
    if (cacheMinutes <= 0 || forceRefresh) {
      const directData = await requestFn(endpoint, config);
      return directData as T;
    }

    const cacheKey = buildCacheKey(endpoint, config);

    // 1. Return unexpired cached response if available
    const cached = memoryCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    // 2. In-flight request deduplication (share existing pending request)
    const existingInFlight = inFlightRequests.get(cacheKey);
    if (existingInFlight) {
      return (await existingInFlight) as T;
    }

    // 3. Perform network call and cache the response
    const fetchPromise = (async (): Promise<T> => {
      try {
        const data = (await requestFn(endpoint, config)) as T;
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
 * Standard fetch helper returning `data` directly (backwards-compatible with previous `apiFetch`).
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  config: CustomRequestConfig = {}
): Promise<T> {
  const { body, data, ...rest } = config;
  const response = await api.request<T>({
    url: endpoint,
    data: data ?? body,
    ...rest,
  });
  return response.data;
}

/**
 * Pre-wrapped `apiFetch` with in-memory TTL caching.
 */
export const apiFetchWithCache = wrapFetchWithCache(apiFetch);

/**
 * Invalidate specific endpoint cache or clear all cache.
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
