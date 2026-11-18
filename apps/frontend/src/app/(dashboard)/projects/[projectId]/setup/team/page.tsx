"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StepProgress } from "@/components/wizard/StepProgress";
import {
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  ProjectMemberItem,
  ProjectRole,
} from "@/lib/project-client";
import { useAuth } from "@/contexts/auth-context";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TeamAndRolesStep3Page() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { user: currentUser } = useAuth();

  const [members, setMembers] = React.useState<ProjectMemberItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<ProjectRole>("DEVELOPER");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [isInviting, setIsInviting] = React.useState(false);
  const [inviteSuccess, setInviteSuccess] = React.useState(false);

  React.useEffect(() => {
    async function loadMembers() {
      setIsLoading(true);
      try {
        const list = await listProjectMembers(projectId);
        setMembers(list);
      } catch {
        // Handled
      } finally {
        setIsLoading(false);
      }
    }
    if (projectId) {
      loadMembers();
    }
  }, [projectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = inviteEmail.trim().toLowerCase();

    // State 13B: Email invalid check
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    // State 13A: Already in this project check
    const existing = members.find(
      (m) => m.user?.email?.toLowerCase() === trimmedEmail
    );
    if (existing) {
      setInviteError("This person is already a member of this project.");
      return;
    }

    setInviteError(null);
    setIsInviting(true);

    try {
      const newMember = await addProjectMember(projectId, trimmedEmail, inviteRole);
      setMembers((prev) => [...prev, newMember]);
      setInviteEmail("");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 2000);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosErr?.response?.status === 409) {
        setInviteError("This person is already a member of this project.");
      } else if (axiosErr?.response?.status === 404) {
        setInviteError(
          axiosErr.response.data?.message ||
            "User is not a member of this workspace. Add them to the workspace first."
        );
      } else {
        setInviteError(
          axiosErr?.response?.data?.message || "Failed to add member to project."
        );
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, role: ProjectRole) => {
    try {
      const updated = await updateProjectMemberRole(projectId, memberId, role);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: updated.role } : m))
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update member role.";
      alert(msg);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the project?")) {
      return;
    }
    try {
      await removeProjectMember(projectId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      // Ignored
    }
  };

  const handleFinish = () => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Wizard Header Progress */}
      <StepProgress
        currentStep={3}
        stepLabel="Step 3 of 3"
        title="Team & roles"
        description="Add team members who will collaborate on, review, or develop designs for this project."
      />

      {/* Invite Member Section (Screen 13 & 13A/13B Error States) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Invite team member</CardTitle>
          </div>
          <CardDescription>
            Invite teammates with specific access roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4" noValidate>
            {inviteError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            {inviteSuccess && (
              <Alert className="border-emerald-500/50 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription>
                  Team member added to project successfully!
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                />
              </div>

              <div className="w-full sm:w-48 space-y-1.5">
                <Label htmlFor="invite-role" className="sr-only">
                  Role
                </Label>
                <Select
                  value={inviteRole}
                  onValueChange={(val) => setInviteRole(val as ProjectRole)}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESIGNER">Designer</SelectItem>
                    <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                    <SelectItem value="DEVELOPER">Developer</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={isInviting}
                className="gap-2 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>{isInviting ? "Adding..." : "Add to project"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Members List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Members ({members.length})</CardTitle>
          <CardDescription>
            Manage roles or revoke project access.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No members added yet.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const isYou = member.user?.id === currentUser?.id;
                  const initials = (member.user?.name || member.user?.email || "U")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="pl-6 font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.user?.image || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {member.user?.name || member.user?.email}
                              {isYou && (
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                  (you)
                                </span>
                              )}
                            </p>
                            {member.user?.name && (
                              <p className="text-xs text-muted-foreground">
                                {member.user?.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {isYou ? (
                          <Badge variant="outline" className="font-medium">
                            {member.role}
                          </Badge>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(val) =>
                              handleChangeRole(member.id, val as ProjectRole)
                            }
                          >
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DESIGNER">Designer</SelectItem>
                              <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                              <SelectItem value="DEVELOPER">Developer</SelectItem>
                              <SelectItem value="CLIENT">Client</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>

                      <TableCell className="text-right pr-6">
                        {!isYou && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMember(member.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Testers note banner (Figma Screen 13 Node 491:5743) */}
      <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-4">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground">Need to invite testers?</p>
          <p>
            Testers participate per testing round and are invited in Step 5 (Test setup), not here.
            Only team members with project editing, review, or developer handoff access are added here.
          </p>
        </div>
      </div>

      {/* Wizard Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          asChild
          className="gap-2 cursor-pointer"
        >
          <Link href={`/projects/${projectId}/setup/intent`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
        </Button>

        <Button
          type="button"
          onClick={handleFinish}
          className="gap-2 font-medium hover:bg-primary-hover cursor-pointer"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Finish setup</span>
        </Button>
      </div>
    </div>
  );
}
