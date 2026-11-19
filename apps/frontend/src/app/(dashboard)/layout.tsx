import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { Workspace } from "@/types/workspace";

async function getWorkspacesServer(): Promise<Workspace[]> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return [];
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  try {
    const res = await fetch(`${apiUrl}/organizations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : data?.data || [];
  } catch {
    return [];
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  // If no auth cookie/session, redirect to signin immediately on server
  if (!accessToken) {
    redirect("/signin");
  }

  const initialWorkspaces = await getWorkspacesServer();

  return (
    <DashboardShell initialWorkspaces={initialWorkspaces}>
      {children}
    </DashboardShell>
  );
}
