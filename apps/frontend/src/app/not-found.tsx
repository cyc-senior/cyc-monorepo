"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

/**
 * Unknown pages stay here, signed in or not: no redirect to sign-in. The
 * visitor chooses to go back or to a safe place.
 */
export default function NotFound() {
  const router = useRouter();
  const { user } = useAuth();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(user ? "/dashboard" : "/");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="font-heading text-5xl font-medium text-foreground">404</p>
        <h1 className="font-heading text-xl font-medium text-foreground">
          This page could not be found.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The link may be broken or the page may have moved.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={goBack}>
          Go back
        </Button>
        <Button asChild>
          <Link href={user ? "/dashboard" : "/"}>{user ? "Go to dashboard" : "Go home"}</Link>
        </Button>
      </div>
    </main>
  );
}
