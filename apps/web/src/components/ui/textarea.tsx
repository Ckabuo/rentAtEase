import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[6.5rem] w-full resize-y rounded-control border-[1.5px] border-border bg-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-muted",
        "transition-colors duration-150",
        "focus:border-primary focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-primary/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
