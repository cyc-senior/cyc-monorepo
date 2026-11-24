import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface HugeIconProps {
  icon: IconSvgElement;
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}

export function HugeIcon({
  icon,
  size = 20,
  className,
  strokeWidth = 1.5,
}: HugeIconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      // Icons keep their size next to long text in flex rows.
      className={cn("shrink-0", className)}
      strokeWidth={strokeWidth}
    />
  );
}
