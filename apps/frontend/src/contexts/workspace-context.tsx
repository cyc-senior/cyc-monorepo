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
import { apiFetch } from "@/lib/api-client";

export interface Workspace {
  id: string;
  name: string;
}

export type DashboardPreviewMode =
  | "both"
  | "projects-only"
  | "empty"
  | "tester";

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace | null) => void;
  isLoading: boolean;
  previewMode: DashboardPreviewMode;
  setPreviewMode: (mode: DashboardPreviewMode) => void;
  isTester: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: "ws-1", name: "Studio workspace" },
  ]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>({
    id: "ws-1",
    name: "Studio workspace",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<DashboardPreviewMode>("both");

  const refreshWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const res = await apiFetch<Workspace[] | { data: Workspace[] }>(
        "/organizations"
      );
      const list = Array.isArray(res)
        ? res
        : (res as { data: Workspace[] })?.data || [];
      if (list.length > 0) {
        setWorkspaces(list);
        setCurrentWorkspace(list[0]);
      } else {
        setWorkspaces([]);
        setCurrentWorkspace(null);
      }
    } catch (err) {
      console.info("Using mock workspace data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // isTester is true if previewMode is "tester" OR user has no workspaces
  const isTester = useMemo(() => {
    if (previewMode === "tester") return true;
    return workspaces.length === 0;
  }, [previewMode, workspaces]);

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      setCurrentWorkspace,
      isLoading,
      previewMode,
      setPreviewMode,
      isTester,
      refreshWorkspaces,
    }),
    [
      workspaces,
      currentWorkspace,
      isLoading,
      previewMode,
      isTester,
      refreshWorkspaces,
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
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
