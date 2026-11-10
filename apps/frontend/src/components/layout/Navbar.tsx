"use client";

import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
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

export interface NavbarUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface NavbarProps {
  variant?: "default" | "auth";
  user?: NavbarUser | null;
  onSignOut?: () => void;
}
function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}
export function Navbar({ variant = "default", user = null, onSignOut }: NavbarProps) {
  const isAuthVariant = variant === "auth";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background text-foreground">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="Home"
        >
          <CYCLogo />
        </Link>

        {/* Right: Actions */}
        {!isAuthVariant && (
          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="size-8">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                      )}
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">
                      {user.name}
                    </span>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium leading-none text-foreground">
                      {user.name}
                    </p>
                    <p className="truncate text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onSignOut}
                    className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="mr-2 size-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/signin">Sign in</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
