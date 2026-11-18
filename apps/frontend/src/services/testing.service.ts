import { api } from "@/lib/api-client";
import type {
  FoundSession,
  TesterTokenResponse,
  UserSession,
} from "@/types/session";

/**
 * Lists all testing sessions the authenticated user participates in.
 */
export async function listMySessions(): Promise<UserSession[]> {
  // TODO: [GET /users/me/sessions] Create new endpoint for authenticated user's testing sessions
  // Please add an endpoint for authenticated users to list all testing sessions they have joined
  // (currently Backend only has GET /testing/session for a single TesterGuard token).
  // Expected response: { data: UserSession[] } where each item contains:
  // - id: string (session ID)
  // - title: string (project or session title, e.g. "Fintech checkout")
  // - status: "ACTIVE" | "SCHEDULED" | "COMPLETED"
  // - currentRound?: number (e.g. 2)
  // - totalRounds?: number (e.g. 5)
  // - lastActiveTime?: string (ISO timestamp or relative string, e.g. "2 h ago")
  // - opensAt?: string (for SCHEDULED sessions, e.g. "30 Oct, 10:00")
  // - submittedAt?: string (for COMPLETED sessions, e.g. "20 Oct")
  const response = await api.get<{ data: UserSession[] } | UserSession[]>(
    "/users/me/sessions"
  );
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload?.data || [];
}

/**
 * Looks up testing session preview details by invitation code before joining.
 */
export async function lookupSessionByCode(code: string): Promise<FoundSession> {
  // TODO: [GET /testing/lookup?code={sessionCode}] Create lookup endpoint for session preview
  // Currently Backend only has POST /testing/join which immediately exchanges the invitation token.
  // Per Figma Screen 7 (220:3851) & Screen 7A (324:7373), the frontend needs a lookup endpoint
  // to preview session details while typing the code before clicking "Continue to session":
  // Expected response shape:
  // {
  //   code: string;
  //   workspaceName: string; (e.g. "Studio workspace")
  //   projectName: string;   (e.g. "KMUTT Library")
  //   taskName: string;      (e.g. "Book a study room")
  //   platform: "Desktop" | "Mobile" | "Tablet";
  //   expiresAt: string;     (e.g. "Open until 3 Nov")
  //   isTakenByOther?: boolean; (true if invitation code is already claimed by another user -> triggers Screen 7A error)
  // }
  const response = await api.get<FoundSession>("/testing/lookup", {
    params: { code },
  });
  return response.data;
}

/**
 * Joins a testing session using an invitation token/code.
 */
export async function joinSessionWithCode(
  token: string
): Promise<TesterTokenResponse> {
  // TODO: [POST /testing/join] Link participant to authenticated user
  // Please also link the authenticated user (`userId` from Bearer token if signed in) to this participant
  // record so that the session appears under `GET /users/me/sessions` ("My sessions" on Dashboard)
  // and enforces that the code cannot be used by a different user account (Screen 7A).
  const response = await api.post<TesterTokenResponse>("/testing/join", {
    token,
  });
  return response.data;
}
