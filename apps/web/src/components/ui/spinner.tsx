import { cn } from "@/lib/cn";

const sizeClass = {
  sm: "size-4 border-2",
  md: "size-8 border-2",
  lg: "size-10 border-[3px]",
} as const;

const toneClass = {
  primary: "border-border/80 border-t-primary",
  muted: "border-border border-t-muted",
  onPrimary: "border-white/35 border-t-on-primary",
  danger: "border-danger/25 border-t-danger",
} as const;

export type SpinnerSize = keyof typeof sizeClass;
export type SpinnerTone = keyof typeof toneClass;

type SpinnerProps = {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
  label?: string;
};

export function Spinner({ size = "md", tone = "primary", className, label }: SpinnerProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn("inline-block shrink-0 animate-spin rounded-full", sizeClass[size], toneClass[tone])}
        aria-hidden={label ? true : undefined}
        role={label ? undefined : "status"}
      />
      {label ? (
        <span className="text-sm text-muted" role="status">
          {label}
        </span>
      ) : null}
    </span>
  );
}

type PageLoaderProps = {
  label?: string;
  className?: string;
  fullScreen?: boolean;
};

export function PageLoader({ label = "Loading", className, fullScreen = true }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 bg-canvas",
        fullScreen ? "min-h-screen" : "py-16",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size="lg" tone="primary" />
      {label ? <p className="text-sm font-medium text-muted">{label}</p> : null}
    </div>
  );
}
