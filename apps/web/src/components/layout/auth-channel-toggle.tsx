import type { SignInChannel } from "@/lib/auth-session";
import { cn } from "@/lib/cn";

type AuthChannelToggleProps = {
  channel: SignInChannel;
  onChange: (channel: SignInChannel) => void;
  className?: string;
};

export function AuthChannelToggle({ channel, onChange, className }: AuthChannelToggleProps) {
  return (
    <div className={cn("flex justify-center lg:justify-start", className)}>
      <div
        className="inline-flex rounded-full border border-border bg-cream p-1"
        role="tablist"
        aria-label="Sign in with phone or email"
      >
        {(["phone", "email"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={channel === value}
            onClick={() => onChange(value)}
            className={cn(
              "min-w-[5.5rem] rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors",
              channel === value ? "bg-ink text-cream shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
