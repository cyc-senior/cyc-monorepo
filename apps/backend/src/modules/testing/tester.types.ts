import { Request } from 'express'

/** What the tester guard resolved for the current request (all from the database). */
export interface TesterContext {
  participantId: string
  sessionId: string
  projectId: string
  roundId: string
  /** The variant this participant is pinned to, if any (A/B group). */
  assignedVariantId: string | null
  consentVersion: string
}

export interface TesterRequest extends Request {
  tester?: TesterContext
}

/** Claims of a tester access token. */
export interface TesterTokenPayload {
  /** Participant id. */
  sub: string
  /** Session id; the token is only good for this session. */
  sid: string
}
