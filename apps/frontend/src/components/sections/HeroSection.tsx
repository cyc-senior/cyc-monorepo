"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { heroContent } from "@/config/landing-page-data";

export interface HeroAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface HeroSessionCardConfig {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  joinLabel: string;
  helpText: string;
}

export interface HeroSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryAction?: HeroAction;
  secondaryAction?: HeroAction;
  sessionCard?: HeroSessionCardConfig | null;
  onJoinSession?: (sessionCode: string) => void | Promise<void>;
  preview?: React.ReactNode;
  backgroundColor?: string;
  className?: string;
}

export function HeroSection({
  eyebrow,
  title = heroContent.title,
  description = heroContent.description,
  primaryAction = heroContent.primaryAction,
  secondaryAction,
  sessionCard = heroContent.sessionCard,
  onJoinSession,
  preview,
  backgroundColor,
  className,
}: HeroSectionProps) {
  const inputId = React.useId();
  const errorId = React.useId();
  const [sessionCode, setSessionCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleJoinSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = sessionCode.trim();
    if (!trimmed) {
      setError("Please enter a session code.");
      return;
    }

    setError("");
    if (!onJoinSession) {
      setError("Session joining requires a connected session service.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onJoinSession(trimmed);
    } catch {
      setError("Unable to join session right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className={cn("bg-brand text-brand-foreground", className)}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="container-page py-16 md:py-20">
        <div className="grid grid-cols-1 min-[900px]:grid-cols-[1.05fr_0.95fr] gap-10 min-[900px]:gap-10 lg:gap-12 items-center">
          {/* Left: Headline, description, CTA, and session join card */}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-overline text-primary mb-3">{eyebrow}</p>
            )}

            <h1 className="font-heading text-3xl sm:text-4xl lg:text-[44px] font-bold leading-[1.14] tracking-tight text-brand-foreground mb-4">
              {title}
            </h1>

            <p className="text-[15px] leading-relaxed text-brand-200 mb-6 max-w-2xl min-[900px]:max-w-xl">
              {description}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {primaryAction.onClick ? (
                <Button
                  type="button"
                  onClick={primaryAction.onClick}
                  size="sm"
                  className="h-9 px-4"
                >
                  {primaryAction.label}
                </Button>
              ) : (
                <Button size="sm" className="h-9 px-4" asChild>
                  <Link href={primaryAction.href ?? "#"}>
                    {primaryAction.label}
                  </Link>
                </Button>
              )}

              {secondaryAction &&
                (secondaryAction.onClick ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={secondaryAction.onClick}
                    className="h-9 px-4"
                  >
                    {secondaryAction.label}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-9 px-4" asChild>
                    <Link href={secondaryAction.href ?? "#"}>
                      {secondaryAction.label}
                    </Link>
                  </Button>
                ))}
            </div>

            {sessionCard && (
              <Card className="p-5 mt-8 border-0 shadow-md w-full min-[900px]:max-w-xl">
                <form onSubmit={handleJoinSubmit} noValidate>
                  <p className="text-sm font-semibold text-foreground mb-3.5">
                    {sessionCard.title}
                  </p>

                  <label
                    htmlFor={inputId}
                    className="text-xs font-medium text-foreground block mb-1.5"
                  >
                    {sessionCard.inputLabel}
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id={inputId}
                      type="text"
                      value={sessionCode}
                      onChange={(e) => {
                        setSessionCode(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder={sessionCard.inputPlaceholder}
                      aria-invalid={error ? "true" : undefined}
                      aria-describedby={error ? errorId : undefined}
                      className="h-9 text-xs"
                    />
                    <Button
                      type="submit"
                      variant="primarySoft"
                      size="sm"
                      disabled={isSubmitting}
                      className="h-9 px-4 shrink-0"
                    >
                      {isSubmitting ? "Joining..." : sessionCard.joinLabel}
                    </Button>
                  </div>

                  {error && (
                    <p
                      id={errorId}
                      role="alert"
                      className="mt-2 flex items-center gap-1.5 text-xs text-danger"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-2.5">
                    {sessionCard.helpText}
                  </p>
                </form>
              </Card>
            )}
          </div>

          {/* Right: Visual preview */}
          {preview && (
            <div className="min-w-0 w-full min-[900px]:flex min-[900px]:justify-end">
              <div className="w-full min-[900px]:max-w-[540px]">{preview}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
