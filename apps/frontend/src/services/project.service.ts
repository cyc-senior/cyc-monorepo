import { api } from "@/lib/api-client";
import type {
  CreateProjectPayload,
  ProjectsResponse,
  ProjectWithRole,
} from "@/types/project";

/**
 * Lists all projects in the given workspace (organization).
 */
export async function listWorkspaceProjects(
  organizationId: string
): Promise<ProjectWithRole[]> {
  // Backend: ProjectWithRoleDto includes dashboard summaries (active round,
  // tester progress, variant count, status badge, attention flag, members and
  // the latest design thumbnail) in addition to the basic project fields.
  const response = await api.get<ProjectsResponse | ProjectWithRole[]>(
    `/organizations/${organizationId}/projects`
  );
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload?.data || [];
}

/**
 * Creates a new project in the given workspace (organization).
 */
export async function createProject(
  organizationId: string,
  payload: CreateProjectPayload
): Promise<ProjectWithRole> {
  // Backend: platforms is optional at creation (defaults to DESKTOP) so Step 1
  // can collect only the brief; it can be refined with PATCH later.
  const response = await api.post<ProjectWithRole>(
    `/organizations/${organizationId}/projects`,
    payload
  );
  return response.data;
}
