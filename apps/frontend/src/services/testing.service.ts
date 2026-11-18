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
  // Backend: GET /users/me/sessions returns the sessions claimed by this
  // account (joined/completed), with round, activity and schedule details.
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
  // Backend: GET /testing/lookup?code=... previews the invitation without
  // joining. Codes are case-insensitive; isTakenByOther flags a code claimed
  // by another signed-in account (Screen 7A).
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
  // Backend: POST /testing/join accepts an optional user bearer token. When
  // present, the invitation is claimed for that account and cannot later be
  // claimed by another user.
  const response = await api.post<TesterTokenResponse>("/testing/join", {
    token,
  });
  return response.data;
}
