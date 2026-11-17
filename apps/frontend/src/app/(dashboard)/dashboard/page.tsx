"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  useWorkspace,
  DashboardPreviewMode,
} from "@/contexts/workspace-context";
import { apiFetch } from "@/lib/api-client";
import { mockProjects } from "@/config/mock-projects";
import { mockSessions } from "@/config/mock-sessions";
import { ProjectWithRole } from "@/types/project";
import { UserSession } from "@/types/session";
import { Loader2 } from "lucide-react";
import {
  DashboardBreadcrumb,
  DashboardHeader,
  DashboardEmptyState,
  DashboardPreviewDock,
  ProjectsSection,
  SessionsSection,
  defaultFormatRole,
} from "@/components/dashboard";

function DashboardView() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    previewMode,
    setPreviewMode,
    isTester,
  } = useWorkspace();

  const searchParams = useSearchParams();

  // Support ?view=tester | both | projects-only | empty in URL
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (
      viewParam === "tester" ||
      viewParam === "both" ||
      viewParam === "projects-only" ||
      viewParam === "empty"
    ) {
      setPreviewMode(viewParam as DashboardPreviewMode);
    }
  }, [searchParams, setPreviewMode]);

  // Projects & Sessions states
  const [projects, setProjects] = useState<ProjectWithRole[]>(mockProjects);
  const [sessions, setSessions] = useState<UserSession[]>(mockSessions);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch projects from API if logged in
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setIsLoadingData(true);
        const projRes = await apiFetch<
          ProjectWithRole[] | { data: ProjectWithRole[] }
        >("/projects");
        const projList = Array.isArray(projRes)
          ? projRes
          : (projRes as { data: ProjectWithRole[] })?.data || [];
        if (isMounted) {
          if (projList.length > 0) {
            setProjects(projList);
          }
        }
      } catch (err) {
        console.info("Using mock dashboard data preview:", err);
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    }

    if (user) {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Sort projects: Items requiring attention ("T3 needs you") first
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aUrgent = a.requiresAttention || a.statusBadge?.type === "warning";
      const bUrgent = b.requiresAttention || b.statusBadge?.type === "warning";
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return 0;
    });
  }, [projects]);

  // Sort sessions: Active -> Scheduled -> Completed
  const sortedSessions = useMemo(() => {
    const priorityMap: Record<string, number> = {
      ACTIVE: 1,
      SCHEDULED: 2,
      COMPLETED: 3,
    };
    return [...sessions].sort((a, b) => {
      return (priorityMap[a.status] || 99) - (priorityMap[b.status] || 99);
    });
  }, [sessions]);

  const hasProjects = previewMode !== "empty" && sortedProjects.length > 0;
  const showSessions =
    (previewMode === "both" || previewMode === "tester") &&
    sortedSessions.length > 0;

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      {/* 1. Sub-header Breadcrumb Bar:
          Hidden when user is a Tester / has no workspace (Figma Node 221:4357) */}
      {!isTester && (
        <DashboardBreadcrumb
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          onSelectWorkspace={setCurrentWorkspace}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
        />
      )}

      {/* 2. Main Content Container */}
      <main className="w-full max-w-7xl mx-auto px-6 lg:px-20 py-8 lg:py-10 flex flex-col gap-8">
        {/* Dynamic Greeting Header:
            - Tester view (221:4357): "Join with code" & "Create workspace"
            - Projects view (137:1589 / 221:3801): "Join with code" & "New project"
            - Empty view (154:1198): no action buttons in header */}
        <DashboardHeader
          userName={user?.name || user?.email}
          hasProjects={hasProjects}
          isTester={isTester}
        />

        {/* Content Body:
            Mode 1 (Tester - Node 221:4357): Full-width 3-column My Sessions grid
            Mode 2 (Empty - Node 154:1198): Dark indigo empty state banner
            Mode 3 (Projects & Sessions - Node 221:3801): 2-column Projects + Sessions sidebar
            Mode 4 (Projects Only - Node 137:1589): Full-width Projects list */}
        {isTester ? (
          <SessionsSection sessions={sortedSessions} layout="grid" />
        ) : !hasProjects ? (
          <DashboardEmptyState />
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
            <ProjectsSection
              projects={sortedProjects}
              isLoading={isLoadingData}
              formatRole={defaultFormatRole}
            />

            {showSessions && <SessionsSection sessions={sortedSessions} layout="sidebar" />}
          </div>
        )}
      </main>

      {/* Persistent floating preview dock for Figma wireframe switching */}
      <DashboardPreviewDock
        currentMode={previewMode}
        onSelectMode={setPreviewMode}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  );
}
