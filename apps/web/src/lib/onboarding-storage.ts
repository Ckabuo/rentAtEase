const KEY = "rae.onboarding";

export type OnboardingProfile = {
  fullName: string;
  businessName: string;
  role: "owner" | "manager" | "agent" | "caretaker";
  unitBand: "1-3" | "4-15" | "16-40" | "40+";
  rentCycles: string[];
  trackingToday: string;
  topChallenge: string;
  caretakers: "none" | "one" | "several";
  firstAction: string;
  whatsappReminders: "yes" | "not_yet";
  completedAt?: string;
};

export function readOnboarding(): OnboardingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingProfile;
  } catch {
    return null;
  }
}

export function writeOnboarding(profile: OnboardingProfile): void {
  sessionStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearOnboarding(): void {
  sessionStorage.removeItem(KEY);
}
