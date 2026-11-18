import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProjectRole } from "@/types/project";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts up to 2 uppercase initials from a full name or email string.
 */
export function getInitials(nameOrEmail: string | null | undefined, fallback = "U"): string {
  if (!nameOrEmail) return fallback;
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return nameOrEmail.slice(0, 2).toUpperCase() || fallback;
}

/**
 * Formats a ProjectRole enum string into human-readable display text.
 */
export function formatProjectRole(role?: ProjectRole | string): string {
  if (!role) return "Member";
  switch (role.toUpperCase()) {
    case "DESIGNER":
      return "Designer";
    case "CLIENT":
      return "Client";
    case "DEVELOPER":
      return "Developer";
    case "PROJECT_MANAGER":
      return "Project Manager";
    case "PRODUCT_OWNER":
      return "Product Owner";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }
}
