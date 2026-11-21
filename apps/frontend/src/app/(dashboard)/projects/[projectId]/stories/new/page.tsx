"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Tick01Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Add01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
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

  // Personas & Devices & Screen Scope
  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = React.useState<string[]>([]);
  const [devices, setDevices] = React.useState<string[]>(["DESKTOP", "MOBILE"]);
  const [screensList, setScreensList] = React.useState<string[]>([
    "Find a room",
    "Room details",
    "Booking confirmed",
  ]);
  const [newScreenInput, setNewScreenInput] = React.useState("");
  const [isAddingScreen, setIsAddingScreen] = React.useState(false);

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

  const handleAddScreen = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newScreenInput.trim();
    if (val && !screensList.includes(val)) {
      setScreensList((prev) => [...prev, val]);
      setNewScreenInput("");
      setIsAddingScreen(false);
    }
  };

  const handleRemoveScreen = (screen: string) => {
    setScreensList((prev) => prev.filter((s) => s !== screen));
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
        screenScope: screensList.length > 0 ? screensList : undefined,
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

  // Color swatches from design intent
  const intentColors = [
    intent?.primaryColor,
    intent?.secondaryColor,
    intent?.accentColor,
  ].filter(Boolean) as string[];

  // Tone of voice tags
  const toneTags = intent?.toneOfVoice
    ? intent.toneOfVoice.split(",").map((t) => t.trim()).filter(Boolean)
    : ["Friendly", "Clear", "Helpful"];

  return (
    <div className="w-full p-10 flex flex-col gap-6">
      {/* Page Header matching Figma Node 815:14269 */}
      <div className="space-y-1.5">
        <h1 className="text-3xl sm:text-4xl font-heading font-medium tracking-tight text-foreground">
          User story & problem statement
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          One user story is one design cycle. AI turns this into a structured prompt you review next.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <HugeIcon icon={Alert02Icon} size={16} />
          <AlertTitle>Validation error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column matching Figma Node 815:14274 */}
          <div className="flex-1 space-y-6 w-full">
            {/* Card 1: User story matching Figma Node 815:14275 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h2 className="text-xl font-heading font-medium text-foreground">
                User story
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="story-role" className="text-sm font-medium text-foreground">
                    As a…
                  </Label>
                  <Input
                    id="story-role"
                    placeholder="student planning a group study session"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="story-want" className="text-sm font-medium text-foreground">
                    I want to…
                  </Label>
                  <Input
                    id="story-want"
                    placeholder="see which rooms are free at the time I need"
                    value={want}
                    onChange={(e) => setWant(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="story-benefit" className="text-sm font-medium text-foreground">
                    So that…
                  </Label>
                  <Input
                    id="story-benefit"
                    placeholder="I can book one without checking every room"
                    value={benefit}
                    onChange={(e) => setBenefit(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Problem matching Figma Node 815:14276 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Problem
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="problem-statement" className="text-sm font-medium text-foreground">
                    Problem statement
                  </Label>
                  <Textarea
                    id="problem-statement"
                    rows={3}
                    placeholder="4 in 10 students who start a booking leave before they finish. They open each room one by one to see when it is free, and give up after the third or fourth room."
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="success-metric" className="text-sm font-medium text-foreground">
                    Success measure
                  </Label>
                  <Input
                    id="success-metric"
                    placeholder="Book a room for a set time in under 60 seconds without help"
                    value={successMetric}
                    onChange={(e) => setSuccessMetric(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Scope matching Figma Node 815:14277 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-5">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Scope
              </h2>

              {/* Persona section matching Figma Node 815:14303 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Persona
                </Label>
                {personas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No personas defined in design intent.{" "}
                    <Link
                      href={`/projects/${projectId}/setup/intent`}
                      className="underline hover:text-foreground"
                    >
                      Add persona
                    </Link>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {personas.map((p) => {
                      const isSelected = selectedPersonaIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePersona(p.id)}
                          className={`rounded-[10px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#ecfccb] text-[#4d7c0f] border border-transparent shadow-2xs"
                              : "border border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {p.name}{p.age ? `, ${p.age}` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Screens in scope section matching Figma Node 815:14308 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Screens in scope
                </Label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {screensList.map((screen) => (
                    <span
                      key={screen}
                      className="rounded-[10px] bg-muted px-2.5 py-1 text-xs font-medium text-foreground flex items-center gap-1.5"
                    >
                      <span>{screen}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveScreen(screen)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <HugeIcon icon={Cancel01Icon} size={12} />
                      </button>
                    </span>
                  ))}

                  {isAddingScreen ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        placeholder="Screen name"
                        value={newScreenInput}
                        onChange={(e) => setNewScreenInput(e.target.value)}
                        className="h-7 text-xs w-36 rounded-[8px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddScreen(e);
                          } else if (e.key === "Escape") {
                            setIsAddingScreen(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddScreen}
                        className="h-7 px-2 text-xs rounded-[8px]"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingScreen(false)}
                        className="h-7 px-1.5 text-xs rounded-[8px]"
                      >
                        <HugeIcon icon={Cancel01Icon} size={14} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingScreen(true)}
                      className="h-7 px-2.5 text-xs font-medium gap-1 text-foreground hover:bg-muted rounded-[10px] cursor-pointer"
                    >
                      <HugeIcon icon={Add01Icon} size={14} />
                      <span>Add</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Devices in scope section matching Figma Node 815:14315 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Devices
                </Label>
                <div className="flex items-center gap-5 pt-1">
                  {/* Desktop Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleDevice("DESKTOP")}
                    className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer select-none"
                  >
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                        devices.includes("DESKTOP")
                          ? "bg-[#ecfccb] border-[#9ae600] text-[#497d00]"
                          : "border-border bg-card"
                      }`}
                    >
                      {devices.includes("DESKTOP") && (
                        <HugeIcon icon={Tick01Icon} size={12} />
                      )}
                    </span>
                    <span>Desktop</span>
                  </button>

                  {/* Mobile Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleDevice("MOBILE")}
                    className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer select-none"
                  >
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                        devices.includes("MOBILE")
                          ? "bg-[#ecfccb] border-[#9ae600] text-[#497d00]"
                          : "border-border bg-card"
                      }`}
                    >
                      {devices.includes("MOBILE") && (
                        <HugeIcon icon={Tick01Icon} size={12} />
                      )}
                    </span>
                    <span>Mobile</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  AI builds A and B for each device you pick.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column matching Figma Node 815:14278 */}
          <div className="w-full lg:w-[400px] shrink-0 space-y-4 lg:sticky lg:top-6 self-start">
            {/* Card 1: Tips for a better A/B matching Figma Node 815:14279 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-3">
              <h3 className="font-heading font-medium text-xl text-foreground">
                Tips for a better A/B
              </h3>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <p>• Describe one problem, not a feature list.</p>
                <p>• Use numbers you already have (drop-off, time).</p>
                <p>• Name the screens so AI keeps the scope small.</p>
              </div>
            </div>

            {/* Card 2: From design intent matching Figma Node 815:14280 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                From design intent
              </h3>

              <div className="space-y-3.5">
                {/* Design system */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block">
                    Design system
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-[10px] border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                      {intent?.designSystem === "MUI" ? "MUI" : "shadcn"}
                    </span>
                    <span className="rounded-[10px] border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                      {intent?.designStandards?.[0] || "WCAG 2.2 AA"}
                    </span>
                  </div>
                </div>

                {/* Brand colours */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block">
                    Brand colours
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(intentColors.length > 0
                      ? intentColors
                      : ["#F2652A", "#FFB81C", "#1E1E1E"]
                    ).map((col, idx) => (
                      <div
                        key={idx}
                        className="rounded-[6px] border border-border px-2 py-0.5 flex items-center gap-1.5 text-xs font-mono uppercase bg-card"
                      >
                        <span
                          className="h-3 w-3 rounded-[3px] border border-border/50 block shrink-0"
                          style={{ backgroundColor: col }}
                        />
                        <span>{col}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tone of voice */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block">
                    Tone of voice
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {toneTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-[10px] bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                asChild
                className="w-full rounded-[10px] h-8 text-xs font-medium border-border cursor-pointer hover:bg-muted"
              >
                <Link href={`/projects/${projectId}/setup/intent`}>
                  <span>Edit design intent</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Navigation matching Figma Node 815:14281 */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            asChild
            className="rounded-[10px] h-8 px-3 font-medium text-sm text-foreground hover:bg-muted cursor-pointer"
          >
            <Link href={`/projects/${projectId}`}>
              <HugeIcon icon={ArrowLeft01Icon} size={16} />
              <span>Back</span>
            </Link>
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 rounded-[10px] h-8 px-4 font-medium text-sm bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] cursor-pointer shadow-2xs"
          >
            <span>{isSubmitting ? "Drafting..." : "Draft structured prompt"}</span>
            <HugeIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      </form>
    </div>
  );
}
