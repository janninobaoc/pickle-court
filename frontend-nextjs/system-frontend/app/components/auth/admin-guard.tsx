"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

type AdminGuardProps = {
  children: React.ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, status, refreshUser, logoutRedirectPending } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      if (logoutRedirectPending) {
        return;
      }

      const returnTo = encodeURIComponent(pathname || "/admin");
      router.replace(`/login?returnTo=${returnTo}`);
    }

    if (status === "authenticated" && user?.role !== "admin") {
      router.replace("/courts");
    }
  }, [status, user, pathname, router, logoutRedirectPending]);

  if (status === "loading") {
    return <p>Checking administrator access...</p>;
  }

  if (status === "error") {
    return (
      <div>
        <p>Unable to verify your session.</p>
        <button type="button" onClick={() => void refreshUser()}>
          Retry
        </button>
      </div>
    );
  }

  if (status !== "authenticated" || user?.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}