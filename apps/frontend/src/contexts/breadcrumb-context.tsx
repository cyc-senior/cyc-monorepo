"use client";

import React, { createContext, useContext, useState, useEffect, Suspense } from "react";
import { usePathname } from "next/navigation";
import { getProjectById, ProjectDetails } from "@/lib/project-client";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbContextType {
  customSegments: BreadcrumbSegment[] | null;
  setBreadcrumbs: (segments: BreadcrumbSegment[] | null) => void;
  project: ProjectDetails | null;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  customSegments: null,
  setBreadcrumbs: () => {},
  project: null,
});

function BreadcrumbPathnameSync({
  onResetCustom,
  onSetProject,
}: {
  onResetCustom: () => void;
  onSetProject: (proj: ProjectDetails | null) => void;
}) {
  const pathname = usePathname();
  const prevPathnameRef = React.useRef(pathname);

  const match = pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
  const projectId = match && match[1] !== "new" ? match[1] : null;

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      onResetCustom();
      if (!projectId) {
        onSetProject(null);
      }
    }
  }, [pathname, projectId, onResetCustom, onSetProject]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let active = true;
    getProjectById(projectId)
      .then((p) => {
        if (active) onSetProject(p);
      })
      .catch(() => {
        if (active) onSetProject(null);
      });

    return () => {
      active = false;
    };
  }, [projectId, onSetProject]);

  return null;
}

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [customSegments, setCustomSegments] = useState<BreadcrumbSegment[] | null>(null);
  const [project, setProject] = useState<ProjectDetails | null>(null);

  return (
    <BreadcrumbContext.Provider
      value={{
        customSegments,
        setBreadcrumbs: setCustomSegments,
        project,
      }}
    >
      <Suspense fallback={null}>
        <BreadcrumbPathnameSync
          onResetCustom={() => setCustomSegments(null)}
          onSetProject={setProject}
        />
      </Suspense>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(BreadcrumbContext);
}
