"use client";

import { useState, type FormEvent } from "react";
import Button from "./button";
import { AuthInput, PasswordInput } from "./auth-input";
import { useRouter } from "next/navigation";
import {
  AuthApiError,
  register,
  type RegisterPayload,
} from "@/app/lib/auth-api";
import { mapRegistrationErrors, type RegistrationFieldErrors } from "@/app/lib/register-validation";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { getSafeReturnTo } from "@/app/lib/auth-redirect";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<RegistrationFieldErrors>({});
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // const [demoMessage, setDemoMessage] = useState("");

  const fullNameError =
    (submitted && !fullName.trim() ? "Full name is required." : "") ||
    apiErrors.name ||
    "";
  const emailError =
    (submitted && !email.trim()
      ? "Email address is required."
      : submitted && !validEmail.test(email.trim())
        ? "Please enter a valid email address."
        : "") || apiErrors.email || "";

  const passwordError =
    (submitted && !password
      ? "Password is required."
      : submitted && password.length < 8
      ? "Password must be at least 8 characters."
      : "") || apiErrors.password || "";

  const confirmPasswordError =
    (submitted && !confirmPassword
      ? "Please confirm your password."
      : submitted && password !== confirmPassword
        ? "Passwords do not match."
        : "") ||
    apiErrors.password_confirmation ||
    "";

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) return;

    setSubmitted(true);
    setApiErrors({});

    if (
      !fullName.trim() ||
      !validEmail.test(email.trim()) ||
      !password ||
      password.length < 8 ||
      !confirmPassword ||
      password !== confirmPassword
    ) {
      return;
    }

    const payload: RegisterPayload = {
      name: fullName.trim(),
      email: email.trim(),
      password,
      password_confirmation: confirmPassword,
    };

    setIsSubmitting(true);

    try {
      const response = await register(payload);

      setAuthenticatedUser(response.user);
      toast.success("Welcome to PickleCourt! Your account has been created successfully.");

      router.replace(getSafeReturnTo(returnTo));
      router.refresh();
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 422) {
          const fieldErrors = mapRegistrationErrors(error.errors);
          setApiErrors(fieldErrors);

          if (!Object.values(fieldErrors).some(Boolean)) {
            toast.error(error.message || "Please check your registration details.");
          }
        } else if (error.status === 419) {
          toast.error("Your session expired. Please refresh and try again.");
        } else {
          toast.error("Registration failed. Please try again.");
        }
      } else {
        toast.error("Unable to connect. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="register-name"
          label="Full Name"
          placeholder="Enter your full name"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            setApiErrors((previous) => ({
              ...previous,
              name: "",
            }));
          }}
          autoComplete="name"
          error={fullNameError}
        />
        <AuthInput
          id="register-email"
          label="Email Address"
          placeholder="you@example.com"
          inputType="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setApiErrors((previous) => ({
              ...previous,
              email: "",
            }));
          }}
          autoComplete="email"
          error={emailError}
        />
        <PasswordInput
          id="register-password"
          label="Password"
          placeholder="Create a password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setApiErrors((previous) => ({
              ...previous,
              password: "",
              password_confirmation: "",
            }));
          }}
          autoComplete="new-password"
          error={passwordError}
        />
        <PasswordInput
          id="register-confirm-password"
          label="Confirm Password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setApiErrors((previous) => ({
              ...previous,
              password: "",
              password_confirmation: "",
            }));
          }}
          autoComplete="new-password"
          error={confirmPasswordError}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </>
  );
}
