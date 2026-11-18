export type SessionStatus = "ACTIVE" | "SCHEDULED" | "COMPLETED";

export interface UserSession {
  id: string;
  title: string;
  status: SessionStatus;
  currentRound?: number;
  totalRounds?: number;
  lastActiveTime?: string;
  opensAt?: string;
  submittedAt?: string;
}

export interface FoundSession {
  code: string;
  workspaceName: string;
  projectName: string;
  taskName: string;
  platform: "Desktop" | "Mobile" | "Tablet" | string;
  expiresAt: string;
  isTakenByOther?: boolean;
}

export interface TesterTokenResponse {
  accessToken: string;
}
