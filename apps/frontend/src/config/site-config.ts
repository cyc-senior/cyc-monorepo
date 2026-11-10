export interface FooterLink {
  label: string;
  href: string;
}

export interface SiteConfig {
  name: string;
  description: string;
  copyright: string;
  footerLinks: FooterLink[];
}

export const siteConfig: SiteConfig = {
  name: "CYC",
  description: "AI-powered UX/UI design feedback and A/B testing platform.",
  copyright: "© 2026 CYC",
  footerLinks: [
    { label: "Terms of use", href: "/terms" },
    { label: "Privacy notice", href: "/privacy" },
  ],
};
