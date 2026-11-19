import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

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
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}
