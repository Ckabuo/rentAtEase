import type { OnboardingProfile } from "@/lib/onboarding-storage";

export type AccountMe = {
  user: { id?: string; name: string; phone: string | null; email: string | null };
  account: { id?: string; name: string; onboarding: OnboardingProfile | null };
  role: string;
  plan: {
    name: string;
    code: string;
    monthlyPriceKobo: number;
    unitLimit: number | null;
    whatsappEnabled: boolean;
  };
  usage: { units: number; caretakers: number; prequalifications: number };
  integrations: { whatsapp: boolean; storage: string; otpDelivery: string };
};
