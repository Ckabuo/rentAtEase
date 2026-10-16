"use client";

import { type ReactNode } from "react";
import { RequireGuestSession } from "@/components/auth/auth-gate";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <RequireGuestSession>{children}</RequireGuestSession>;
}
