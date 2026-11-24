"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StepProgress } from "@/components/wizard/StepProgress";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Tick02Icon,
  MinusSignIcon,
  Alert02Icon,
  Add01Icon,
  Upload01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Delete02Icon,
  File01Icon,
} from "@hugeicons/core-free-icons";
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

  // Form states
  const [designSystem, setDesignSystem] = React.useState<"SHADCN" | "MUI">("SHADCN");
  const [accessibilityStandard, setAccessibilityStandard] = React.useState("WCAG 2.2 AA");
  const [brandColors, setBrandColors] = React.useState<string[]>([]);
  const [ciGuideline, setCiGuideline] = React.useState("");
  const [toneTags, setToneTags] = React.useState<string[]>([]);
  const [newTagInput, setNewTagInput] = React.useState("");
  const [isAddingTag, setIsAddingTag] = React.useState(false);
  const [toneNotes, setToneNotes] = React.useState("");

  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Modal 12C: Add brand colour State matching Figma Node 915:20674
  const [isAddColorModalOpen, setIsAddColorModalOpen] = React.useState(false);
  const [customHex, setCustomHex] = React.useState("#1A73E8");

  // Modal 12D: Upload CI guideline State matching Figma Node 916:20544
  const [isUploadCiModalOpen, setIsUploadCiModalOpen] = React.useState(false);
  const [pendingCiFile, setPendingCiFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const modalFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Modal 12A: Add Persona State matching Figma Node 815:10541
  const [isPersonaModalOpen, setIsPersonaModalOpen] = React.useState(false);
  const [personaName, setPersonaName] = React.useState("");
  const [personaAge, setPersonaAge] = React.useState("");
  const [personaDesc, setPersonaDesc] = React.useState("");
  const [personaBehaviors, setPersonaBehaviors] = React.useState("");
  const [personaFrustrations, setPersonaFrustrations] = React.useState("");
  const [personaGoals, setPersonaGoals] = React.useState("");
  const [personaTasks, setPersonaTasks] = React.useState("");
  const [personaModalError, setPersonaModalError] = React.useState<string | null>(null);
  const [isSavingPersona, setIsSavingPersona] = React.useState(false);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [intent, personaList] = await Promise.all([
          getDesignIntent(projectId).catch(() => null),
          listPersonas(projectId).catch(() => []),
        ]);
        if (intent) {
          setIsEditMode(true);
          if (intent.statement) setToneNotes(intent.statement);
          if (intent.brandGuidelines) setCiGuideline(intent.brandGuidelines);
          if (intent.toneOfVoice) {
            const tags = intent.toneOfVoice.split(",").map((t) => t.trim()).filter(Boolean);
            if (tags.length > 0) setToneTags(tags);
          }
          if (intent.primaryColor) {
            const colors = [
              intent.primaryColor,
              intent.secondaryColor || "#0F172A",
              intent.accentColor || "#F59E0B",
            ].filter(Boolean) as string[];
            setBrandColors(colors);
          }
          if (intent.designSystem) {
            setDesignSystem(intent.designSystem === "MUI" ? "MUI" : "SHADCN");
          }
          if (intent.designStandards && intent.designStandards.length > 0) {
            setAccessibilityStandard(intent.designStandards[0]);
          }
        }
        setPersonas(personaList);
      } catch {
        // Ignored
      }
    }
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleColorChange = (index: number, newColor: string) => {
    setBrandColors((prev) => {
      const updated = [...prev];
      updated[index] = newColor;
      return updated;
    });
  };

  const handleRemoveColor = (index: number) => {
    setBrandColors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (tag && !toneTags.includes(tag)) {
      setToneTags((prev) => [...prev, tag]);
    }
    setNewTagInput("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setToneTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleCreatePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim()) {
      setPersonaModalError("Persona name is required.");
      return;
    }
    const shortDesc = personaDesc.trim();
    if (!shortDesc) {
      setPersonaModalError("Short description is required.");
      return;
    }
    setPersonaModalError(null);
    setIsSavingPersona(true);

    try {
      const parsedAge = personaAge.trim() ? parseInt(personaAge.trim(), 10) : undefined;
      const validAge =
        parsedAge !== undefined && !isNaN(parsedAge) && parsedAge >= 1 && parsedAge <= 120
          ? parsedAge
          : undefined;

      const behaviorsList = personaBehaviors.split("\n").map((s) => s.trim()).filter(Boolean);
      const frustrationsList = personaFrustrations.split("\n").map((s) => s.trim()).filter(Boolean);
      const goalsList = personaGoals.split("\n").map((s) => s.trim()).filter(Boolean);
      const tasksList = personaTasks.split("\n").map((s) => s.trim()).filter(Boolean);

      const created = await createPersona(projectId, {
        name: personaName.trim(),
        age: validAge,
        shortDescription: shortDesc,
        behavioralConsiderations: behaviorsList.length > 0 ? behaviorsList : undefined,
        frustrations: frustrationsList.length > 0 ? frustrationsList : undefined,
        goals: goalsList.length > 0 ? goalsList : undefined,
        tasks: tasksList.length > 0 ? tasksList : undefined,
      });

      setPersonas((prev) => [...prev, created]);
      setIsPersonaModalOpen(false);
      setPersonaName("");
      setPersonaAge("");
      setPersonaDesc("");
      setPersonaBehaviors("");
      setPersonaFrustrations("");
      setPersonaGoals("");
      setPersonaTasks("");
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
        statement: toneNotes.trim() || undefined,
        designSystem: designSystem === "MUI" ? "MUI" : "SHADCN",
        designStandards: accessibilityStandard ? [accessibilityStandard] : ["WCAG 2.1 AA"],
        designGuidelines: undefined,
        primaryColor: brandColors[0]?.startsWith("#") ? brandColors[0] : "#1A73E8",
        secondaryColor: brandColors[1]?.startsWith("#") ? brandColors[1] : "#0F172A",
        accentColor: brandColors[2]?.startsWith("#") ? brandColors[2] : "#F59E0B",
        brandGuidelines: ciGuideline.trim() || undefined,
        toneOfVoice: toneTags.join(", ") || undefined,
      });

      if (isEditMode) {
        router.push(`/projects/${projectId}`);
      } else {
        router.push(`/projects/${projectId}/setup/team`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to save design intent.";
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Checklist completion states
  const isPersonasCompleted = personas.length > 0;
  const isDesignSystemCompleted = Boolean(designSystem);
  const isAccessibilityCompleted = Boolean(accessibilityStandard);
  const isBrandColoursCompleted = brandColors.length > 0;
  const isCiGuidelineCompleted = ciGuideline.trim().length > 0;
  const isToneOfVoiceCompleted = toneTags.length > 0 || toneNotes.trim().length > 0;

  const hasMissingItems =
    !isPersonasCompleted ||
    !isDesignSystemCompleted ||
    !isAccessibilityCompleted ||
    !isBrandColoursCompleted ||
    !isCiGuidelineCompleted ||
    !isToneOfVoiceCompleted;

  return (
    <div className="p-6 sm:p-10 space-y-8">
      {/* Step Progress Bar matching Figma Node 815:10125 & 815:10126 */}
      <StepProgress
        currentStep={2}
        stepLabel="STEP 2 OF 3"
        stepName="DESIGN INTENT"
        title="Design intent"
        description="AI uses this for every A/B it builds in this project. You can change it later."
      />

      {serverError && (
        <Alert variant="destructive">
          <AlertTitle>Save Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Columns matching Figma Node 815:10130 */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column (Forms) matching Figma Node 815:10131 */}
          <div className="flex-1 w-full space-y-4">
            {/* Personas Card matching Figma Node 815:10132 / 815:10838 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                Personas
              </h3>

              {personas.length === 0 ? (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPersonaModalOpen(true)}
                    className="gap-1 rounded-[10px] h-8 px-2.5 font-medium text-sm border-border cursor-pointer hover:bg-muted"
                  >
                    <HugeIcon icon={Add01Icon} size={16} />
                    <span>Add persona</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {personas.map((persona) => (
                      <div
                        key={persona.id}
                        className="rounded-[10px] border border-border p-2.5 sm:p-3 flex items-center justify-between gap-2.5 bg-card"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-[10px] bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                            {persona.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {persona.name}
                              {persona.age ? `, ${persona.age}` : persona.role ? `, ${persona.role.replace(/^Age\s*/i, "")}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {persona.shortDescription || persona.description || "Target persona"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePersona(persona.id)}
                          className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0 cursor-pointer"
                        >
                          <HugeIcon icon={Delete02Icon} size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPersonaModalOpen(true)}
                    className="gap-1 rounded-[10px] h-8 px-2.5 font-medium text-sm border-border cursor-pointer hover:bg-muted"
                  >
                    <HugeIcon icon={Add01Icon} size={16} />
                    <span>Add persona</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Design system & standards Card matching Figma Node 815:10133 / 815:10839 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                Design system & standards
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="design-system" className="text-sm font-medium text-foreground">
                    Design system / guideline
                  </Label>
                  <select
                    id="design-system"
                    value={designSystem}
                    onChange={(e) => setDesignSystem(e.target.value as "SHADCN" | "MUI")}
                    className="w-full h-9 rounded-[10px] border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-xs cursor-pointer"
                  >
                    <option value="SHADCN">shadcn</option>
                    <option value="MUI">Material UI</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessibility" className="text-sm font-medium text-foreground">
                    Accessibility standard
                  </Label>
                  <select
                    id="accessibility"
                    value={accessibilityStandard}
                    onChange={(e) => setAccessibilityStandard(e.target.value)}
                    className="w-full h-9 rounded-[10px] border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-xs cursor-pointer"
                  >
                    <option value="WCAG 2.2 AA">WCAG 2.2 AA</option>
                    <option value="WCAG 2.2 AAA">WCAG 2.2 AAA</option>
                    <option value="WCAG 2.1 AA">WCAG 2.1 AA</option>
                  </select>
                </div>
              </div>

              {/* Design system demo preview matching Figma Node 847:17946 */}
              <div className="rounded-[10px] border border-border overflow-hidden bg-muted/20 relative aspect-video max-h-[360px] w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designSystem === "MUI" ? "/mui_demo.jpg" : "/shadcn_demo.jpg"}
                  alt={designSystem === "MUI" ? "Material UI components preview" : "shadcn components preview"}
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>

            {/* Brand & CI Card matching Figma Node 815:10134 / 815:10840 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                Brand & CI
              </h3>

              <div className="space-y-4">
                {/* Brand Colors Swatches */}
                <div className="space-y-3">
                  {brandColors.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {brandColors.map((color, idx) => (
                        <div
                          key={idx}
                          className="rounded-[10px] border border-border p-2 flex items-center justify-between gap-2.5 bg-card shadow-xs min-w-[150px] flex-1 sm:flex-initial relative"
                        >
                          <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                            <span
                              className="h-10 w-10 rounded-[10px] border border-border shrink-0 block relative overflow-hidden shadow-2xs"
                              style={{ backgroundColor: color }}
                            />
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => handleColorChange(idx, e.target.value)}
                              className="sr-only"
                            />
                            <span className="text-sm font-medium text-foreground uppercase font-mono select-none">
                              {color}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveColor(idx);
                            }}
                            className="text-muted-foreground hover:text-destructive p-1 rounded cursor-pointer relative z-10"
                          >
                            <HugeIcon icon={Cancel01Icon} size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddColorModalOpen(true)}
                      className="gap-1 rounded-[10px] h-8 px-2.5 font-medium text-sm border-border cursor-pointer hover:bg-muted"
                    >
                      <HugeIcon icon={Add01Icon} size={16} />
                      <span>Add colour</span>
                    </Button>
                  </div>
                </div>

                {/* CI Guideline */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="ci-guideline" className="text-sm font-medium text-foreground">
                    CI guideline
                  </Label>
                  <Textarea
                    id="ci-guideline"
                    placeholder="Type your brand rules: logo use, colour ratios, what to avoid."
                    rows={3}
                    value={ciGuideline}
                    onChange={(e) => setCiGuideline(e.target.value)}
                    className="rounded-[10px] border-border text-sm"
                  />

                  {/* Upload row matching Figma Node 815:10158 */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsUploadCiModalOpen(true)}
                      className="gap-1 rounded-[10px] h-8 px-2.5 font-medium text-sm border-border cursor-pointer hover:bg-muted shrink-0"
                    >
                      <HugeIcon icon={Upload01Icon} size={16} />
                      <span>Upload file</span>
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      .md works best. PDF and Word files are turned into Markdown for AI.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tone of voice Card matching Figma Node 815:10135 / 815:10841 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                Tone of voice
              </h3>

              <div className="space-y-4">
                {/* Tone Tags row */}
                <div className="flex flex-wrap items-center gap-2">
                  {toneTags.map((tag) => (
                    <div
                      key={tag}
                      className="rounded-[10px] bg-muted px-2.5 py-1 flex items-center gap-1.5 text-xs font-medium text-foreground"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <HugeIcon icon={Cancel01Icon} size={12} />
                      </button>
                    </div>
                  ))}

                  {isAddingTag ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag(e);
                          }
                        }}
                        placeholder="e.g. Concise"
                        autoFocus
                        className="h-7 w-28 text-xs rounded-[8px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddTag}
                        className="h-7 px-2 text-xs rounded-[8px]"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingTag(false)}
                        className="h-7 px-1.5 text-xs rounded-[8px]"
                      >
                        <HugeIcon icon={Cancel01Icon} size={12} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingTag(true)}
                      className="h-7 px-2 text-xs font-medium gap-1 rounded-[10px] text-foreground hover:bg-muted cursor-pointer"
                    >
                      <HugeIcon icon={Add01Icon} size={14} />
                      <span>Add</span>
                    </Button>
                  )}
                </div>

                {/* Notes field */}
                <div className="space-y-2">
                  <Label htmlFor="tone-notes" className="text-sm font-medium text-foreground">
                    Notes
                  </Label>
                  <Textarea
                    id="tone-notes"
                    placeholder="Anything AI should know about the tone"
                    rows={2}
                    value={toneNotes}
                    onChange={(e) => setToneNotes(e.target.value)}
                    className="rounded-[10px] border-border text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: "What AI knows so far" matching Figma Node 815:10136 / 815:10842 */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 h-fit lg:sticky lg:top-6 self-start">
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                What AI knows so far
              </h3>

              {/* Checklist items */}
              <div className="space-y-1">
                {/* 1. Project description */}
                <div className="flex items-center gap-2.5 py-2">
                  <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    Project description
                  </span>
                </div>

                {/* 2. Personas */}
                <div className="flex items-center gap-2.5 py-2">
                  {isPersonasCompleted ? (
                    <>
                      <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {personas.length} {personas.length === 1 ? "persona" : "personas"}
                      </span>
                    </>
                  ) : (
                    <>
                      <HugeIcon icon={MinusSignIcon} size={20} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Personas
                      </span>
                    </>
                  )}
                </div>

                {/* 3. Design system components */}
                <div className="flex items-center gap-2.5 py-2">
                  {isDesignSystemCompleted ? (
                    <>
                      <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {designSystem} components
                      </span>
                    </>
                  ) : (
                    <>
                      <HugeIcon icon={MinusSignIcon} size={20} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Design system components
                      </span>
                    </>
                  )}
                </div>

                {/* 4. Accessibility standard */}
                <div className="flex items-center gap-2.5 py-2">
                  {isAccessibilityCompleted ? (
                    <>
                      <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {accessibilityStandard}
                      </span>
                    </>
                  ) : (
                    <>
                      <HugeIcon icon={MinusSignIcon} size={20} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Accessibility standard
                      </span>
                    </>
                  )}
                </div>

                {/* 5. Brand colours */}
                <div className="flex items-center gap-2.5 py-2">
                  {isBrandColoursCompleted ? (
                    <>
                      <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {brandColors.length} brand colours
                      </span>
                    </>
                  ) : (
                    <>
                      <HugeIcon icon={MinusSignIcon} size={20} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Brand colours
                      </span>
                    </>
                  )}
                </div>

                {/* 6. CI guideline */}
                <div className="flex items-center gap-2.5 py-2">
                  {isCiGuidelineCompleted ? (
                    <>
                      <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        CI guideline
                      </span>
                    </>
                  ) : (
                    <>
                      <HugeIcon icon={MinusSignIcon} size={20} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">
                        CI guideline
                      </span>
                    </>
                  )}
                </div>

                {/* 7. Tone of voice */}
                <div className="flex items-center gap-2.5 py-2">
                  {isToneOfVoiceCompleted ? (
                    <>
                      <HugeIcon icon={Tick02Icon} size={20} className="text-[#497d00] shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        Tone of voice
                      </span>
                    </>
                  ) : (
                    <>
                      <HugeIcon icon={MinusSignIcon} size={20} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Tone of voice
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Missing items warning banner matching Figma Node 815:10893 */}
              {hasMissingItems && (
                <div className="rounded-[10px] bg-[#ffedd5] border border-[#ffedd5] p-2.5 flex items-start gap-2">
                  <HugeIcon icon={Alert02Icon} size={16} className="text-[#c2410c] shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs text-[#c2410c]">
                    <p className="font-medium text-sm">Missing items make A/B less on-brand.</p>
                    <p className="font-normal opacity-90">You can add missing details later.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Footer matching Figma Node 815:10137 */}
        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            asChild
            className="gap-2 rounded-[10px] h-8 px-3 font-medium text-sm border-border cursor-pointer hover:bg-muted"
          >
            <Link href={`/projects/${projectId}`}>
              <HugeIcon icon={ArrowLeft01Icon} size={16} />
              <span>Back</span>
            </Link>
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 rounded-[10px] h-8 px-3.5 font-medium text-sm bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
          >
            <span>
              {isSubmitting
                ? "Saving..."
                : isEditMode
                ? "Save design intent"
                : "Next: team & roles"}
            </span>
            <HugeIcon icon={isEditMode ? Tick02Icon : ArrowRight01Icon} size={16} />
          </Button>
        </div>
      </form>

      {/* Modal 12A: Add Persona Dialog matching Figma Node 815:10541 */}
      <Dialog open={isPersonaModalOpen} onOpenChange={setIsPersonaModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-[14px] p-6">
          <form onSubmit={handleCreatePersona} noValidate className="space-y-4">
            <DialogHeader className="flex flex-row items-center justify-between pb-2">
              <DialogTitle className="font-heading font-medium text-xl text-foreground">
                Add persona
              </DialogTitle>
            </DialogHeader>

            {personaModalError && (
              <Alert variant="destructive">
                <AlertDescription>{personaModalError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 max-h-[67vh] overflow-y-auto p-1">
              {/* Name & Age Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="persona-name" className="text-sm font-medium text-foreground">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="persona-name"
                    placeholder="Mint"
                    value={personaName}
                    onChange={(e) => setPersonaName(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="persona-age" className="text-sm font-medium text-foreground">
                    Age <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="persona-age"
                    placeholder="20"
                    value={personaAge}
                    onChange={(e) => setPersonaAge(e.target.value)}
                    className="rounded-[10px]"
                  />
                </div>
              </div>

              {/* Short description */}
              <div className="space-y-1.5">
                <Label htmlFor="persona-desc" className="text-sm font-medium text-foreground">
                  Short description <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="persona-desc"
                  placeholder="Second-year student, books for her group"
                  value={personaDesc}
                  onChange={(e) => setPersonaDesc(e.target.value)}
                  className="rounded-[10px]"
                />
              </div>

              {/* Behavioral considerations */}
              <div className="space-y-1.5">
                <Label htmlFor="persona-behaviors" className="text-sm font-medium text-foreground">
                  Behavioral considerations <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="persona-behaviors"
                  placeholder="Plans group work on her laptop between classes."
                  rows={2}
                  value={personaBehaviors}
                  onChange={(e) => setPersonaBehaviors(e.target.value)}
                  className="rounded-[10px]"
                />
              </div>

              {/* Frustrations */}
              <div className="space-y-1.5">
                <Label htmlFor="persona-frustrations" className="text-sm font-medium text-foreground">
                  Frustrations <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="persona-frustrations"
                  placeholder="Opening each room one by one to see when it is free."
                  rows={2}
                  value={personaFrustrations}
                  onChange={(e) => setPersonaFrustrations(e.target.value)}
                  className="rounded-[10px]"
                />
              </div>

              {/* Goals */}
              <div className="space-y-1.5">
                <Label htmlFor="persona-goals" className="text-sm font-medium text-foreground">
                  Goals <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="persona-goals"
                  placeholder="Book a room for her group in one go."
                  rows={2}
                  value={personaGoals}
                  onChange={(e) => setPersonaGoals(e.target.value)}
                  className="rounded-[10px]"
                />
              </div>

              {/* Tasks */}
              <div className="space-y-1.5">
                <Label htmlFor="persona-tasks" className="text-sm font-medium text-foreground">
                  Tasks <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="persona-tasks"
                  placeholder="Find a free room and book it for a set time."
                  rows={2}
                  value={personaTasks}
                  onChange={(e) => setPersonaTasks(e.target.value)}
                  className="rounded-[10px]"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPersonaModalOpen(false)}
                disabled={isSavingPersona}
                className="rounded-[10px] h-8 px-3 font-medium text-sm border-border cursor-pointer hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingPersona}
                className="rounded-[10px] h-8 px-3.5 font-medium text-sm bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
              >
                {isSavingPersona ? "Saving..." : "Save persona"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 12C: Add brand colour dialog matching Figma Node 915:20674 */}
      <Dialog open={isAddColorModalOpen} onOpenChange={setIsAddColorModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[14px] p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formatted = customHex.startsWith("#") ? customHex : `#${customHex}`;
              if (/^#[0-9A-Fa-f]{6}$/.test(formatted)) {
                if (!brandColors.includes(formatted.toUpperCase())) {
                  setBrandColors((prev) => [...prev, formatted.toUpperCase()]);
                }
                setIsAddColorModalOpen(false);
              }
            }}
            className="space-y-5"
          >
            <DialogHeader className="flex flex-row items-center justify-between pb-1">
              <DialogTitle className="font-heading font-medium text-xl text-foreground">
                Add brand colour
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Native / interactive color picker */}
              <div className="rounded-[10px] border border-border p-3 flex flex-col gap-3 bg-muted/20">
                <div
                  className="h-32 w-full rounded-[8px] border border-border relative overflow-hidden flex items-center justify-center cursor-pointer shadow-inner"
                  style={{ backgroundColor: customHex }}
                >
                  <input
                    type="color"
                    value={customHex.startsWith("#") && customHex.length === 7 ? customHex : "#1A73E8"}
                    onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <span className="bg-black/50 text-white text-xs px-2.5 py-1 rounded backdrop-blur-xs font-mono select-none">
                    Click to pick shade
                  </span>
                </div>

                {/* Preset Swatches for quick selection */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {[
                    "#1A73E8",
                    "#0F172A",
                    "#F59E0B",
                    "#10B981",
                    "#8B5CF6",
                    "#EC4899",
                    "#EF4444",
                    "#06B6D4",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomHex(preset)}
                      className={`size-7 rounded-[6px] border border-border shrink-0 cursor-pointer transition-transform hover:scale-110 ${
                        customHex.toUpperCase() === preset ? "ring-2 ring-primary ring-offset-1" : ""
                      }`}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
              </div>

              {/* Hex Row matching Figma Node 915:20839 */}
              <div className="space-y-1.5">
                <Label htmlFor="hex-code" className="text-sm font-medium text-foreground">
                  Hex
                </Label>
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-[10px] border border-border shrink-0 shadow-2xs"
                    style={{ backgroundColor: customHex }}
                  />
                  <Input
                    id="hex-code"
                    value={customHex}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setCustomHex(val.startsWith("#") ? val : `#${val}`);
                    }}
                    placeholder="#1A73E8"
                    maxLength={7}
                    className="font-mono uppercase text-sm rounded-[10px]"
                  />
                </div>
                {!/^#[0-9A-Fa-f]{6}$/.test(customHex) && (
                  <p className="text-xs text-destructive">Must be a 6-digit hex color like #1A73E8</p>
                )}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddColorModalOpen(false)}
                className="rounded-[10px] h-8 px-3 text-sm cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!/^#[0-9A-Fa-f]{6}$/.test(customHex)}
                className="rounded-[10px] h-8 px-3.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
              >
                Add colour
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 12D: Upload CI guideline dialog matching Figma Node 916:20544 */}
      <Dialog open={isUploadCiModalOpen} onOpenChange={setIsUploadCiModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-[14px] p-6">
          <div className="space-y-5">
            <DialogHeader className="flex flex-row items-center justify-between pb-1">
              <DialogTitle className="font-heading font-medium text-xl text-foreground">
                Upload CI guideline
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Dropzone matching Figma Node 916:20686 */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) setPendingCiFile(file);
                }}
                className={`rounded-[12px] border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/10 hover:bg-muted/20"
                }`}
              >
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-1">
                  <HugeIcon icon={Upload01Icon} size={20} />
                </div>
                <p className="text-sm font-medium text-foreground">Drag a file here</p>
                <p className="text-xs text-muted-foreground">.md, PDF or Word</p>
                <input
                  type="file"
                  ref={modalFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingCiFile(file);
                  }}
                  accept=".md,.pdf,.doc,.docx,.txt"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => modalFileInputRef.current?.click()}
                  className="rounded-[8px] h-7 px-2.5 text-xs mt-2 border-border cursor-pointer"
                >
                  Browse files
                </Button>
              </div>

              {/* Uploaded file preview matching Figma Node 916:20708 */}
              {pendingCiFile && (
                <div className="rounded-[10px] border border-border p-3 flex items-center justify-between gap-3 bg-card shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-[8px] bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      <HugeIcon icon={File01Icon} size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pendingCiFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(pendingCiFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingCiFile(null)}
                    className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0 cursor-pointer"
                  >
                    <HugeIcon icon={Cancel01Icon} size={14} />
                  </Button>
                </div>
              )}

              {/* Upload note matching Figma Node 916:20734 */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                PDF and Word files are turned into Markdown so AI can read them. .md works best.
              </p>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPendingCiFile(null);
                  setIsUploadCiModalOpen(false);
                }}
                className="rounded-[10px] h-8 px-3 text-sm cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!pendingCiFile}
                onClick={() => {
                  if (!pendingCiFile) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
                    if (content) {
                      setCiGuideline((prev) =>
                        prev
                          ? `${prev}\n\n# ${pendingCiFile.name}\n${content}`
                          : `# ${pendingCiFile.name}\n${content}`
                      );
                    } else {
                      setCiGuideline((prev) =>
                        prev
                          ? `${prev}\n\n[Uploaded CI: ${pendingCiFile.name}]`
                          : `[Uploaded CI: ${pendingCiFile.name}]`
                      );
                    }
                  };
                  reader.readAsText(pendingCiFile);
                  setPendingCiFile(null);
                  setIsUploadCiModalOpen(false);
                }}
                className="rounded-[10px] h-8 px-3.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
              >
                Upload
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
