"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeIcon } from "@/components/ui/huge-icon";
import { SidebarLeft01Icon } from "@hugeicons/core-free-icons";

interface SidebarHeaderProps {
  onToggleSidebar?: () => void;
}

export function SidebarHeader({ onToggleSidebar }: SidebarHeaderProps) {
  return (
    <header className="h-14 border-b px-4 flex items-center gap-3 bg-background shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onToggleSidebar}
        title="Toggle sidebar"
      >
        <HugeIcon icon={SidebarLeft01Icon} size={18} />
        <span className="sr-only">Toggle sidebar</span>
      </Button>
    </header>
  );
}
