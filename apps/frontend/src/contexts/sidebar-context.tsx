"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type SidebarMode = "default" | "overlay";

interface SidebarContextValue {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  mode: "default",
  setMode: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<SidebarMode>("default");
  return (
    <SidebarContext.Provider value={{ mode, setMode }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

/**
 * Declaratively sets the shell sidebar mode while the calling page is mounted,
 * and restores `"default"` on unmount.
 */
export function useSidebarMode(mode: SidebarMode) {
  const { setMode } = useSidebar();
  useEffect(() => {
    setMode(mode);
    return () => setMode("default");
  }, [mode, setMode]);
}
