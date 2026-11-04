
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
        } catch (error) {
            if (error instanceof AuthApiError) {
                if (error.status === 401) {
                    toast.error("You were signed out locally because the token could not be verified.");
                } else if (error.status === 403) {
                    toast.error("You were signed out locally, but the server denied the logout request.");
                } else if (error.status === 0) {
                    toast.error("You were signed out locally, but server-side token revocation could not be confirmed. Please check your connection.");
                } else {
                    toast.error("You were signed out locally, but the server did not confirm token revocation.");
                }
            } else {
                toast.error(
                    "You were signed out locally, but server-side token revocation could not be confirmed. Please check your connection.",
                );
            }
        } finally {
            setLogoutRedirectPending(true);
            clearAuthenticatedUser();
            router.replace("/login");
            router.refresh();
            logoutPendingRef.current = false;
            setIsLoggingOut(false);
        }

        return true;
    }, [clearAuthenticatedUser, router, status, user, setLogoutRedirectPending]);

    return { isLoggingOut, handleLogout };
}
