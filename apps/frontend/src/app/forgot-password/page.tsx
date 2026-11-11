"use client";

import * as React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [countdown, setCountdown] = React.useState(COUNTDOWN_SECONDS);

  React.useEffect(() => {
    if (!submitted || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted, countdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email (e.g. you@company.com)");
      return;
    }
    setError(null);
    setSubmitted(true);
    setCountdown(COUNTDOWN_SECONDS);
  };

  const handleResend = () => {
    console.log("Resending reset password link to:", email);
    setCountdown(COUNTDOWN_SECONDS);
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--cyc-bg-brand)]"
      style={{ background: "var(--cyc-bg-brand)" }}
    >
      <Navbar variant="auth" />

      <MobileDesktopNotice>
        <main className="flex-1 flex justify-center px-4 pt-[80px] pb-16">
          <div className="w-[440px] max-w-full">
            <Card className="w-full shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-semibold">
                  {submitted ? "Check your email" : "Reset your password"}
                </CardTitle>
                <CardDescription>
                  {submitted
                    ? `If an account exists for ${email}, we sent a link to reset your password.`
                    : "Enter your email and we'll send you a reset link."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {submitted ? (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full cursor-pointer disabled:cursor-not-allowed"
                      disabled={countdown > 0}
                      onClick={handleResend}
                    >
                      {countdown > 0
                        ? `Resend email (${formatCountdown(countdown)})`
                        : "Resend email"}
                    </Button>

                    <Button variant="ghost" asChild className="w-full">
                      <Link href="/signin">Back to sign in</Link>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        error={!!error}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                      />
                      {error && (
                        <p className="text-xs text-destructive">{error}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full cursor-pointer">
                      Send reset link
                    </Button>

                    <div className="pt-2">
                      <Button variant="ghost" asChild className="w-full">
                        <Link href="/signin">Back to sign in</Link>
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </MobileDesktopNotice>
    </div>
  );
}
