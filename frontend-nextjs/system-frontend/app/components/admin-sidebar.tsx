"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout } from "@/app/hooks/use-logout";

const adminLinks = [
  { label: "Overview", href: "/admin", icon: "overview" },
  { label: "Courts", href: "/admin/courts", icon: "courts" },
  { label: "Bookings", href: "/admin/bookings", icon: "bookings" },
  { label: "Customers", href: "/admin/customers", icon: "customers" },
] as const;

function SidebarIcon({ icon }: { icon: (typeof adminLinks)[number]["icon"] }) {
  const iconPaths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    courts: <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M12 4v16M3 12h18" /></>,
    bookings: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
    customers: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M16 5.5a3 3 0 0 1 0 5.8M17 14h.5a4 4 0 0 1 4 4v2" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      {iconPaths[icon]}
    </svg>
  );
}

type AdminSidebarProps = { mobileOpen: boolean; onNavigate: () => void };

export default function AdminSidebar({ mobileOpen, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const { isLoggingOut, handleLogout } = useLogout();

  async function handleAdminLogout() {
    const success = await handleLogout();

    if (success) {
      onNavigate?.();
    }
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close admin navigation"
          onClick={onNavigate}
          className="fixed inset-0 z-30 cursor-default bg-black/40 md:hidden"
        />
      )}
      <aside
        id="admin-sidebar"
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-white/10 bg-[#123c35] text-white shadow-xl transition-transform duration-200 md:flex md:translate-x-0 md:shadow-none ${mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full"}`}
      >
        <div className="flex min-h-20 items-center justify-between border-b border-white/10 px-6">
          <Link href="/admin" onClick={onNavigate} className="rounded text-lg font-bold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            PickleCourt <span className="ml-1 text-xs font-medium text-accent">ADMIN</span>
          </Link>
          <button type="button" onClick={onNavigate} aria-label="Close admin navigation" className="grid size-10 place-items-center rounded-lg text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent md:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Admin sections" className="space-y-1 px-3 py-5">
          {adminLinks.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "bg-accent text-primary" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <SidebarIcon icon={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={handleAdminLogout}
            disabled={isLoggingOut}
            aria-label={isLoggingOut ? "Logging out" : "Log out"}
            className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
          <p className="border-t border-white/10 px-6 py-5 text-xs leading-5 text-white/60">Demo workspace<br />Access restrictions are not enabled.</p>
        </div>
      </aside>
    </>
  );
}
