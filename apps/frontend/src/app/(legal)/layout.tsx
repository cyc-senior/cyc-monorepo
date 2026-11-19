import React, { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";

/**
 * Shared layout shell for legal, policy, and compliance documentation pages.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--cyc-bg-brand)]"
      style={{ background: "var(--cyc-bg-brand)" }}
    >
      <Suspense fallback={<div className="h-16 border-b border-border bg-background" />}>
        <Navbar variant="auth" />
      </Suspense>

      <main className="flex-1 flex justify-center px-4 pt-[80px] pb-16">
        <div className="w-[600px] max-w-full">{children}</div>
      </main>
    </div>
  );
}
