"use client";

import { useState, type ChangeEventHandler } from "react";

type SharedFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  autoComplete: string;
  error?: string;
  placeholder?: string;
};

type AuthInputProps = SharedFieldProps & { inputType?: "text" | "email" };

const inputStyles =
  "min-h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted/70 hover:border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export function AuthInput({
  id,
  label,
  inputType = "text",
  value,
  onChange,
  autoComplete,
  error,
  placeholder,
}: AuthInputProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
      <input
        id={id}
        name={id}
        type={inputType}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`${inputStyles} mt-2 ${error ? "border-[#DC2626] hover:border-[#DC2626] focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20" : ""}`}
      />
      {error && <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-[#DC2626]">{error}</p>}
    </div>
  );
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  placeholder,
}: SharedFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${inputStyles} pr-20 ${error ? "border-[#DC2626] hover:border-[#DC2626] focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20" : ""}`}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-2 my-auto min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-[#DC2626]">{error}</p>}
    </div>
  );
}
