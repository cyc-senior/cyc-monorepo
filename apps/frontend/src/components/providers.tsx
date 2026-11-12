"use client";

import React from "react";
import { AuthProvider } from "@/contexts/auth-context";

/**
 * Client-side boundary wrapper providing global React contexts (such as AuthProvider).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

