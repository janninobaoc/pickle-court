import type { Metadata } from "next";
import Link from "next/link";
import GuestGuard from "@/app/components/auth/guest-guard";
import AuthSplitLayout from "@/app/components/login-page-layout";
import RegisterForm from "@/app/components/register-form";
import { DEFAULT_AUTH_REDIRECT, getSafeReturnTo } from "@/app/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Register | PickleCourt",
  description: "Create your PickleCourt account to explore courts and manage your pickleball bookings.",
};

type RegisterPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const returnTo = getSafeReturnTo(params.returnTo);
  const loginHref = returnTo === DEFAULT_AUTH_REDIRECT
    ? "/login"
    : `/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <GuestGuard returnTo={returnTo}>
      <AuthSplitLayout
        eyebrow="Get Started"
        title="Create your account"
        description="Join PickleCourt and start exploring courts."
        demoNotice="Register for a PickleCourt account to explore courts and manage your bookings."
        footer={<>Already have an account? <Link href={loginHref} className="rounded font-semibold text-[#164A41] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]">Log in</Link></>}
      >
        <RegisterForm returnTo={returnTo} />
      </AuthSplitLayout>
    </GuestGuard>
  );
}
