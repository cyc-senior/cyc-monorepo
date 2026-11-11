"use client";

import React, { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { useSearchParams } from "next/navigation";
import { MobileDesktopNotice } from "@/components/mobile-desktop-notice";

function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get("session_code");

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--cyc-bg-brand)]"
      style={{ background: "var(--cyc-bg-brand)" }}
    >
      <Navbar variant="auth" />

      <MobileDesktopNotice sessionCode={sessionCode}>
        <main className="flex-1 flex justify-center px-4 pt-[80px] pb-16">
          <div className="w-[440px] max-w-full flex flex-col gap-4">
            {children}
          </div>
        </main>
      </MobileDesktopNotice>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AuthLayoutContent>{children}</AuthLayoutContent>
    </Suspense>
  );
}
