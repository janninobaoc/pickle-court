"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getSafeReturnTo } from "@/app/lib/auth-redirect";

export default function GuestGuard({
  children,
  returnTo,
}: {
  children: ReactNode;
  returnTo?: string;
}) {
  const router = useRouter();
  const { status, refreshUser } = useAuth();
  const redirectStartedRef = useRef(false);
  const retryPendingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      if (!redirectStartedRef.current) {
        redirectStartedRef.current = true;
        router.replace(getSafeReturnTo(returnTo));
      }
      return;
    }

    redirectStartedRef.current = false;
  }, [router, returnTo, status]);

  async function handleRetry() {
    if (retryPendingRef.current || status !== "error") return;

    retryPendingRef.current = true;
    setIsRetrying(true);

    try {
      await refreshUser();
    } finally {
      retryPendingRef.current = false;
      setIsRetrying(false);
    }
  }

  if (status === "authenticated" || status === "loading") {
    return (
      <main className="flex min-h-[50vh] flex-1 items-center justify-center px-4 py-12">
        <p role="status" aria-live="polite" className="inline-flex items-center gap-3 text-sm font-medium text-[#1F2937]">
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[#164A41]/20 border-t-[#164A41] motion-reduce:animate-none" />
          {status === "authenticated" ? "Redirecting..." : "Checking your session..."}
        </p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-[50vh] flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-2xl border border-[#164A41]/10 bg-white p-6 text-center shadow-soft sm:p-8">
          <p role="status" aria-live="polite" className="text-sm leading-6 text-[#1F2937]">
            Unable to verify your session.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#164A41] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#123D36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {isRetrying ? "Checking..." : "Retry"}
          </button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
