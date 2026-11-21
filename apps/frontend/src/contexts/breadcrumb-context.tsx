"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [customSegments, setCustomSegments] = useState<BreadcrumbSegment[] | null>(null);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const pathname = usePathname();

  // Reset custom breadcrumbs when path changes
  useEffect(() => {
    setCustomSegments(null);
  }, [pathname]);

  // Extract projectId if in path and fetch project name for auto breadcrumbs
  useEffect(() => {
    const match = pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
    const projectId = match ? match[1] : null;

    if (projectId && projectId !== "new") {
      getProjectById(projectId)
        .then((p) => setProject(p))
        .catch(() => setProject(null));
    } else {
      setProject(null);
    }
  }, [pathname]);

  return (
    <BreadcrumbContext.Provider
      value={{
        customSegments,
        setBreadcrumbs: setCustomSegments,
        project,
      }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(BreadcrumbContext);
}
