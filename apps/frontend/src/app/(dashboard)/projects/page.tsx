"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { listWorkspaceProjects } from "@/services/project.service";
import { ProjectWithRole } from "@/types/project";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CYCProjectCard } from "@/components/projects";
import { HugeIcon } from "@/components/ui/huge-icon";
import { FolderAddIcon } from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

function ProjectsView() {
  const router = useRouter();
  const {
    currentWorkspace,
    isLoading: workspaceLoading,
  } = useWorkspace();
  const searchParams = useSearchParams();

  const [projectsList, setProjectsList] = useState<ProjectWithRole[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);

  // Sync ?new=true query param -> redirect to /projects/new
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      router.replace("/projects/new");
    }
  }, [searchParams, router]);

  // Fetch projects for the active workspace from Backend API
  const workspaceId = currentWorkspace?.id;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!workspaceId) {
        setIsLoadingProjects(false);
        return;
      }
      try {
        setIsLoadingProjects(true);
        const list = await listWorkspaceProjects(workspaceId);
        if (isMounted) {
          setProjectsList(list);
        }
      } catch (err) {
        console.error(
          `Failed to fetch projects from GET /workspaces/${workspaceId}/projects:`,
          err
        );
        if (isMounted) {
          setProjectsList([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  if (workspaceLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      <main className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-10 flex flex-col gap-10">
        {/* Page Head (Figma Node 832:18050 / 819:17019) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl sm:text-[36px] font-medium tracking-tight text-foreground leading-[40px]">
              Projects
            </h1>
            <p className="text-base text-muted-foreground font-normal leading-6">
              {projectsList.length === 0
                ? `No projects in ${currentWorkspace?.name || "workspace"} yet`
                : `${projectsList.length} ${
                    projectsList.length === 1 ? "project" : "projects"
                  } in ${currentWorkspace?.name || "workspace"}`}
            </p>
          </div>

          {/* New project action only in header when projects exist */}
          {projectsList.length > 0 && currentWorkspace?.id && (
            <div className="flex items-center gap-2">
              <Button
                asChild
                className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Link href="/projects/new">New project</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Projects Grid or Loading / Empty State */}
        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[340px] w-full rounded-[14px] border border-border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : projectsList.length === 0 ? (
          /* Empty state (Figma Node 814:10509) */
          <Empty className="bg-[#15095d] flex flex-col gap-6 items-center justify-center px-6 sm:px-10 py-20 rounded-[14px] w-full text-center shadow-xs border-0">
            {/* Hugeicons FolderAddIcon (Node 814:10510) */}
            <EmptyMedia className="size-10 flex items-center justify-center text-white mb-0">
              <HugeIcon icon={FolderAddIcon} size={40} className="text-white" />
            </EmptyMedia>

            {/* Title & Subtitle (Node 814:10511) */}
            <EmptyHeader className="flex flex-col gap-2 items-center text-white max-w-xl">
              <EmptyTitle className="font-heading font-medium text-2xl tracking-[-0.24px] text-white">
                No projects yet
              </EmptyTitle>
              <EmptyDescription className="text-base text-white font-normal leading-6">
                Create your first project to start testing A/B designs with real testers.
              </EmptyDescription>
            </EmptyHeader>

            {/* Action Button: Lime green New Project (Node 814:10515) */}
            {currentWorkspace?.id && (
              <EmptyContent className="mt-0">
                <Button
                  asChild
                  className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <Link href="/projects/new">New project</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {projectsList.map((project) => (
              <CYCProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ProjectsView />
    </Suspense>
  );
}
