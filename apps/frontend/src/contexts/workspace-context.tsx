"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth-context";
import { listWorkspaces } from "@/services/workspace.service";
import type { OrganizationRole, Workspace } from "@/types/workspace";

export type { OrganizationRole, Workspace };

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace | null) => void;
  isLoading: boolean;
  isTester: boolean;
  refreshWorkspaces: () => Promise<Workspace[]>;
  setWorkspaceAvatar: (workspaceId: string, avatarUrl: string) => void;
}

const STORAGE_AVATAR_PREFIX = "cyc_ws_avatar_";

const getStoredWorkspaceAvatar = (id: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${STORAGE_AVATAR_PREFIX}${id}`);
  } catch {
    return null;
  }
};

const persistWorkspaceAvatar = (id: string, avatarUrl: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_AVATAR_PREFIX}${id}`, avatarUrl);
  } catch {}
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return [];
    }

    try {
      setIsLoading(true);
      const rawList = await listWorkspaces();
      const list = rawList.map((ws) => ({
        ...ws,
        avatarUrl: ws.avatarUrl || getStoredWorkspaceAvatar(ws.id) || null,
      }));

      setWorkspaces(list);
      setCurrentWorkspace((prev) => {
        if (list.length === 0) return null;
        if (prev) {
          const matched = list.find((ws) => ws.id === prev.id);
          if (matched) return matched;
        }
        return list[0];
      });
      return list;
    } catch (err) {
      console.error("Failed to fetch workspaces from GET /organizations:", err);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const setWorkspaceAvatar = useCallback(
    (workspaceId: string, avatarUrl: string) => {
      persistWorkspaceAvatar(workspaceId, avatarUrl);
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === workspaceId ? { ...ws, avatarUrl } : ws))
      );
      setCurrentWorkspace((prev) =>
        prev?.id === workspaceId ? { ...prev, avatarUrl } : prev
      );
    },
    []
  );

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // According to Figma Screen 9 Tester (Node 221:4357):
  // User is in Tester mode when they have no workspaces.
  const isTester = useMemo(() => {
    return !isLoading && workspaces.length === 0;
  }, [isLoading, workspaces]);

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      setCurrentWorkspace,
      isLoading,
      isTester,
      refreshWorkspaces,
      setWorkspaceAvatar,
    }),
    [
      workspaces,
      currentWorkspace,
      isLoading,
      isTester,
      refreshWorkspaces,
      setWorkspaceAvatar,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
