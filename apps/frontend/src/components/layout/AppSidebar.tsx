"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Folder,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronsUpDown,
  ChevronRight,
  LogOut,
  User,
  Plus,
  Check,
} from "lucide-react";
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
import { AccountSettingsDialog } from "./AccountSettingsDialog";

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

  // Top Nav Items
  const navItems = [
    {
      title: "Projects",
      href: "/projects",
      icon: Folder,
      active: pathname.startsWith("/projects") || pathname === "/dashboard",
    },
    ...(!isTester
      ? [
          {
            title: "Test Sessions",
            href: "/sessions",
            icon: Users,
            active: pathname.startsWith("/sessions"),
          },
          {
            title: "Reports",
            href: "/reports",
            icon: BarChart3,
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

  if (collapsed) {
    return null;
  }

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
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-60" align="start">
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
                  {currentWorkspace?.id === ws.id ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/create/workspace")}
                className="cursor-pointer gap-2"
              >
                <Plus className="h-4 w-4" />
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
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      item.active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Recent projects group */}
          {!isTester && (
            <div>
              <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recent projects
              </p>
              <nav className="space-y-1">
                <Link
                  href="/projects"
                  className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">All projects</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </nav>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t space-y-1">
          {!isTester && (
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>Workspace settings</span>
            </Link>
          )}

          <a
            href="mailto:support@cyc.app"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
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
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
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
                  <User className="h-4 w-4" />
                  <span>Account settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
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
    </>
  );
}
