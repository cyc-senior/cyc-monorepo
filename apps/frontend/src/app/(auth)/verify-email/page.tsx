"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const sessionCode = searchParams.get("session_code");
  const { verifyEmailOtp, resendVerificationCode } = useAuth();

  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyEmailOtp(emailParam, otp.trim());
      setSuccess(true);
      if (sessionCode) {
        router.push(`/dashboard?session_code=${encodeURIComponent(sessionCode)}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Invalid or expired verification code.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setOtp("");
    setError(null);
    try {
      await resendVerificationCode(emailParam);
    } catch {
      // Ignored
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-semibold">Verify email</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">
            {emailParam || "your email address"}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Verification failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="border-primary/20 bg-primary/5 text-primary">
            <AlertTitle>Email verified!</AlertTitle>
            <AlertDescription>
              Redirecting you to workspace...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (error) setError(null);
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button type="submit" className="w-full" disabled={success}>
            Verify email
          </Button>
        </form>

        <div className="space-y-3 text-center text-sm">
          <p className="text-muted-foreground">
            Didn&apos;t get the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors cursor-pointer"
            >
              {isResending ? "Resending..." : "Resend code"}
            </button>
          </p>
          <div>
            <Link
              href="/signin"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailContent />
    </React.Suspense>
  );
}
