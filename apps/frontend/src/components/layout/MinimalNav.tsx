"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CYCLogo } from "@/components/logo";
import { AccountSettingsDialog } from "./AccountSettingsDialog";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  ArrowDown01Icon,
  UserCircleIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";

export function MinimalNav() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [accountDialogOpen, setAccountDialogOpen] = React.useState(false);

  const userInitials = (user?.name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="h-16 border-b px-6 lg:px-12 flex items-center justify-between bg-background shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <CYCLogo className="h-7 w-auto text-foreground" />
        </Link>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2.5 px-2 hover:bg-accent rounded-full"
              >
                <Avatar className="h-8 w-8 rounded-full border">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name || "User"} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground max-w-[150px] truncate hidden sm:inline-block">
                  {user.name || user.email}
                </span>
                <HugeIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  className="text-muted-foreground"
                />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.name || "Account"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setAccountDialogOpen(true)}
                className="cursor-pointer gap-2"
              >
                <HugeIcon icon={UserCircleIcon} size={16} />
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
        )}
      </header>

      <AccountSettingsDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
      />
    </>
  );
}
