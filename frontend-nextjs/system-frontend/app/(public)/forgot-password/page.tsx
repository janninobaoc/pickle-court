import type { Metadata } from "next";
import AuthFormLayout from "@/app/components/auth-form-layout";
import Button from "@/app/components/button";

export const metadata: Metadata = {
  title: "Password Recovery | PickleCourt",
  description: "Password recovery is not available yet.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFormLayout
      title="Password recovery"
      description="Password recovery is not available yet."
      footer={<span>PickleCourt</span>}
    >
      <div className="rounded-xl border border-accent/60 bg-[#f3f8e9] p-4 text-sm leading-6 text-primary">
        This is an informational page only. No reset email will be sent and no password changes can be made.
      </div>
      <Button href="/login" variant="secondary" className="mt-5 w-full">Back to Login</Button>
    </AuthFormLayout>
  );
}
