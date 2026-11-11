import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">
          Privacy Notice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          This is a placeholder for the CYC Privacy Notice. When you participate in testing sessions or create an account, we respect your privacy and protect your personal information.
        </p>
        <p>
          We do not sell personal data. Information provided is only used for authentication, session coordination, and feedback analytics.
        </p>
        <div className="pt-4 border-t border-border">
          <Link
            href="/signin"
            className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
