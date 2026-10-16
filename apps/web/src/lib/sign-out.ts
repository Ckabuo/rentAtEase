import { api, clearToken } from "@/lib/api";
import { clearSignedIn } from "@/lib/auth-session";
import { toast } from "@/lib/toast";

export async function signOut(): Promise<void> {
  try {
    await api("/auth/sign-out", { method: "POST" });
  } catch {
    // Session may already be invalid; still clear local state.
  }
  clearToken();
  clearSignedIn();
  toast.success("Signed out.");
}
