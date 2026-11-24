"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AccountSettingsDialog } from "./AccountSettingsDialog";
import { InviteWorkspaceDialog } from "@/components/projects/InviteWorkspaceDialog";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";
import { ProjectsNav } from "./ProjectsNav";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Folder01Icon,
  UserGroupIcon,
  Analytics01Icon,
  Settings01Icon,
  HelpCircleIcon,
  UnfoldMoreIcon,
  UserIcon,
  Logout01Icon,
  Add01Icon,
  UserAdd01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

interface AppSidebarProps {
  collapsed?: boolean;
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace, isTester } =
    useWorkspace();
  const [accountDialogOpen, setAccountDialogOpen] = React.useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = React.useState(false);

  // Top Nav Items
  const navItems = [
    {
      title: "Projects",
      href: "/projects",
      icon: Folder01Icon,
      active: pathname.startsWith("/projects") || pathname === "/dashboard",
    },
    ...(!isTester
      ? [
          {
            title: "Test Sessions",
            href: "/sessions",
            icon: UserGroupIcon,
            active: pathname.startsWith("/sessions"),
          },
          {
            title: "Reports",
            href: "/reports",
            icon: Analytics01Icon,
            active: pathname.startsWith("/reports"),
          },
        ]
      : []),
  ];

  const userInitials = (user?.name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const workspaceInitials = (currentWorkspace?.name || "W")
    .slice(0, 2)
    .toUpperCase();

  // COLLAPSED VIEW (Figma Node 949:13416: width 48px, icons centered)
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <aside className="w-12 border-r bg-sidebar flex flex-col h-screen shrink-0 text-sidebar-foreground items-center py-2 select-none">
          {/* Workspace Switcher Icon */}
          <div className="p-1 mb-2">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger className="p-1 rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none flex items-center justify-center">
                    <Avatar className="h-8 w-8 rounded-md border shrink-0">
                      {currentWorkspace?.avatarUrl ? (
                        <AvatarImage
                          src={currentWorkspace.avatarUrl}
                          alt={currentWorkspace.name}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold rounded-md">
                        {workspaceInitials}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {currentWorkspace?.name || "Switch Workspace"}
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent className="w-56" align="start" side="right">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Workspaces
                </DropdownMenuLabel>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => setCurrentWorkspace(ws)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === currentWorkspace?.id && (
                      <HugeIcon
                        icon={Tick02Icon}
                        size={16}
                        className="text-primary shrink-0"
                      />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsInviteDialogOpen(true)}
                  className="cursor-pointer gap-2"
                >
                  <HugeIcon icon={UserAdd01Icon} size={16} />
                  <span>Invite to workspace</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/workspaces/new")}
                  className="cursor-pointer gap-2"
                >
                  <HugeIcon icon={Add01Icon} size={16} />
                  <span>Create workspace</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Navigation Items (Icons only) */}
          <nav className="flex-1 w-full flex flex-col items-center gap-1">
            {navItems.map((item) => (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${
                      item.active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}
                  >
                    <HugeIcon icon={item.icon} size={18} />
                    <span className="sr-only">{item.title}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ))}
          </nav>

          {/* Footer Items (Settings, Help, Account) */}
          <div className="w-full flex flex-col items-center gap-1 pt-2 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setWorkspaceSettingsOpen(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors cursor-pointer"
                >
                  <HugeIcon icon={Settings01Icon} size={18} />
                  <span className="sr-only">Workspace settings</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Workspace settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="mailto:support@cyc.app"
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <HugeIcon icon={HelpCircleIcon} size={18} />
                  <span className="sr-only">Help</span>
                </a>
              </TooltipTrigger>
              <TooltipContent side="right">Help</TooltipContent>
            </Tooltip>

            {/* Account Avatar Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger className="p-1 rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none flex items-center justify-center mt-1">
                    <Avatar className="h-8 w-8 rounded-full border shrink-0">
                      {user?.image ? (
                        <AvatarImage src={user.image} alt={user.name || "User"} />
                      ) : null}
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Account</TooltipContent>
              </Tooltip>

              <DropdownMenuContent className="w-56" align="start" side="right">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.name || "Account"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAccountDialogOpen(true)}
                  className="cursor-pointer gap-2"
                >
                  <HugeIcon icon={UserIcon} size={16} />
                  <span>Account settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <HugeIcon icon={Logout01Icon} size={16} />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <AccountSettingsDialog
            open={accountDialogOpen}
            onOpenChange={setAccountDialogOpen}
          />
          <WorkspaceSettingsDialog
            open={workspaceSettingsOpen}
            onOpenChange={setWorkspaceSettingsOpen}
            workspace={currentWorkspace}
          />
          <InviteWorkspaceDialog
            isOpen={isInviteDialogOpen}
            onClose={() => setIsInviteDialogOpen(false)}
            workspaceId={currentWorkspace?.id}
            workspaceName={currentWorkspace?.name}
          />
        </aside>
      </TooltipProvider>
    );
  }

  // EXPANDED VIEW
  return (
    <>
      <aside className="w-64 border-r bg-sidebar flex flex-col h-screen shrink-0 text-sidebar-foreground">
        {/* Workspace Switcher Header */}
        <div className="p-3 border-b">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left focus:outline-none">
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-8 w-8 rounded-md border shrink-0">
                  {currentWorkspace?.avatarUrl ? (
                    <AvatarImage
                      src={currentWorkspace.avatarUrl}
                      alt={currentWorkspace.name}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold rounded-md">
                    {workspaceInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate leading-tight">
                    {currentWorkspace?.name || "Select Workspace"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Workspace
                  </p>
                </div>
              </div>
              <HugeIcon
                icon={UnfoldMoreIcon}
                size={16}
                className="text-muted-foreground shrink-0"
              />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64" align="start">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setCurrentWorkspace(ws)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === currentWorkspace?.id && (
                    <HugeIcon icon={Tick02Icon} size={16} className="text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsInviteDialogOpen(true)}
                className="cursor-pointer gap-2"
              >
                <HugeIcon icon={UserAdd01Icon} size={16} />
                <span>Invite to workspace</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/workspaces/new")}
                className="cursor-pointer gap-2"
              >
                <HugeIcon icon={Add01Icon} size={16} />
                <span>Create workspace</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Navigation */}
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspace
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    item.active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <HugeIcon icon={item.icon} size={18} className="shrink-0" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Recent projects group */}
          {!isTester && (
            <div>
              <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recent projects
              </p>
              <ProjectsNav />
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t space-y-1">
          <button
            type="button"
            onClick={() => setWorkspaceSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors cursor-pointer text-left"
          >
            <HugeIcon icon={Settings01Icon} size={18} className="shrink-0" />
            <span>Workspace settings</span>
          </button>

          <a
            href="mailto:support@cyc.app"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <HugeIcon icon={HelpCircleIcon} size={18} className="shrink-0" />
            <span>Help</span>
          </a>

          {/* Account Menu */}
          <div className="pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left focus:outline-none">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar className="h-8 w-8 rounded-full border shrink-0">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user.name || "User"} />
                    ) : null}
                    <AvatarFallback className="bg-muted text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate leading-tight">
                      {user?.name || user?.email || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <HugeIcon
                  icon={UnfoldMoreIcon}
                  size={16}
                  className="text-muted-foreground shrink-0"
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-56" align="start" side="top">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.name || "Account"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAccountDialogOpen(true)}
                  className="cursor-pointer gap-2"
                >
                  <HugeIcon icon={UserIcon} size={16} />
                  <span>Account settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <HugeIcon icon={Logout01Icon} size={16} />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Account Settings Modal */}
      <AccountSettingsDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
      />
      <WorkspaceSettingsDialog
        open={workspaceSettingsOpen}
        onOpenChange={setWorkspaceSettingsOpen}
        workspace={currentWorkspace}
      />
      <InviteWorkspaceDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        workspaceId={currentWorkspace?.id}
        workspaceName={currentWorkspace?.name}
      />
    </>
  );
}
