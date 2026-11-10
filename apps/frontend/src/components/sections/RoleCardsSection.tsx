import { cn } from "@/lib/utils";
import { RoleCard } from "@/components/cards/RoleCard";
import {
  roleCardsContent,
  rolesData,
  type RoleItem,
} from "@/config/landing-page-data";

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
