import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-control border-[1.5px] border-border bg-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-muted",
        "transition-colors duration-150",
        "focus:border-primary focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-primary/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
