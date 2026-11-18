"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Layers,
  FileText,
  Users,
  Settings,
  Plus,
  Compass,
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
import {
  getProjectById,
  listUserStories,
  ProjectDetails,
  UserStoryItem,
} from "@/lib/project-client";

export default function ProjectMainLandingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = React.useState<ProjectDetails | null>(null);
  const [stories, setStories] = React.useState<UserStoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [proj, userStories] = await Promise.all([
          getProjectById(projectId),
          listUserStories(projectId).catch(() => []),
        ]);
        setProject(proj);
        setStories(userStories);
      } catch (err) {
        console.error("Failed to load project:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center text-muted-foreground">
        Loading project overview...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Button asChild className="mt-4">
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Project Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {project.name}
            </h1>
            <Badge variant="outline" className="text-xs">
              Active
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild size="sm">
            <Link href={`/projects/${projectId}/setup/intent`}>
              <Settings className="h-4 w-4 mr-1.5" />
              <span>Design intent</span>
            </Link>
          </Button>

          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/stories/new`}>
              <Plus className="h-4 w-4 mr-1.5" />
              <span>New user story</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Screen 14A: Empty State vs Screen 14 Stories Overview */}
      {stories.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                No user stories yet
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                One user story is one design cycle. AI turns your story and problem statement into structured prompts and UI variants.
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href={`/projects/${projectId}/stories/new`}>
                <Plus className="h-4 w-4" />
                <span>Create first user story</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              User stories ({stories.length})
            </h2>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/stories/new`}>
                <Plus className="h-4 w-4 mr-1" />
                <span>Add story</span>
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((story) => (
              <Card key={story.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {story.storyKey || "Story"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(story.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-base line-clamp-2 mt-2">
                    {story.want || "Untitled story"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p className="line-clamp-2">
                    <span className="font-semibold text-foreground">So that: </span>
                    {story.benefit}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs mt-2"
                    onClick={() => router.push(`/projects/${projectId}/rounds/new?storyId=${story.id}`)}
                  >
                    <span>View design cycle</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
