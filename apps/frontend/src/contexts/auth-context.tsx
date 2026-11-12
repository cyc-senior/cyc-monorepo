"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { User } from "@/types/auth";
import {
  apiFetch,
  refreshAccessToken,
  setAccessToken as setClientAccessToken,
} from "@/lib/api-client";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => void;
  setSession: (token: string) => Promise<User | null>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider component for managing authentication state and session operations.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (): Promise<User | null> => {
    try {
      const profile = await apiFetch<User>("/users/me");
      setUser(profile);
      return profile;
    } catch (err: unknown) {
      // Clear user only when the response explicitly indicates unauthenticated
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 401 || err.response?.status === 403)
      ) {
        setUser(null);
        setClientAccessToken(null);
        setToken(null);
      }
      return null;
    }
  }, []);

  const setSession = useCallback(
    async (newToken: string): Promise<User | null> => {
      setClientAccessToken(newToken);
      setToken(newToken);
      return await fetchProfile();
    },
    [fetchProfile]
  );

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      setToken(refreshed);
    }
    return await fetchProfile();
  }, [fetchProfile]);

  const loginWithGoogle = useCallback(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${apiUrl}/auth/google`);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiFetch("/auth/logout", {
      method: "POST",
      data: {},
    });
    setClientAccessToken(null);
    setToken(null);
    setUser(null);
    router.push("/signin");
  }, [router]);

  // Initial authentication check on application mount
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Try refreshing access token via HTTP-only refresh cookie
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken && mounted) {
          setToken(refreshedToken);
          await fetchProfile();
        }
      } catch {
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: token,
        isLoading,
        isAuthenticated: !!user,
        loginWithGoogle,
        setSession,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication state and session methods.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

