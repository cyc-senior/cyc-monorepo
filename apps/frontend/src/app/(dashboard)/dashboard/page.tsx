"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { listWorkspaceProjects } from "@/services/project.service";
import { listMySessions } from "@/services/testing.service";
import { ProjectWithRole } from "@/types/project";
import { UserSession } from "@/types/session";
import { Loader2 } from "lucide-react";
import {
  DashboardBreadcrumb,
  DashboardHeader,
  DashboardEmptyState,
  ProjectsSection,
  SessionsSection,
  defaultFormatRole,
} from "@/components/dashboard";

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    isLoading: workspaceLoading,
    isTester,
  } = useWorkspace();

  const [projects, setProjects] = useState<ProjectWithRole[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // 1. Fetch projects belonging to the selected workspace
  useEffect(() => {
    let isMounted = true;

    async function fetchWorkspaceProjects() {
      if (!user || !currentWorkspace?.id) {
        setProjects([]);
        return;
      }

      try {
        setIsLoadingProjects(true);
        const projList = await listWorkspaceProjects(currentWorkspace.id);

        if (isMounted) {
          setProjects(projList);
        }
      } catch (err) {
        console.error(
          `Failed to fetch projects for workspace ${currentWorkspace.id}:`,
          err
        );
        if (isMounted) {
          setProjects([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    fetchWorkspaceProjects();

    return () => {
      isMounted = false;
    };
  }, [user, currentWorkspace?.id]);

  // 2. Fetch testing sessions that the authenticated user has joined
  useEffect(() => {
    let isMounted = true;

    async function fetchMySessions() {
      if (!user) {
        setSessions([]);
        return;
      }

      try {
        setIsLoadingSessions(true);
        const sessionList = await listMySessions();

        if (isMounted) {
          setSessions(sessionList);
        }
      } catch {
        // Endpoint not yet implemented on backend; default to empty array
        if (isMounted) {
          setSessions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessions(false);
        }
      }
    }

    fetchMySessions();

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

  const hasProjects = sortedProjects.length > 0;
  const showSessionsSidebar = sortedSessions.length > 0;

  if (authLoading || workspaceLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      {/* 1. Sub-header Breadcrumb Bar:
          Hidden when user has no workspace (Tester Home - Figma Node 221:4357) */}
      {!isTester && (
        <DashboardBreadcrumb
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          onSelectWorkspace={setCurrentWorkspace}
        />
      )}

      {/* 2. Main Content Container */}
      <main className="w-full max-w-7xl mx-auto px-6 lg:px-20 py-8 lg:py-10 flex flex-col gap-8">
        <DashboardHeader
          userName={user?.name || user?.email}
          hasProjects={hasProjects}
          isTester={isTester}
        />

        {isTester ? (
          // Tester view (user has no workspace): full-width 3-column My Sessions grid
          <SessionsSection
            sessions={sortedSessions}
            isLoading={isLoadingSessions}
            layout="grid"
          />
        ) : isLoadingProjects ? (
          <ProjectsSection
            projects={[]}
            isLoading={true}
            formatRole={defaultFormatRole}
          />
        ) : !hasProjects ? (
          // Workspace exists, but has 0 projects: show Empty State banner
          <DashboardEmptyState />
        ) : (
          // Workspace has projects: show Projects list + optional Sessions sidebar
          <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
            <ProjectsSection
              projects={sortedProjects}
              isLoading={isLoadingProjects}
              formatRole={defaultFormatRole}
            />

            {showSessionsSidebar && (
              <SessionsSection
                sessions={sortedSessions}
                isLoading={isLoadingSessions}
                layout="sidebar"
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
