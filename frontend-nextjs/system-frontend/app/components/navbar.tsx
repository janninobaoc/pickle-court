"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
// import { AuthApiError, logout } from "@/app/lib/auth-api";
import { useAuth } from "@/contexts/auth-context";
// import { toast } from "sonner";
import Button from "./button";
import Container from "./container";
import { useLogout } from "@/app/hooks/use-logout";

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, refreshUser } = useAuth();
  const { isLoggingOut, handleLogout } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileControlRef = useRef<HTMLDivElement>(null);
  const retryPendingRef = useRef(false);
  const courtsActive = isRouteActive(pathname, "/courts");

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeMenu();
      menuButtonRef.current?.focus();
    }
  }

  function handleProfileKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setProfileOpen(false);
      profileButtonRef.current?.focus();
    }
  }

  useEffect(() => {
    setProfileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    function handleOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !profileControlRef.current?.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [profileOpen]);

  async function handleNavbarLogout() {
    const success = await handleLogout();

    if (success) {
      setProfileOpen(false);
      closeMenu();
    }
  }

  async function handleRetry() {
    if (retryPendingRef.current || status === "loading") {
      return;
    }

    retryPendingRef.current = true;
    setIsRetrying(true);

    try {
      await refreshUser();
    } finally {
      retryPendingRef.current = false;
      setIsRetrying(false);
    }
  }

  function renderExploreCourts(mobile = false) {
    return (
      <Button
        href="/courts"
        aria-current={courtsActive ? "page" : undefined}
        className={`${mobile ? "mt-1 w-full" : "ml-1"} min-h-11 gap-2 rounded-xl bg-[#C5F277] px-4 text-sm font-bold text-[#164A41] shadow-sm hover:bg-[#d4f695] focus-visible:outline-[#164A41] ${courtsActive ? "ring-2 ring-[#164A41]/20" : ""}`}
        onClick={mobile ? closeMenu : undefined}
      >
        Explore Courts
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </Button>
    );
  }

  function renderGuestLinks(mobile = false) {
    return (
      <div className={mobile ? "grid grid-cols-2 gap-2" : "flex items-center gap-1"}>
        <Link
          href="/login"
          aria-current={isRouteActive(pathname, "/login") ? "page" : undefined}
          onClick={mobile ? closeMenu : undefined}
          className={mobile
            ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-[#164A41] transition-colors hover:bg-[#164A41]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]"
            : `inline-flex min-h-10 items-center rounded-xl px-3 text-sm transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isRouteActive(pathname, "/login") ? "font-semibold text-primary" : "font-medium text-muted"}`}
        >
          Log In
        </Link>
        <Link
          href="/register"
          aria-current={isRouteActive(pathname, "/register") ? "page" : undefined}
          onClick={mobile ? closeMenu : undefined}
          className={mobile
            ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-[#164A41] transition-colors hover:bg-[#164A41]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]"
            : `inline-flex min-h-10 items-center rounded-xl px-3 text-sm transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isRouteActive(pathname, "/register") ? "font-semibold text-primary" : "font-medium text-muted"}`}
        >
          Register
        </Link>
      </div>
    );
  }

  function renderProfileIcon() {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }

  function renderChevron() {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`size-4 transition-transform ${profileOpen ? "rotate-180" : ""}`}>
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    );
  }

  function renderProfileMenu(mobile = false) {
    if (status === "authenticated" && user) {
      if (mobile) {
        return (
          <div className="mt-2 border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-[#164A41]">
              {renderProfileIcon()}
              <span className="truncate">{user.name}</span>
            </div>
            <Link
              href="/bookings"
              aria-current={isRouteActive(pathname, "/bookings") ? "page" : undefined}
              onClick={closeMenu}
              className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#1F2937] transition-colors hover:bg-[#F8FAF7] focus-visible:outline-2 focus-visible:outline-[#164A41]"
            >
              My Bookings
            </Link>
            <button
              type="button"
              onClick={handleNavbarLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Logging out" : "Log out"}
              className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-[#164A41] transition-colors hover:bg-[#F8FAF7] focus-visible:outline-2 focus-visible:outline-[#164A41] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        );
      }

      return (
        <div ref={profileControlRef} onKeyDown={handleProfileKeyDown} className="relative">
          <button
            ref={profileButtonRef}
            type="button"
            aria-expanded={profileOpen}
            aria-controls="desktop-profile-menu"
            aria-label={`Profile menu for ${user.name}`}
            onClick={() => setProfileOpen((open) => !open)}
            className="inline-flex min-h-11 max-w-64 items-center gap-2 rounded-xl border border-[#164A41]/15 bg-white px-3 text-sm font-semibold text-[#164A41] transition-colors hover:bg-[#F8FAF7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]"
          >
            {renderProfileIcon()}
            <span className="max-w-36 truncate">{user.name}</span>
            {renderChevron()}
          </button>
          <div
            id="desktop-profile-menu"
            hidden={!profileOpen}
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#164A41]/10 bg-white p-2 shadow-[0_14px_36px_rgba(22,74,65,0.16)]"
          >
            <Link
              href="/bookings"
              aria-current={isRouteActive(pathname, "/bookings") ? "page" : undefined}
              onClick={() => setProfileOpen(false)}
              className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#1F2937] transition-colors hover:bg-[#F8FAF7] focus-visible:outline-2 focus-visible:outline-[#164A41]"
            >
              My Bookings
            </Link>
            <button
              type="button"
              onClick={handleNavbarLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Logging out" : "Log out"}
              className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-[#164A41] transition-colors hover:bg-[#F8FAF7] focus-visible:outline-2 focus-visible:outline-[#164A41] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      );
    }

    if (status === "unauthenticated") {
      return renderGuestLinks(mobile);
    }

    if (status === "error") {
      return (
        <div className={mobile ? "mt-2 border-t border-border pt-3" : "flex items-center gap-2"}>
          <span role="status" aria-live="polite" className="text-xs text-[#1F2937]">
            Unable to verify your session.
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex min-h-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-[#164A41] hover:bg-[#164A41]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetrying ? "Checking..." : "Retry"}
          </button>
        </div>
      );
    }

    return (
      <span role="status" aria-live="polite" className="inline-flex items-center gap-2 px-3 text-xs text-[#1F2937]">
        <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-[#C5F277]" />
        Checking session...
      </span>
    );
  }

  return (
    <header className="sticky top-0 z-30 bg-background/90 px-3 pt-3 pb-3 backdrop-blur sm:px-4 sm:pt-4 sm:pb-4">
      <Container className="relative">
        <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border/90 bg-white px-3 shadow-[0_8px_28px_rgba(22,74,65,0.09)] sm:px-5 lg:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-xl"
            aria-label="PickleCourt home"
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={closeMenu}
          >
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/70 bg-white">
              <Image src="/img/logo.png" alt="" width={40} height={40} priority className="size-full object-contain" />
            </span>
            PickleCourt
          </Link>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {renderProfileMenu()}
            <nav aria-label="Primary navigation">
              {renderExploreCourts()}
            </nav>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            onKeyDown={handleMenuKeyDown}
            className="absolute left-4 right-4 top-[calc(100%+0.5rem)] z-40 rounded-2xl border border-border bg-white p-3 shadow-[0_14px_36px_rgba(22,74,65,0.14)] md:hidden"
          >
            <div className="flex flex-col gap-1">
              {renderExploreCourts(true)}
              {renderProfileMenu(true)}
            </div>
          </nav>
        )}
      </Container>
    </header>
  );
}
