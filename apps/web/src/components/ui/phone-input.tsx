import { forwardRef } from "react";
import { NIGERIAN_PHONE_LENGTH, normalizeNigerianPhoneInput } from "@rae/domain";
import { Input, type InputProps } from "@/components/ui/input";

export type PhoneInputProps = Omit<InputProps, "value" | "onChange" | "inputMode" | "maxLength"> & {
  value: string;
  onChange: (value: string) => void;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, placeholder = "08030000000", ...props },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={NIGERIAN_PHONE_LENGTH}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(normalizeNigerianPhoneInput(event.target.value))}
      {...props}
    />
  );
});
