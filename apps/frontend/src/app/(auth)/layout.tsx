"use client";

import React, { Suspense, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MobileDesktopNotice } from "@/components/mobile-desktop-notice";
import { useAuth } from "@/contexts/auth-context";
import { consumeReturnTo } from "@/lib/return-to";

/** Pages only a signed-out visitor needs. */
const SIGNED_OUT_ONLY = ["/signin", "/signup", "/forgot-password"];

function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const sessionCode = searchParams.get("session_code");

  // Signed in (by any method): sign-in and sign-up have nothing to offer, so
  // go back to where the visitor came from, or the dashboard. A tester
  // invitation (session_code) and the /auth/* sign-in steps stay reachable.
  const guarded = SIGNED_OUT_ONLY.includes(pathname) && !sessionCode;
  const leaving = guarded && Boolean(user);

  useEffect(() => {
    if (!isLoading && leaving) {
      router.replace(consumeReturnTo() ?? "/dashboard");
    }
  }, [isLoading, leaving, router]);

  // Don't flash the form while the session is checked or while leaving.
  if (guarded && (isLoading || leaving)) {
    return <div className="min-h-screen bg-[var(--cyc-bg-brand)]" />;
  }

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

/**
 * Shared layout shell for authentication views (signin, signup, reset password).
 */
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

