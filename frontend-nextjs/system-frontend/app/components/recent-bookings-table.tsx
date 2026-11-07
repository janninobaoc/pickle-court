export default function RecentBookingsTable() {
  return (
    <section aria-labelledby="recent-bookings-title" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Latest activity</p>
        <h2 id="recent-bookings-title" className="mt-1 text-lg font-bold text-foreground">Recent Bookings</h2>
      </div>
      <p className="px-5 py-8 text-sm text-muted sm:px-6">
        Recent booking activity is not available yet.
      </p>
    </section>
  );
}
