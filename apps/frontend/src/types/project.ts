export type Platform = "DESKTOP" | "MOBILE";

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type ProjectRole =
  | "DESIGNER"
  | "PROJECT_MANAGER"
  | "PRODUCT_OWNER"
  | "DEVELOPER"
  | "CLIENT";

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
}

export interface ProjectsResponse {
  data: ProjectWithRole[];
  total: number;
  limit: number;
  offset: number;
}
