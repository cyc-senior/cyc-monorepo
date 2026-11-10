import {
  Braces,
  ChartLine,
  CircleCheck,
  Palette,
  User,
  Users,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

export interface StepItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface RoleItem {
  icon: LucideIcon;
  title: string;
  description: string;
  footerText: string;
}

export interface TesterRoundNode {
  value?: number;
  status: "done" | "active" | "review" | "empty";
}

export interface TesterRoundRow {
  testerLabel: string;
  rounds: TesterRoundNode[];
  badge: {
    label: string;
    variant: "neutral" | "outline" | "warning";
  };
}

export const heroContent = {
  title: "Test two designs with real people, every week.",
  description:
    "Set your design intent once. AI builds two alternatives from your design system, testers compare them, and the feedback comes back grouped so you can decide faster.",
  primaryAction: {
    label: "Get started",
    href: "/signin",
  },
  sessionCard: {
    title: "Got a session code from a designer?",
    inputLabel: "Session code",
    inputPlaceholder: "e.g. CYC-4821",
    joinLabel: "Join session",
    helpText: "No account needed. Just add your name and email.",
  },
};

export const abTestingPreviewData = {
  title: "Checkout flow",
  subtitle: "Round 2 of 5",
  statusLabel: "Testing",
  variants: [
    { id: "a" as const, label: "Design A", layout: "stacked" as const },
    { id: "b" as const, label: "Design B", layout: "media-header" as const },
  ],
  extraTestersCount: "+5",
  quote: "\"B's pay button is easier to find.\"",
  progressLabel: "6 of 8 testers",
};

export const stepsData: StepItem[] = [
  {
    title: "Set design intent",
    description: "Persona, design system, brand colour and tone of voice.",
    icon: Palette,
  },
  {
    title: "AI builds A and B",
    description: "Two alternatives built from your own components.",
    icon: WandSparkles,
  },
  {
    title: "Testers compare",
    description: "Real people do one task on both and give feedback.",
    icon: Users,
  },
  {
    title: "You decide",
    description: "Feedback grouped into usability problems and preferences.",
    icon: CircleCheck,
  },
];

export const testerRoundsContent = {
  title: "Every tester gets their own rounds",
  description:
    "Round 1 is the same A/B for everyone. From round 2, each tester's next pair is built from their own feedback, until there are no new comments or the round limit.",
};

export const testerRoundFeatures: FeatureItem[] = [
  {
    icon: WandSparkles,
    title: "AI runs the rounds",
    description:
      "It analyses each tester's feedback and regenerates their next A/B.",
  },
  {
    icon: User,
    title: "You step in when feedback swings",
    description:
      "If a tester's feedback goes up and down instead of falling, you decide what changes next.",
  },
];

export const testerRoundsPreviewData = {
  title: "Checkout flow",
  subtitle: "Up to 5 rounds",
  statusLabel: "Testing",
  rootLabel: "Round 1",
  rootSubtitle: "Same A/B",
  footnote: "Numbers show feedback per round. Fewer means the design is settling.",
  testers: [
    {
      testerLabel: "Tester 1",
      rounds: [
        { value: 4, status: "done" },
        { value: 2, status: "done" },
        { value: 0, status: "done" },
        { status: "empty" },
      ],
      badge: { label: "Done", variant: "neutral" },
    },
    {
      testerLabel: "Tester 2",
      rounds: [
        { value: 5, status: "done" },
        { value: 3, status: "done" },
        { status: "active" },
        { status: "empty" },
      ],
      badge: { label: "Round 4 of 5", variant: "outline" },
    },
    {
      testerLabel: "Tester 3",
      rounds: [
        { value: 3, status: "done" },
        { value: 6, status: "review" },
        { value: 2, status: "review" },
        { status: "empty" },
      ],
      badge: { label: "Needs review", variant: "warning" },
    },
  ] satisfies TesterRoundRow[],
};

export const roleCardsContent = {
  title: "Every decision traces back to feedback",
  description:
    "When you approve a round, CYC writes a report for each role. You edit and publish it, then share it as a PDF or a link.",
};

export const rolesData: RoleItem[] = [
  {
    icon: User,
    title: "Client",
    description:
      "Who your users are and what the change means for the business.",
    footerText: "From 6 tester comments",
  },
  {
    icon: Braces,
    title: "Developer",
    description:
      "Handoff spec, components, constraints and flagged technical risks.",
    footerText: "From 3 pinned comments",
  },
  {
    icon: ChartLine,
    title: "Project manager",
    description:
      "Round progress, timeline, gap, budget and resources across the project.",
    footerText: "From 4 rounds of feedback",
  },
];

export const ctaContent = {
  title: "Ready to test your next design?",
  description:
    "Set your design intent once. CYC builds the A/B and real testers compare it.",
  buttonLabel: "Get started",
  buttonHref: "/signin",
};
