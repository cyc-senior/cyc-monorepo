"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Edit2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getUserStoryById,
  createDesignRound,
  startGenerationJob,
  getDesignIntent,
  UserStoryItem,
  DesignIntentDetail,
} from "@/lib/project-client";

export default function ReviewStructuredPromptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const storyId = searchParams.get("storyId");

  const [story, setStory] = React.useState<UserStoryItem | null>(null);
  const [intent, setIntent] = React.useState<DesignIntentDetail | null>(null);

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      if (!storyId) return;
      setIsLoading(true);
      try {
        const [storyData, intentData] = await Promise.all([
          getUserStoryById(projectId, storyId),
          getDesignIntent(projectId).catch(() => null),
        ]);
        setStory(storyData);
        setIntent(intentData);
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
      const round = await createDesignRound(projectId, {
        storyId,
        hypothesis: `Testing variant layouts for ${story?.want || "improved usability"}.`,
      });

      // 2. Start the AI Generation Job
      await startGenerationJob(projectId, round.id, {
        prompt: `Create 2 distinct UI variants (Variant A and Variant B) for: As a ${story?.role}, I want to ${story?.want} so that ${story?.benefit}. Address problem: ${story?.problemStatement}.`,
      });

      // Redirect to round view or project landing
      router.push(`/projects/${projectId}`);
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
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-muted-foreground">No user story specified.</p>
        <Button asChild className="mt-4">
          <Link href={`/projects/${projectId}/stories/new`}>Create User Story</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center text-muted-foreground">
        Loading AI structured prompt...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Screen 16 Header */}
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {story?.storyKey || "US1"}
          </Badge>
          <span className="text-xs text-muted-foreground">Version 1</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-2">
          Review the structured prompt
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI drafted this from your user story and design intent. Nothing is generated until you approve it.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Structured Prompt Breakdown (Screen 16 Node 815:14533) */}
      <div className="space-y-4">
        {/* Goal */}
        <Card>
          <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Goal
              </CardTitle>
              <p className="text-base font-medium text-foreground mt-1">
                {story?.successMetric ||
                  `Let a ${story?.role || "user"} ${story?.want || "achieve their objective"} quickly and seamlessly.`}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          </CardHeader>
        </Card>

        {/* User & Persona */}
        <Card>
          <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                User & persona
              </CardTitle>
              <p className="text-base font-medium text-foreground mt-1">
                {story?.role || "Target user"} aiming to {story?.want}.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          </CardHeader>
        </Card>

        {/* Problem */}
        <Card>
          <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Problem statement
              </CardTitle>
              <p className="text-base font-medium text-foreground mt-1">
                {story?.problemStatement || "Users encounter friction in the current flow."}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          </CardHeader>
        </Card>

        {/* Must Use */}
        <Card>
          <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Must use & Constraints
              </CardTitle>
              <p className="text-base font-medium text-foreground mt-1">
                Use shadcn components only and meet WCAG 2.2 AA. Primary brand color:{" "}
                <span className="font-mono text-xs">{intent?.brandColorPrimary || "#0a0a0a"}</span>.
                Tone: {intent?.voiceTone || "Clear and helpful"}.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          </CardHeader>
        </Card>

        {/* How A and B differ */}
        <Card className="border-primary/40 bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wider">
                  How Design A and B differ
                </CardTitle>
                <CardDescription className="mt-0.5">
                  What core UX hypotheses will testers evaluate?
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-0">
            <div className="rounded-lg border p-4 bg-muted/20 space-y-1">
              <span className="text-xs font-bold text-foreground">Design A · Timetable / Grid First</span>
              <p className="text-xs text-muted-foreground">
                Displays visual calendar slots upfront. Users can click any free slot immediately.
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-muted/20 space-y-1">
              <span className="text-xs font-bold text-foreground">Design B · Search & Filter First</span>
              <p className="text-xs text-muted-foreground">
                Users specify time, headcount, and amenities first; matching rooms appear ranked by availability.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button type="button" variant="outline" asChild>
          <Link href={`/projects/${projectId}/stories/new`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>Back to story</span>
          </Link>
        </Button>

        <Button
          onClick={handleApproveAndGenerate}
          disabled={isGenerating}
          className="gap-2 font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          <span>{isGenerating ? "Generating variants..." : "Approve and generate designs"}</span>
        </Button>
      </div>
    </div>
  );
}
