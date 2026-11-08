"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

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
                  Forgot password
                </CardTitle>
                <CardDescription>
                  {submitted
                    ? "Check your inbox. If an account exists, a reset link was sent."
                    : "Enter your email address and we'll send you a link to reset your password."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {submitted ? (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full cursor-pointer"
                      onClick={() => setSubmitted(false)}
                    >
                      Resend email
                    </Button>
                    <div className="text-center">
                      <Link
                        href="/signin"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to sign in
                      </Link>
                    </div>
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

                    <div className="text-center pt-2">
                      <Link
                        href="/signin"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to sign in
                      </Link>
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

