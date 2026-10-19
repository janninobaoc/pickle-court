
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError, logout } from "@/app/lib/auth-api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export function useLogout() {
    const router = useRouter();
    const {
        user,
        status,
        clearAuthenticatedUser,
        setLogoutRedirectPending,
    } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const logoutPendingRef = useRef(false);

    const handleLogout = useCallback(async (): Promise<boolean> => {
        if (logoutPendingRef.current || status !== "authenticated" || !user) {
            return false;
        }

        logoutPendingRef.current = true;
        setIsLoggingOut(true);

        try {
            await logout();

            toast.success("You have been logged out successfully.");

            setLogoutRedirectPending(true);
            clearAuthenticatedUser();

            router.replace("/login");
            router.refresh();

            return true;
        } catch (error) {
            if (error instanceof AuthApiError && error.status === 401) {
                toast.error("Your session could not be verified. Please try again.");

                setLogoutRedirectPending(true);
                clearAuthenticatedUser();
                router.replace("/login");
                router.refresh();

                return true;
            }

            if (error instanceof AuthApiError && error.status === 419) {
                toast.error("Your session expired. Please refresh and try again.");
            } else if (error instanceof AuthApiError) {
                toast.error("Logout failed. Please try again.");
            } else {
                toast.error(
                    "Unable to log out. Please check your connection and try again.",
                );
            }

            return false;
        } finally {
            logoutPendingRef.current = false;
            setIsLoggingOut(false);
        }
    }, [clearAuthenticatedUser, router, status, user, setLogoutRedirectPending]);

    return { isLoggingOut, handleLogout };
}
