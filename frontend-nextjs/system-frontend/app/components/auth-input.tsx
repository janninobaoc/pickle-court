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
  const accessibleFieldName = label.trim().toLowerCase() === "confirm password"
    ? "confirm password"
    : "password";

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
          className={`${inputStyles} pr-14 ${error ? "border-[#DC2626] hover:border-[#DC2626] focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20" : ""}`}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${accessibleFieldName}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-[#164A41] transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {visible ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.5c5.5 0 9.5 7.5 9.5 7.5a15.5 15.5 0 0 1-4.2 4.9" />
              <path d="M6.6 6.6A15.5 15.5 0 0 0 2.5 12s4 7.5 9.5 7.5a10.9 10.9 0 0 0 5.4-1.4" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M2.5 12s3.5-7.5 9.5-7.5 9.5 7.5 9.5 7.5-3.5 7.5-9.5 7.5-9.5-7.5-9.5-7.5Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error && <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-[#DC2626]">{error}</p>}
    </div>
  );
}
