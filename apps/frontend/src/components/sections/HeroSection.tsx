"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      setError("Joining by session code is not available yet.");
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
    <section className={cn("bg-brand text-brand-foreground", className)}>
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Left: Headline, description, CTA, and session join card */}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-3 text-overline text-primary">{eyebrow}</p>
            )}

            <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-brand-foreground sm:text-4xl xl:text-5xl">
              {title}
            </h1>

            <p className="mb-6 max-w-2xl text-sm leading-relaxed text-brand-200 sm:text-base lg:max-w-xl">
              {description}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {primaryAction.onClick ? (
                <Button type="button" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </Button>
              ) : (
                <Button asChild>
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
                    onClick={secondaryAction.onClick}
                  >
                    {secondaryAction.label}
                  </Button>
                ) : (
                  <Button variant="outline" asChild>
                    <Link href={secondaryAction.href ?? "#"}>
                      {secondaryAction.label}
                    </Link>
                  </Button>
                ))}
            </div>

            {sessionCard && (
              <Card className="mt-6 w-full gap-0 border-0 ppy-5 shadow-md lg:max-w-xl">
                <CardHeader className="px-5 pb-3.5">
                  <h2 className="font-sans text-sm font-semibold leading-none tracking-tight text-foreground">
                    {sessionCard.title}
                  </h2>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleJoinSubmit} noValidate>
                    <label
                      htmlFor={inputId}
                      className="mb-1.5 block text-xs font-medium text-foreground"
                    >
                      {sessionCard.inputLabel}
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={inputId}
                        name="sessionCode"
                        type="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        value={sessionCode}
                        onChange={(e) => {
                          setSessionCode(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder={sessionCard.inputPlaceholder}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        className="text-xs"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={isSubmitting}
                        className="shrink-0 border-primary-300 bg-primary-subtle font-semibold text-primary-text hover:bg-primary-200 hover:text-primary-text dark:border-primary-800 dark:hover:bg-primary-900"
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
                        <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                      </p>
                    )}

                    <p className="mt-2.5 text-xs text-muted-foreground">
                      {sessionCard.helpText}
                    </p>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Visual preview */}
          {preview && <div className="w-full h-full p-12">{preview}</div>}
        </div>
      </div>
    </section>
  );
}
