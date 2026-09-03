import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { DEMO_ADMIN } from "@/lib/demo/db";
import { AdminLogin } from "@/components/admin/admin-login";
import { isDemoMode } from "@/lib/site";

export const metadata: Metadata = { title: "Admin Sign In | Ambika" };

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user?.role === "admin") redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <AdminLogin demoHint={isDemoMode() ? DEMO_ADMIN : undefined} />
    </main>
  );
}
