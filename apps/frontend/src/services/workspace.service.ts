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
  // Backend: OrganizationDto now includes `avatarUrl`; the returned URL is a
  // public picture endpoint backed by the organization's stored blob.
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
  // Backend: accepts an optional PNG/JPEG `avatarUrl` data URL; the caller
  // automatically becomes its ADMIN.
  const response = await api.post<Workspace>("/organizations", { name });
  return response.data;
}

/**
 * Updates a workspace (organization) name.
 */
export async function updateWorkspace(
  organizationId: string,
  name: string
): Promise<Workspace> {
  const response = await api.patch<Workspace>(`/organizations/${organizationId}`, {
    name,
  });
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

  // Backend: POST /organizations/:organizationId/picture accepts a PNG/JPEG
  // multipart `file` (max 1 MiB) and rotates the public avatar key.
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
  // Backend: unregistered emails become pending invitations (no email sent);
  // the invitee accepts them after signing in.
  await api.post(`/organizations/${organizationId}/members`, {
    email,
    role,
  });
}
