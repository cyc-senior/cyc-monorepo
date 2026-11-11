"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info, MailCheck } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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

function SignUpContent() {
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get("session_code");

  // Form states
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  // Step state: "form" | "verify"
  const [step, setStep] = React.useState<"form" | "verify">("form");
  const [otp, setOtp] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);

  // Form errors
  const [errors, setErrors] = React.useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  const validateForm = () => {
    const newErrors: {
      fullName?: string;
      email?: string;
      password?: string;
    } = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = "Please enter a valid email (e.g. you@company.com)";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Advance to OTP verify step
    console.log("Mock sign up created:", { fullName, email, sessionCode });
    setStep("verify");
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setOtpError("Please enter the complete 6-digit code");
      return;
    }
    setOtpError(null);
    // Dummy api verification
    console.log("Verifying OTP:", otp, "for email:", email, "sessionCode:", sessionCode);
  };

  const handleResendOtp = () => {
    setOtp("");
    setOtpError(null);
    console.log("Resending OTP code to:", email);
  };

  const handleGoogleLogin = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
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
            {/* Alert if session code is provided in url */}
            {sessionCode && step === "form" && (
              <Alert variant="info" className="relative">
                <Info className="h-4 w-4" />
                <AlertTitle>Joining session {sessionCode}</AlertTitle>
                <AlertDescription>
                  After you verify your email, we&apos;ll take you straight to the session.
                </AlertDescription>
              </Alert>
            )}

            <Card className="w-full shadow-sm">
              {step === "form" ? (
                /* Step 1: Create Account Form */
                <>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-semibold">
                      Create your account
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <form onSubmit={handleCreateAccount} className="space-y-4" noValidate>
                      {/* Full Name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName">Full name</Label>
                        <Input
                          id="fullName"
                          placeholder="Your name"
                          value={fullName}
                          error={!!errors.fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (errors.fullName) {
                              setErrors((prev) => ({ ...prev, fullName: undefined }));
                            }
                          }}
                        />
                        {errors.fullName && (
                          <p className="text-xs text-destructive">{errors.fullName}</p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
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

                      {/* Password with Eye Icon */}
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 8 characters"
                            value={password}
                            error={!!errors.password}
                            className="pr-10"
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (errors.password) {
                                setErrors((prev) => ({ ...prev, password: undefined }));
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-xs text-destructive">
                            {errors.password}
                          </p>
                        )}
                      </div>

                      {/* Create account button */}
                      <Button type="submit" className="w-full cursor-pointer">
                        Create account
                      </Button>
                    </form>

                    {/* OR Divider */}
                    <div className="relative flex items-center justify-center my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <span className="relative bg-card px-2 text-xs uppercase text-muted-foreground font-medium">
                        or
                      </span>
                    </div>

                    {/* Google Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 cursor-pointer"
                      onClick={handleGoogleLogin}
                    >
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </Button>

                    {/* Already have an account? Sign in */}
                    <div className="space-y-3 text-center pt-2">
                      <p className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                          href={
                            sessionCode
                              ? `/signin?session_code=${encodeURIComponent(sessionCode)}`
                              : "/signin"
                          }
                          className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
                        >
                          Sign in
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
                  </CardContent>
                </>
              ) : (
                /* Step 2: Check your email (OTP Verification) */
                <>
                  <CardHeader className="space-y-1 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                      <MailCheck className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl font-semibold">
                      Check your email
                    </CardTitle>
                    <CardDescription>
                      We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <form onSubmit={handleVerifyOtp} className="space-y-6" noValidate>
                      <div className="space-y-2">
                        <Label className="text-center block text-xs text-muted-foreground">
                          Enter 6-digit verification code
                        </Label>
                        <InputOTP
                          maxLength={6}
                          value={otp}
                          onChange={(val) => {
                            setOtp(val);
                            if (otpError) setOtpError(null);
                          }}
                          containerClassName="justify-center"
                          aria-invalid={!!otpError}
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
                        {otpError && (
                          <p className="text-xs text-destructive text-center">{otpError}</p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <Button type="submit" className="w-full cursor-pointer">
                          Verify and continue
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full cursor-pointer"
                          onClick={handleResendOtp}
                        >
                          Resend a code
                        </Button>
                      </div>
                    </form>

                    <div className="text-center pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setStep("form")}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Wrong email address? Change details
                      </button>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </main>
      </MobileDesktopNotice>
    </div>
  );
}

export default function SignUpPage() {
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
      <SignUpContent />
    </React.Suspense>
  );
}

