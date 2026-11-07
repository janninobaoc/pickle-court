import RecentBookingsTable from "./recent-bookings-table";
import StatCard from "./stat-card";
import Button from "./button";

const stats = [
  { label: "Total Courts", icon: "C" },
  { label: "Total Bookings", icon: "B" },
  { label: "Pending Bookings", icon: "P" },
  { label: "Estimated Revenue", icon: "₱" },
];

export default function AdminDashboardOverview() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section aria-labelledby="dashboard-stats-title">
        <div className="mb-4">
          <h1 id="dashboard-stats-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-muted">A snapshot of your court booking activity.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => <StatCard key={stat.label} {...stat} value="—" detail="Not available yet" />)}
        </div>
        <p className="mt-3 text-xs text-muted">Statistics and revenue estimates are not available yet.</p>
      </section>

      <RecentBookingsTable />

      <section aria-labelledby="quick-actions-title" className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Shortcuts</p>
          <h2 id="quick-actions-title" className="mt-1 text-lg font-bold text-foreground">Quick Actions</h2>
          <p className="mt-1 text-sm text-muted">Open an administration section.</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button href="/admin/courts" variant="secondary">View Courts</Button>
          <Button href="/admin/bookings" variant="secondary">View Bookings</Button>
          <Button href="/admin/customers" variant="secondary">View Customers</Button>
        </div>
      </section>
    </div>
  );
}
