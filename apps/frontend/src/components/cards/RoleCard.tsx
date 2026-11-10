import { MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  footerText: string;
  className?: string;
}

export function RoleCard({
  icon: Icon,
  title,
  description,
  footerText,
  className,
}: RoleCardProps) {
  return (
    <Card className={cn("p-5 flex flex-col h-full", className)}>
      <div className="w-8 h-8 rounded-full bg-primary-subtle text-primary-text flex items-center justify-center mb-4 shrink-0">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground flex-1">
        {description}
      </p>
      <Separator className="my-4" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="text-xs">{footerText}</span>
      </div>
    </Card>
  );
}
