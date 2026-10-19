import type { Metadata } from "next";
import Link from "next/link";
import GuestGuard from "@/app/components/auth/guest-guard";
import AuthSplitLayout from "@/app/components/login-page-layout";
import LoginForm from "@/app/components/login-form";
import { DEFAULT_AUTH_REDIRECT, getSafeReturnTo } from "@/app/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Login | PickleCourt",
  description: "Log in to PickleCourt to continue to your courts and bookings.",
};

type LoginPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawReturnTo = params.returnTo;
  const safeReturnTo = getSafeReturnTo(rawReturnTo);
  const registerHref = safeReturnTo === DEFAULT_AUTH_REDIRECT
    ? "/register"
    : `/register?returnTo=${encodeURIComponent(safeReturnTo)}`;

  return (
    <GuestGuard returnTo={rawReturnTo}>
      <AuthSplitLayout
        eyebrow="Welcome Back"
        title="Log in to your account"
        description="Enter your details to continue."
        demoNotice="Log in to your PickleCourt account to explore courts and manage your bookings."
        footer={<>Don&apos;t have an account? <Link href={registerHref} className="rounded font-semibold text-[#164A41] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]">Sign up</Link></>}
      >
        <LoginForm returnTo={rawReturnTo} />
      </AuthSplitLayout>
    </GuestGuard>
  );
}
