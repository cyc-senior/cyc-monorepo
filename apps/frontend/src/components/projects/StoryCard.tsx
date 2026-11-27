"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeIcon } from "@/components/ui/huge-icon";
import { deleteUserStory, UserStoryItem } from "@/lib/project-client";
import { storyContinueHref, storySteps } from "@/lib/design-cycle";
import { cn } from "@/lib/utils";

/** Tells the sidebar (and other lists) that the project's stories changed. */
export const STORIES_CHANGED_EVENT = "cyc:stories-changed";

interface StoryCardProps {
  projectId: string;
  story: UserStoryItem;
  /** "US1", "US2", … in creation order. */
  code: string;
  /** Designers can edit and delete stories. */
  canEdit: boolean;
  /** Called after the story was deleted, to drop it from the list. */
  onDeleted: (storyId: string) => void;
}

/**
 * A user story in the project's Overview and User stories tab: its A/B
 * designs (or that there are none yet), code, cycle step, title and problem,
 * and a menu to open, edit or delete it.
 */
export function StoryCard({ projectId, story, code, canEdit, onDeleted }: StoryCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const href = storyContinueHref(projectId, story);
  const currentStep = storySteps(projectId, story).find((step) => step.state === "current");
  const designs = story.designCycle?.variantCount ?? 0;
  const generating = Boolean(story.designCycle?.activeJob);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteUserStory(projectId, story.id);
      setConfirmOpen(false);
      onDeleted(story.id);
      window.dispatchEvent(new CustomEvent(STORIES_CHANGED_EVENT, { detail: { projectId } }));
    } catch {
      setError("Couldn't delete the story. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        className="gap-0 group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[14px] border border-border bg-card p-0 shadow-2xs transition hover:border-foreground/30"
        onClick={() => router.push(href)}
      >
        {/* Designs of the story: A and B once they exist. */}
        <div className="flex h-[120px] select-none items-end justify-center gap-2 overflow-hidden border-b border-border/60 bg-muted px-4 pt-4">
          {designs > 0 ? (
            (["A", "B"] as const).slice(0, Math.min(designs, 2)).map((label) => (
              <div
                key={label}
                className="flex h-full flex-1 flex-col gap-1.5 rounded-t-[6px] border border-b-0 border-border bg-card p-2 opacity-90 shadow-2xs transition-opacity group-hover:opacity-100"
              >
                <span
                  className={cn(
                    "w-fit rounded-[4px] px-1 text-[10px] font-medium leading-4",
                    label === "A" ? "bg-design-a-subtle text-design-a-text" : "bg-design-b-subtle text-design-b-text"
                  )}
                >
                  Design {label}
                </span>
                <div className="h-1.5 w-3/4 rounded-xs bg-muted" />
                <div className="h-1.5 w-1/2 rounded-xs bg-muted" />
                <div className="mt-auto h-2.5 w-10 self-end rounded-xs bg-primary/30" />
              </div>
            ))
          ) : (
            <p className="mb-auto mt-auto text-xs text-muted-foreground">
              {generating ? "Generating designs…" : "No designs yet"}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-3 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-[10px] border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                {code}
              </span>
              <div className="flex items-center gap-1">
                {currentStep && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {currentStep.label}
                  </span>
                )}
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${code}`}
                        className="size-7 rounded-[8px] text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HugeIcon icon={MoreHorizontalIcon} size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem asChild className="cursor-pointer gap-2">
                        <Link href={href}>
                          <HugeIcon icon={ViewIcon} size={16} />
                          Open
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer gap-2">
                        <Link href={`/projects/${projectId}/stories/${story.id}`}>
                          <HugeIcon icon={PencilEdit02Icon} size={16} />
                          Edit story
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        onSelect={() => setConfirmOpen(true)}
                      >
                        <HugeIcon icon={Delete02Icon} size={16} />
                        Delete…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">{story.title}</h3>
            {story.problemStatement && (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{story.problemStatement}</p>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <DialogContent className="rounded-[14px] sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {code}?</DialogTitle>
            <DialogDescription>
              The story, its prompt, chat and designs will be removed from this project
              {generating ? ", and its running generation will stop" : ""}.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete story"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
