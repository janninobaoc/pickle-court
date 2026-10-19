"use client";

import { useState, type FormEvent } from "react";
import Button from "./button";
import { AuthInput, PasswordInput } from "./auth-input";
import { useRouter } from "next/navigation";
import {
  AuthApiError,
  login,
  type LoginPayload,
  type ValidationErrors,
} from "@/app/lib/auth-api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { getRoleAwareAuthRedirect } from "@/app/lib/auth-redirect";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm({ returnTo }: { returnTo?: string | string[]; }) {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<ValidationErrors>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // const [rememberMe, setRememberMe] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError =
    (submitted
      ? !email.trim()
        ? "Email is required."
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
          ? "Enter a valid email address."
          : ""
      : "") ||
    apiErrors.email?.[0] ||
    "";

  const passwordError =
    (submitted && !password
      ? "Password is required."
      : "") ||
    apiErrors.password?.[0] ||
    "";


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) return;

    setSubmitted(true);
    setApiErrors({});

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!validEmail.test(email.trim()) || !password) {
      return;
    }

    const payload: LoginPayload = {
      email: email.trim(),
      password,
    };

    setIsSubmitting(true);

    try {
      const response = await login(payload);
      const destination = getRoleAwareAuthRedirect(
        returnTo,
        response.user.role
      );


      setAuthenticatedUser(response.user);
      router.replace(destination);
      toast.success("Welcome back to PickleCourt!");
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 422) {
          setApiErrors(error.errors);

          if (Object.keys(error.errors).length === 0) {
            toast.error(error.message || "Please check your login details.");
          }
        } else if (error.status === 401) {
          toast.error("Invalid email or password.");
        } else if (error.status === 419) {
          toast.error("Your session expired. Please try again.");
        } else {
          toast.error("Login failed. Please try again.");
        }
      } else {
        toast.error("Unable to connect. Please check your internet connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          id="login-email"
          label="Email address"
          placeholder="you@example.com"
          inputType="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setApiErrors((previous) => ({
              ...previous,
              email: [],
            }));
          }}
          autoComplete="email"
          error={emailError}
        />
        <PasswordInput
          id="login-password"
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setApiErrors((previous) => ({
              ...previous,
              password: [],
            }));
          }}
          autoComplete="current-password"
          error={passwordError}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Logging in..." : "Log In"}
        </Button>
      </form>
    </>
  );
}
