"use client";

type AdminHeaderProps = { onMenuClick: () => void };

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open admin navigation"
          aria-controls="admin-sidebar"
          className="grid size-10 place-items-center rounded-xl border border-border text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div>
          <p className="text-xs font-medium text-muted">PickleCourt admin</p>
          <p className="font-semibold text-foreground">Overview</p>
        </div>
      </div>
      <span className="rounded-full border border-accent/70 bg-[#f3f8e9] px-3 py-1.5 text-xs font-semibold text-primary">Administration</span>
    </header>
  );
}
