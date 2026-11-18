import { apiFetch } from "./api-client";

export type ProjectPlatform = "DESKTOP" | "MOBILE" | "TABLET";

export type ProjectRole =
  | "DESIGNER"
  | "PROJECT_MANAGER"
  | "PRODUCT_OWNER"
  | "CLIENT"
  | "DEVELOPER";

export interface CreateProjectPayload {
  name: string;
  clientOrProduct: string;
  platforms: ProjectPlatform[];
  description?: string | null;
  targetAudience?: string | null;
}

export interface ProjectDetails {
  id: string;
  organizationId: string;
  name: string;
  clientOrProduct: string;
  platforms: ProjectPlatform[];
  description?: string | null;
  targetAudience?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignIntentPayload {
  statement?: string | null;
  brandColorPrimary?: string | null;
  brandColorSecondary?: string | null;
  brandColorAccent?: string | null;
  brandNotes?: string | null;
  voiceTone?: string | null;
  targetAudience?: string | null;
  designPrinciples?: string[];
}

export interface PersonaPayload {
  name: string;
  role: string;
  description: string;
  goals: string[];
  painPoints: string[];
}

export interface PersonaItem extends PersonaPayload {
  id: string;
  projectId: string;
  origin: "MANUAL" | "AI";
  createdAt: string;
}

export interface ProjectMemberUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface ProjectMemberItem {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user: ProjectMemberUser;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Creates project under workspace (maps to /organizations/:workspaceId/projects)
 */
export async function createProject(
  workspaceId: string,
  payload: CreateProjectPayload
): Promise<ProjectDetails> {
  return await apiFetch<ProjectDetails>(
    `/organizations/${workspaceId}/projects`,
    {
      method: "POST",
      data: payload,
    }
  );
}

export async function getProject(projectId: string): Promise<ProjectDetails> {
  return await apiFetch<ProjectDetails>(`/projects/${projectId}`);
}

export async function getDesignIntent(
  projectId: string
): Promise<DesignIntentPayload> {
  return await apiFetch<DesignIntentPayload>(
    `/projects/${projectId}/design-intent`
  );
}

export async function putDesignIntent(
  projectId: string,
  payload: DesignIntentPayload
): Promise<DesignIntentPayload> {
  return await apiFetch<DesignIntentPayload>(
    `/projects/${projectId}/design-intent`,
    {
      method: "PUT",
      data: payload,
    }
  );
}

export async function listPersonas(projectId: string): Promise<PersonaItem[]> {
  const res = await apiFetch<PaginatedResult<PersonaItem>>(
    `/projects/${projectId}/personas`
  );
  return res.data || [];
}

export async function createPersona(
  projectId: string,
  payload: PersonaPayload
): Promise<PersonaItem> {
  return await apiFetch<PersonaItem>(`/projects/${projectId}/personas`, {
    method: "POST",
    data: payload,
  });
}

export async function deletePersona(
  projectId: string,
  personaId: string
): Promise<void> {
  await apiFetch(`/projects/${projectId}/personas/${personaId}`, {
    method: "DELETE",
  });
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMemberItem[]> {
  const res = await apiFetch<PaginatedResult<ProjectMemberItem>>(
    `/projects/${projectId}/members`
  );
  return res.data || [];
}

export async function addProjectMember(
  projectId: string,
  email: string,
  role: ProjectRole
): Promise<ProjectMemberItem> {
  return await apiFetch<ProjectMemberItem>(`/projects/${projectId}/members`, {
    method: "POST",
    data: { email, role },
  });
}

export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole
): Promise<ProjectMemberItem> {
  return await apiFetch<ProjectMemberItem>(
    `/projects/${projectId}/members/${memberId}`,
    {
      method: "PATCH",
      data: { role },
    }
  );
}

export async function removeProjectMember(
  projectId: string,
  memberId: string
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
  });
}
