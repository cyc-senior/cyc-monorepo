import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ctaContent } from "@/config/landing-page-data";

export interface CTASectionProps {
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
  onButtonClick?: () => void;
  backgroundColor?: string;
  className?: string;
}

export function CTASection({
  title = ctaContent.title,
  description = ctaContent.description,
  buttonLabel = ctaContent.buttonLabel,
  buttonHref = ctaContent.buttonHref,
  onButtonClick,
  backgroundColor,
  className,
}: CTASectionProps) {
  return (
    <section
      className={cn("bg-brand py-16 md:py-20", className)}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="container-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="section-heading text-brand-foreground mb-2">
              {title}
            </h2>
            <p className="text-[15px] text-brand-200">{description}</p>
          </div>

          {onButtonClick ? (
            <Button
              type="button"
              onClick={onButtonClick}
              size="sm"
              className="h-9 px-5 shrink-0 self-start md:self-auto"
            >
              {buttonLabel}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-9 px-5 shrink-0 self-start md:self-auto"
              asChild
            >
              <Link href={buttonHref ?? "#"}>{buttonLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
