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
  className?: string;
}
export function CTASection({
  title = ctaContent.title,
  description = ctaContent.description,
  buttonLabel = ctaContent.buttonLabel,
  buttonHref = ctaContent.buttonHref,
  onButtonClick,
  className,
}: CTASectionProps) {
  return (
    <section className={cn("bg-brand py-16 md:py-20", className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-brand-foreground sm:text-3xl">
              {title}
            </h2>
            <p className="text-sm text-brand-200 sm:text-base">{description}</p>
          </div>

          {onButtonClick ? (
            <Button
              type="button"
              onClick={onButtonClick}
              className="shrink-0 self-start md:self-auto"
            >
              {buttonLabel}
            </Button>
          ) : (
            <Button className="shrink-0 self-start md:self-auto" asChild>
              <Link href={buttonHref ?? "#"}>{buttonLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
