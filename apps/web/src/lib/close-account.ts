import { api, clearToken } from "@/lib/api";
import { clearSignedIn } from "@/lib/auth-session";
import { toast } from "@/lib/toast";

export async function closeAccount(): Promise<void> {
  await api<{ message: string }>("/accounts/me", { method: "DELETE" });
  clearToken();
  clearSignedIn();
  toast.success("Your account has been closed.");
}
