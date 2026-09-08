"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Clapperboard,
  ExternalLink,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Tags,
  Users,
  X,
} from "lucide-react";
import { cx } from "@/lib/utils";
import { ToastProvider } from "@/components/admin/toast";

const NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Saree Models", href: "/admin/models", icon: Images },
  { label: "Marketing Studio", href: "/admin/marketing", icon: Clapperboard },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Customers", href: "/admin/customers", icon: Users },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function AdminShell({
  userName,
  email,
  children,
}: {
  userName: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 pb-6">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-[#f6ebd9]/12 text-[#f6ebd9]"
                : "text-[#e2c9a6] hover:bg-white/5 hover:text-[#f6ebd9]",
            )}
          >
            <item.icon size={17} />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/"
        target="_blank"
        className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#e2c9a6] transition-colors hover:bg-white/5 hover:text-[#f6ebd9]"
      >
        <ExternalLink size={16} /> View store
      </Link>
    </nav>
  );

  return (
    <ToastProvider>
    <div className="min-h-dvh bg-bg text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#2b1608] lg:flex">
        <div className="px-5 py-6">
          <Link href="/admin" className="block w-fit">
            <Image
              src="/logo/logo-light.webp"
              alt="TheTanti Admin"
              width={200}
              height={90}
              className="h-auto w-[136px] object-contain"
            />
          </Link>
        </div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#2b1608]">
            <div className="flex items-center justify-between px-5 py-5">
              <Image
                src="/logo/logo-light.webp"
                alt="TheTanti Admin"
                width={200}
                height={90}
                className="h-auto w-[116px] object-contain"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#e2c9a6] hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:pl-[268px]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink2 hover:bg-accent/15 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="hidden text-sm font-bold uppercase tracking-[0.16em] text-muted sm:block">
          Store operations
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-bold leading-tight text-ink">{userName}</p>
            <p className="text-xs text-muted">{email}</p>
          </div>
          <span className="mx-1 h-8 w-px bg-line" />
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-ink2 transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:pl-[268px] lg:pr-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
    </ToastProvider>
  );
}
