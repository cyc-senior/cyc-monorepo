import * as React from "react";
import { Navbar, type NavbarProps } from "./Navbar";
import { Footer, type FooterProps } from "./Footer";
import { cn } from "@/lib/utils";

export interface PageLayoutProps {
  children: React.ReactNode;
  navbarProps?: NavbarProps;
  footerProps?: FooterProps;
  className?: string;
}

export function PageLayout({
  children,
  navbarProps,
  footerProps,
  className,
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-col min-h-screen overflow-x-clip bg-background text-foreground",
        className
      )}
    >
      <Navbar {...navbarProps} />
      <main className="flex-1">{children}</main>
      <Footer {...footerProps} />
    </div>
  );
}
