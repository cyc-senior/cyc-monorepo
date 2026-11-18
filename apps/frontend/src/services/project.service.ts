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
  // TODO: [GET /organizations/:organizationId/projects] Expand ProjectWithRoleDto summary fields
  // Currently returns Page<ProjectWithRoleDto> ({ data, total, limit, offset }) with basic project fields.
  // Please include the following fields in ProjectWithRoleDto for the Dashboard ProjectRow & Project Hub Card UI:
  // - activeRound?: string (e.g. "Round 2 of 5", "Draft")
  // - testerProgress?: { current: number; total: number } (e.g. { current: 24, total: 30 })
  // - variantCount?: number (e.g. 2)
  // - statusBadge?: { label: string; type: "warning" | "in-progress" | "ready" }
  //   (e.g. "T3 needs you", "Prompt & context", "In testing", "Completed", "Draft · Design intent")
  // - requiresAttention?: boolean (true when user story needs designer action, used to sort urgent projects to top)
  // - members?: Array<{ id: string; name: string | null; image: string | null }>
  //   (Project members list for displaying member initials avatars PW, NT, PK on each card)
  // - thumbnailUrl?: string | null
  //   (Latest generated A/B design preview image URL; null until AI generates the first A/B round)
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
  // TODO: [POST /organizations/:organizationId/projects] Make platforms optional in Step 1 or support draft wizard step
  // In Figma Screen 11 (node 491:5322), Step 1 ("New project") collects:
  //   - name: string (e.g. "KMUTT Library room booking")
  //   - clientOrProduct: string (e.g. "KMUTT Library")
  //   - description?: string (e.g. "Help students book a group study room...")
  // Notice `platforms` is defaulted to ["DESKTOP", "MOBILE"] by the caller to satisfy current backend CreateProjectDto validation.
  // In future steps (e.g. Step 2 "Design intent"), platforms or design intent tokens can be refined.
  const response = await api.post<ProjectWithRole>(
    `/organizations/${organizationId}/projects`,
    payload
  );
  return response.data;
}
