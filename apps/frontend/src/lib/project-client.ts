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
  workspaceId: string;
  name: string;
  clientOrProduct: string;
  platforms: ProjectPlatform[];
  description?: string | null;
  targetAudience?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type UiLibrary = "SHADCN" | "MUI";

export interface DesignIntentPayload {
  statement?: string;
  designSystem: UiLibrary;
  designStandards?: string[];
  designGuidelines?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  brandGuidelines?: string;
  toneOfVoice?: string;
}

export interface DesignIntentDetail {
  id?: string;
  projectId?: string;
  statement?: string | null;
  designSystem?: UiLibrary | string;
  designStandards?: string[];
  designGuidelines?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  brandGuidelines?: string | null;
  toneOfVoice?: string | null;
  legacyBrief?: unknown;
  version?: number;
  // Aliases for compatibility with other views
  brandColorPrimary?: string | null;
  brandColorSecondary?: string | null;
  brandColorAccent?: string | null;
  brandNotes?: string | null;
  voiceTone?: string | null;
  designPrinciples?: string[];
}

export interface PersonaPayload {
  name: string;
  age?: number;
  shortDescription: string;
  behavioralConsiderations?: string[];
  frustrations?: string[];
  goals?: string[];
  tasks?: string[];
}

export interface PersonaItem {
  id: string;
  projectId: string;
  origin: "MANUAL" | "AI";
  generationJobId?: string | null;
  name: string;
  age?: number | null;
  shortDescription: string;
  behavioralConsiderations?: string[];
  frustrations?: string[];
  goals?: string[];
  tasks?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  // Aliases for compatibility with other views
  role?: string;
  description?: string;
  painPoints?: string[];
}

export interface ProjectMemberUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

export interface ProjectMemberItem {
  id: string;
  role: ProjectRole;
  joinedAt: string;
  user: ProjectMemberUser;
}

export interface UserStoryItem {
  id: string;
  projectId: string;
  storyKey?: string;
  role: string;
  want: string;
  benefit: string;
  problemStatement?: string;
  successMetric?: string;
  personaIds?: string[];
  screenScope?: string[];
  devices?: string[];
  createdAt: string;
}

export interface CreateUserStoryPayload {
  role: string;
  want: string;
  benefit: string;
  problemStatement?: string;
  successMetric?: string;
  personaIds?: string[];
  screenScope?: string[];
  devices?: string[];
}

export interface DesignRoundItem {
  id: string;
  projectId: string;
  roundNumber?: number;
  hypothesis?: string;
  createdAt: string;
}

export interface CreateDesignRoundPayload {
  storyId?: string;
  hypothesis?: string;
}

export interface GenerationJobItem {
  id: string;
  roundId: string;
  status: string;
  createdAt: string;
}

export interface StartGenerationJobPayload {
  prompt: string;
}

/** Project API calls */
export async function createProject(
  workspaceId: string,
  payload: CreateProjectPayload
): Promise<ProjectDetails> {
  return apiFetch<ProjectDetails>(`/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProject(projectId: string): Promise<ProjectDetails> {
  return apiFetch<ProjectDetails>(`/projects/${projectId}`);
}

export async function getProjectById(projectId: string): Promise<ProjectDetails> {
  return getProject(projectId);
}

/** Design intent API calls */
export async function getDesignIntent(
  projectId: string
): Promise<DesignIntentDetail> {
  return apiFetch<DesignIntentDetail>(`/projects/${projectId}/design-intent`);
}

export async function putDesignIntent(
  projectId: string,
  payload: DesignIntentPayload
): Promise<DesignIntentDetail> {
  return apiFetch<DesignIntentDetail>(`/projects/${projectId}/design-intent`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Persona API calls */
export async function listPersonas(projectId: string): Promise<PersonaItem[]> {
  const res = await apiFetch<PersonaItem[] | { data: PersonaItem[] }>(
    `/projects/${projectId}/personas`
  );
  return Array.isArray(res) ? res : res.data || [];
}

export async function createPersona(
  projectId: string,
  payload: PersonaPayload
): Promise<PersonaItem> {
  return apiFetch<PersonaItem>(`/projects/${projectId}/personas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePersona(
  projectId: string,
  personaId: string
): Promise<void> {
  return apiFetch<void>(`/projects/${projectId}/personas/${personaId}`, {
    method: "DELETE",
  });
}

/** Members API calls */
export async function listProjectMembers(
  projectId: string
): Promise<ProjectMemberItem[]> {
  const res = await apiFetch<ProjectMemberItem[] | { data: ProjectMemberItem[] }>(
    `/projects/${projectId}/members`
  );
  return Array.isArray(res) ? res : res.data || [];
}

export async function addProjectMember(
  projectId: string,
  email: string,
  role: ProjectRole
): Promise<ProjectMemberItem> {
  return apiFetch<ProjectMemberItem>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole
): Promise<ProjectMemberItem> {
  return apiFetch<ProjectMemberItem>(
    `/projects/${projectId}/members/${memberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }
  );
}

export async function removeProjectMember(
  projectId: string,
  memberId: string
): Promise<void> {
  return apiFetch<void>(`/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
  });
}

/** User Stories API calls */
export async function listUserStories(
  projectId: string
): Promise<UserStoryItem[]> {
  const res = await apiFetch<UserStoryItem[] | { data: UserStoryItem[] }>(
    `/projects/${projectId}/user-stories`
  );
  return Array.isArray(res) ? res : res.data || [];
}

export async function getUserStoryById(
  projectId: string,
  storyId: string
): Promise<UserStoryItem> {
  return apiFetch<UserStoryItem>(`/projects/${projectId}/user-stories/${storyId}`);
}

export async function createUserStory(
  projectId: string,
  payload: CreateUserStoryPayload
): Promise<UserStoryItem> {
  return apiFetch<UserStoryItem>(`/projects/${projectId}/user-stories`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Design Rounds & Generation API calls */
export async function createDesignRound(
  projectId: string,
  payload: CreateDesignRoundPayload
): Promise<DesignRoundItem> {
  return apiFetch<DesignRoundItem>(`/projects/${projectId}/rounds`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startGenerationJob(
  projectId: string,
  roundId: string,
  payload: StartGenerationJobPayload
): Promise<GenerationJobItem> {
  return apiFetch<GenerationJobItem>(
    `/projects/${projectId}/rounds/${roundId}/generation-jobs`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
