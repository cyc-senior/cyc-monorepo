"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateProject, ProjectDetails } from "@/lib/project-client";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetails;
  /** Called with the project as the API returned it after saving. */
  onSaved: (project: ProjectDetails) => void;
}

/** Edits a project's title, target users or client, and description. */
export function EditProjectDialog({ open, onOpenChange, project, onSaved }: EditProjectDialogProps) {
  // The form starts from the project each time the dialog opens.
  const [editName, setEditName] = React.useState(project.name);
  const [editClientOrProduct, setEditClientOrProduct] = React.useState(project.clientOrProduct || "");
  const [editDescription, setEditDescription] = React.useState(project.description || "");
  const [isUpdatingProject, setIsUpdatingProject] = React.useState(false);
  const [editProjectError, setEditProjectError] = React.useState<string | null>(null);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditProjectError("Project title is required.");
      return;
    }
    if (!editClientOrProduct.trim()) {
      setEditProjectError("Target user or client is required.");
      return;
    }

    setIsUpdatingProject(true);
    setEditProjectError(null);
    try {
      const updated = await updateProject(project.id, {
        name: editName.trim(),
        clientOrProduct: editClientOrProduct.trim(),
        description: editDescription.trim() || undefined,
      });
      onSaved(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update project.";
      setEditProjectError(msg);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-[14px] p-6">
        <form onSubmit={handleSaveProject} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-medium text-foreground">
              Edit project details
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Update the project title, target users, or context description.
            </DialogDescription>
          </DialogHeader>

          {editProjectError && (
            <div className="rounded-[10px] bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {editProjectError}
            </div>
          )}

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="project-title" className="text-sm font-medium text-foreground">
                Project title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-title"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Acme Bank mobile app"
                maxLength={160}
                className="rounded-[10px] text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-client" className="text-sm font-medium text-foreground">
                Target user or client <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-client"
                value={editClientOrProduct}
                onChange={(e) => setEditClientOrProduct(e.target.value)}
                placeholder="e.g. Students, young adults, retail shoppers"
                maxLength={160}
                className="rounded-[10px] text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-description" className="text-sm font-medium text-foreground">
                Description
              </Label>
              <Textarea
                id="project-description"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What is this project aiming to solve?"
                maxLength={5000}
                className="rounded-[10px] text-sm leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-[10px] cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isUpdatingProject}
              className="rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-hover font-medium cursor-pointer"
            >
              {isUpdatingProject ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
