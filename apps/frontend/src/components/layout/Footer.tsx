import Link from "next/link";
import { cn } from "@/lib/utils";
import type { FooterLink } from "@/config/site-config";

export interface FooterProps {
  copyright?: string;
  links?: FooterLink[];
  className?: string;
}
export function Footer({
  copyright = "© 2026 CYC",
  links = [
    { label: "Terms of use", href: "/terms" },
    { label: "Privacy notice", href: "/privacy" },
  ],
  className,
}: FooterProps) {
  return (
    <footer className={cn("w-full border-t border-border bg-background", className)}>
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
        <span className="text-xs text-muted-foreground">{copyright}</span>
        <nav aria-label="Footer navigation" className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
