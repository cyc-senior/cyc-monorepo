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
    <section className={cn("bg-background section-padding", className)}>
      <div className="container-page">
        <div className="mb-10">
          <h2 className="section-heading text-foreground mb-3">{title}</h2>
          <p className="section-description text-muted-foreground max-w-xl">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
