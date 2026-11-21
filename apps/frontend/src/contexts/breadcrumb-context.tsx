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
  const [prevPathname, setPrevPathname] = useState("");
  const pathname = usePathname();

  const match = pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
  const projectId = match && match[1] !== "new" ? match[1] : null;

  // Adjust state during render when pathname changes (official React pattern avoiding effect setState)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setCustomSegments(null);
    if (!projectId) {
      setProject(null);
    }
  }

  // Extract projectId if in path and fetch project name for auto breadcrumbs
  useEffect(() => {
    if (!projectId) {
      return;
    }

    let active = true;
    getProjectById(projectId)
      .then((p) => {
        if (active) setProject(p);
      })
      .catch(() => {
        if (active) setProject(null);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

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
