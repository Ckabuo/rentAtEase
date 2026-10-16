"use client";

import { type ReactNode } from "react";
import { RequireOnboardingSession } from "@/components/auth/auth-gate";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <RequireOnboardingSession>{children}</RequireOnboardingSession>;
}
