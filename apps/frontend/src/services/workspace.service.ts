import { api } from "@/lib/api-client";
import type {
  OrganizationRole,
  PaginatedWorkspacesResponse,
  Workspace,
} from "@/types/workspace";

/**
 * Fetches all workspaces (organizations) the current user belongs to.
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  // TODO: [GET /organizations] Please add `avatarUrl?: string | null` to OrganizationDto / OrganizationWithRoleDto
  // so the workspace picture uploaded during onboarding can be returned directly by the server.
  // Backend returns Page<OrganizationWithRoleDto>: { data: Workspace[], total, limit, offset }
  const response = await api.get<PaginatedWorkspacesResponse | Workspace[]>(
    "/organizations"
  );
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload?.data || [];
}

/**
 * Creates a new workspace (organization); the caller automatically becomes its ADMIN.
 */
export async function createWorkspace(name: string): Promise<Workspace> {
  // TODO: [POST /organizations] Support optional `avatarUrl` or multipart picture upload on creation
  // Caller automatically becomes its ADMIN.
  const response = await api.post<Workspace>("/organizations", { name });
  return response.data;
}

/**
 * Uploads an avatar picture for a workspace.
 */
export async function uploadWorkspacePicture(
  organizationId: string,
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  // TODO: [POST /organizations/:organizationId/picture or multipart in POST /organizations]
  // Per Figma Screen 8 (node 491:5260): Users can upload a workspace picture (PNG or JPG).
  // Please provide an endpoint to upload and associate an avatar image URL with the organization.
  await api.post(`/organizations/${organizationId}/picture`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

/**
 * Invites a user by email to join a workspace.
 */
export async function inviteWorkspaceMember(
  organizationId: string,
  email: string,
  role: OrganizationRole = "MEMBER"
): Promise<void> {
  // TODO: [POST /organizations/:organizationId/members] Support pending invitation for unregistered emails
  // Currently Backend AddOrganizationMemberDto requires the invited user to have already signed in once
  // (throws 404 if user does not exist yet).
  // Per Figma Screen 8 & Screen 10A: Please support creating a pending workspace invitation & sending
  // an invite email even if the email address has not registered an account yet.
  await api.post(`/organizations/${organizationId}/members`, {
    email,
    role,
  });
}
