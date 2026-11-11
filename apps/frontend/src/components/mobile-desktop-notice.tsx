"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MobileNoticeProps {
  sessionCode?: string | null;
  children: React.ReactNode;
}

export function MobileDesktopNotice({ sessionCode, children }: MobileNoticeProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error("Failed to copy link:", e);
    }
  };

  return (
    <>
      {/* Mobile Screen: show "Open CYC on a computer" */}
      <div className="block sm:hidden w-full px-4 pt-[80px] pb-16 flex justify-center">
        <Card className="w-full max-w-[440px] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">
              Open CYC on a computer
            </CardTitle>
            <CardDescription>
              CYC works on desktop only. Open this link on a computer to join the session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionCode && (
              <div className="space-y-1.5">
                <Label htmlFor="mobile-session-code">Session Code</Label>
                <Input
                  id="mobile-session-code"
                  readOnly
                  value={sessionCode}
                  className="bg-muted text-muted-foreground font-mono"
                />
              </div>
            )}
            <Button
              type="button"
              className="w-full gap-2 cursor-pointer"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied link</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy link</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Screen: show normal content */}
      <div className="hidden sm:block w-full">
        {children}
      </div>
    </>
  );
}

