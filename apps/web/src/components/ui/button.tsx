import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner, type SpinnerTone } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  /** Shown beside the spinner when `loading` is true. Defaults to `children` when children is a string. */
  loadingLabel?: ReactNode;
};

const loadingSpinnerTone: Record<Variant, SpinnerTone> = {
  primary: "onPrimary",
  secondary: "primary",
  ghost: "primary",
  danger: "onPrimary",
};

const variantClass: Record<Variant, string> = {
  primary:
    "border border-transparent bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50",
  secondary:
    "border-[1.5px] border-border bg-transparent text-ink hover:border-ink hover:bg-canvas disabled:opacity-50",
  ghost: "border border-transparent bg-transparent text-primary hover:bg-teal-light disabled:opacity-50",
  danger:
    "border border-transparent bg-danger-light text-danger hover:bg-danger hover:text-white disabled:opacity-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", fullWidth, type = "button", loading, loadingLabel, children, disabled, ...props },
  ref,
) {
  const showLoading = Boolean(loading);
  const busyLabel =
    loadingLabel ?? (typeof children === "string" ? children : showLoading ? "Please wait" : null);

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || showLoading}
      aria-busy={showLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control px-6 py-2.5 text-sm font-bold transition-colors duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none",
        variantClass[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {showLoading ? (
        <>
          <Spinner size="sm" tone={loadingSpinnerTone[variant]} />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
});
