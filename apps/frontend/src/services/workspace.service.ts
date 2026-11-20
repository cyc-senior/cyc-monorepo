import { api } from "@/lib/api-client";
import type {
  WorkspaceRole,
  PaginatedWorkspacesResponse,
  Workspace,
} from "@/types/workspace";

/**
 * Fetches all workspaces the current user belongs to.
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  // Backend: WorkspaceDto now includes `avatarUrl`; the returned URL is a
  // public picture endpoint backed by the workspace's stored blob.
  const response = await api.get<PaginatedWorkspacesResponse | Workspace[]>(
    "/workspaces"
  );
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload?.data || [];
}

/**
 * Creates a new workspace; the caller automatically becomes its ADMIN.
 */
export async function createWorkspace(name: string): Promise<Workspace> {
  // Backend: accepts an optional PNG/JPEG `avatarUrl` data URL; the caller
  // automatically becomes its ADMIN.
  const response = await api.post<Workspace>("/workspaces", { name });
  return response.data;
}

/**
 * Updates a workspace name.
 */
export async function updateWorkspace(
  workspaceId: string,
  name: string
): Promise<Workspace> {
  const response = await api.patch<Workspace>(`/workspaces/${workspaceId}`, {
    name,
  });
  return response.data;
}

/**
 * Uploads an avatar picture for a workspace.
 */
export async function uploadWorkspacePicture(
  workspaceId: string,
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  // Backend: POST /workspaces/:workspaceId/picture accepts a PNG/JPEG
  // multipart `file` (max 1 MiB) and rotates the public avatar key.
  await api.post(`/workspaces/${workspaceId}/picture`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

/**
 * Invites a user by email to join a workspace.
 */
export async function inviteWorkspaceMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole = "MEMBER"
): Promise<void> {
  // Backend: unregistered emails become pending invitations (no email sent);
  // the invitee accepts them after signing in.
  await api.post(`/workspaces/${workspaceId}/members`, {
    email,
    role,
  });
}
