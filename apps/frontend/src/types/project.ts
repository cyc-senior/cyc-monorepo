export type Platform = "DESKTOP" | "MOBILE" | "TABLET";

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type ProjectRole =
  | "DESIGNER"
  | "PROJECT_MANAGER"
  | "PRODUCT_OWNER"
  | "DEVELOPER"
  | "CLIENT";

export interface ProjectMemberSummary {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ProjectWithRole {
  id: string;
  organizationId: string;
  name: string;
  clientOrProduct: string;
  description: string | null;
  platforms: Platform[];
  status: ProjectStatus;
  hasDesignIntent: boolean;
  createdById: string | null;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
  // Additional UI summary fields requested from Backend API:
  activeRound?: string;
  testerProgress?: {
    current: number;
    total: number;
  };
  variantCount?: number;
  statusBadge?: {
    label: string;
    type: "warning" | "in-progress" | "ready";
  };
  requiresAttention?: boolean;
  members?: ProjectMemberSummary[];
  thumbnailUrl?: string | null;
}

export interface CreateProjectPayload {
  name: string;
  clientOrProduct: string;
  description?: string | null;
  platforms?: Platform[];
}

export interface ProjectsResponse {
  data: ProjectWithRole[];
  total: number;
  limit: number;
  offset: number;
}
