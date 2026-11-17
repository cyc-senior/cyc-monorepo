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
