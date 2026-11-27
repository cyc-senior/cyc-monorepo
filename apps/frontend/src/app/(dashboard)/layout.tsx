"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { SidebarProvider, useSidebar } from "@/contexts/sidebar-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";
import { consumeReturnTo, rememberReturnTo } from "@/lib/return-to";

function WorkspaceRedirectGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();
  const isPreWorkspaceRoute =
    pathname === "/first-run" || pathname === "/workspaces/new";

  useEffect(() => {
    if (!workspaceLoading) {
      if (workspaces.length === 0 && !isPreWorkspaceRoute) {
        router.replace("/first-run");
      } else if (workspaces.length > 0 && pathname === "/first-run") {
        router.replace("/projects");
      }
    }
  }, [workspaceLoading, workspaces.length, isPreWorkspaceRoute, pathname, router]);

  return null;
}

function DashboardSidebarWrapper({
  collapsed,
  rail,
  overlayFor,
  onCloseOverlay,
}: {
  collapsed: boolean;
  /** Rail mode (refine): icon rail, full sidebar only as an overlay. */
  rail: boolean;
  /** The page the overlay was opened on; it closes once you leave it. */
  overlayFor: string | null;
  onCloseOverlay: () => void;
}) {
  const pathname = usePathname();
  const overlayOpen = overlayFor === pathname;
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();

  const hasNoWorkspace = !workspaceLoading && workspaces.length === 0;
  const isPreWorkspaceRoute =
    pathname === "/first-run" || pathname === "/workspaces/new";
  const showSidebar = !hasNoWorkspace && !isPreWorkspaceRoute;

  if (!showSidebar) return null;
  if (!rail) return <AppSidebar collapsed={collapsed} />;
  return (
    <RailSidebar
      key={pathname}
      pinned={overlayOpen}
      onClosePinned={onCloseOverlay}
    />
  );
}

/** Hover must rest this long on the rail before the sidebar peeks out. */
const PEEK_OPEN_DELAY_MS = 150;
/** Grace period after the pointer leaves before the peek closes. */
const PEEK_CLOSE_DELAY_MS = 250;

/**
 * Rail mode (refine): the icon rail, plus the full sidebar on top of the page
 * - "peek": hovering (or tabbing into) the rail floats it without dimming,
 *   and it closes shortly after the pointer leaves (Figma "sidebar hover").
 * - "pinned": the header toggle keeps it open over a dimmed backdrop until a
 *   backdrop click, Esc or navigation.
 * Remounted per page (key), so navigating always starts closed.
 */
function RailSidebar({
  pinned,
  onClosePinned,
}: {
  pinned: boolean;
  onClosePinned: () => void;
}) {
  const [peek, setPeek] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inside = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const scheduleClose = useCallback(() => {
    clearTimer();
    const tryClose = () => {
      // A menu of the sidebar (workspace or account) renders outside it:
      // stay open while one is open, and retry once it closes.
      if (inside.current) return;
      if (document.querySelector('[role="menu"]')) {
        timer.current = setTimeout(tryClose, PEEK_CLOSE_DELAY_MS);
        return;
      }
      setPeek(false);
    };
    timer.current = setTimeout(tryClose, PEEK_CLOSE_DELAY_MS);
  }, []);

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // no hover on touch: toggle only
    inside.current = true;
    clearTimer();
    if (!peek) timer.current = setTimeout(() => setPeek(true), PEEK_OPEN_DELAY_MS);
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    inside.current = false;
    scheduleClose();
  };

  // Esc also closes a peek (the pinned overlay has its own Esc handler).
  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPeek(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek]);

  const open = peek || pinned;
  return (
    <div
      className="relative shrink-0"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={() => {
        clearTimer();
        setPeek(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <AppSidebar collapsed />
      {pinned && (
        <div
          onClick={() => {
            setPeek(false);
            onClosePinned();
          }}
          className="fixed inset-0 z-40 bg-black/40 animate-scrim-in"
          aria-hidden="true"
        />
      )}
      {open && (
        <div
          role={pinned ? "dialog" : undefined}
          aria-modal={pinned ? true : undefined}
          aria-label="Sidebar"
          className="fixed inset-y-0 left-0 z-50 shadow-lg animate-sidebar-in"
        >
          <AppSidebar collapsed={false} />
        </div>
      )}
    </div>
  );
}

function DashboardHeaderWrapper({
  onToggleSidebar,
}: {
  onToggleSidebar: (pathname: string) => void;
}) {
  const pathname = usePathname();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();

  const hasNoWorkspace = !workspaceLoading && workspaces.length === 0;
  const isPreWorkspaceRoute =
    pathname === "/first-run" || pathname === "/workspaces/new";
  const showSidebar = !hasNoWorkspace && !isPreWorkspaceRoute;

  if (showSidebar) {
    return <SidebarHeader onToggleSidebar={() => onToggleSidebar(pathname)} />;
  }
  return <MinimalNav />;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  // No URL hooks here (they must sit inside <Suspense> for prerendering):
  // the wrappers below read the pathname.
  const { mode } = useSidebar();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /** Pathname the rail-mode overlay was opened on, or null when closed. */
  const [overlayFor, setOverlayFor] = useState<string | null>(null);
  const rail = mode === "rail";

  // The overlay closes when the sidebar mode changes.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setOverlayFor(null);
  }

  useEffect(() => {
    if (overlayFor === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlayFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayFor]);

  const toggleSidebar = (pathname: string) => {
    if (rail) setOverlayFor((open) => (open === pathname ? null : pathname));
    else setSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Suspense fallback={null}>
        <WorkspaceRedirectGuard />
        <DashboardSidebarWrapper
          collapsed={sidebarCollapsed}
          rail={rail}
          overlayFor={overlayFor}
          onCloseOverlay={() => setOverlayFor(null)}
        />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Suspense
          fallback={<div className="h-14 border-b bg-background shrink-0" />}
        >
          <DashboardHeaderWrapper onToggleSidebar={toggleSidebar} />
        </Suspense>
        <main className="flex-1 overflow-y-auto w-full">
          <Suspense
            fallback={
              <div className="w-full flex justify-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/**
 * Protected dashboard shell with session guard and workspace context.
 * Always renders children uniformly so Next.js static prerender
 * validates child route segments without dropping.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <BreadcrumbProvider>
        {/* The guard reads the URL, which is only known at request time. */}
        <Suspense fallback={null}>
          <SessionGuard />
        </Suspense>
        <SidebarProvider>
          <DashboardShell>{children}</DashboardShell>
        </SidebarProvider>
      </BreadcrumbProvider>
    </WorkspaceProvider>
  );
}

/** Sends signed-out visitors to sign in and back here afterwards. */
function SessionGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      // Come back here after signing in, whichever way that happens.
      rememberReturnTo(`${pathname}${window.location.search}`);
      router.replace("/signin");
    } else if (pathname === "/dashboard") {
      // Google sign-in always lands on /dashboard: continue to the remembered page.
      const returnTo = consumeReturnTo();
      if (returnTo) router.replace(returnTo);
    }
  }, [isLoading, user, router, pathname]);

  return null;
}
