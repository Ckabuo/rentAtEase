import { type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label
      className={cn("mb-1.5 block font-heading text-xs font-bold uppercase tracking-widest text-muted", className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
    </label>
  );
}
