import { UserSession } from "@/types/session";

export const mockSessions: UserSession[] = [
  {
    id: "session-1",
    title: "Fintech checkout",
    status: "ACTIVE",
    currentRound: 2,
    totalRounds: 5,
    lastActiveTime: "2 h ago",
  },
  {
    id: "session-2",
    title: "Food delivery search",
    status: "SCHEDULED",
    opensAt: "30 Oct, 10:00",
  },
  {
    id: "session-3",
    title: "E-commerce checkout",
    status: "COMPLETED",
    submittedAt: "20 Oct",
    totalRounds: 4,
  },
];
