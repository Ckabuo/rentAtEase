"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

const LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function OtpInput({ value, onChange, disabled, id, className }: OtpInputProps) {
  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (index: number, char: string) => {
    const next = digits.map((d, i) => (i === index ? char : d === " " ? "" : d));
    const joined = next.join("").replace(/\s/g, "").slice(0, LENGTH);
    onChange(joined);
    if (char && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, LENGTH - 1);
    refs.current[focusIndex]?.focus();
  };

  return (
    <div
      id={id}
      className={cn("grid w-full grid-cols-6 gap-2 sm:gap-3", className)}
      role="group"
      aria-label="One-time code"
    >
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digits[index] === " " ? "" : digits[index]}
          onChange={(event) => {
            const v = event.target.value.replace(/\D/g, "").slice(-1);
            setDigit(index, v);
          }}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          className={cn(
            "aspect-square w-full min-w-0 rounded-control border-[1.5px] border-border bg-cream text-center text-lg font-bold text-ink",
            "focus:border-primary focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-primary/15",
            "disabled:opacity-60",
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
