"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// data-theme (not a class) so that router.refresh() on a language change cannot overwrite it (F0-AC12).
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
