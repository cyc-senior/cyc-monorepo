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
    <footer className={cn("w-full bg-background border-t border-border", className)}>
      <div className="container-page py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{copyright}</span>
        <nav aria-label="Footer navigation" className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-foreground/80 hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
