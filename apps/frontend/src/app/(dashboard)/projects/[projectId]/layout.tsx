import React, { Suspense } from "react";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 sm:p-10 space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded-[10px]" />
          <div className="h-64 bg-muted/50 rounded-[14px]" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
