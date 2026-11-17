import { MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className={cn("flex h-full flex-col gap-0", className)}>
      <CardHeader className="pb-1.5">
        <div className="mb-2.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary-text">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <CardDescription className="text-xs leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
      <div className="px-5">
        <Separator />
      </div>
      <CardFooter className="gap-2 pt-4 text-muted-foreground">
        <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-xs">{footerText}</span>
      </CardFooter>
    </Card>
  );
}
