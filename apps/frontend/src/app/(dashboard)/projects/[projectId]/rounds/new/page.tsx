"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Tick02Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  SparklesIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import {
  getUserStoryById,
  updateUserStory,
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
  const [selectedPersonaId, setSelectedPersonaId] = React.useState<string>("");

  // Editable prompt fields
  const [goalText, setGoalText] = React.useState("");
  const [isEditingGoal, setIsEditingGoal] = React.useState(false);
  const [isSavingGoal, setIsSavingGoal] = React.useState(false);

  const [problemText, setProblemText] = React.useState("");
  const [isEditingProblem, setIsEditingProblem] = React.useState(false);
  const [isSavingProblem, setIsSavingProblem] = React.useState(false);

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
  const [backendStatus, setBackendStatus] = React.useState<string | null>(
    "Drafting your prompt with AI..."
  );

  React.useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    async function loadData() {
      if (!storyId) return;
      setIsLoading(true);
      setBackendStatus("Drafting your prompt with AI...");

      try {
        const [storyData, intentData, personaList] = await Promise.all([
          getUserStoryById(projectId, storyId),
          getDesignIntent(projectId).catch(() => null),
          listPersonas(projectId).catch(() => []),
        ]);

        if (isCancelled) return;

        setStory(storyData);
        setIntent(intentData);
        setPersonas(personaList);

        const initialPersona = personaList[0];
        const personaIdToUse = initialPersona?.id || "";
        setSelectedPersonaId(personaIdToUse);

        // Fallbacks
        const defaultGoal =
          storyData.acceptanceCriteria ||
          storyData.title ||
          "Complete the primary user workflow successfully.";
        setGoalText(defaultGoal);

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

        // Start SSE stream from backend to draft prompt
        const sseUrl = `/api/projects/${projectId}/rounds/draft-prompt/events?storyId=${storyId}${
          personaIdToUse ? `&personaId=${personaIdToUse}` : ""
        }`;

        try {
          const res = await fetch(sseUrl, {
            signal: abortController.signal,
            headers: { Accept: "text/event-stream" },
          });

          if (!res.ok || !res.body) {
            // Non-blocking fallback
            setIsLoading(false);
            setBackendStatus(null);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const chunk of lines) {
              const dataLine = chunk
                .split("\n")
                .find((line) => line.startsWith("data:"));
              if (!dataLine) continue;

              const payloadStr = dataLine.replace(/^data:\s*/, "").trim();
              if (!payloadStr) continue;

              try {
                const parsed = JSON.parse(payloadStr);
                if (parsed.status) {
                  setBackendStatus(parsed.status);
                }

                if (parsed.prompt) {
                  const p = parsed.prompt;
                  if (p.goal) setGoalText(p.goal);
                  if (p.problem) setProblemText(p.problem);
                  if (p.mustUse) setMustUseText(p.mustUse);
                  if (p.comparisonQuestion) setComparisonQuestion(p.comparisonQuestion);
                  if (p.variantA?.name) setDesignAName(p.variantA.name);
                  if (p.variantA?.description) setDesignADesc(p.variantA.description);
                  if (p.variantB?.name) setDesignBName(p.variantB.name);
                  if (p.variantB?.description) setDesignBDesc(p.variantB.description);

                  setIsLoading(false);
                  setBackendStatus(null);
                }
              } catch (parseErr) {
                console.error("Failed to parse SSE payload", parseErr);
              }
            }
          }
        } catch (fetchErr: unknown) {
          if ((fetchErr as Error).name !== "AbortError") {
            console.warn("SSE fetch warning or finished", fetchErr);
          }
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
            setBackendStatus(null);
          }
        }
      } catch (err) {
        console.error("Failed to load prompt review data:", err);
        if (!isCancelled) {
          setIsLoading(false);
          setBackendStatus(null);
        }
      }
    }

    if (projectId && storyId) {
      loadData();
    }

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [projectId, storyId]);

  const handleSaveGoal = async () => {
    if (!isEditingGoal) {
      setIsEditingGoal(true);
      return;
    }
    if (!storyId) {
      setIsEditingGoal(false);
      return;
    }
    setIsSavingGoal(true);
    try {
      await updateUserStory(projectId, storyId, { acceptanceCriteria: goalText });
      setIsEditingGoal(false);
    } catch (e) {
      console.error("Failed to persist goal", e);
      setIsEditingGoal(false);
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleSaveProblem = async () => {
    if (!isEditingProblem) {
      setIsEditingProblem(true);
      return;
    }
    if (!storyId) {
      setIsEditingProblem(false);
      return;
    }
    setIsSavingProblem(true);
    try {
      await updateUserStory(projectId, storyId, { problemStatement: problemText });
      setIsEditingProblem(false);
    } catch (e) {
      console.error("Failed to persist problem", e);
      setIsEditingProblem(false);
    } finally {
      setIsSavingProblem(false);
    }
  };

  const handleApproveAndGenerate = async () => {
    if (!storyId) return;
    setError(null);
    setIsGenerating(true);

    try {
      const roundTitle = story?.title
        ? `Design Round: ${story.title.length > 50 ? story.title.slice(0, 47) + "..." : story.title}`
        : "Design Round";
      const round = await createDesignRound(projectId, {
        title: roundTitle,
        storyId,
      });

      const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
      const personaSummary = selectedPersona
        ? `${selectedPersona.name}${selectedPersona.age ? `, ${selectedPersona.age}` : ""}. ${selectedPersona.shortDescription || ""}`
        : "Target end user.";

      const job = await startGenerationJob(projectId, round.id, {
        prompt: `Goal: ${goalText}. User: ${personaSummary}. Problem: ${problemText}. Constraints: ${mustUseText}. Variant A: ${designAName} (${designADesc}). Variant B: ${designBName} (${designBDesc}). Evaluation: ${comparisonQuestion}.`,
        storyIds: [storyId],
        personaIds: selectedPersonaId ? [selectedPersonaId] : personas.slice(0, 5).map((p) => p.id),
      });

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

  const selectedPersonaObj = personas.find((p) => p.id === selectedPersonaId);
  const personaDisplay = selectedPersonaObj
    ? `${selectedPersonaObj.name}${selectedPersonaObj.age ? `, ${selectedPersonaObj.age}` : ""}`
    : personas[0]
    ? `${personas[0].name}${personas[0].age ? `, ${personas[0].age}` : ""}`
    : "Primary persona";

  return (
    <div className="w-full p-10 flex flex-col gap-6">
      {/* Page Header */}
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

      {/* Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column */}
        <div className="flex-1 space-y-4 w-full">
          {/* Card 1: Goal */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Goal
              </h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading || isSavingGoal}
                onClick={handleSaveGoal}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isSavingGoal ? "Saving..." : isEditingGoal ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </div>
            ) : isEditingGoal ? (
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

          {/* Card 2: User & persona */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                User & persona
              </h2>
            </div>

            {isLoading ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-9 w-full rounded-[10px]" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  value={selectedPersonaId}
                  onValueChange={(val) => setSelectedPersonaId(val)}
                >
                  <SelectTrigger className="w-full rounded-[10px]">
                    <SelectValue placeholder="Select target persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.age ? `(${p.age})` : ""} - {p.shortDescription || "No description"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPersonaObj && (
                  <div className="rounded-[10px] bg-muted/50 border border-border/60 p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {selectedPersonaObj.name}
                      {selectedPersonaObj.age ? `, ${selectedPersonaObj.age}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedPersonaObj.shortDescription || "Target persona for this workflow."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Problem */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Problem
              </h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading || isSavingProblem}
                onClick={handleSaveProblem}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isSavingProblem ? "Saving..." : isEditingProblem ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-4/5 rounded-md" />
              </div>
            ) : isEditingProblem ? (
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

          {/* Card 4: Must use */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Must use
              </h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                onClick={() => setIsEditingMustUse((prev) => !prev)}
                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-[8px] cursor-pointer"
              >
                <span>{isEditingMustUse ? "Done" : "Edit"}</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
              </div>
            ) : isEditingMustUse ? (
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

          {/* Card 5: How A and B differ */}
          <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                How A and B differ
              </h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
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
              {isLoading ? (
                <Skeleton className="h-5 w-3/4 rounded-md" />
              ) : isEditingDiff ? (
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

            {/* Side-by-side Variant Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Design A Box */}
              <div className="rounded-[10px] border border-border p-4 space-y-2 bg-card">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#f5a3f0] block" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Design A
                  </span>
                </div>
                {isLoading ? (
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <Skeleton className="h-3 w-5/6 rounded-md" />
                  </div>
                ) : isEditingDiff ? (
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

              {/* Design B Box */}
              <div className="rounded-[10px] border border-border p-4 space-y-2 bg-card">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#4d9bff] block" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Design B
                  </span>
                </div>
                {isLoading ? (
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <Skeleton className="h-3 w-5/6 rounded-md" />
                  </div>
                ) : isEditingDiff ? (
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

        {/* Right Column */}
        <div className="w-full lg:w-[400px] shrink-0 space-y-4 lg:sticky lg:top-6 self-start">
          {/* Live Status Card while drafting */}
          {backendStatus && (
            <div className="rounded-[14px] border border-border bg-card p-4 shadow-xs flex items-center gap-3">
              <HugeIcon
                icon={Loading03Icon}
                size={20}
                className="animate-spin text-muted-foreground shrink-0"
              />
              <span className="text-sm font-medium text-foreground">
                {backendStatus}
              </span>
            </div>
          )}

          {/* Built from Card */}
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

          {/* Before you generate Card */}
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

      {/* Footer Navigation */}
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
          disabled={isGenerating || isLoading}
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
