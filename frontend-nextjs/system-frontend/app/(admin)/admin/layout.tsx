import AdminShell from "@/app/components/admin-shell";
import AdminGuard from "@/app/components/auth/admin-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  )
}
