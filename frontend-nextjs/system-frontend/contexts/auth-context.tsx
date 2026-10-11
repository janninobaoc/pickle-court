
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentUser,
  invalidateCurrentUserRequest,
  type AuthUser,
} from "@/app/lib/auth-api";

type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  setAuthenticatedUser: (user: AuthUser) => void;
  clearAuthenticatedUser: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);

  const setAuthenticatedUser = useCallback((user: AuthUser) => {
    requestGenerationRef.current += 1;
    invalidateCurrentUserRequest();
    setUser(user);
    setStatus("authenticated");
  }, []);

  const clearAuthenticatedUser = useCallback(() => {
    requestGenerationRef.current += 1;
    invalidateCurrentUserRequest();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current;
    setStatus("loading");

    try {
      const currentUser = await getCurrentUser();

      if (
        !mountedRef.current ||
        requestGeneration !== requestGenerationRef.current
      ) {
        return;
      }

      if (currentUser) {
        setUser(currentUser);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      // A network failure does not prove the user logged out.
      if (
        mountedRef.current &&
        requestGeneration === requestGenerationRef.current
      ) {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshUser();

    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        setAuthenticatedUser,
        clearAuthenticatedUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
