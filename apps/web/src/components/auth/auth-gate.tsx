"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { PageLoader } from "@/components/ui/spinner";
import { api, readToken } from "@/lib/api";

type GateState = "pending" | "allow" | "deny";

export function AuthLoading() {
  return <PageLoader />;
}

/** Landlord portal: requires a signed-in session (JWT in sessionStorage). */
export function RequireAppSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("pending");

  useLayoutEffect(() => {
    if (!readToken()) {
      router.replace("/sign-in");
      setState("deny");
      return;
    }
    setState("allow");
  }, [router]);

  if (state !== "allow") return <AuthLoading />;
  return children;
}

/** Post–OTP setup wizard: session required; users with an account go to the dashboard. */
export function RequireOnboardingSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("pending");

  useLayoutEffect(() => {
    if (!readToken()) {
      router.replace("/sign-in");
      setState("deny");
      return;
    }
    void api<{ accountId: string | null }>("/auth/session")
      .then((session) => {
        if (session.accountId) {
          router.replace("/dashboard");
          setState("deny");
          return;
        }
        setState("allow");
      })
      .catch(() => {
        router.replace("/sign-in");
        setState("deny");
      });
  }, [router]);

  if (state !== "allow") return <AuthLoading />;
  return children;
}

/** Sign-in flow: redirect authenticated users away from auth screens. */
export function RequireGuestSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("pending");

  useLayoutEffect(() => {
    if (!readToken()) {
      setState("allow");
      return;
    }
    void api<{ accountId: string | null }>("/auth/session")
      .then((session) => {
        router.replace(session.accountId ? "/dashboard" : "/onboarding");
        setState("deny");
      })
      .catch(() => setState("allow"));
  }, [router]);

  if (state !== "allow") return <AuthLoading />;
  return children;
}
