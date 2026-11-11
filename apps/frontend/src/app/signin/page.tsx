"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { MobileDesktopNotice } from "@/components/mobile-desktop-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";

// Mock session resolver
function getSessionDetails(code: string) {
  return {
    code,
    title: `UI A/B Testing Review - ${code.toUpperCase()}`,
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get("session_code");
  const authError = searchParams.get("error");
  const session = sessionCode ? getSessionDetails(sessionCode) : null;

  // Google sign in error state
  const [showGoogleError, setShowGoogleError] = React.useState(
    authError === "google" || authError === "google_failed"
  );

  // Form states
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");

  // Validation states
  const [errors, setErrors] = React.useState<{
    email?: string;
    password?: string;
    name?: string;
  }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string; name?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = "Please enter a valid email (e.g. you@company.com)";
    }

    if (session) {
      if (!name.trim()) {
        newErrors.name = "Name is required";
      }
    } else {
      if (!password) {
        newErrors.password = "Password is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStandardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Mock UI only
    console.log("Mock signin submitted:", { email, password });
  };

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Mock UI only
    console.log("Mock join session submitted:", {
      sessionCode: session?.code,
      name,
      email,
    });
  };

  const handleGoogleLogin = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "https://api.cyc.local/api";
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--cyc-bg-brand)]"
      style={{ background: "var(--cyc-bg-brand)" }}
    >
      <Navbar variant="auth" />

      <MobileDesktopNotice sessionCode={sessionCode}>
        <main className="flex-1 flex justify-center px-4 pt-[80px] pb-16">
        <div className="w-[440px] max-w-full flex flex-col gap-4">
          {/* Alert Error when Google sign-in fails or cancelled */}
          {showGoogleError && (
            <Alert variant="destructive" className="relative">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Couldn&apos;t sign you in with Google</AlertTitle>
              <AlertDescription>
                The sign-in was cancelled or didn&apos;t finish. Try again, or use your email.
              </AlertDescription>
            </Alert>
          )}

          {/* Alert Info when session code provided */}
          {session && (
            <Alert variant="info" className="relative">
              <Info className="h-4 w-4" />
              <AlertTitle>Joining session {session.code}</AlertTitle>
              <AlertDescription>{session.title}</AlertDescription>
            </Alert>
          )}

          <Card className="w-full shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold">
                {session ? "Add your details" : "Sign In"}
              </CardTitle>
              {session ? (
                <CardDescription>
                  No account needed. Just tell us who you are.
                </CardDescription>
              ) : null}
            </CardHeader>

            <CardContent>
              {session ? (
                /* Session Join Mode */
                <form onSubmit={handleJoinSession} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={name}
                      error={!!errors.name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) {
                          setErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="session-email">Email</Label>
                    <Input
                      id="session-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      error={!!errors.email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors((prev) => ({ ...prev, email: undefined }));
                        }
                      }}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full mt-2">
                    Join session
                  </Button>
                </form>
              ) : (
                /* Regular Sign In Mode */
                <div className="space-y-4">
                  <form onSubmit={handleStandardSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        error={!!errors.email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) {
                            setErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link
                          href="/forgot-password"
                          className="text-xs text-link font-medium hover:text-foreground transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        error={!!errors.password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) {
                            setErrors((prev) => ({ ...prev, password: undefined }));
                          }
                        }}
                      />
                      {errors.password && (
                        <p className="text-xs text-destructive">
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <Button type="submit" className="w-full">
                      Sign In
                    </Button>
                  </form>

                  {/* OR Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <span className="relative bg-card px-2 text-xs uppercase text-muted-foreground font-medium">
                      OR
                    </span>
                  </div>

                  {/* Google Login Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 cursor-pointer"
                    onClick={handleGoogleLogin}
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </Button>

                  {/* Footer signup & terms */}
                  <div className="space-y-3 text-center pt-2">
                    <p className="text-sm text-muted-foreground">
                      Don&apos;t have an account?{" "}
                      <Link
                        href={
                          sessionCode
                            ? `/signup?session_code=${encodeURIComponent(sessionCode)}`
                            : "/signup"
                        }
                        className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
                      >
                        Sign up
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      By continuing, you agree to the{" "}
                      <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
                        Terms of use
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                        Privacy notice
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </MobileDesktopNotice>
    </div>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense
      fallback={
        <div
          className="min-h-screen flex flex-col bg-[var(--cyc-bg-brand)]"
          style={{ background: "var(--cyc-bg-brand)" }}
        >
          <Navbar variant="auth" />
        </div>
      }
    >
      <SignInContent />
    </React.Suspense>
  );
}

