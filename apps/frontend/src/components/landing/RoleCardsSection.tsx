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
import {
  roleCardsContent,
  rolesData,
  type RoleItem,
} from "@/config/landing-page-data";

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

export interface RoleCardsSectionProps {
  title?: string;
  description?: string;
  roles?: RoleItem[];
  className?: string;
}

export function RoleCardsSection({
  title = roleCardsContent.title,
  description = roleCardsContent.description,
  roles = rolesData,
  className,
}: RoleCardsSectionProps) {
  return (
    <section className={cn("bg-background py-16 md:py-20", className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {roles.map((role) => (
            <RoleCard
              key={role.title}
              icon={role.icon}
              title={role.title}
              description={role.description}
              footerText={role.footerText}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
