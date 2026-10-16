"use client";

import { type ReactNode } from "react";
import { RequireAppSession } from "@/components/auth/auth-gate";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <RequireAppSession>{children}</RequireAppSession>;
}
