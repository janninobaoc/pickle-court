import type { Metadata } from "next";
import Link from "next/link";
import AuthSplitLayout from "@/app/components/login-page-layout";
import RegisterForm from "@/app/components/register-form";

export const metadata: Metadata = {
  title: "Register | PickleCourt",
  description: "Create your PickleCourt account to explore courts and manage your pickleball bookings.",
};

export default function RegisterPage() {
  return (
    <AuthSplitLayout
      eyebrow="Get Started"
      title="Create your account"
      description="Join PickleCourt and start exploring courts."
      demoNotice="Register for a PickleCourt account to explore courts and manage your bookings."
      footer={<>Already have an account? <Link href="/login" className="rounded font-semibold text-[#164A41] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]">Log in</Link></>}
    >
      <RegisterForm />
    </AuthSplitLayout>
  );
}
