"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Smartphone,
  Monitor,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  createUserStory,
  listPersonas,
  getDesignIntent,
  PersonaItem,
  DesignIntentDetail,
} from "@/lib/project-client";

export default function NewUserStoryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // Story formula: As a... I want to... So that...
  const [role, setRole] = React.useState("");
  const [want, setWant] = React.useState("");
  const [benefit, setBenefit] = React.useState("");

  // Problem & success measure
  const [problemStatement, setProblemStatement] = React.useState("");
  const [successMetric, setSuccessMetric] = React.useState("");

  // Personas & Devices
  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = React.useState<string[]>([]);
  const [devices, setDevices] = React.useState<string[]>(["DESKTOP", "MOBILE"]);
  const [screenScope, setScreenScope] = React.useState("");

  // Intent preview
  const [intent, setIntent] = React.useState<DesignIntentDetail | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [personaList, intentDetail] = await Promise.all([
          listPersonas(projectId).catch(() => []),
          getDesignIntent(projectId).catch(() => null),
        ]);
        setPersonas(personaList);
        setIntent(intentDetail);
        if (personaList.length > 0) {
          setSelectedPersonaIds([personaList[0].id]);
        }
      } catch {
        // Ignored
      }
    }
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const toggleDevice = (dev: string) => {
    setDevices((prev) =>
      prev.includes(dev) ? prev.filter((d) => d !== dev) : [...prev, dev]
    );
  };

  const togglePersona = (id: string) => {
    setSelectedPersonaIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim() || !want.trim() || !benefit.trim()) {
      setError("Please fill out the full user story formula (As a... I want to... So that...).");
      return;
    }
    if (!problemStatement.trim()) {
      setError("Please describe the problem statement.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const created = await createUserStory(projectId, {
        role: role.trim(),
        want: want.trim(),
        benefit: benefit.trim(),
        problemStatement: problemStatement.trim(),
        successMetric: successMetric.trim() || undefined,
        personaIds: selectedPersonaIds,
        screenScope: screenScope
          ? screenScope.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        devices,
      });

      // Proceed to Screen 16: Review structured prompt
      router.push(`/projects/${projectId}/rounds/new?storyId=${created.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create user story.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          User story & problem statement
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          One user story is one design cycle. AI turns this into a structured prompt you review next.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Story Formula */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">User Story</CardTitle>
            </div>
            <CardDescription>
              State the user, their objective, and the ultimate value.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="story-role">As a…</Label>
              <Input
                id="story-role"
                placeholder="e.g. student planning a group study session"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="story-want">I want to…</Label>
              <Input
                id="story-want"
                placeholder="e.g. see which rooms are free at the time I need"
                value={want}
                onChange={(e) => setWant(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="story-benefit">So that…</Label>
              <Input
                id="story-benefit"
                placeholder="e.g. I can book one without checking every room"
                value={benefit}
                onChange={(e) => setBenefit(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Problem Statement & Success Measure */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Problem & Metric</CardTitle>
            <CardDescription>
              Why are users dropping off, and what proves the new design won?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="problem-statement">Problem statement</Label>
              <Textarea
                id="problem-statement"
                rows={3}
                placeholder="e.g. 4 in 10 students leave before finishing because they have to open each room one by one to see schedule availability."
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="success-metric">Success measure</Label>
              <Input
                id="success-metric"
                placeholder="e.g. Book a room for a set time in under 60 seconds without help"
                value={successMetric}
                onChange={(e) => setSuccessMetric(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Scope: Personas & Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scope & Targeting</CardTitle>
            <CardDescription>
              Select target persona and testing devices. AI builds A and B for each device you pick.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Personas */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Target Persona</Label>
              {personas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No personas found in design intent.{" "}
                  <Link
                    href={`/projects/${projectId}/setup/intent`}
                    className="underline hover:text-foreground"
                  >
                    Add persona
                  </Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {personas.map((p) => {
                    const isSelected = selectedPersonaIds.includes(p.id);
                    return (
                      <Button
                        key={p.id}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => togglePersona(p.id)}
                        className="rounded-full text-xs"
                      >
                        {p.name} ({p.role})
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Devices */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Devices in scope</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={devices.includes("DESKTOP") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDevice("DESKTOP")}
                  className="gap-2"
                >
                  <Monitor className="h-4 w-4" />
                  <span>Desktop</span>
                </Button>
                <Button
                  type="button"
                  variant={devices.includes("MOBILE") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDevice("MOBILE")}
                  className="gap-2"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Mobile</span>
                </Button>
              </div>
            </div>

            {/* Screen Scope */}
            <div className="space-y-1.5">
              <Label htmlFor="screen-scope">Screens in scope (comma-separated)</Label>
              <Input
                id="screen-scope"
                placeholder="e.g. Find a room, Room details, Booking confirmed"
                value={screenScope}
                onChange={(e) => setScreenScope(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Design Intent Summary Card */}
        {intent && (
          <div className="rounded-xl border bg-muted/30 p-4 text-xs space-y-2 text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Inherited from Design Intent
              </span>
              <Link
                href={`/projects/${projectId}/setup/intent`}
                className="underline hover:text-foreground"
              >
                Edit intent
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {intent.brandColorPrimary && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full border"
                    style={{ backgroundColor: intent.brandColorPrimary }}
                  />
                  <span>Primary: {intent.brandColorPrimary}</span>
                </div>
              )}
              {intent.voiceTone && (
                <div>
                  <span className="font-medium">Tone:</span> {intent.voiceTone}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span>Back</span>
            </Link>
          </Button>

          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <span>{isSubmitting ? "Drafting..." : "Draft structured prompt"}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
