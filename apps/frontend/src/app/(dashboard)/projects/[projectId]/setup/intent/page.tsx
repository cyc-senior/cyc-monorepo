"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Users,
  AlertCircle,
  Palette,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StepProgress } from "@/components/wizard/StepProgress";
import {
  getDesignIntent,
  putDesignIntent,
  listPersonas,
  createPersona,
  deletePersona,
  PersonaItem,
} from "@/lib/project-client";

export default function DesignIntentStep2Page() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [statement, setStatement] = React.useState("");
  const [colorPrimary, setColorPrimary] = React.useState("#0a0a0a");
  const [colorSecondary, setColorSecondary] = React.useState("#737373");
  const [colorAccent, setColorAccent] = React.useState("#9ae600");
  const [brandNotes, setBrandNotes] = React.useState("");
  const [voiceTone, setVoiceTone] = React.useState("Clear, modern, and trustworthy");

  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Modal 12A: Add Persona State
  const [isPersonaModalOpen, setIsPersonaModalOpen] = React.useState(false);
  const [personaName, setPersonaName] = React.useState("");
  const [personaRole, setPersonaRole] = React.useState("");
  const [personaDesc, setPersonaDesc] = React.useState("");
  const [personaGoals, setPersonaGoals] = React.useState("");
  const [personaPains, setPersonaPains] = React.useState("");
  const [personaModalError, setPersonaModalError] = React.useState<string | null>(null);
  const [isSavingPersona, setIsSavingPersona] = React.useState(false);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [intent, personaList] = await Promise.all([
          getDesignIntent(projectId).catch(() => null),
          listPersonas(projectId).catch(() => []),
        ]);
        if (intent) {
          if (intent.statement) setStatement(intent.statement);
          if (intent.brandColorPrimary) setColorPrimary(intent.brandColorPrimary);
          if (intent.brandColorSecondary) setColorSecondary(intent.brandColorSecondary);
          if (intent.brandColorAccent) setColorAccent(intent.brandColorAccent);
          if (intent.brandNotes) setBrandNotes(intent.brandNotes);
          if (intent.voiceTone) setVoiceTone(intent.voiceTone);
        }
        setPersonas(personaList);
      } finally {
        setIsLoading(false);
      }
    }
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleCreatePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim()) {
      setPersonaModalError("Persona name is required.");
      return;
    }
    setPersonaModalError(null);
    setIsSavingPersona(true);

    try {
      const created = await createPersona(projectId, {
        name: personaName.trim(),
        role: personaRole.trim() || "User",
        description: personaDesc.trim() || "Primary consumer",
        goals: personaGoals
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        painPoints: personaPains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });

      setPersonas((prev) => [...prev, created]);
      setIsPersonaModalOpen(false);
      setPersonaName("");
      setPersonaRole("");
      setPersonaDesc("");
      setPersonaGoals("");
      setPersonaPains("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to add persona.";
      setPersonaModalError(msg);
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    try {
      await deletePersona(projectId, personaId);
      setPersonas((prev) => prev.filter((p) => p.id !== personaId));
    } catch {
      // Ignored
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setIsSubmitting(true);

    try {
      await putDesignIntent(projectId, {
        statement: statement.trim() || undefined,
        brandColorPrimary: colorPrimary,
        brandColorSecondary: colorSecondary,
        brandColorAccent: colorAccent,
        brandNotes: brandNotes.trim() || undefined,
        voiceTone: voiceTone.trim() || undefined,
      });

      router.push(`/projects/${projectId}/setup/team`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to save design intent.";
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Step Progress Bar */}
      <StepProgress
        currentStep={2}
        stepLabel="Step 2 of 3"
        title="Design Intent"
        description="Tell AI your design guidelines, brand colors, and key target personas."
      />

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Save Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Design System & Guidelines */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Design System & Principles</CardTitle>
            </div>
            <CardDescription>
              Core philosophy, UI patterns, and design system constraints.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="intent-statement">Design philosophy statement</Label>
              <Textarea
                id="intent-statement"
                placeholder="e.g. Modern, accessible, minimalist fintech interface focusing on high contrast and effortless transaction completion."
                rows={3}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voice-tone">Tone of voice</Label>
              <Input
                id="voice-tone"
                placeholder="e.g. Professional, friendly, transparent, direct"
                value={voiceTone}
                onChange={(e) => setVoiceTone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Brand & Visual Tokens</CardTitle>
            </div>
            <CardDescription>
              Define your primary palette for consistent component theming.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="color-primary">Primary Brand</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="color-primary"
                    value={colorPrimary}
                    onChange={(e) => setColorPrimary(e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer p-0.5"
                  />
                  <Input
                    value={colorPrimary}
                    onChange={(e) => setColorPrimary(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="color-secondary">Secondary / Muted</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="color-secondary"
                    value={colorSecondary}
                    onChange={(e) => setColorSecondary(e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer p-0.5"
                  />
                  <Input
                    value={colorSecondary}
                    onChange={(e) => setColorSecondary(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="color-accent">Accent / Highlight</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="color-accent"
                    value={colorAccent}
                    onChange={(e) => setColorAccent(e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer p-0.5"
                  />
                  <Input
                    value={colorAccent}
                    onChange={(e) => setColorAccent(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="brand-notes">Additional Brand Notes</Label>
              <Textarea
                id="brand-notes"
                placeholder="Include font recommendations, padding conventions, or corner radius styles..."
                rows={2}
                value={brandNotes}
                onChange={(e) => setBrandNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Personas Section (Screen 12 & 12A) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Target Personas</CardTitle>
              </div>
              <CardDescription className="mt-1">
                AI agents test against these target profiles.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPersonaModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add persona</span>
            </Button>
          </CardHeader>
          <CardContent>
            {personas.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <p className="text-sm">No personas created yet.</p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Click &quot;Add persona&quot; to specify your target users.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className="rounded-lg border p-3 flex items-start justify-between bg-card text-card-foreground shadow-xs"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {persona.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {persona.role}
                      </p>
                      {persona.description && (
                        <p className="text-xs text-foreground/80 line-clamp-2 pt-1">
                          {persona.description}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePersona(persona.id)}
                      className="text-muted-foreground hover:text-destructive h-7 w-7"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            asChild
            className="gap-2 cursor-pointer"
          >
            <Link href="/projects/new">
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Link>
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 font-medium hover:bg-primary-hover cursor-pointer"
          >
            <span>{isSubmitting ? "Saving..." : "Next: Team & roles"}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Modal 12A: Add Persona Dialog */}
      <Dialog open={isPersonaModalOpen} onOpenChange={setIsPersonaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreatePersona} noValidate>
            <DialogHeader>
              <DialogTitle>Add persona</DialogTitle>
              <DialogDescription>
                Define a persona archetype that the AI test simulator will roleplay.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {personaModalError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{personaModalError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="persona-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="persona-name"
                  placeholder="e.g. Sarah, Tech-Savvy Shopper"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="persona-role">Role or title</Label>
                <Input
                  id="persona-role"
                  placeholder="e.g. Working professional, frequent traveler"
                  value={personaRole}
                  onChange={(e) => setPersonaRole(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="persona-desc">Key behaviors & traits</Label>
                <Textarea
                  id="persona-desc"
                  placeholder="Prefers quick biometric login, gets annoyed by multiple confirmation dialogs."
                  rows={2}
                  value={personaDesc}
                  onChange={(e) => setPersonaDesc(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="persona-goals">Goals (comma separated)</Label>
                <Input
                  id="persona-goals"
                  placeholder="Complete checkout in under 30s, verify security badge"
                  value={personaGoals}
                  onChange={(e) => setPersonaGoals(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPersonaModalOpen(false)}
                disabled={isSavingPersona}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingPersona}>
                {isSavingPersona ? "Adding..." : "Add persona"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
