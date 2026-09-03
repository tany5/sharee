import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AdminLogin } from "@/components/admin/admin-login";
import { demoAdminHint, isSupabaseBackend } from "@/lib/backend";

export const metadata: Metadata = { title: "Admin Sign In | Ambika" };

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user?.role === "admin") redirect("/admin");

  const demoHint = await demoAdminHint();
  const note = isSupabaseBackend()
    ? "Sign in with a Supabase account. The first account created on this project automatically becomes the admin."
    : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <AdminLogin demoHint={demoHint} note={note} />
    </main>
  );
}
