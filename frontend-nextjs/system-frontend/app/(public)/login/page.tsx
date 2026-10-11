import type { Metadata } from "next";
import Link from "next/link";
import AuthSplitLayout from "@/app/components/login-page-layout";
import LoginForm from "@/app/components/login-form";

export const metadata: Metadata = {
  title: "Login | PickleCourt",
  description: "Log in to PickleCourt. Demo interface only; authentication is not connected.",
};

export default function LoginPage() {
  return (
    <AuthSplitLayout
      eyebrow="Welcome Back"
      title="Log in to your account"
      description="Enter your details to continue."
      demoNotice="Log in to your PickleCourt account to explore courts and manage your bookings."
      footer={<>Don&apos;t have an account? <Link href="/register" className="rounded font-semibold text-[#164A41] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]">Sign up</Link></>}
    >
      <LoginForm />
    </AuthSplitLayout>
  );
}
