import React from "react";
import { Navbar } from "@/components/navbar";

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
      <Navbar variant="auth" />

      <main className="flex-1 flex justify-center px-4 pt-[80px] pb-16">
        <div className="w-[600px] max-w-full">{children}</div>
      </main>
    </div>
  );
}

