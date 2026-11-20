export type WorkspaceRole = "ADMIN" | "MEMBER";

export interface Workspace {
  id: string;
  name: string;
  role?: WorkspaceRole;
  avatarUrl?: string | null;
  createdById?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedWorkspacesResponse {
  data: Workspace[];
  total: number;
  limit: number;
  offset: number;
}
