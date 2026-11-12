# CYC Frontend

Frontend application for the CYC interactive A/B testing and design iteration platform. Built with Next.js (App Router), React, Tailwind CSS, and Axios.

---

## Tech Stack

* **Framework:** [Next.js](https://nextjs.org) (App Router, Turbopack)
* **UI Library:** [React](https://react.dev)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com)
* **Components:** [Radix UI](https://www.radix-ui.com) & custom shadcn-inspired components
* **HTTP Client:** [Axios](https://axios-http.com) with automatic JWT refresh interceptors & in-memory caching
* **Icons:** [Lucide React](https://lucide.dev)

---

## Getting Started

### 1. Environment Setup

Create `.env.local` by copying `.env.example`:

```bash
cp .env.example .env.local
```

Default contents:
```env
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 2. Development

Run the frontend app standalone or from the monorepo root:

```bash
# From monorepo root (starts both frontend on :3000 and backend on :4000)
pnpm dev

# Or run frontend only:
pnpm --filter frontend dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Directory Structure & Route Groups

The application uses Next.js **Route Groups** `(...)` to share layouts without modifying clean public URLs:

```
src/
├── app/
│   ├── layout.tsx                      # Root layout (Fonts, Providers, Theme)
│   ├── page.tsx                        # Public landing page (/)
│   │
│   ├── (auth)/                         # Auth Route Group
│   │   ├── layout.tsx                  # Shared brand shell, Navbar variant="auth", mobile notice
│   │   ├── signin/page.tsx             # /signin
│   │   ├── signup/page.tsx             # /signup
│   │   ├── forgot-password/page.tsx    # /forgot-password
│   │   └── auth/callback/page.tsx      # /auth/callback (OAuth session exchange)
│   │
│   ├── (dashboard)/                    # Authenticated Application Group
│   │   ├── layout.tsx                  # Auth Guard (redirects if not logged in) & Dashboard Navbar
│   │   └── dashboard/page.tsx          # /dashboard
│   │
│   └── (legal)/                        # Content & Legal Group
│       ├── layout.tsx                  # Document container & legal navbar
│       ├── privacy/page.tsx            # /privacy
│       └── terms/page.tsx              # /terms
│
├── components/
│   ├── layout/                         # Shell & Navigation (Navbar, Footer)
│   ├── providers.tsx                   # Client Component boundary (<Providers>)
│   ├── ui/                             # Buttons, Cards, Inputs, Dialogs, etc.
│   └── ...
│
├── contexts/
│   └── auth-context.tsx                # AuthProvider & useAuth hook
│
├── lib/
│   ├── api-client.ts                   # Axios instance, token interceptors, TTL cache
│   └── utils.ts                        # Styling utilities (cn helper)
│
└── types/
    └── auth.ts                         # User & Token type contracts
```

---

## Authentication System

Authentication is managed via [`src/contexts/auth-context.tsx`](src/contexts/auth-context.tsx) and backed by Axios interceptors in [`src/lib/api-client.ts`](src/lib/api-client.ts).

### How it Works:
1. **Tokens:**
   * **Access Token:** Stored in memory (15-minute lifespan). Injected into outgoing requests via Axios request interceptor (`Authorization: Bearer <token>`).
   * **Refresh Token:** Stored in a secure `httpOnly` cookie managed by the backend.
2. **App Boot & Session Hydration:**
   * When the app mounts, `AuthProvider` calls `POST /api/auth/refresh` (`withCredentials: true`).
   * If a valid cookie exists, the backend returns a new access token, and the app calls `GET /api/users/me` to load user profile into state.
3. **Transparent 401 Token Refresh:**
   * If an API call fails with `401 Unauthorized`, the Axios response interceptor pauses, calls `/auth/refresh`, updates the in-memory token, and transparently retries the failed request without logging out the user.
4. **Protected Routes:**
   * Pages under `(dashboard)/` automatically verify `user` state. If unauthenticated, they redirect to `/signin`.

### Using `useAuth`:

```tsx
"use client";

import { useAuth } from "@/contexts/auth-context";

export function UserProfile() {
  const { user, isLoading, isAuthenticated, logout, loginWithGoogle } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <button onClick={loginWithGoogle}>Sign in with Google</button>;

  return (
    <div>
      <p>Hello, {user?.name || user?.email}</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

---

## API Client & Caching Guide

The API client is located in [`src/lib/api-client.ts`](src/lib/api-client.ts). It provides an Axios instance, fetch helpers, and an in-memory TTL cache with in-flight deduplication.

### 1. Basic Requests (with Axios)

```ts
import { api, apiFetch } from "@/lib/api-client";

// Using the Axios instance directly:
const res = await api.get("/projects", { params: { limit: 10 } });
console.log(res.data);

// Or using apiFetch (returns response.data directly):
const user = await apiFetch("/users/me");
```

### 2. Cached Requests (`apiFetchWithCache`)

Use `apiFetchWithCache` to cache responses in memory for a given number of minutes.

```ts
import { apiFetchWithCache } from "@/lib/api-client";

// Cache for 5 minutes (passing minutes as 3rd parameter):
const user = await apiFetchWithCache("/users/me", {}, 5);

// Cache with pagination parameters (cached separately per page):
const page1 = await apiFetchWithCache("/projects", {
  params: { page: 1, limit: 10 },
}, 10);

const page2 = await apiFetchWithCache("/projects", {
  params: { page: 2, limit: 10 },
}, 10);
```

#### Key Cache Features:
* **In-Flight Deduplication:** Multiple simultaneous calls to the same endpoint share the same promise — only 1 network request is made.
* **Deterministic Parameter Sorting:** `?page=1&limit=10` and `?limit=10&page=1` produce the exact same cache hit.
* **Different Parameters, Separate Caches:** `page=1` and `page=2` are stored as distinct entries.

### 3. Wrapping Custom Fetchers (`wrapFetchWithCache`)

You can wrap any custom fetch or Axios call with the same caching engine:

```ts
import { wrapFetchWithCache } from "@/lib/api-client";

const cachedFetcher = wrapFetchWithCache(customAsyncFunction);
const data = await cachedFetcher("/analytics", {}, 15); // cached for 15 minutes
```

### 4. Bypassing or Invalidating Cache

```ts
import { apiFetchWithCache, clearApiCache } from "@/lib/api-client";

// Force a fresh network request for a specific call:
const freshData = await apiFetchWithCache("/projects", { forceRefresh: true });

// Invalidate cache after creating or updating a project:
clearApiCache("/projects");

// Clear all cached API entries:
clearApiCache();
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts Next.js dev server on `http://localhost:3000` |
| `pnpm build` | Creates an optimized production build |
| `pnpm start` | Starts the production server |
| `pnpm lint` | Runs ESLint |
