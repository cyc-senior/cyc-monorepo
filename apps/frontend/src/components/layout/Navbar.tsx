"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CYCLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  ArrowDown01Icon,
  HelpCircleIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";

export interface NavbarUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface NavbarProps {
  variant?: "default" | "auth";
  user?: NavbarUser | null;
  onSignOut?: () => void;
  /** When true (e.g. tester mode or user has no workspace), hides Projects & Reports navigation links */
  hideWorkspaceLinks?: boolean;
}

export function Navbar({
  variant = "default",
  user = null,
  onSignOut,
  hideWorkspaceLinks = false,
}: NavbarProps) {
  const isAuthVariant = variant === "auth";
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background text-foreground">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Left: Logo + Nav links */}
        <div className="flex items-center gap-6">
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            aria-label="Home"
          >
            <CYCLogo />
          </Link>

          {!isAuthVariant && user && (
            <nav className="hidden md:flex items-center gap-2" aria-label="Main Navigation">
              <Link
                href="/dashboard"
                className={`h-8 px-2.5 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                  pathname === "/dashboard"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                Home
              </Link>
              {!hideWorkspaceLinks && (
                <Link
                  href="/projects"
                  className={`h-8 px-2.5 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                    pathname?.startsWith("/projects")
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  Projects
                </Link>
              )}
              <Link
                href="/sessions"
                className={`h-8 px-2.5 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                  pathname?.startsWith("/sessions")
                    ? "bg-secondary text-secondary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                Sessions
              </Link>
              {!hideWorkspaceLinks && (
                <Link
                  href="/reports"
                  className={`h-8 px-2.5 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                    pathname?.startsWith("/reports")
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  Reports
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right: Actions */}
        {!isAuthVariant && (
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Help"
                >
                  <HugeIcon icon={HelpCircleIcon} size={16} />
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-2 rounded-[10px] py-1 pl-1 pr-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar className="h-8 w-8 rounded-[10px]">
                        {user.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user.name} className="rounded-[10px]" />
                        )}
                        <AvatarFallback className="rounded-[10px]">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground hidden sm:inline">
                        {user.name}
                      </span>
                      <HugeIcon icon={ArrowDown01Icon} size={16} className="text-muted-foreground transition-transform duration-200" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex flex-col space-y-1 p-2">
                      <p className="text-sm font-medium leading-none text-foreground">
                        {user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onSignOut}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                    >
                      <HugeIcon icon={Logout01Icon} size={16} className="mr-2" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button variant="ghost" className="bg-secondary rounded-[10px]" asChild>
                <Link href="/signin">Sign in</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
