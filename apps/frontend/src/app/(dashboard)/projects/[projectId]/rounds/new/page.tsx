"use client";

import * as React from "react";
import { storyShortTitle } from "@/lib/design-cycle";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Tick02Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import {
  getUserStoryById,
  createDesignRound,
  startGenerationJob,
  getDesignIntent,
  listPersonas,
  UserStoryItem,
  DesignIntentDetail,
  PersonaItem,
} from "@/lib/project-client";

function ReviewStructuredPromptContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const storyId = searchParams.get("storyId");

  const [story, setStory] = React.useState<UserStoryItem | null>(null);
  const [intent, setIntent] = React.useState<DesignIntentDetail | null>(null);
  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);

  // Editable prompt fields
  const [goalText, setGoalText] = React.useState("");
  const [isEditingGoal, setIsEditingGoal] = React.useState(false);

  const [personaText, setPersonaText] = React.useState("");
  const [isEditingPersona, setIsEditingPersona] = React.useState(false);

  const [problemText, setProblemText] = React.useState("");
  const [isEditingProblem, setIsEditingProblem] = React.useState(false);

  const [mustUseText, setMustUseText] = React.useState("");
  const [isEditingMustUse, setIsEditingMustUse] = React.useState(false);

  const [comparisonQuestion, setComparisonQuestion] = React.useState(
    "Which design makes it easier to achieve the user's goal?"
  );
  const [designAName, setDesignAName] = React.useState("Direct flow");
  const [designADesc, setDesignADesc] = React.useState(
    "All essential inputs on a single view for speed."
  );
  const [designBName, setDesignBName] = React.useState("Guided step-by-step");
  const [designBDesc, setDesignBDesc] = React.useState(
    "A staged flow prioritizing clarity and guidance."
  );
  const [isEditingDiff, setIsEditingDiff] = React.useState(false);

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      if (!storyId) return;
      setIsLoading(true);
      try {
        const [storyData, intentData, personaList] = await Promise.all([
          getUserStoryById(projectId, storyId),
          getDesignIntent(projectId).catch(() => null),
          listPersonas(projectId).catch(() => []),
        ]);
        setStory(storyData);
        setIntent(intentData);
        setPersonas(personaList);

        // Populate prompt texts from actual user story
        const defaultGoal =
          storyData.acceptanceCriteria ||
          storyData.title ||
          "Complete the primary user workflow successfully.";
        setGoalText(defaultGoal);

        const targetPersona = personaList[0];
        const defaultPersona = targetPersona
          ? `${targetPersona.name}${targetPersona.age ? `, ${targetPersona.age}` : ""}. ${
              targetPersona.shortDescription || ""
            }`
          : storyData.description
          ? storyData.description.split("\n")[0]
          : "Target end user for this project.";
        setPersonaText(defaultPersona);

        const defaultProblem =
          storyData.problemStatement ||
          "Users need a more efficient way to accomplish this task.";
        setProblemText(defaultProblem);

        const ds = intentData?.designSystem === "MUI" ? "Material UI" : "shadcn";
        const standard = intentData?.designStandards?.[0] || "WCAG 2.2 AA";
        const color = intentData?.primaryColor || "#F2652A";
        setMustUseText(
          `Use ${ds} components only and meet ${standard}. Use ${color} for primary actions. Keep copy plain and friendly, and provide clear user feedback.`
        );

        // Populate comparison based on story
        // The story's "I want to …" part, cut at a word boundary.
        const want = storyShortTitle(storyData).replace(/\.$/, "");
        const task = want.length > 80 ? `${want.slice(0, 80).replace(/\s+\S*$/, "")}…` : want;
        setComparisonQuestion(
          `Which design makes it easier to ${task.charAt(0).toLowerCase()}${task.slice(1)}?`
        );
        setDesignAName("Direct flow");
        setDesignADesc("Streamlined single-page workflow minimizing steps.");
        setDesignBName("Guided flow");
        setDesignBDesc("Structured multi-step workflow with contextual guidance.");
      } catch (err) {
        console.error("Failed to load prompt review data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (projectId && storyId) {
      loadData();
    }
  }, [projectId, storyId]);

  const handleApproveAndGenerate = async () => {
    if (!storyId) return;
    setError(null);
    setIsGenerating(true);

    try {
      // 1. Create a Design Round for this User Story
      const roundTitle = story?.title
        ? `Design Round: ${story.title.length > 50 ? story.title.slice(0, 47) + "..." : story.title}`
        : "Design Round";
      const round = await createDesignRound(projectId, {
        title: roundTitle,
        storyId,
      });

      // 2. Start the AI Generation Job with the reviewed structured prompt and story linkage
      const job = await startGenerationJob(projectId, round.id, {
        prompt: `Goal: ${goalText}. User: ${personaText}. Problem: ${problemText}. Constraints: ${mustUseText}. Variant A: ${designAName} (${designADesc}). Variant B: ${designBName} (${designBDesc}). Evaluation: ${comparisonQuestion}.`,
        storyIds: [storyId],
        personaIds: personas.slice(0, 5).map((p) => p.id),
      });

      // Follow the generation live (Screen 17: Generating A/B)
      router.push(`/projects/${projectId}/rounds/${round.id}/generate?job=${job.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to trigger AI generation job.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!storyId) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center">
        <p className="text-muted-foreground">No user story specified.</p>
        <Button asChild className="mt-4">
          <Link href={`/projects/${projectId}/stories/new`}>Create user story</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center text-muted-foreground">
        Loading AI structured prompt...
      </div>
    );
  }

  const primaryPersona = personas[0];
  const personaDisplay = primaryPersona
    ? `${primaryPersona.name}${primaryPersona.age ? `, ${primaryPersona.age}` : ""}`
    : "Mint, 20";

  return (
    <div className="w-full p-10 flex flex-col gap-6">
      {/* Page Header matching Figma Node 815:14557 */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-heading font-medium tracking-tight text-foreground">
          Review the structured prompt
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          AI drafted this from your user story and design intent. Nothing is generated until you approve it.
        </p>
        <div>
          <span className="inline-block rounded-[10px] bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
            Version 1
          </span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <HugeIcon icon={Alert02Icon} size={16} />
          <AlertTitle>Generation error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Two-Column Layout matching Figma Node 815:14564 */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column matching Figma Node 815:14565 */}
        <div className="flex-1 space-y-4 w-full">
          {/* Card 1: Goal matching Figma Node 815:14566 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Goal
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingGoal((prev) => !prev)}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isEditingGoal ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isEditingGoal ? (
              <Input
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                className="rounded-[10px] text-sm"
              />
            ) : (
              <p className="text-base text-foreground leading-relaxed">
                {goalText}
              </p>
            )}
          </div>

          {/* Card 2: User & persona matching Figma Node 815:14567 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                User & persona
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingPersona((prev) => !prev)}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isEditingPersona ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isEditingPersona ? (
              <Textarea
                rows={2}
                value={personaText}
                onChange={(e) => setPersonaText(e.target.value)}
                className="rounded-[10px] text-sm"
              />
            ) : (
              <p className="text-base text-foreground leading-relaxed">
                {personaText}
              </p>
            )}
          </div>

          {/* Card 3: Problem matching Figma Node 815:14568 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Problem
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingProblem((prev) => !prev)}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isEditingProblem ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isEditingProblem ? (
              <Textarea
                rows={2}
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                className="rounded-[10px] text-sm"
              />
            ) : (
              <p className="text-base text-foreground leading-relaxed">
                {problemText}
              </p>
            )}
          </div>

          {/* Card 4: Must use matching Figma Node 815:14569 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Must use
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingMustUse((prev) => !prev)}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isEditingMustUse ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isEditingMustUse ? (
              <Textarea
                rows={2}
                value={mustUseText}
                onChange={(e) => setMustUseText(e.target.value)}
                className="rounded-[10px] text-sm"
              />
            ) : (
              <p className="text-base text-foreground leading-relaxed">
                {mustUseText}
              </p>
            )}
          </div>

          {/* Card 5: How A and B differ matching Figma Node 815:14570 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                How A and B differ
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingDiff((prev) => !prev)}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isEditingDiff ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {/* Comparison question section */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">
                Testers compare
              </span>
              {isEditingDiff ? (
                <Input
                  value={comparisonQuestion}
                  onChange={(e) => setComparisonQuestion(e.target.value)}
                  className="rounded-[10px] text-sm"
                />
              ) : (
                <h3 className="text-base font-semibold text-foreground">
                  {comparisonQuestion}
                </h3>
              )}
            </div>

            {/* Side-by-side Variant Cards matching Figma Node 933:21025 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Design A Box matching Figma Node 933:21027 */}
              <div className="rounded-[10px] border border-border p-4 space-y-2 bg-card">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#f5a3f0] block" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Design A
                  </span>
                </div>
                {isEditingDiff ? (
                  <div className="space-y-2 pt-1">
                    <Input
                      value={designAName}
                      onChange={(e) => setDesignAName(e.target.value)}
                      placeholder="Variant name"
                      className="text-xs rounded-md h-7"
                    />
                    <Textarea
                      rows={2}
                      value={designADesc}
                      onChange={(e) => setDesignADesc(e.target.value)}
                      placeholder="Description"
                      className="text-xs rounded-md"
                    />
                  </div>
                ) : (
                  <>
                    <h4 className="text-base font-semibold text-foreground">
                      {designAName}
                    </h4>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {designADesc}
                    </p>
                  </>
                )}
              </div>

              {/* Design B Box matching Figma Node 933:21039 */}
              <div className="rounded-[10px] border border-border p-4 space-y-2 bg-card">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#4d9bff] block" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Design B
                  </span>
                </div>
                {isEditingDiff ? (
                  <div className="space-y-2 pt-1">
                    <Input
                      value={designBName}
                      onChange={(e) => setDesignBName(e.target.value)}
                      placeholder="Variant name"
                      className="text-xs rounded-md h-7"
                    />
                    <Textarea
                      rows={2}
                      value={designBDesc}
                      onChange={(e) => setDesignBDesc(e.target.value)}
                      placeholder="Description"
                      className="text-xs rounded-md"
                    />
                  </div>
                ) : (
                  <>
                    <h4 className="text-base font-semibold text-foreground">
                      {designBName}
                    </h4>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {designBDesc}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column matching Figma Node 815:14573 */}
        <div className="w-full lg:w-[400px] shrink-0 space-y-4 lg:sticky lg:top-6 self-start">
          {/* Card 1: Built from matching Figma Node 815:14574 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
            <h3 className="font-heading font-medium text-xl text-foreground">
              Built from
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <HugeIcon icon={Tick02Icon} size={18} className="text-[#497d00] shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {story?.storyKey || "US1"} user story
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <HugeIcon icon={Tick02Icon} size={18} className="text-[#497d00] shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  Problem statement and success measure
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <HugeIcon icon={Tick02Icon} size={18} className="text-[#497d00] shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  Design intent: {intent?.designSystem === "MUI" ? "MUI" : "shadcn"}, brand, tone
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <HugeIcon icon={Tick02Icon} size={18} className="text-[#497d00] shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  Persona: {personaDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Before you generate matching Figma Node 815:14575 */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-3">
            <h3 className="font-heading font-medium text-xl text-foreground">
              Before you generate
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Check that “How A and B differ” names one clear difference. Two variants that differ in many ways are hard to compare.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Navigation matching Figma Node 815:14576 */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          asChild
          className="rounded-[10px] h-8 px-3 font-medium text-sm text-foreground hover:bg-muted cursor-pointer"
        >
          <Link href={`/projects/${projectId}/stories/new`}>
            <HugeIcon icon={ArrowLeft01Icon} size={16} />
            <span>Back</span>
          </Link>
        </Button>

        <Button
          onClick={handleApproveAndGenerate}
          disabled={isGenerating}
          className="gap-2 rounded-[10px] h-8 px-4 font-medium text-sm bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] cursor-pointer shadow-2xs"
        >
          <HugeIcon icon={SparklesIcon} size={16} />
          <span>{isGenerating ? "Generating variants..." : "Approve & generate A and B"}</span>
        </Button>
      </div>
    </div>
  );
}

export default function ReviewStructuredPromptPage() {
  return (
    <React.Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center text-muted-foreground">
          Loading prompt review...
        </div>
      }
    >
      <ReviewStructuredPromptContent />
    </React.Suspense>
  );
}
