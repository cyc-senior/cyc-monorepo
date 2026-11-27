"use client";

import * as React from "react";
import {
  getProjectById,
  listUserStories,
  listTestSessions,
  listReports,
  listAuditLogs,
  ProjectDetails,
  UserStoryItem,
  TestSessionItem,
  ReportItem,
  AuditLogItem,
} from "@/lib/project-client";

interface ProjectDataCache {
  project: ProjectDetails;
  stories: UserStoryItem[];
  sessions: TestSessionItem[];
  reports: ReportItem[];
  auditLogs: AuditLogItem[];
  timestamp: number;
}

/** Last data per project, so switching tabs shows it at once while refreshing. */
const projectDataCache = new Map<string, ProjectDataCache>();

/**
 * A project with its stories, test sessions, reports and activity, for the
 * project's landing tabs. Cached data is shown immediately and refreshed.
 */
export function useProjectOverview(projectId: string) {
  const cachedData = projectDataCache.get(projectId);

  const [project, setProject] = React.useState<ProjectDetails | null>(
    cachedData ? cachedData.project : null
  );
  const [stories, setStories] = React.useState<UserStoryItem[]>(
    cachedData ? cachedData.stories : []
  );
  const [sessions, setSessions] = React.useState<TestSessionItem[]>(
    cachedData ? cachedData.sessions : []
  );
  const [reports, setReports] = React.useState<ReportItem[]>(
    cachedData ? cachedData.reports : []
  );
  const [auditLogs, setAuditLogs] = React.useState<AuditLogItem[]>(
    cachedData ? cachedData.auditLogs : []
  );
  // Only show initial loading state if we have no cached data at all
  const [isLoading, setIsLoading] = React.useState(!cachedData);

  React.useEffect(() => {
    let active = true;

    async function loadData() {
      // Do not flash full-screen loading if we already have cached data
      if (!projectDataCache.has(projectId)) {
        setIsLoading(true);
      }
      try {
        const [proj, userStories, testSessions, reportItems, logs] = await Promise.all([
          getProjectById(projectId),
          listUserStories(projectId).catch(() => []),
          listTestSessions(projectId).catch(() => []),
          listReports(projectId).catch(() => []),
          listAuditLogs(projectId).catch(() => []),
        ]);

        if (!active) return;

        projectDataCache.set(projectId, {
          project: proj,
          stories: userStories,
          sessions: testSessions,
          reports: reportItems,
          auditLogs: logs,
          timestamp: Date.now(),
        });

        setProject(proj);
        setStories(userStories);
        setSessions(testSessions);
        setReports(reportItems);
        setAuditLogs(logs);
      } catch (err) {
        console.error("Failed to load project:", err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    if (projectId) {
      loadData();
    }

    return () => {
      active = false;
    };
  }, [projectId]);

  /** Shows (and caches) the project as returned by an update. */
  const projectUpdated = React.useCallback(
    (updated: ProjectDetails) => {
      setProject(updated);
      const existing = projectDataCache.get(projectId);
      if (existing) {
        projectDataCache.set(projectId, { ...existing, project: updated });
      }
    },
    [projectId]
  );

  /** Drops a deleted story from the lists (and the cache). */
  const storyDeleted = React.useCallback(
    (storyId: string) => {
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      const existing = projectDataCache.get(projectId);
      if (existing) {
        projectDataCache.set(projectId, {
          ...existing,
          stories: existing.stories.filter((s) => s.id !== storyId),
        });
      }
    },
    [projectId]
  );

  return { project, stories, sessions, reports, auditLogs, isLoading, projectUpdated, storyDeleted };
}
