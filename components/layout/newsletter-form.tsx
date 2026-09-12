"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site";

/**
 * Newsletter capture. The store has no subscriber backend, so this hands the
 * address to the owner's mailbox (mailto:) rather than showing a fake
 * "subscribed!" state — the hint below the field says so plainly.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
            "Newsletter signup",
          )}&body=${encodeURIComponent(`Please add ${email.trim()} to the newsletter list.`)}`;
        }}
        className="flex items-center gap-2 rounded-pill border border-white/15 bg-white/[0.06] p-1 pl-4 focus-within:border-accent"
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Your email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-[#f7f1e8] placeholder:text-[#9e8f83] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Subscribe to the newsletter"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent text-white transition-colors hover:bg-accent-light"
        >
          <ArrowRight size={16} />
        </button>
      </form>
      <p className="mt-2 text-[11px] leading-4 text-[#9e8f83]">
        Opens your email app so we can add you to the list.
      </p>
    </div>
  );
}
