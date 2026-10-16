"use client";

import { useSyncExternalStore } from "react";
import { readSignedInName } from "@/lib/auth-session";
import { readOnboarding, type OnboardingProfile } from "@/lib/onboarding-storage";

function subscribeSessionStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function useSignedInName(): string | null {
  return useSyncExternalStore(subscribeSessionStorage, readSignedInName, () => null);
}

export function useOnboardingProfile(): OnboardingProfile | null {
  return useSyncExternalStore(subscribeSessionStorage, readOnboarding, () => null);
}
