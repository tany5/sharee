import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = { title: "Admin | Ambika" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  return (
    <AdminShell userName={user.name} email={user.email}>
      {children}
    </AdminShell>
  );
}
