import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { utilityMetadata } from "@/lib/meta";

export const metadata: Metadata = utilityMetadata({
  title: "My Wishlist",
  description:
    "Sarees you've saved for later — every one still just ₹199. Add them to your cart whenever you're ready.",
  path: "/wishlist",
});

export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl text-ink sm:text-4xl">My Wishlist</h1>
      <p className="mt-1.5 text-sm text-ink2">
        Saved on this device — no account needed.
      </p>
      <div className="mt-8">
        <WishlistView />
      </div>
    </div>
  );
}
