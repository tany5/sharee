import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "My Account & Orders",
  description:
    "View orders placed from this device, manage your wishlist and reach customer care. Guest checkout — no account required.",
  path: "/account",
});

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mt-8">
        <AccountView />
      </div>
    </div>
  );
}
