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
  const [designSystem, setDesignSystem] = React.useState("shadcn");
  const [accessibilityStandard, setAccessibilityStandard] = React.useState("WCAG 2.2 AA");
  const [brandColors, setBrandColors] = React.useState<string[]>([
    "#f2652a",
    "#ffb81c",
    "#1e1e1e",
  ]);
  const [ciGuideline, setCiGuideline] = React.useState("");
  const [toneTags, setToneTags] = React.useState<string[]>([
    "Friendly",
    "Clear",
    "Helpful",
  ]);
  const [newTagInput, setNewTagInput] = React.useState("");
  const [isAddingTag, setIsAddingTag] = React.useState(false);
  const [toneNotes, setToneNotes] = React.useState(
    "Plain words, no library jargon. Show the room and time before confirming."
  );

  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Hidden file input for uploading CI guideline
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
      setIsLoading(true);
      try {
        const [intent, personaList] = await Promise.all([
          getDesignIntent(projectId).catch(() => null),
          listPersonas(projectId).catch(() => []),
        ]);
        if (intent) {
          if (intent.statement) setToneNotes(intent.statement);
          if (intent.brandNotes) setCiGuideline(intent.brandNotes);
          if (intent.voiceTone) {
            const tags = intent.voiceTone.split(",").map((t) => t.trim()).filter(Boolean);
            if (tags.length > 0) setToneTags(tags);
          }
          if (intent.brandColorPrimary) {
            const colors = [
              intent.brandColorPrimary,
              intent.brandColorSecondary || "#ffb81c",
              intent.brandColorAccent || "#1e1e1e",
            ].filter(Boolean) as string[];
            setBrandColors(colors);
          }
          if (intent.designPrinciples && intent.designPrinciples.length > 0) {
            if (intent.designPrinciples[0]) setDesignSystem(intent.designPrinciples[0]);
            if (intent.designPrinciples[1]) setAccessibilityStandard(intent.designPrinciples[1]);
          }
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCiGuideline((prev) =>
          prev ? `${prev}\n\n# ${file.name}\n${content}` : `# ${file.name}\n${content}`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleAddColor = () => {
    const defaultNewColors = ["#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"];
    const unusedColor = defaultNewColors.find((c) => !brandColors.includes(c)) || "#6366f1";
    setBrandColors((prev) => [...prev, unusedColor]);
  };

  const handleColorChange = (index: number, newColor: string) => {
    setBrandColors((prev) => {
      const updated = [...prev];
      updated[index] = newColor;
      return updated;
    });
  };

  const handleRemoveColor = (index: number) => {
    if (brandColors.length <= 1) return;
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
    setPersonaModalError(null);
    setIsSavingPersona(true);

    try {
      const goalsList = [
        ...personaGoals.split("\n").map((s) => s.trim()).filter(Boolean),
        ...personaTasks.split("\n").map((s) => s.trim()).filter(Boolean),
      ];
      const painsList = personaFrustrations
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await createPersona(projectId, {
        name: personaName.trim(),
        role: personaAge.trim() ? `Age ${personaAge.trim()}` : "User",
        description:
          personaDesc.trim() ||
          personaBehaviors.trim() ||
          "Target persona",
        goals: goalsList.length > 0 ? goalsList : ["Achieve goal"],
        painPoints: painsList.length > 0 ? painsList : ["Friction points"],
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
        brandColorPrimary: brandColors[0] || undefined,
        brandColorSecondary: brandColors[1] || undefined,
        brandColorAccent: brandColors[2] || undefined,
        brandNotes: ciGuideline.trim() || undefined,
        voiceTone: toneTags.join(", ") || undefined,
        designPrinciples: [designSystem, accessibilityStandard].filter(Boolean),
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

  // Checklist completion states
  const isPersonasCompleted = personas.length > 0;
  const isDesignSystemCompleted = Boolean(designSystem && designSystem !== "none");
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
                              {persona.role ? `, ${persona.role.replace(/^Age\s*/i, "")}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {persona.description || "Target persona"}
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
                    onChange={(e) => setDesignSystem(e.target.value)}
                    className="w-full h-9 rounded-[10px] border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-xs cursor-pointer"
                  >
                    <option value="shadcn">shadcn</option>
                    <option value="Tailwind UI">Tailwind UI</option>
                    <option value="Material UI">Material UI</option>
                    <option value="Ant Design">Ant Design</option>
                    <option value="Custom / None">Custom / None</option>
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
                    <option value="Section 508">Section 508</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Brand & CI Card matching Figma Node 815:10134 / 815:10840 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-medium text-xl text-foreground">
                Brand & CI
              </h3>

              <div className="space-y-4">
                {/* Brand Colors Swatches */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {brandColors.map((color, idx) => (
                      <div
                        key={idx}
                        className="rounded-[10px] border border-border p-2 flex items-center justify-between gap-2.5 bg-card shadow-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <label
                            className="h-10 w-10 rounded-[10px] border border-border shrink-0 cursor-pointer block relative overflow-hidden"
                            style={{ backgroundColor: color }}
                          >
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => handleColorChange(idx, e.target.value)}
                              className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                            />
                          </label>
                          <span className="text-sm font-medium text-foreground uppercase font-mono">
                            {color}
                          </span>
                        </div>
                        {brandColors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveColor(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded cursor-pointer"
                          >
                            <HugeIcon icon={Cancel01Icon} size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddColor}
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
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".md,.pdf,.doc,.docx,.txt"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
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
          <div className="w-full lg:w-[400px] shrink-0 h-fit">
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
            <Link href={`/projects/${projectId}/setup/story`}>
              <HugeIcon icon={ArrowLeft01Icon} size={16} />
              <span>Back</span>
            </Link>
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 rounded-[10px] h-8 px-3.5 font-medium text-sm bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
          >
            <span>{isSubmitting ? "Saving..." : "Next: team & roles"}</span>
            <HugeIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      </form>

      {/* Modal 12A: Add Persona Dialog matching Figma Node 815:10541 */}
      <Dialog open={isPersonaModalOpen} onOpenChange={setIsPersonaModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-[14px] p-6">
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

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
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
                    Age
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
                  Short description
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
                  Behavioral considerations
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
                  Frustrations
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
                  Goals
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
                  Tasks
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
    </div>
  );
}
