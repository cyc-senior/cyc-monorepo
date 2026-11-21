import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeIcon } from "@/components/ui/huge-icon";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

export default function TermsPage() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">
          Terms of Use
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          By using CYC, you agree to these terms of use. CYC is designed for interactive A/B testing and design feedback.
        </p>
        <div className="pt-4 border-t border-border">
          <Link
            href="/signin"
            className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium hover:underline"
          >
            <HugeIcon icon={ArrowLeft02Icon} size={14} />
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
